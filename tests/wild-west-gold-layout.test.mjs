import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/components/wwg/WildWestGoldGame.tsx'), 'utf8');

test('Wild West Gold gives the Android board and each row a resolved width above its frame', () => {
  assert.match(source, /grid:\s*\{\s*width: '100%',\s*flexDirection: 'column',[^}]*zIndex: 2, elevation: 2\s*\}/);
  assert.match(source, /gridRow:\s*\{\s*width: '100%',\s*flexDirection: 'row', columnGap: 8\s*\}/);
  assert.match(source, /width: mode === 2 \? '48\.6%' : '31\.6%'/);
  assert.match(source, /<Image source=\{A\.boardFrame\}[\s\S]*?\{grid\}/);
});

test('Wild West Gold synchronizes the Firestore state ref after render without causing a React update', () => {
  assert.match(source, /const gameStateRef = useRef\(\{ mode, phase, safe, selected \}\);\s*useEffect\(\(\) => \{\s*gameStateRef\.current = \{ mode, phase, safe, selected \};\s*\}, \[mode, phase, safe, selected\]\);/);
  assert.match(source, /const state = gameStateRef\.current/);
  assert.equal((source.match(/gameStateRef\.current = \{ mode, phase, safe, selected \}/g) ?? []).length, 1);
});
