const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { CrashWalletProcessor } = require('../src/components/crash/crashWallet.ts');

const projectRoot = path.resolve(__dirname, '..');
const betIdentity = { gameId: 'crash', roundId: '1', betId: '1' };

function createWallet(balance = 1000, updateBalance) {
  let currentBalance = balance;
  const processor = new CrashWalletProcessor({
    getBalance: () => currentBalance,
    updateBalance: (amount) => {
      const result = updateBalance ? updateBalance(amount) : true;
      if (result !== false) currentBalance = amount;
      return result;
    },
  });
  return { processor, getBalance: () => currentBalance };
}

function createEmbeddedBridge() {
  const sent = [];
  const listeners = new Map();
  const hostWindow = {
    setTimeout,
    clearTimeout,
    addEventListener: (name, callback) => listeners.set(name, callback),
    parent: null,
    ReactNativeWebView: { postMessage: (value) => sent.push(JSON.parse(value)) },
  };
  hostWindow.parent = hostWindow;
  const source = fs.readFileSync(path.join(projectRoot, 'src/components/crash/web-src/wallet-bridge.js'), 'utf8');
  vm.runInNewContext(source, { window: hostWindow, Date, Math, Map, Set, Promise, Number, Error, JSON });
  return { bridge: hostWindow.AviatorWalletBridge, receive: hostWindow.__onexWalletReceive, sent };
}

test('le bridge demande le solde hôte et résout la réponse postMessage', async () => {
  const { bridge, receive, sent } = createEmbeddedBridge();
  const resultPromise = bridge.getBalance();
  const request = sent.at(-1);
  assert.equal(request.type, 'wallet_request');
  assert.equal(request.operation, 'getBalance');
  receive({ type: 'wallet_response', id: request.id, ok: true, snapshot: { amount: 1250, currency: 'XAF' } });
  const snapshot = await resultPromise;
  assert.equal(snapshot.amount, 1250);
  assert.equal(snapshot.currency, 'XAF');
});

test('le bridge relaie débit, activation, encaissement et mise à jour du solde', async () => {
  const { bridge, receive, sent } = createEmbeddedBridge();
  const updates = [];
  bridge.subscribe((snapshot) => updates.push(snapshot.amount));
  const debitPromise = bridge.debit({ requestId: 'stake:session:1:1', amount: 400, ...betIdentity });
  const debit = sent.at(-1);
  assert.equal(debit.operation, 'debit');
  assert.equal(debit.payload.amount, 400);
  receive({ type: 'wallet_response', id: debit.id, ok: true, snapshot: { amount: 600 } });
  assert.equal((await debitPromise).amount, 600);

  const activatePromise = bridge.activateBet({ requestId: 'activate:session:1:1', ...betIdentity });
  const activation = sent.at(-1);
  assert.equal(activation.operation, 'activateBet');
  receive({ type: 'wallet_response', id: activation.id, ok: true, snapshot: { amount: 600 } });
  await activatePromise;

  const creditPromise = bridge.credit({
    requestId: 'cashout:session:1:1:2.00', amount: 800, betAmount: 400, multiplier: 2, ...betIdentity,
  });
  const credit = sent.at(-1);
  assert.equal(credit.operation, 'credit');
  receive({ type: 'wallet_response', id: credit.id, ok: true, snapshot: { amount: 1400 } });
  assert.equal((await creditPromise).amount, 1400);
  receive({ type: 'wallet_update', snapshot: { amount: 1500 } });
  assert.equal(updates.at(-1), 1500);
});

test('le bridge relaie la clôture de perte sans exiger un montant fictif', async () => {
  const { bridge, receive, sent } = createEmbeddedBridge();
  const lossPromise = bridge.settleLoss({ requestId: 'loss:session:1:1', ...betIdentity });
  const loss = sent.at(-1);
  assert.equal(loss.operation, 'settleLoss');
  assert.equal(Object.prototype.hasOwnProperty.call(loss.payload, 'amount'), false);
  receive({ type: 'wallet_response', id: loss.id, ok: true, snapshot: { amount: 600 } });
  assert.equal((await lossPromise).amount, 600);
});

test('le bridge ne crée aucun solde simulé et renvoie les erreurs hôte au jeu', async () => {
  const source = fs.readFileSync(path.join(projectRoot, 'src/components/crash/web-src/wallet-bridge.js'), 'utf8');
  assert.doesNotMatch(source, /mockBalance|simulatedBalance|5428311/);
  const { bridge, receive, sent } = createEmbeddedBridge();
  const pending = bridge.debit({ requestId: 'stake:insufficient', amount: 400, ...betIdentity });
  const request = sent.at(-1);
  receive({ type: 'wallet_response', id: request.id, ok: false, error: 'Solde insuffisant.' });
  await assert.rejects(pending, /Solde insuffisant/);
  bridge.exit();
  assert.equal(sent.at(-1).type, 'exit');
});

test('le portefeuille partage le solde, débite une mise idempotente et refuse un solde insuffisant', async () => {
  const wallet = createWallet(1000);
  const stake = {
    operation: 'debit',
    payload: { requestId: 'stake:once', amount: 400, ...betIdentity },
  };
  assert.equal((await wallet.processor.process(stake)).amount, 600);
  assert.equal((await wallet.processor.process(stake)).amount, 600);
  assert.equal(wallet.getBalance(), 600);
  await assert.rejects(wallet.processor.process({
    operation: 'debit',
    payload: { requestId: 'stake:too-much', amount: 700, gameId: 'crash', roundId: '2', betId: '1' },
  }), /Solde insuffisant/);
  assert.equal(wallet.getBalance(), 600);
});

test('un crédit doit suivre une mise activée et correspondre à son gain exact', async () => {
  const wallet = createWallet(1000);
  await wallet.processor.process({
    operation: 'debit',
    payload: { requestId: 'stake:valid', amount: 400, ...betIdentity },
  });
  await assert.rejects(wallet.processor.process({
    operation: 'credit',
    payload: {
      requestId: 'cashout:before-flight', amount: 800, betAmount: 400, multiplier: 2, ...betIdentity,
    },
  }), /Aucune mise active/);
  await wallet.processor.process({
    operation: 'activateBet',
    payload: { requestId: 'activate:valid', ...betIdentity },
  });
  await assert.rejects(wallet.processor.process({
    operation: 'credit',
    payload: {
      requestId: 'cashout:forged', amount: 3000, betAmount: 400, multiplier: 2, ...betIdentity,
    },
  }), /Montant de gain incohérent/);
  const validCredit = {
    operation: 'credit',
    payload: {
      requestId: 'cashout:valid', amount: 800, betAmount: 400, multiplier: 2, ...betIdentity,
    },
  };
  assert.equal((await wallet.processor.process(validCredit)).amount, 1400);
  assert.equal((await wallet.processor.process(validCredit)).amount, 1400);
  await assert.rejects(wallet.processor.process({
    operation: 'credit',
    payload: {
      requestId: 'cashout:replay', amount: 800, betAmount: 400, multiplier: 2, ...betIdentity,
    },
  }), /Aucune mise active/);
  assert.equal(wallet.getBalance(), 1400);
});

test('une perte clôt la mise et empêche un encaissement différé', async () => {
  const wallet = createWallet(1000);
  await wallet.processor.process({
    operation: 'debit',
    payload: { requestId: 'stake:lost', amount: 400, ...betIdentity },
  });
  await wallet.processor.process({
    operation: 'activateBet',
    payload: { requestId: 'activate:lost', ...betIdentity },
  });
  assert.equal(wallet.getBalance(), 600);
  await wallet.processor.process({
    operation: 'settleLoss',
    payload: { requestId: 'loss:closed', ...betIdentity },
  });
  await assert.rejects(wallet.processor.process({
    operation: 'credit',
    payload: {
      requestId: 'cashout:after-loss', amount: 1000, betAmount: 400, multiplier: 2.5, ...betIdentity,
    },
  }), /Aucune mise active/);
  assert.equal(wallet.getBalance(), 600);
});

test('quitter le jeu rembourse les mises en attente et clôt les mises déjà parties', async () => {
  const wallet = createWallet(1000);
  await wallet.processor.process({
    operation: 'debit',
    payload: { requestId: 'stake:queued', amount: 400, gameId: 'crash', roundId: '2', betId: '1' },
  });
  await wallet.processor.process({
    operation: 'debit',
    payload: { requestId: 'stake:live', amount: 400, gameId: 'crash', roundId: '2', betId: '2' },
  });
  await wallet.processor.process({
    operation: 'activateBet',
    payload: { requestId: 'activate:live', gameId: 'crash', roundId: '2', betId: '2' },
  });
  assert.equal(wallet.getBalance(), 200);
  assert.equal((await wallet.processor.closeOpenBets()).amount, 600);
  await assert.rejects(wallet.processor.process({
    operation: 'credit',
    payload: {
      requestId: 'cashout:after-exit', amount: 800, betAmount: 400, multiplier: 2,
      gameId: 'crash', roundId: '2', betId: '2',
    },
  }), /Aucune mise active/);
  assert.equal(wallet.getBalance(), 600);
});

test('le portefeuille refuse un débit si l’écriture du solde échoue', async () => {
  const wallet = createWallet(1000, () => false);
  await assert.rejects(wallet.processor.process({
    operation: 'debit',
    payload: { requestId: 'stake:db-failure', amount: 400, ...betIdentity },
  }), /solde n’a pas pu être enregistré/);
  assert.equal(wallet.getBalance(), 1000);
});

test('deux mises simultanées sont sérialisées sans faire passer le solde sous zéro', async () => {
  const wallet = createWallet(600);
  const requests = ['stake:a', 'stake:b'].map((requestId, index) => wallet.processor.process({
    operation: 'debit',
    payload: {
      requestId, amount: 400, gameId: 'crash', roundId: '3', betId: String(index + 1),
    },
  }));
  const results = await Promise.allSettled(requests);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(wallet.getBalance(), 200);
});


test('le bridge relaie une cible BotX au jeu sans l’interpréter comme une transaction', () => {
  const { bridge, receive } = createEmbeddedBridge();
  const received = [];
  const unsubscribe = bridge.onCrashTarget((command) => received.push(command));
  receive({ type: 'bot_crash_target', commandId: 'botx-crash-42', target: 3.15 });
  assert.equal(received.length, 1);
  assert.equal(received[0].type, 'bot_crash_target');
  assert.equal(received[0].commandId, 'botx-crash-42');
  assert.equal(received[0].target, 3.15);
  unsubscribe();
  receive({ type: 'bot_crash_target', commandId: 'botx-crash-43', target: 4.2 });
  assert.equal(received.length, 1);
});
