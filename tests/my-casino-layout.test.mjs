import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/components/tabs/CasinoTab.tsx'), 'utf8');
const asset = fs.readFileSync(path.join(root, 'assets/images/casino/my_casino_banner.png'));

test('My Casino fits the Android viewport and shows the full source banner at its original ratio', () => {
  assert.equal(asset.readUInt32BE(16), 1200);
  assert.equal(asset.readUInt32BE(20), 525);
  assert.match(source, /const \{ width: viewportWidth \} = useWindowDimensions\(\);/);
  assert.match(source, /const casinoBannerWidth = Math\.max\(1, Math\.min\(viewportWidth - 32, 1200\)\);/);
  assert.match(source, /style=\{\[styles\.bannerWrap, \{ width: casinoBannerWidth \}\]\}/);
  assert.match(source, /style=\{styles\.banner\} resizeMode="contain"/);
  assert.match(source, /content: \{ width: '100%', paddingBottom: 24 \}/);
  assert.match(source, /banner: \{ width: '100%', aspectRatio: 1200 \/ 525/);
});
