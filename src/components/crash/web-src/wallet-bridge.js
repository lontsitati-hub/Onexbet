/* Bridge strict: aucune balance locale de secours, toutes les écritures passent par l’application hôte. */
(function attachAviatorWalletBridge(global) {
  const pending = new Map();
  const listeners = new Set();
  const crashTargetListeners = new Set();
  let sequence = 0;

  function normalizeBalance(snapshot) {
    const amount = Number(snapshot && snapshot.amount);
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Solde reçu invalide.');
    return { amount, currency: snapshot.currency || 'XAF' };
  }

  function sendToHost(message) {
    if (global.ReactNativeWebView && typeof global.ReactNativeWebView.postMessage === 'function') {
      global.ReactNativeWebView.postMessage(JSON.stringify(message));
      return;
    }
    if (global.parent && global.parent !== global) {
      global.parent.postMessage({ __onexGameMessage: message }, '*');
      return;
    }
    throw new Error('Connexion au portefeuille hôte indisponible.');
  }

  function request(operation, payload = {}) {
    return new Promise((resolve, reject) => {
      const id = `crash-wallet-${Date.now().toString(36)}-${++sequence}`;
      const timeout = global.setTimeout(() => {
        pending.delete(id);
        reject(new Error('Le portefeuille ne répond pas.'));
      }, 10000);
      pending.set(id, { resolve, reject, timeout });
      try {
        sendToHost({ type: 'wallet_request', id, operation, payload });
      } catch (error) {
        global.clearTimeout(timeout);
        pending.delete(id);
        reject(error);
      }
    });
  }

  function validateBet(payload, needsAmount) {
    if (!payload || typeof payload.requestId !== 'string' || !payload.requestId.trim()) {
      throw new Error('Identifiant de transaction manquant.');
    }
    if (!String(payload.roundId || '').trim() || !String(payload.betId || '').trim()) {
      throw new Error('Identifiant du pari manquant.');
    }
    if (needsAmount && (!Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0)) {
      throw new Error('Montant de transaction invalide.');
    }
  }

  const bridge = {
    mode: 'host',
    isConnected: () => true,
    getBalance: () => request('getBalance'),
    debit(payload) {
      validateBet(payload, true);
      return request('debit', payload);
    },
    activateBet(payload) {
      validateBet(payload, false);
      return request('activateBet', payload);
    },
    credit(payload) {
      validateBet(payload, true);
      return request('credit', payload);
    },
    settleLoss(payload) {
      validateBet(payload, false);
      return request('settleLoss', payload);
    },
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onCrashTarget(listener) {
      if (typeof listener !== 'function') return () => {};
      crashTargetListeners.add(listener);
      return () => crashTargetListeners.delete(listener);
    },
    exit() {
      sendToHost({ type: 'exit' });
    },
    _receive(message) {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'wallet_response') {
        const task = pending.get(message.id);
        if (!task) return;
        pending.delete(message.id);
        global.clearTimeout(task.timeout);
        if (!message.ok) {
          task.reject(new Error(message.error || 'Opération du portefeuille refusée.'));
          return;
        }
        try {
          const snapshot = normalizeBalance(message.snapshot);
          listeners.forEach(listener => listener(snapshot));
          task.resolve(snapshot);
        } catch (error) {
          task.reject(error);
        }
      } else if (message.type === 'wallet_update') {
        try {
          const snapshot = normalizeBalance(message.snapshot);
          listeners.forEach(listener => listener(snapshot));
        } catch (_) {
          // Une mise à jour mal formée ne doit pas bloquer l’interface du jeu.
        }
      } else if (message.type === 'bot_crash_target') {
        crashTargetListeners.forEach(listener => listener(message));
      }
    }
  };

  global.AviatorWalletBridge = bridge;
  global.__onexWalletReceive = message => bridge._receive(message);
  global.addEventListener('message', event => {
    const envelope = event.data;
    if (envelope && envelope.__onexNativePayload) bridge._receive(envelope.__onexNativePayload);
  });
})(window);
