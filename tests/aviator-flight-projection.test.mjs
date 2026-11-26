import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createFlightProjection, horizontalProgress } = require('../src/components/aviator/flightProjection.ts');
const { multiplierAt, timeForMultiplier } = require('../src/components/aviator/gameLogic.ts');

test('la projection garde sa montée jusqu’à 2,50× puis ondule sans reculer horizontalement', () => {
  const width = 416;
  const height = 300;
  const start = timeForMultiplier(2.5);
  const startProjection = createFlightProjection(2.5, width, height);
  const earlyProjection = createFlightProjection(1.4, width, height);
  const fallingProjection = createFlightProjection(multiplierAt(start + 2.2), width, height);
  const fullCycleProjection = createFlightProjection(multiplierAt(start + 4.4), width, height);

  assert.ok(startProjection.planeY < earlyProjection.planeY, 'la trajectoire monte jusqu’au repère haut à 2,50×');
  assert.ok(fallingProjection.planeY > startProjection.planeY, 'après 2,50×, l’altitude redescend');
  assert.ok(Math.abs(fullCycleProjection.planeY - startProjection.planeY) < 0.01, 'la trajectoire remonte au repère haut après un cycle');

  const samples = Array.from({ length: 23 }, (_, index) =>
    createFlightProjection(multiplierAt(start + index * 0.2), width, height).planeY,
  );
  assert.ok(Math.max(...samples) > startProjection.planeY, 'la trajectoire atteint aussi le repère bas');
  assert.ok(Math.max(...samples) <= fallingProjection.planeY + 0.01, 'la trajectoire reste bornée au repère bas');
  assert.ok(startProjection.points.length > 1, 'la projection fournit les points à dessiner');
  const progress = [2, 3, 5, 8, 12, 20].map(horizontalProgress);
  for (let index = 1; index < progress.length; index += 1) {
    assert.ok(progress[index] >= progress[index - 1], 'le tracé horizontal ne repart jamais en arrière');
  }
});
