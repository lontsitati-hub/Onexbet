import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const { getWildWestLayout } = require('../src/components/wwg/wwgLayout.ts');

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('WWG conserve ses dimensions de maquette quand l’écran a assez de hauteur', () => {
  const layout = getWildWestLayout({ width: 390, height: 844, topInset: 24, bottomInset: 24 });
  assert.equal(layout.usableHeight, 796);
  assert.equal(layout.gameTopPadding, 97);
  assert.equal(layout.boardScale, 1);
  assert.equal(layout.boardWidth, 330);
  assert.equal(layout.boardViewportHeight, 477);
  assert.equal(layout.boardScrollHeight, 335);
});

test('WWG réserve les safe areas et réduit le plateau sur une surface courte', () => {
  const layout = getWildWestLayout({ width: 390, height: 520, topInset: 24, bottomInset: 24 });
  assert.equal(layout.usableHeight, 472);
  assert.equal(layout.gameTopPadding, 8);
  assert.ok(layout.boardScale < 1);
  assert.ok(layout.boardScale >= 0.45);
  assert.ok(layout.boardWidth < 330);
  assert.equal(layout.boardViewportHeight, 242);
  assert.equal(layout.boardScrollHeight, layout.boardViewportHeight);
});

test('sur un écran extrêmement court, le ScrollView se limite au viewport et garde les commandes après lui', () => {
  const layout = getWildWestLayout({ width: 390, height: 300, topInset: 24, bottomInset: 24 });
  assert.equal(layout.boardViewportHeight, 22);
  assert.equal(layout.boardScrollHeight, 22);
  assert.ok(335 * layout.boardScale > layout.boardScrollHeight);
});

test('le ScrollView ne grandit pas au-delà du plateau et les commandes suivent immédiatement', () => {
  const source = read('src/components/wwg/WildWestGoldGame.tsx');
  assert.match(source, /<ScrollView[\s\S]*?style=\{\[styles\.boardScroll,\s*\{\s*height: boardScrollHeight,\s*maxHeight: boardScrollHeight,\s*flexGrow: 0,\s*flexShrink: 0,\s*flexBasis: 'auto'/);
  assert.match(source, /boardScroll:\s*\{\s*flexGrow:\s*0,\s*flexShrink:\s*0,\s*flexBasis:\s*'auto'/);
  const boardScroll = source.indexOf('style={[styles.boardScroll, { height: boardScrollHeight');
  const control = source.indexOf('<View style={styles.control}>', boardScroll);
  assert.ok(boardScroll >= 0 && control > boardScroll);
});

test('le plateau WWG est ancré sous les modes 2x/3x au lieu d’être centré dans le vide', () => {
  const source = read('src/components/wwg/WildWestGoldGame.tsx');
  assert.match(source, /boardScrollContent:\s*\{\s*flexGrow:\s*1,\s*justifyContent:\s*'flex-start',\s*alignItems:\s*'center'\s*\}/);
  const modeRow = source.indexOf('<View style={styles.modeRow}>');
  const boardScroll = source.indexOf('<ScrollView', modeRow);
  assert.ok(modeRow >= 0 && boardScroll > modeRow);
});
