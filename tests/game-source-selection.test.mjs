import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

test('Apple of Fortune utilise uniquement le nouvel écran de référence', async () => {
  const route = await read('src/app/apple-of-fortune.tsx');
  const screen = await read('src/components/aof/v4/game-screen.tsx');
  const styles = await read('src/components/aof/v4/reference-styles.ts');

  assert.match(route, /@\/components\/aof\/v4\/game-screen/);
  assert.doesNotMatch(screen, /Sélectionnez le niveau de difficulté/);
  assert.doesNotMatch(screen, /\b2x\b|\b3x\b/);
  assert.doesNotMatch(screen, /#4A7BE0/);
  assert.match(screen, /RÉCUPÉRER LES GAINS/);
  assert.match(styles, /playButton: \{[^}]*backgroundColor: '#4682CA'/);
  assert.match(styles, /endActionButton: \{[^}]*maxWidth: 286/);
  assert.match(styles, /cashButton: \{[^}]*maxWidth: 286/);
  assert.match(styles, /cashSurface: \{[^}]*backgroundColor: '#3D7FCB'/);
});

test('Aviator utilise le BetPanel de référence et sa grille de montants', async () => {
  const screen = await read('src/components/aviator/AviatorGameScreen.tsx');
  const panel = await read('src/components/aviator/BetPanel.tsx');

  assert.match(screen, /@\/components\/aviator\/BetPanel['"];/);
  assert.doesNotMatch(screen, /@\/components\/aviator\/BetPanelV41/);
  assert.match(panel, /\[\[1, 2\], \[5, 10\]\]/);
  assert.match(panel, /label: "Bet"/);
  assert.match(panel, /label: "CASH OUT"/);
  assert.match(panel, /bg: "#1F9C09"/);
  assert.match(panel, /bg: "#ffad29"/);
});
