import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { cashOut, createInitialState, GROWTH_RATE, placeBet, tickGame } = require('../src/components/crash-point/engine.ts');

function firstRoundCrashAt() {
  return 8000 + Math.ceil(Math.log(12) / GROWTH_RATE * 1000) + 100;
}

test('Crash Point synchronise les mises et gains avec le solde global', () => {
  let state = { ...createInitialState(0), balance: 1000 };
  state = placeBet(state, 0, 400);
  assert.equal(state.balance, 600);
  state = tickGame(state, 8000);
  assert.equal(state.bets[0]?.status, 'live');
  state = { ...state, multiplier: 2.5 };
  state = cashOut(state, 0);
  assert.equal(state.balance, 1600);
  assert.equal(state.bets[0]?.payout, 1000);
});

test('Crash Point ne recrédite pas une perte et refuse une mise supérieure au solde', () => {
  let state = { ...createInitialState(0), balance: 1000 };
  state = placeBet(state, 0, 400);
  const rejected = placeBet(state, 1, 2000);
  assert.equal(rejected.balance, 600);
  assert.equal(rejected.bets[1], null);
  state = tickGame(state, 8000);
  state = tickGame(state, firstRoundCrashAt());
  assert.equal(state.phase, 'crashed');
  assert.equal(state.bets[0]?.status, 'lost');
  assert.equal(state.balance, 600);
});

test('Une mise placée au crash est débitée et mise en file au prochain tour', () => {
  let state = { ...createInitialState(0), balance: 1000 };
  state = placeBet(state, 0, 400);
  state = tickGame(state, 8000);
  state = tickGame(state, firstRoundCrashAt());
  state = placeBet(state, 0, 200);
  assert.equal(state.balance, 400);
  assert.equal(state.bets[0]?.status, 'queued');
});
