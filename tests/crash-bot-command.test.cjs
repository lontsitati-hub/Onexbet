const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parseCrashBotCommand } = require('../src/components/crash/crashBotCommand.ts');

const NOW = 1_800_000_000_000;
const fresh = (patch = {}) => ({
  source: 'botx-web',
  commandId: 'botx-crash-1',
  target: 2.35,
  updatedAt: { toMillis: () => NOW - 1_000 },
  ...patch,
});

test('accepte une commande Crash BotX fraîche et restitue exactement sa cible', () => {
  assert.deepEqual(parseCrashBotCommand(fresh(), NOW), { commandId: 'botx-crash-1', target: 2.35 });
});

test('refuse les cibles hors bornes, non numériques ou non finies', () => {
  for (const target of [0.99, 1000.01, '2.35', Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(parseCrashBotCommand(fresh({ target }), NOW), null);
  }
});

test('refuse une autre source, un identifiant vide et une commande déjà reçue', () => {
  assert.equal(parseCrashBotCommand(fresh({ source: 'onexbet-app' }), NOW), null);
  assert.equal(parseCrashBotCommand(fresh({ commandId: '  ' }), NOW), null);
  assert.equal(parseCrashBotCommand(fresh(), NOW, 'botx-crash-1'), null);
});

test('refuse une commande trop ancienne, datée trop loin dans le futur ou sans Timestamp Firestore', () => {
  assert.equal(parseCrashBotCommand(fresh({ updatedAt: { toMillis: () => NOW - 600_001 } }), NOW), null);
  assert.equal(parseCrashBotCommand(fresh({ updatedAt: { toMillis: () => NOW + 60_001 } }), NOW), null);
  assert.equal(parseCrashBotCommand(fresh({ updatedAt: new Date(NOW) }), NOW), null);
});


test('le dernier commandId est conservé par compte entre les remontages', async () => {
  const { crashBotCommandStorageKey, loadLastCrashBotCommandId, persistCrashBotCommandId } = require('../src/components/crash/crashBotCommand.ts');
  const values = new Map();
  const storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
  };
  assert.notEqual(crashBotCommandStorageKey('user-a'), crashBotCommandStorageKey('user-b'));
  assert.equal(await loadLastCrashBotCommandId(storage, 'user-a'), null);
  await persistCrashBotCommandId(storage, 'user-a', 'botx-crash-1');
  const restoredCommandId = await loadLastCrashBotCommandId(storage, 'user-a');
  assert.equal(restoredCommandId, 'botx-crash-1');
  assert.equal(parseCrashBotCommand(fresh(), NOW, restoredCommandId), null);
  assert.equal(await loadLastCrashBotCommandId(storage, 'user-b'), null);
});

test('une erreur de stockage empêche de déclarer une commande comme persistée', async () => {
  const { persistCrashBotCommandId } = require('../src/components/crash/crashBotCommand.ts');
  const storage = { getItem: async () => null, setItem: async () => { throw new Error('quota'); } };
  await assert.rejects(persistCrashBotCommandId(storage, 'user-a', 'botx-crash-1'), /quota/);
});
