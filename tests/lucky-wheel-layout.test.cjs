const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/components/tabs/PopularTab.tsx'), 'utf8');
const assetPath = path.join(root, 'assets/images/fast-games/reference/lucky-wheel-banner.png');
const asset = fs.readFileSync(assetPath);

function getLuckyWheelSection() {
  const start = source.indexOf('function XGameCatalogSection(');
  const end = source.indexOf('\nfunction OddsRow(', start);
  assert.notEqual(start, -1, 'XGameCatalogSection exists');
  assert.notEqual(end, -1, 'XGameCatalogSection has a bounded source block');
  return source.slice(start, end);
}

test('Lucky Wheel banner is constrained to the viewport and displays the complete source image', () => {
  const section = getLuckyWheelSection();
  const aspect = source.match(/const LUCKY_WHEEL_BANNER_ASPECT_RATIO = (\d+) \/ (\d+);/);
  assert.ok(aspect, 'source image ratio is explicit');

  const sourceWidth = asset.readUInt32BE(16);
  const sourceHeight = asset.readUInt32BE(20);
  assert.equal(Number(aspect[1]), sourceWidth);
  assert.equal(Number(aspect[2]), sourceHeight);
  assert.match(section, /const contentWidth = Math\.min\(Math\.max\(viewportWidth, 1\), 1000\);/);
  assert.match(section, /width: contentWidth, maxWidth: 1000, alignSelf: 'center'/);
  assert.match(section, /style=\{\{ width: bannerWidth, alignSelf: 'center', overflow: 'hidden' \}\}/);
  assert.match(section, /width: bannerWidth, height: bannerWidth \/ LUCKY_WHEEL_BANNER_ASPECT_RATIO/);
  assert.match(section, /resizeMode="contain"/);
});
