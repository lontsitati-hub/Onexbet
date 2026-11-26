import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/wwg/WildWestGoldGame.tsx', import.meta.url), 'utf8');

test('les textures des cases WWG utilisent une Image native explicite', () => {
  assert.match(source, /const cellSource = activeRow[\s\S]*?activeCells2\[index % 2\][\s\S]*?activeCells3\[index % 3\][\s\S]*?cells\[index % 12\][\s\S]*?cells3\[index\]/);
  assert.match(source, /<View style=\{styles\.cellImage\}>[\s\S]*?<Image\s+source=\{cellSource\}\s+style=\{\[StyleSheet\.absoluteFill, styles\.cellRadius\]\}\s+resizeMode="cover"\s+accessible=\{false\}\s*\/>/);
  assert.match(source, /cellImage: \{ width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#d6c08c', borderRadius: 5 \}/);
  assert.doesNotMatch(source, /<ImageBackground source=\{activeRow/);
});

test('le rendu des cellules conserve leur Pressable et ne change pas les handlers du jeu', () => {
  assert.match(source, /disabled=\{disabled\}\s+onPress=\{\(\) => pick\(index\)\}/);
  assert.match(source, /accessibilityLabel="Jouer"[\s\S]*?onPress=\{start\}/);
  assert.match(source, /onPress=\{\(\) => pick\(index\)\}/);
  assert.match(source, /const start = \(\) => \{[\s\S]*?setPhase\('playing'\)/);
});
