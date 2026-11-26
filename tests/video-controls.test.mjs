import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'src');
const videoAssetRoot = path.join(projectRoot, 'assets', 'videos');

function listFiles(directory, allowedExtensions) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(filePath, allowedExtensions);
    return allowedExtensions.has(path.extname(entry.name).toLowerCase()) ? [filePath] : [];
  });
}

const sourceFiles = listFiles(sourceRoot, new Set(['.ts', '.tsx', '.js', '.jsx']));
const sourceText = new Map(sourceFiles.map((filePath) => [filePath, fs.readFileSync(filePath, 'utf8')]));
const sourceTextAll = [...sourceText.values()].join('\n');
const videoViewTags = [];
for (const [filePath, content] of sourceText) {
  for (const match of content.matchAll(/<VideoView\b[^>]*>/gs)) {
    videoViewTags.push({ filePath, tag: match[0] });
  }
}

test('tous les VideoView désactivent les commandes natives', () => {
  assert.ok(videoViewTags.length > 0, 'au moins un VideoView doit être recensé');
  const missingControlsOff = videoViewTags
    .filter(({ tag }) => !/\bnativeControls\s*=\s*\{\s*false\s*\}/.test(tag))
    .map(({ filePath }) => path.relative(projectRoot, filePath));
  assert.deepEqual(missingControlsOff, [], `VideoView sans nativeControls={false}: ${missingControlsOff.join(', ')}`);
});

test('tous les VideoView sont placés dans une surface non interactive', () => {
  const interactiveVideoViews = [];
  for (const { filePath, tag } of videoViewTags) {
    if (!/pointerEvents\s*=\s*["']none["']/.test(tag)) {
      const source = sourceText.get(filePath) || '';
      const line = source.slice(0, source.indexOf(tag)).split('\n').length;
      const nearby = source.split('\n').slice(Math.max(0, line - 4), line + 3).join('\n');
      const hasNonInteractiveStyle = /pointerEvents\s*:\s*["']none["']/.test(source);
      if (!/pointerEvents\s*=\s*["']none["']/.test(nearby) && !hasNonInteractiveStyle) interactiveVideoViews.push(`${path.relative(projectRoot, filePath)}:${line}`);
    }
  }
  assert.deepEqual(interactiveVideoViews, [], `VideoView potentiellement interactif : ${interactiveVideoViews.join(', ')}`);
});

test('aucune balise vidéo HTML n’active les contrôles du navigateur', () => {
  const enabledHtmlControls = [];
  for (const [filePath, content] of sourceText) {
    for (const match of content.matchAll(/<video\b[^>]*\bcontrols(?:\s|=|>)[^>]*>/gis)) {
      enabledHtmlControls.push(`${path.relative(projectRoot, filePath)}: ${match[0]}`);
    }
  }
  assert.deepEqual(enabledHtmlControls, [], `Balise <video> avec contrôles : ${enabledHtmlControls.join('\n')}`);
});

test('l’état vide Web de l’historique utilise une animation sans lecteur', () => {
  const webFallbackPath = path.join(sourceRoot, 'components', 'EmptyBetHistoryMascot.tsx');
  const content = fs.readFileSync(webFallbackPath, 'utf8');
  assert.match(content, /bet-history-empty\.gif/);
  assert.match(content, /<Image\b/);
  assert.doesNotMatch(content, /VideoView|useVideoPlayer|<video\b|\bcontrols\s*=/i);
});

test('l’onglet Populaire ne référence plus le clip de confirmation d’âge', () => {
  const popularTabPath = path.join(sourceRoot, 'components', 'tabs', 'PopularTab.tsx');
  const popularTabSource = fs.readFileSync(popularTabPath, 'utf8');
  assert.doesNotMatch(popularTabSource, /app-intro/i);
  assert.equal(fs.existsSync(path.join(videoAssetRoot, 'app-intro.mp4')), false);
  assert.equal(fs.existsSync(path.join(videoAssetRoot, 'app-intro-source.mov')), false);
});

test('chaque MP4 intégré est référencé par le code source', () => {
  const mp4Files = listFiles(videoAssetRoot, new Set(['.mp4']));
  assert.ok(mp4Files.length > 0, 'au moins un MP4 doit être recensé');
  const unreferenced = mp4Files
    .filter((assetPath) => !sourceTextAll.includes(path.basename(assetPath)))
    .map((assetPath) => path.relative(projectRoot, assetPath));
  assert.deepEqual(unreferenced, [], `MP4 sans référence source : ${unreferenced.join(', ')}`);
});

console.log(`Contrôle de ${videoViewTags.length} composants VideoView et ${listFiles(videoAssetRoot, new Set(['.mp4'])).length} assets MP4.`);
