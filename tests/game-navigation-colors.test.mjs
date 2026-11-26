import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('les flèches des cinq jeux ramènent explicitement à l’onglet 1xGames', () => {
  const helper = read('src/utils/gameNavigation.ts');
  const aof = read('src/components/aof/v4/game-screen.tsx');
  const aviator = read('src/components/aviator/AviatorGameScreen.tsx');
  const crash = read('src/components/crash/CrashGameScreen.tsx');
  const crashPoint = read('src/app/crash-point.tsx');
  const wwg = read('src/components/wwg/WildWestGoldGame.tsx');
  const wwgRoute = read('src/app/wild-west-gold.tsx');
  const popular = read('src/components/tabs/PopularTab.tsx');

  assert.match(helper, /router\.dismissTo\(\{ pathname: '\/', params: \{ topTab: 'games' \} \}/);
  assert.match(aof, /router\.dismissTo\(\{ pathname: '\/', params: \{ topTab: 'games' \} \}/);
  assert.match(aviator, /onPress=\{navigateTo1xGames\}/);
  assert.match(crash, /setActiveTab\('populaire'\);\s*navigateTo1xGames\(\)/);
  assert.match(crashPoint, /onPress=\{navigateTo1xGames\}/);
  assert.match(wwg, /onPress=\{navigateTo1xGames\} style=\{styles\.headerBack\}/);
  assert.match(wwgRoute, /if \(!access\.allowed\) \{\s*navigateTo1xGames\(\)/);
  assert.match(popular, /const \{ topTab \} = useLocalSearchParams/);
  assert.match(popular, /const nextTab = requestedTab as TopTab;\s*setActiveTopTab\(nextTab\);/);
  assert.doesNotMatch(aviator, /router\.back\(\)/);
  assert.doesNotMatch(crash, /router\.replace\('\/'\)/);
  assert.doesNotMatch(crashPoint, /onPress=\{\(\) => router\.back\(\)\}/);
  assert.doesNotMatch(wwg, /Pressable style=\{styles\.headerBack\}>/);
});

test('les refus de mise Aviator sont visibles sans remplacer les callbacks', () => {
  const aviatorPanel = read('src/components/aviator/BetPanel.tsx');
  assert.match(aviatorPanel, /const handleAction = \(\) => \{\s*setActionError\(null\);/);
  assert.equal((aviatorPanel.match(/if \(err\) setActionError\(err\);/g) ?? []).length, 5);
  assert.match(aviatorPanel, /\{actionError && \([\s\S]*?<Text style=\{styles\.actionError\} accessibilityRole="alert" accessibilityLiveRegion="polite">\s*\{actionError\}/);
});

test('les choix de coupon et les badges FIFA reprennent l’accent actif du thème', () => {
  const builder = read('src/components/admin/CouponBuilderTab.tsx');
  assert.match(builder, /s\.typeBtn, \{ backgroundColor: activeBgColor \}/);
  assert.match(builder, /s\.fifaBadge, \{ backgroundColor: activeBgColor \}/);
  assert.match(builder, /backgroundColor: m\.league === cat\.title \? activeColor : activeBgColor/);
  assert.match(builder, /s\.fifaBadgeText, \{ color: activeColor \}/);
  assert.match(builder, /status === 'Accepté' \? \{ backgroundColor: COLORS\.primaryBlue \}/);
});

test('les CTA Aviator et WWG gardent un fond et un libellé visibles', () => {
  const aviatorPanel = read('src/components/aviator/BetPanel.tsx');
  const depositMenu = read('src/components/aviator/DepositMenu.tsx');
  const wwg = read('src/components/wwg/WildWestGoldGame.tsx');
  const aofStyles = read('src/components/aof/v4/reference-styles.ts');
  const aofScreen = read('src/components/aof/v4/game-screen.tsx');

  assert.match(aviatorPanel, /<View style=\{\[styles\.mainBtn, \{ backgroundColor: mainBtn\.bg \}, styles\.actionButton\]\}>/);
  assert.match(aviatorPanel, /bg: "#1F9C09"/);
  assert.match(aviatorPanel, /bg: "#ffad29"/);
  assert.doesNotMatch(aviatorPanel, /#28A912/);
  assert.match(depositMenu, /actionBtn:\s*\{\s*backgroundColor: "#17C653"/);
  assert.match(wwg, /onPress=\{closeWin\} style=\{\[styles\.continue, \{ backgroundColor: '#5baa37'/);
  assert.match(wwg, /color: '#fff9da', fontSize: 8, fontWeight: '900'/);
  assert.doesNotMatch(wwg, /color: 'transparent'\}>CONTINUER/);
  assert.match(aofStyles, /cashSurface: \{[^}]*backgroundColor: '#3D7FCB', borderColor: '#3D7FCB' \}/);
  assert.match(aofStyles, /cashSurfaceDisabled: \{[^}]*opacity: 0\.55 \}/);
  assert.match(aofScreen, /disabled=\{level === 0\}[\s\S]*?<View style=\{\[styles\.actionButtonSurface, styles\.cashSurface, level === 0 && styles\.cashSurfaceDisabled\]\}>/);
});
