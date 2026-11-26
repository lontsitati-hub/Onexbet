import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'src/components/crash/web-src');
const outputPath = path.join(projectRoot, 'src/components/crash/gameHtml.ts');
const mimeTypes = { '.png': 'image/png', '.svg': 'image/svg+xml' };
const read = (relativePath) => fs.readFileSync(path.join(sourceRoot, relativePath));
const dataUri = (relativePath) => {
  const extension = path.extname(relativePath).toLowerCase();
  const mime = mimeTypes[extension];
  if (!mime) throw new Error(`Type d’image non pris en charge: ${relativePath}`);
  return `data:${mime};base64,${read(relativePath).toString('base64')}`;
};
const frames = [31.0, 31.2, 31.4, 31.6, 31.8, 32.0, 32.2, 32.4, 32.6]
  .map((time) => dataUri(`assets/crash-sequence/frame-${time.toFixed(1)}.png`));
const assets = {
  plane: dataUri('assets/aviator-video-sprite.png'),
  crashSprite: dataUri('assets/crash-video-sprite.png'),
  crashFlare: dataUri('assets/video-crash-extracted.png'),
  crashFrames: frames,
};

let html = read('index.html').toString('utf8');
const styles = read('styles.css').toString('utf8');
const gameScript = read('app.js').toString('utf8').replace(/<\/script/gi, '<\\/script');
const walletBridge = read('wallet-bridge.js').toString('utf8').replace(/<\/script/gi, '<\\/script');
const assetsBootstrap = `window.__CRASH_GAME_ASSETS__=${JSON.stringify(assets)};`;

html = html
  .replace(/\s*<link rel="icon"[^>]*>/i, '')
  .replace('<link rel="stylesheet" href="/styles.css">', `<style>${styles}</style>`)
  .replace('href="/assets/aviator-video-sprite.png"', `href="${assets.plane}"`)
  .replace('href="/assets/video-crash-extracted.png"', `href="${assets.crashFlare}"`)
  .replace('<script src="/wallet-bridge.js" defer></script>', `<script>${assetsBootstrap}\n${walletBridge}</script>`)
  .replace('<script src="/app.js" defer></script>', `<script>${gameScript}</script>`);

if (html.includes('href="/assets/') || html.includes('src="/')) {
  throw new Error('Le jeu contient encore une ressource distante ou un chemin local non embarqué.');
}
if (!html.includes('window.AviatorWalletBridge') || !html.includes('Connexion…')) {
  throw new Error('Le bundle ne contient pas les garde-fous de portefeuille attendus.');
}

const generated = `/* Généré par scripts/build-crash-webview.mjs depuis les sources locales du ZIP Crash. */\nexport const CRASH_GAME_HTML = ${JSON.stringify(html)};\n`;
fs.writeFileSync(outputPath, generated);
console.log(`Bundle Crash généré: ${path.relative(projectRoot, outputPath)} (${Buffer.byteLength(generated)} octets)`);
