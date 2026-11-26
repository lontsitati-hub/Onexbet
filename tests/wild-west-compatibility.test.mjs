import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createInitialWildWestRound, wildWestAppChannelPatch, wildWestRowForDisplayIndex, wildWestRowLabel } = require('../src/services/wildWestProtocol.ts');

test('BotX row display follows the app: row 1 is at the bottom and play order is 1 to 6', () => {
  const rowsTopToBottom = Array.from({ length: 6 }, (_, display) => {
    const row = wildWestRowForDisplayIndex(display);
    return { row, label: wildWestRowLabel(row) };
  });
  assert.deepEqual(rowsTopToBottom.map(({ label }) => label), [6, 5, 4, 3, 2, 1]);
  assert.equal(rowsTopToBottom.at(-1).row, 0);
  assert.equal(rowsTopToBottom.at(-1).label, 1);
  assert.equal(rowsTopToBottom[0].label, 6);
  assert.throws(() => wildWestRowForDisplayIndex(6), RangeError);
});

test('first round document matches the secure app-origin initial state', () => {
  const stamp = { serverTimestamp: true };
  const doc = createInitialWildWestRound(2, 'wwg-test-1', stamp);
  assert.deepEqual(doc, { game: 'wild-west-gold', action: 'reveal', status: 'round-started', mode: 2, row: 5, col: 0, commandId: 'wwg-test-1', source: 'onexbet-app', updatedAt: stamp });
  assert.throws(() => createInitialWildWestRound(4, 'id', stamp), RangeError);
  assert.throws(() => createInitialWildWestRound(3, '', stamp), RangeError);
});

test('cashout reset is marked as app source while BotX acknowledgements preserve their source', () => {
  assert.deepEqual(wildWestAppChannelPatch({ action: 'reset', status: 'waiting', source: 'botx-web' }), {
    action: 'reset', status: 'waiting', source: 'onexbet-app',
  });
  assert.deepEqual(wildWestAppChannelPatch({ status: 'prepared' }), { status: 'prepared' });
  assert.deepEqual(wildWestAppChannelPatch({ status: 'revealed' }), { status: 'revealed' });
});
