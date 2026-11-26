import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const splash = fs.readFileSync(path.join(root, 'src/components/branding/theme-splash.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/_layout.tsx'), 'utf8');
const config = fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8');

test('le chargeur affiche les huit assets sportifs dans leur ordre avec une superposition animée', () => {
  const indices = [...splash.matchAll(/android-splash\/loader-(\d+)\.png/g)].map((match) => Number(match[1]));
  assert.deepEqual(indices, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.match(splash, /SPORT_LOADER_COUNT = 8/);
  assert.match(splash, /<Image source=\{LOADER_DOT\}/);
  assert.match(splash, /<Animated\.Image source=\{LOADER_ICONS\[index\]\}/);
  assert.doesNotMatch(splash, /config\.loaderColor/);
});

test('la séquence conserve le fondu en ordre d’origine, se joue une fois et finit sur la huitième icône', () => {
  assert.match(splash, /toValue: SPORT_LOADER_COUNT - 0\.5/);
  assert.match(splash, /duration: 7200/);
  assert.match(splash, /inputRange: \[index, index \+ 0\.5, SPORT_LOADER_COUNT\]/);
  assert.match(splash, /outputRange: \[0, 1, 1\]/);
  assert.match(splash, /sequence\.start\(\(\{ finished \}\)/);
  assert.match(splash, /onCompleteRef\.current\?\.\(\)/);
  assert.doesNotMatch(splash, /Animated\.loop/);
  assert.match(splash, /isReduceMotionEnabled/);
  assert.match(splash, /if \(completed\.current\) \{\s*phase\.setValue\(SPORT_LOADER_COUNT - 0\.5\);\s*return;/);
  assert.doesNotMatch(splash, /completed\.current = false/);
});

test('le thème sauvegardé est lu avant le splash de marque; la première vue native reste neutre', () => {
  assert.match(layout, /useBetStore\.getState\(\)\.loadFromDb\(\);\s*setSplashThemeReady\(true\)/);
  assert.match(layout, /if \(!splashThemeReady\) return <View style=\{layoutStyles\.neutralStartupSplash\} \/>/);
  assert.match(layout, /return <SplashScreen onComplete=\{finishSplashAnimation\} \/>/);
  assert.match(layout, /window\.location\.pathname === '\/splash-preview'/);
  assert.match(config, /native-neutral-splash\.png/);
  assert.match(config, /backgroundColor: "#101820"/);
});
