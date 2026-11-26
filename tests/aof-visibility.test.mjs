import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const screen = fs.readFileSync(path.join(root, 'src/components/aof/v4/game-screen.tsx'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/components/aof/v4/reference-styles.ts'), 'utf8');

test('les pommes révélées restent nettes, seules les cases non gagnantes s’estompent', () => {
  assert.match(screen, /const displayedRows = visibleReferenceRows\(ROWS\)/);
  assert.doesNotMatch(screen, /displayFloor/);
  assert.doesNotMatch(screen, /opacity:\s*roundEnded\s*\?\s*0\.38/);
  assert.match(screen, /if \(st === 'apple'\)\s*\{\s*cellFade = 1;\s*\}/);
  assert.match(screen, /Fade only the unpicked cells in crossed rows/);
  assert.match(screen, /On a result board, apples stay vivid and non-apple/);
});

test('les codes multiplicateurs des rangées franchies gardent la visibilité des codes actifs', () => {
  assert.match(styles, /multPill:\s*\{[^}]*backgroundColor: 'rgba\(8, 42, 32, 0\.55\)'/);
  assert.match(styles, /multPillPast:\s*\{\s*backgroundColor: 'rgba\(8, 42, 32, 0\.55\)'\s*\}/);
  assert.match(styles, /multText:\s*\{\s*color: '#D0DDD3'/);
  assert.match(styles, /multPastText:\s*\{\s*color: '#D0DDD3'\s*\}/);
  assert.doesNotMatch(styles, /multPillPast:\s*\{[^}]*\bopacity\s*:/);
});

test('le bouton de récupération AOF reprend la taille du bandeau de gains et conserve le bleu vidéo', () => {
  const gainsPill = styles.match(/gainsPill:\s*\{([^}]*)\}/)?.[1];
  const cashButton = styles.match(/cashButton:\s*\{([^}]*)\}/)?.[1];
  assert.ok(gainsPill && cashButton, 'les styles des deux éléments doivent exister');
  for (const dimension of ["width: '100%'", 'maxWidth: 286', 'height: 38']) {
    assert.ok(gainsPill.includes(dimension), `GAINS ACTUELS doit inclure ${dimension}`);
    assert.ok(cashButton.includes(dimension), `RÉCUPÉRER LES GAINS doit inclure ${dimension}`);
  }
  assert.match(styles, /cashSurface:\s*\{[^}]*backgroundColor:\s*'#3D7FCB'/);
  assert.match(styles, /cashSurfaceDisabled:\s*\{[^}]*backgroundColor:\s*'#3D7FCB'/);
});

test('le dock AOF reste masqué au démarrage et apparaît au premier toucher, sans autoriser un retrait à zéro', () => {
  assert.match(screen, /const \[showCashOutDock, setShowCashOutDock\] = useState\(false\)/);
  const startAt = screen.indexOf('const startRound = useCallback(async () => {');
  const finishAt = screen.indexOf('\n  const finishRound', startAt);
  const startRound = screen.slice(startAt, finishAt);
  assert.match(startRound, /setShowCashOutDock\(false\)/);
  assert.doesNotMatch(startRound, /setShowCashOutDock\(true\)/);
  assert.match(startRound, /catch \(error\) \{[\s\S]*?setShowCashOutDock\(false\)/);
  const firstTouchStart = screen.indexOf('const handleCellPress = useCallback(');
  const firstTouchEnd = screen.indexOf('\n  const cashOut', firstTouchStart);
  const handleCellPress = screen.slice(firstTouchStart, firstTouchEnd);
  assert.ok(handleCellPress.includes('setShowCashOutDock(true);'));
  assert.match(screen, /\{showCashOutDock && !roundEnded && \([\s\S]*?GAINS ACTUELS:/);
  assert.match(screen, /disabled=\{level === 0\}/);
  const finishRound = screen.slice(finishAt, screen.indexOf('\n  const handleCellPress', finishAt));
  assert.match(finishRound, /setShowCashOutDock\(false\)/);
});
