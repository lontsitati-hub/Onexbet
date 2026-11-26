import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const {
  AVIATOR_COMPACT_LAYOUT_BREAKPOINT_DP,
  AVIATOR_COMPACT_CONTROLS_RESERVED_HEIGHT_DP,
  AVIATOR_COMPACT_CHART_MIN_HEIGHT_DP,
  AVIATOR_COMPACT_CHART_MAX_HEIGHT_DP,
  getAviatorCompactChartHeight,
} = require('../src/components/aviator/aviatorLayout.ts');

test('le graphe Aviator réserve la place aux deux panneaux sur les hauteurs Fold courtes', () => {
  assert.equal(AVIATOR_COMPACT_LAYOUT_BREAKPOINT_DP, 1000);
  assert.equal(AVIATOR_COMPACT_CONTROLS_RESERVED_HEIGHT_DP, 520);
  assert.equal(AVIATOR_COMPACT_CHART_MIN_HEIGHT_DP, 120);
  assert.equal(AVIATOR_COMPACT_CHART_MAX_HEIGHT_DP, 320);
  assert.equal(getAviatorCompactChartHeight(600), 120);
  assert.equal(getAviatorCompactChartHeight(640), 120);
  assert.equal(getAviatorCompactChartHeight(700), 180);
  assert.equal(getAviatorCompactChartHeight(840), 320);
  assert.equal(getAviatorCompactChartHeight(999), 320);
});

test('le ScrollView parent peut faire défiler les deux panneaux sous Android sans double safe area', () => {
  const screen = fs.readFileSync(path.join(root, 'src/components/aviator/AviatorGameScreen.tsx'), 'utf8');
  assert.match(screen, /nestedScrollEnabled\s+showsVerticalScrollIndicator/);
  assert.match(screen, /contentContainerStyle=\{\[styles\.screenContent, \{ paddingBottom: 16 \}\]\}/);
  assert.match(screen, /paddingBottom: insets\.bottom/);
  assert.match(screen, /getAviatorCompactChartHeight\(usableHeight\)/);
  assert.equal((screen.match(/<BetPanel\b/g) || []).length, 2);
});
