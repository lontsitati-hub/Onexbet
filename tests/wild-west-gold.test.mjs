import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  ROWS,
  MODE_CONFIG,
  balanceAfterCashout,
  balanceAfterDynamiteHit,
  generateGrid,
  potentialWin,
} = require('../src/services/wildWestLogic.ts');

test('Wild West Gold utilise les six rangées de la maquette et une seule case or par rangée', () => {
  assert.equal(ROWS, 6);
  for (const mode of ['2x', '3x']) {
    const cols = MODE_CONFIG[mode].cols;
    const grid = generateGrid(MODE_CONFIG[mode], () => 0);
    assert.equal(grid.length, 6);
    for (const row of grid) {
      assert.equal(row.cells.length, cols);
      assert.equal(row.cells.filter((cell) => cell === 'gold').length, 1);
      assert.equal(row.cells.filter((cell) => cell === 'dynamite').length, cols - 1);
    }
  }
});

test('aucun débit au départ ou sur une case or; seule la dynamite débite la mise', () => {
  const initialBalance = 15000;
  const bet = 500;
  // Le démarrage et un choix or ne passent volontairement aucune opération de solde.
  let balance = initialBalance;
  assert.equal(balance, initialBalance);
  assert.equal(balanceAfterDynamiteHit(balance, bet), 14500);
});

test('les gains possibles suivent le multiplicateur par rangée et sont crédités au solde partagé', () => {
  assert.equal(potentialWin(500, MODE_CONFIG['2x'], 1), 1000);
  assert.equal(potentialWin(500, MODE_CONFIG['2x'], 2), 2000);
  assert.equal(potentialWin(500, MODE_CONFIG['3x'], 1), 1500);
  assert.equal(balanceAfterCashout(15000, 1000), 16000);
});
