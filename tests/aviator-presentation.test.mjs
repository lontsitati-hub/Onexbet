import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createFlightProjection, horizontalProgress } = require('../src/components/aviator/flightProjection.ts');
const root = path.resolve(import.meta.dirname, '..');

const atReferenceSeconds = (seconds, width = 416, height = 291) => createFlightProjection(Math.exp(seconds * 0.082), width, height);

test('la projection continue après 1,20x au lieu de rester figée', () => {
  const early = createFlightProjection(1.2, 416, 291);
  const later = createFlightProjection(2.2, 416, 291);
  assert.ok(later.planeX > early.planeX);
  assert.notEqual(later.planeY, early.planeY);
});

test('la montée atteint 2,5× puis l’altitude redescend et remonte sans altérer la cote', () => {
  const start = createFlightProjection(1, 416, 291);
  const summit = createFlightProjection(2.5, 416, 291);
  const lower = createFlightProjection(3, 416, 291);
  const rebound = createFlightProjection(4.48, 416, 291);
  assert.ok(summit.planeY < start.planeY);
  assert.ok(lower.planeY > summit.planeY);
  assert.ok(rebound.planeY < lower.planeY);
  assert.deepEqual([start.mRaw, summit.mRaw, lower.mRaw, rebound.mRaw], [1, 2.5, 3, 4.48]);
});

test('les poses du graphe suivent les repères horizontaux de la vidéo et le plateau vertical actuel', () => {
  const start = createFlightProjection(1.25, 480, 336);
  const peak = createFlightProjection(1.74, 480, 336);
  const trough = createFlightProjection(2.37, 480, 336);
  const near = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual.toFixed(3)} != ${expected.toFixed(3)}`);
  near(start.planeX / 480, 0.40, 0.045);
  near(start.planeY / 336, 0.81, 0.045);
  near(peak.planeX / 480, 0.64, 0.045);
  near(peak.planeY / 336, 0.53, 0.055);
  near(trough.planeX / 480, 0.85, 0.045);
  near(trough.planeY / 336, 0.39, 0.055);
  near(start.points[0][1] / 336, 0.996, 0.01);
});

test('la progression horizontale ne retrace pas sa trajectoire et plafonne après 2,37×', () => {
  const multipliers = [1.25, 1.74, 2.37, 2.5, 3, 1000];
  const projections = multipliers.map((multiplier) => createFlightProjection(multiplier, 480, 336));
  for (let index = 1; index < projections.length; index += 1) {
    assert.ok(projections[index].planeX >= projections[index - 1].planeX);
  }
  assert.ok(projections[3].planeX > projections[1].planeX);
  assert.equal(projections[2].planeX, projections[3].planeX);
  assert.equal(projections[2].planeX, projections[5].planeX);
  assert.ok(projections[4].planeY > projections[3].planeY);
  assert.ok(createFlightProjection(4.48, 480, 336).planeY < projections[4].planeY);
  assert.equal(horizontalProgress(createFlightProjection(1000, 480, 336).pathTime), 0.95);
});

test('avion et courbe restent dans leurs marges pendant tous les vols testés', () => {
  for (const [width, height] of [[320, 156], [360, 224], [416, 340], [768, 360]]) {
    for (let seconds = 0; seconds <= 140; seconds += 0.25) {
      const projection = atReferenceSeconds(seconds, width, height);
      const assetScale = Math.max(0.78, Math.min(1.18, width / 416));
      assert.ok(projection.planeX >= width * 0.035 && projection.planeX <= width - 46 * assetScale);
      assert.ok(projection.planeY >= 48 * assetScale && projection.planeY <= height - 5);
      if (projection.points.length) {
        assert.deepEqual(projection.points.at(-1), [projection.planeX, projection.planeY]);
        for (let index = 1; index < projection.points.length; index += 1) {
          assert.ok(projection.points[index][0] >= projection.points[index - 1][0]);
          assert.ok(projection.points[index][1] <= projection.points[index - 1][1]);
        }
      }
    }
  }
});

test('la projection ne déclenche aucun pari et ne calcule ni crash ni gain', () => {
  const source = fs.readFileSync(path.join(root, 'src/components/aviator/flightProjection.ts'), 'utf8');
  assert.doesNotMatch(source, /placeBet|cashOut|computeCrashPoint|updateBalance|Math\.random/);
  const viewport = fs.readFileSync(path.join(root, 'src/components/aviator/GameViewport.tsx'), 'utf8');
  assert.doesNotMatch(viewport, /VISUAL_CURVE_CAP|Math\.min\(t, timeForMultiplier/);
  assert.match(viewport, /<Stop offset="1" stopColor="#A50A1D" stopOpacity="0\.68" \/>/);
});

test('le rectangle tourné du sprite complet reste dans le cadre dès le décollage', () => {
  const frames = [[0, 5], [2, 8], [4, 15], [6, 20], [8, 30], [10, 30], [12, 35], [14, 27], [18, 35]];
  const ease = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const angle = time => {
    for (let i = 1; i < frames.length; i++) {
      const [t0, a0] = frames[i - 1]; const [t1, a1] = frames[i];
      if (time <= t1) return a0 + (a1 - a0) * ease((time - t0) / (t1 - t0));
    }
    return 35;
  };
  for (const [width, height] of [[320, 156], [360, 224], [416, 340], [768, 360]]) {
    const scale = Math.max(0.78, Math.min(1.18, width / 416));
    for (let seconds = 0; seconds <= 12; seconds += 0.1) {
      const p = atReferenceSeconds(seconds, width, height);
      const theta = (11.9 - angle(p.t)) * Math.PI / 180;
      const c = Math.cos(theta), s = Math.sin(theta);
      const centerX = p.planeX - (-29.5 * c - 13.3 * s) * scale;
      const centerY = p.planeY - (-29.5 * s + 13.3 * c) * scale;
      for (const x of [-30, 30]) for (const y of [-15, 15]) {
        const px = centerX + (x * c - y * s) * scale;
        const py = centerY + (x * s + y * c) * scale;
        assert.ok(px >= -1 && px <= width + 1 && py >= -1 && py <= height + 1, `${width}x${height} t=${seconds} corner=${px},${py}`);
      }
    }
  }
});

test('Aviator utilise son nouveau chargement et ne change pas les autres jeux', () => {
  const source = fs.readFileSync(path.join(root, 'src/app/xgame-loading.tsx'), 'utf8');
  assert.ok(source.includes("const isAviator = destination === '/aviator-game';"));
  assert.ok(source.includes("const isCrash = destination === '/crash';"));
  assert.ok(source.includes('const AVIATOR_CONNECTION_MS = 2500;'));
  assert.ok(source.includes('setTimeout(navigateToGame, AVIATOR_CONNECTION_MS)'));
  assert.ok(source.includes('const MIN_GAME_LOADING_MS = 300;'));
  assert.ok(source.includes('if (routeWasPrefetched && gameAssetsAlreadyReady)'));
  assert.doesNotMatch(source, /setInterval/);
  assert.ok(source.includes('isAviator ? <AviatorConnectionScreen'));
  const connection = fs.readFileSync(path.join(root, 'src/components/aviator/AviatorConnectionScreen.tsx'), 'utf8');
  assert.match(connection, /\[0, 1, 2\]\.map/);
  assert.match(connection, />Connexion<\/Text>/);
  assert.doesNotMatch(connection, /Animated\.loop/);
});

test('les deux panneaux Aviator restent montés et utilisent les montants rapides actuels', () => {
  const screen = fs.readFileSync(path.join(root, 'src/components/aviator/AviatorGameScreen.tsx'), 'utf8');
  const panel = fs.readFileSync(path.join(root, 'src/components/aviator/BetPanel.tsx'), 'utf8');
  assert.equal((screen.match(/<BetPanel/g) || []).length, 2);
  assert.match(screen, /removeClippedSubviews=\{false\}/);
  assert.match(screen, /compactLayout = usableHeight < AVIATOR_COMPACT_LAYOUT_BREAKPOINT_DP/);
  for (const label of ['CANCEL', 'CASH OUT', 'Bet', 'Auto']) assert.ok(panel.includes(`"${label}"`) || panel.includes(`>${label}</Text>`));
  assert.match(panel, /\[\[1, 2\], \[5, 10\]\]/);
  assert.match(panel, /onPress=\{handleAction\}/);
});

test('Cash Out en vol cible le bon pari sur chacun des deux panneaux', () => {
  const screen = fs.readFileSync(path.join(root, 'src/components/aviator/AviatorGameScreen.tsx'), 'utf8');
  const panel = fs.readFileSync(path.join(root, 'src/components/aviator/BetPanel.tsx'), 'utf8');
  const hook = fs.readFileSync(path.join(root, 'src/components/aviator/useAviatorGame.ts'), 'utf8');

  assert.match(panel, /phase === "flying" && bet && bet\.cashedOutAt === null[\s\S]*?label: "CASH OUT"/);
  assert.match(panel, /phase === "flying" && !bet[\s\S]*?label: "Bet"/);
  assert.match(screen, /bet=\{bets\[0\]\}[\s\S]*?onCashOut=\{\(\) => cashOut\(0\)\}[\s\S]*?bet=\{bets\[1\]\}[\s\S]*?onCashOut=\{\(\) => cashOut\(1\)\}/);
  assert.match(hook, /if \(isFlying && crashNotYet\) \{[\s\S]*?betsRef\.current\[index\] = \{ amount, cashedOutAt: null, active: true \}[\s\S]*?setBets\(\[\.\.\.betsRef\.current\]\)/);
});

test('la disposition compacte préserve les panneaux et leurs actions, avec un message d’erreur accessible', () => {
  const screen = fs.readFileSync(path.join(root, 'src/components/aviator/AviatorGameScreen.tsx'), 'utf8');
  const panel = fs.readFileSync(path.join(root, 'src/components/aviator/BetPanel.tsx'), 'utf8');
  assert.match(screen, /const usableHeight = height - insets\.top - insets\.bottom;\s*const compactLayout = usableHeight < AVIATOR_COMPACT_LAYOUT_BREAKPOINT_DP;/);
  assert.match(screen, /const canvasHeightHint = compactLayout \? getAviatorCompactChartHeight\(usableHeight\) : undefined;/);
  assert.match(screen, /<BetPanel[\s\S]*?<View style=\{styles\.panelGap\} \/>[\s\S]*?<BetPanel/);
  assert.match(panel, /mainBtn:\s*\{[\s\S]*?width: "100%",[\s\S]*?height: 88/);
  assert.match(panel, /backgroundColor: mainBtn\.bg/);
  assert.match(panel, /<Text style=\{styles\.actionError\} accessibilityRole="alert" accessibilityLiveRegion="polite">\s*\{actionError\}/);
  assert.match(panel, /onPress=\{handleAction\}/);
});
