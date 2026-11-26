import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const screen = readFileSync(new URL('../src/components/wwg/WildWestGoldGame.tsx', import.meta.url), 'utf8');

test('Wild West Gold dessine ses icônes SVG localement sans SvgUri/fetch', () => {
  assert.doesNotMatch(screen, /SvgUri|Asset\.fromModule/);
  assert.match(screen, /function GameSvgIcon/);
  assert.match(screen, /name="arrow-left"/);
  assert.match(screen, /name="arrow-right"/);
  assert.match(screen, /name="back"/);
  assert.match(screen, /d="M3 12h31" stroke="#9b6b2b" strokeWidth=\{5\}/);
  assert.match(screen, /d="M40 12H9" stroke="#9b6b2b" strokeWidth=\{5\}/);
  assert.match(screen, /d="M15\.5 4\.5 8 12l7\.5 7\.5" fill="none" stroke="#73818a"/);
});
