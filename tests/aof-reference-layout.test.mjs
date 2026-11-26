import assert from 'node:assert/strict';
import test from 'node:test';
import referenceLayout from '../src/components/aof/v4/reference-layout.ts';

const {
  formatReferenceAmount,
  formatReferenceBalance,
  parseReferenceBet,
  referencePayout,
  visibleReferenceRows,
} = referenceLayout;

test('la mise MAX conserve sa partie décimale', () => {
  assert.equal(parseReferenceBet('706 275.9 F'), 706275.9);
  assert.equal(parseReferenceBet('706 275,9 F'), 706275.9);
  assert.equal(parseReferenceBet('500 F'), 500);
  assert.equal(parseReferenceBet(''), 200);
  assert.equal(parseReferenceBet('1000000'), 706275.9);
});

test('les gains suivent les centièmes observés dans la vidéo', () => {
  assert.equal(referencePayout(500, 1.23), 615);
  assert.equal(referencePayout(500, 1.93), 965);
  assert.equal(referencePayout(500, 4.02), 2010);
  assert.equal(referencePayout(706275.9, 1.54), 1087664.88);
  const balance = 4951822.71 - 706275.9 + referencePayout(706275.9, 1.54);
  assert.equal(formatReferenceBalance(balance), '5333211.69 F');
});

test('les montants reprennent les séparateurs de la vidéo', () => {
  assert.equal(formatReferenceAmount(500), '500 F');
  assert.equal(formatReferenceAmount(706275.9), '706 275.9 F');
  assert.equal(formatReferenceAmount(1087664.88), '1 087 664.88 F');
});

test('les dix rangées restent montées après que le joueur ait avancé', () => {
  const allRows = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  assert.deepEqual(visibleReferenceRows(10), allRows);
  assert.ok(visibleReferenceRows(10).includes(1));
  assert.ok(visibleReferenceRows(10).includes(0));
});
