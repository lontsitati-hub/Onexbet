/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
  GAME_LAUNCH_ROUTES,
  isGameLaunchRoutePrefetched,
  prefetchGameLaunchRoute,
  resolveGameLaunchRoute,
} = require('../src/services/gameLaunchRoutes.ts');

const projectRoot = path.resolve(__dirname, '..');

test('chaque jeu intégré redirige vers une route Expo Router existante', () => {
  for (const [gameId, route] of Object.entries(GAME_LAUNCH_ROUTES)) {
    assert.equal(resolveGameLaunchRoute(gameId), route);
    assert.ok(fs.existsSync(path.join(projectRoot, 'src/app', `${route.slice(1)}.tsx`)), route);
  }
});

test('le préchargement d’une route est mémorisé et ne se relance pas', () => {
  const route = '/__launch-cache-test__';
  let prefetchCount = 0;
  const router = { prefetch: () => { prefetchCount += 1; } };
  assert.equal(isGameLaunchRoutePrefetched(route), false);
  prefetchGameLaunchRoute(router, route);
  assert.equal(isGameLaunchRoutePrefetched(route), true);
  prefetchGameLaunchRoute(router, route);
  assert.equal(prefetchCount, 1);
});

test('Crash ouvre l’interface du dernier ZIP et partage le portefeuille global', () => {
  const route = fs.readFileSync(path.join(projectRoot, 'src/app/crash.tsx'), 'utf8');
  const screen = fs.readFileSync(path.join(projectRoot, 'src/components/crash/CrashGameScreen.tsx'), 'utf8');
  const wallet = fs.readFileSync(path.join(projectRoot, 'src/components/crash/crashWallet.ts'), 'utf8');
  const botCommand = fs.readFileSync(path.join(projectRoot, 'src/components/crash/crashBotCommand.ts'), 'utf8');
  const game = fs.readFileSync(path.join(projectRoot, 'src/components/crash/web-src/app.js'), 'utf8');
  const bridge = fs.readFileSync(path.join(projectRoot, 'src/components/crash/web-src/wallet-bridge.js'), 'utf8');
  const nativeWebView = fs.readFileSync(path.join(projectRoot, 'src/components/crash/CrashWebView.native.tsx'), 'utf8');
  const crashHtml = fs.readFileSync(path.join(projectRoot, 'src/components/crash/web-src/index.html'), 'utf8');
  const bundledHtml = fs.readFileSync(path.join(projectRoot, 'src/components/crash/gameHtml.ts'), 'utf8');
  const store = fs.readFileSync(path.join(projectRoot, 'src/store/useBetStore.ts'), 'utf8');
  const loader = fs.readFileSync(path.join(projectRoot, 'src/app/xgame-loading.tsx'), 'utf8');

  assert.equal(resolveGameLaunchRoute('crash'), '/crash');
  assert.equal(resolveGameLaunchRoute('crash-point'), '/crash-point');
  assert.match(route, /<CrashGameScreen\s*\/>/);
  assert.match(screen, /getBalance: \(\) => useBetStore\.getState\(\)\.balance/);
  assert.match(screen, /updateBalance: \(amount\) => useBetStore\.getState\(\)\.updateBalance\(amount\)/);
  assert.match(screen, /walletProcessor\.closeOpenBets\(\)/);
  assert.match(wallet, /completedTransactions\.has\(transactionKey\)/);
  assert.match(wallet, /status !== 'live'/);
  assert.match(wallet, /MAX_BET = 358548\.65/);
  assert.match(screen, /setActiveTab\('populaire'\);\s*navigateTo1xGames\(\)/);
  assert.ok(screen.includes("doc(db, 'crash_channels', user.uid)"));
  assert.ok(screen.includes('parseCrashBotCommand(snapshot.data(), Date.now(), lastBotCommandId.current)'));
  assert.ok(screen.includes("type: 'bot_crash_target'"));
  assert.match(botCommand, /MAX_AGE_MS = 10 \* 60 \* 1000/);
  assert.match(botCommand, /data\.source !== 'botx-web'/);
  assert.match(botCommand, /data\.commandId === lastCommandId/);
  assert.ok(screen.indexOf('loadLastCrashBotCommandId(AsyncStorage, user.uid)') < screen.indexOf("onSnapshot(doc(db, 'crash_channels', user.uid)"));
  assert.match(screen, /await persistCrashBotCommandId\(AsyncStorage, user\.uid, command\.commandId\)/);
  assert.match(screen, /if \(!command \|\| persistenceFailed\) return/);
  assert.match(screen, /if \(!active \|\| generation !== authGeneration \|\| auth\.currentUser\?\.uid !== user\.uid\) return;\s*persistenceFailed = true/);
  assert.match(game, /window\.AviatorWalletBridge\.debit/);
  assert.match(game, /window\.AviatorWalletBridge\.credit/);
  assert.match(game, /window\.AviatorWalletBridge\?\.settleLoss/);
  assert.match(game, /betId: String\(bet\.id\)/);
  assert.match(game, /betAmount: bet\.amount,[\s\S]*?multiplier/);
  assert.match(game, /function applyBotCrashTarget\(command\)/);
  assert.match(game, /pendingBotCrashTarget \?\? upcomingCrashes/);
  assert.match(bridge, /onCrashTarget\(listener\)/);
  assert.match(bridge, /message\.type === 'bot_crash_target'/);
  assert.doesNotMatch(game, /let balance = 5428311/);
  assert.doesNotMatch(game, /balance\s*\+=|Math\.max\(0,\s*balance\s*-/);
  assert.match(game, /Connexion…/);
  assert.match(bridge, /mode:\s*'host'/);
  assert.doesNotMatch(bridge, /5428311|mockBalance|simulatedBalance/);
  assert.match(nativeWebView, /originWhitelist=\{\['about:blank'\]\}/);
  assert.match(nativeWebView, /scrollEnabled/);
  assert.match(bundledHtml, /settleLoss/);
  assert.match(bundledHtml, /data:image\/png;base64,/);
  assert.doesNotMatch(bundledHtml, /deposit-button/);
  assert.doesNotMatch(bundledHtml, /href=.{0,20}assets/);
  assert.doesNotMatch(bundledHtml, /src=.{0,20}app\.js/);
  assert.ok(store.includes('updateBalance: (amount) => {'));
  assert.ok(loader.includes("const isAviator = destination === '/aviator-game';"));
  assert.ok(loader.includes("const isCrash = destination === '/crash';"));
  assert.ok(!loader.includes('MIN_GAME_LOADING_MS = 2000'));
  assert.ok(screen.includes('onLoad={handleWebLoadSuccess}'));
  assert.match(nativeWebView, /onLoad=\{onLoad\}/);
  const webWebView = fs.readFileSync(path.join(projectRoot, 'src/components/crash/CrashWebView.web.tsx'), 'utf8');
  assert.match(webWebView, /onLoad,\s*frameBorder/);
  assert.ok(screen.includes('loadingOverlayVisible'));
  assert.match(crashHtml, /Statistiques et joueurs de démonstration — ne reflètent pas les mises du compte/);
});

test('le compte à rebours Crash suit la vidéo 4→1 et n’annonce que les mises réellement en file', () => {
  const game = fs.readFileSync(path.join(projectRoot, 'src/components/crash/web-src/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(projectRoot, 'src/components/crash/web-src/index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(projectRoot, 'src/components/crash/web-src/styles.css'), 'utf8');
  assert.match(game, /const COUNTDOWN_SECONDS = 4;/);
  assert.match(game, /acceptedBetNoticeNode\.hidden = phase !== 'countdown' \|\| !bets\.some\(bet => bet\.state === 'queued'\)/);
  assert.match(game, /bet\.state = phase === 'flight' && roundNumber >= targetRound \? 'live' : 'queued'/);
  assert.match(html, /id="countdown-accepted" class="countdown-accepted" hidden aria-live="polite">Votre pari est accepté !/);
  assert.match(styles, /\.countdown-accepted\{/);
  assert.match(game, /const countdownMarkerPositions = \[\[386,31\],\[348,29\],\[315,46\],\[300,79\],\[289,112\]\]/);
  assert.match(game, /const countdownMarkerAngles = \[108,77,48,18,0\]/);
  assert.match(game, /rotate\(\$\{angle\.toFixed\(1\)\}\)/);
  assert.match(html, /class="wallet-plus" aria-hidden="true"/);
  assert.match(html, /M-6 0L6 0/);
  assert.match(html, /id="countdown-indicator-overlay" class="countdown-indicator-overlay"/);
  assert.match(game, /countdown-indicator-overlay'\)\.style\.display = showCountdownIndicator \? 'block' : 'none'/);
  assert.doesNotMatch(html, /<button[^>]*class="wallet-plus"/);
  assert.match(styles, /\.wallet-plus\{[^}]*background:#b4d9b6/);
  assert.match(styles, /\.countdown-indicator-overlay\{[^}]*z-index:2/);
  assert.match(styles, /\.countdown-active-bar\{[^}]*stroke-width:5\.8/);
  assert.doesNotMatch(styles, /\.countdown-segment\.is-(?:active|complete)/);
});

test('la flèche Apple Fortune revient à l’écran 1xGames du lobby', () => {
  const game = fs.readFileSync(path.join(projectRoot, 'src/components/aof/v4/game-screen.tsx'), 'utf8');
  const popular = fs.readFileSync(path.join(projectRoot, 'src/components/tabs/PopularTab.tsx'), 'utf8');
  assert.match(game, /useBetStore\.getState\(\)\.setActiveTab\('populaire'\);\s*router\.dismissTo\(\{ pathname: '\/', params: \{ topTab: 'games' \} \} as any\);/);
  assert.match(popular, /const \{ topTab \} = useLocalSearchParams/);
  assert.match(popular, /const nextTab = requestedTab as TopTab;\s*setActiveTopTab\(nextTab\);/);
  assert.match(game, /accessibilityLabel="Retour aux jeux"/);
  assert.match(game, /hitSlop=\{12\}/);
  assert.doesNotMatch(game, /onPress=\{\(\) => router\.back\(\)\}/);
});

test('le bouton de retrait AOF reste bleu et ne peut pas encaisser un gain nul', () => {
  const game = fs.readFileSync(path.join(projectRoot, 'src/components/aof/v4/game-screen.tsx'), 'utf8');
  const styles = fs.readFileSync(path.join(projectRoot, 'src/components/aof/v4/reference-styles.ts'), 'utf8');
  assert.match(game, /onPress=\{cashOut\}[\s\S]*?disabled=\{level === 0\}/);
  assert.match(styles, /cashSurfaceDisabled:\s*\{\s*backgroundColor: '#3D7FCB'/);
  assert.match(styles, /cashButtonDisabledText:\s*\{\s*opacity: 0\.88\s*\}/);
});

test('les identifiants inconnus, réservés ou hérités ne produisent pas de fausse route', () => {
  for (const gameId of ['jeu-inconnu', '__proto__', 'constructor', 'toString']) {
    assert.equal(resolveGameLaunchRoute(gameId), null, gameId);
  }
});

test('le loader attend les ressources sélectionnées sans trembler ni recharger deux fois', () => {
  const popular = fs.readFileSync(path.join(projectRoot, 'src/components/tabs/PopularTab.tsx'), 'utf8');
  const loader = fs.readFileSync(path.join(projectRoot, 'src/app/xgame-loading.tsx'), 'utf8');
  const aofAssets = fs.readFileSync(path.join(projectRoot, 'src/components/aof/v4/use-game-assets.ts'), 'utf8');
  const crashScreen = fs.readFileSync(path.join(projectRoot, 'src/components/crash/CrashGameScreen.tsx'), 'utf8');
  const rootLayout = fs.readFileSync(path.join(projectRoot, 'src/app/_layout.tsx'), 'utf8');
  assert.match(popular, /pathname:\s*['"]\/xgame-loading['"]/);
  assert.match(loader, /prefetchGameLaunchRoute\(router, destination\)/);
  assert.match(loader, /isGameLaunchRoutePrefetched\(destination\)/);
  assert.match(loader, /completedRoute !== destination/);
  assert.match(loader, /MIN_GAME_LOADING_MS = 300/);
  assert.match(loader, /LOADING_START_FRAME/);
  assert.match(loader, /LOADING_COMPLETE_FRAME/);
  assert.match(loader, /preloadGameAssets\(\)/);
  assert.match(rootLayout, /Font\.loadAsync\(\{/);
  assert.match(rootLayout, /MaterialCommunityIcons\.font/);
  assert.doesNotMatch(loader, /LOADING_FRAME_MS|setInterval\(/);
  assert.doesNotMatch(loader, /MIN_GAME_LOADING_MS = 2000/);
  assert.match(loader, /navigationTriggered = useRef\(false\)/);
  assert.match(loader, /if \(!active \|\| navigationTriggered\.current \|\| !destination\) return/);
  assert.match(loader, /destination === '\/crash'/);
  assert.match(loader, /frame-00\.png/);
  assert.match(loader, /frame-10\.png/);
  assert.match(loader, /<Image\b/);
  assert.match(loader, /router\.replace\(destination/);
  assert.match(aofAssets, /let gameAssetsLoaded = false/);
  assert.match(aofAssets, /let gameAssetsLoadPromise: Promise<Asset\[\]> \| null = null/);
  assert.match(aofAssets, /export function areGameAssetsLoaded/);
  assert.match(aofAssets, /export function preloadGameAssets/);
  assert.match(aofAssets, /useState\(areGameAssetsLoaded\)/);
  assert.match(crashScreen, /onLoad=\{handleWebLoadSuccess\}/);
  assert.match(crashScreen, /loadingOverlayVisible &&/);
  assert.match(crashScreen, /webLoadComplete \? CRASH_LOADING_COMPLETE_FRAME : CRASH_LOADING_START_FRAME/);
  assert.match(crashScreen, /loadingOverlay:\s*\{[\s\S]*pointerEvents: 'none'/);
  assert.doesNotMatch(crashScreen, /top: insets\.top, bottom: insets\.bottom/);
  assert.match(crashScreen, /loadingHideTimer\.current = setTimeout/);
  assert.doesNotMatch(loader, /expo-video|VideoView|useVideoPlayer|\.mp4|gameTitle|Chargement de la partie|1x GAMES/);
  assert.equal(fs.existsSync(path.join(projectRoot, 'assets/videos/xgame-loading.mp4')), false);
  for (let index = 0; index <= 10; index += 1) {
    assert.ok(fs.existsSync(path.join(projectRoot, 'assets/game/xgame-loading', `frame-${String(index).padStart(2, '0')}.png`)));
  }
});

test('le splash général charge ses 8 pictogrammes une seule fois avant de lancer l’application', () => {
  const layout = fs.readFileSync(path.join(projectRoot, 'src/app/_layout.tsx'), 'utf8');
  const splash = fs.readFileSync(path.join(projectRoot, 'src/components/branding/theme-splash.tsx'), 'utf8');
  const popular = fs.readFileSync(path.join(projectRoot, 'src/components/tabs/PopularTab.tsx'), 'utf8');
  const loader = fs.readFileSync(path.join(projectRoot, 'src/app/xgame-loading.tsx'), 'utf8');
  assert.doesNotMatch(layout, /MIN_STARTUP_SPLASH_DURATION_MS/);
  assert.match(layout, /if \(!splashThemeReady\) return <View style=\{layoutStyles\.neutralStartupSplash\} \/>/);
  assert.match(layout, /<SplashScreen onComplete=\{finishSplashAnimation\} \/>/);
  assert.match(layout, /if \(startupReady\.current && iconFontsReady\.current\) setLoading\(false\)/);
  assert.match(splash, /SPORT_LOADER_COUNT - 0\.5/);
  assert.match(splash, /duration: 7200/);
  assert.match(splash, /sequence\.start\(/);
  assert.doesNotMatch(splash, /Animated\.loop/);
  assert.match(popular, /const gameLaunchInProgress = useRef\(false\)/);
  assert.match(popular, /if \(gameLaunchInProgress\.current\) return/);
  assert.match(popular, /gameLaunchInProgress\.current = true/);
  assert.match(popular, /gameLaunchInProgress\.current = false/);
  assert.equal((loader.match(/router\.replace\(destination as never\)/g) || []).length, 1);
});

test('le splash 1xBet affiche les logos partenaires prévus', () => {
  const layout = fs.readFileSync(path.join(projectRoot, 'src/components/branding/theme-splash.tsx'), 'utf8');
  for (const partner of ['partner-psg.png', 'partner-losc.png', 'partner-barca.png', 'partner-caf.png', 'partner-pud.png']) {
    assert.match(layout, new RegExp(partner.replace('.', '\\.')));
    assert.ok(fs.existsSync(path.join(projectRoot, 'assets/images/android-splash/dynamic', partner)));
  }
  assert.match(layout, /partners/);
});

test('le splash MegaParis utilise un fond noir et son logo à deux points', () => {
  const branding = fs.readFileSync(path.join(projectRoot, 'src/constants/themeBranding.ts'), 'utf8');
  assert.match(branding, /red_mega: \{ background: '#000000'/);
  assert.match(branding, /logoDark: require\('\.\.\/\.\.\/assets\/images\/brand-logos\/megapari-logo-transparent\.png'\)/);
  assert.match(branding, /red_mega: \{ background: '#000000', loaderColor: '#FFFFFF'/);
  assert.ok(fs.existsSync(path.join(projectRoot, 'assets/images/brand-logos/megapari-splash-horizontal.png')));
  const splash = fs.readFileSync(path.join(projectRoot, 'src/components/branding/theme-splash.tsx'), 'utf8');
  assert.match(splash, /theme === 'red_mega'\s*\? MEGA_LOGO/);
  assert.match(splash, /megaLogo: \{ left: '3%', width: '94%', height: '24%' \}/);
});

test('un changement de style joue le splash de ce style jusqu’à la fin de sa séquence', () => {
  const layout = fs.readFileSync(path.join(projectRoot, 'src/app/_layout.tsx'), 'utf8');
  const themeScreen = fs.readFileSync(path.join(projectRoot, 'src/app/admin-theme.tsx'), 'utf8');
  assert.match(layout, /setThemeSplashVisible\(true\)/);
  assert.match(layout, /<SplashScreen onComplete=\{\(\) => setThemeSplashVisible\(false\)\} \/>/);
  assert.doesNotMatch(layout, /setThemeSplashVisible\(false\),\s*5000/);
  assert.match(layout, /if \(loading \|\| previousTheme\.current === theme \|\| !isUnlocked\)/);
  assert.match(layout, /\}, \[theme, isUnlocked, loading\]\);/);
  assert.match(themeScreen, /betStore\.setActiveTab\('populaire'\)/);
  assert.match(themeScreen, /router\.replace\('\/'\)/);
  assert.doesNotMatch(themeScreen, /onPress=\{\(\) => \{[\s\S]{0,120}betStore\.setTheme\(t\)/);
});

test('Apple Fortune garde le bouton de récupération des gains visible pendant une manche', () => {
  const game = fs.readFileSync(path.join(projectRoot, 'src/components/aof/v4/game-screen.tsx'), 'utf8');
  const styles = fs.readFileSync(path.join(projectRoot, 'src/components/aof/v4/reference-styles.ts'), 'utf8');
  assert.match(game, /contentContainerStyle=\{\[styles\.scroll,[\s\S]*?inRound && \{ paddingBottom: 124 \}\]\}/);
  assert.match(game, /removeClippedSubviews=\{false\}/);
  assert.match(game, /\{showCashOutDock && !roundEnded && \([\s\S]*?<View style=\{styles\.cashOutDock\}>[\s\S]*?RÉCUPÉRER LES GAINS/);
  assert.match(game, /\{roundEnded && \([\s\S]*?<View style=\{styles\.actionArea\}>/);
  assert.match(styles, /cashOutDock:\s*\{[\s\S]*?position: 'absolute'[\s\S]*?bottom: 28/);
  assert.doesNotMatch(game.slice(game.indexOf('<ScrollView'), game.indexOf('</ScrollView>')), /styles\.actionArea/);
  assert.match(game, /const startRound = useCallback\(async \(\) => \{\s*Keyboard\.dismiss\(\)[\s\S]{0,80}if \(busyRef\.current\) return;/);
});

test('Apple Fortune allège le clic sans loader ajouté ni changement du débit', () => {
  const game = fs.readFileSync(path.join(projectRoot, 'src/components/aof/v4/game-screen.tsx'), 'utf8');
  const startAt = game.indexOf('const startRound = useCallback(async () => {');
  const startEnd = game.indexOf('\n  const finishRound', startAt);
  const startRound = game.slice(startAt, startEnd);
  const busy = startRound.indexOf('setBusy(true);');
  const wager = startRound.indexOf('await game.addWager(bet);');
  assert.ok(busy >= 0 && busy < wager, 'l’UI busy doit être activée avant l’écriture asynchrone');
  assert.match(startRound, /busyRef\.current = true;[\s\S]*?await game\.addWager\(bet\);/);
  assert.match(startRound, /catch \(error\) \{[\s\S]*?busyRef\.current = false;[\s\S]*?setBusy\(false\);/);
  assert.match(game, /disabled=\{!assetsLoaded \|\| busy\}/);
  assert.ok(wager < startRound.indexOf('const r = createRound('), 'le débit confirmé précède la création de manche');
  assert.doesNotMatch(startRound, /setTimeout|requestAnimationFrame|InteractionManager/);
  assert.doesNotMatch(game, /ActivityIndicator/);
  assert.match(game, /\{settingsOpen && <SettingsSheet visible onClose=\{\(\) => setSettingsOpen\(false\)\} \/>\}/);
  assert.match(game, /<Text allowFontScaling=\{false\} style=\{styles\.playButtonText\}>\{!assetsLoaded \? "Chargement\.\.\." : "JOUER"\}<\/Text>/);
});

test('Apple Fortune masque les cotes avant JOUER puis les révèle pendant la manche', () => {
  const game = fs.readFileSync(path.join(projectRoot, 'src/components/aof/v4/game-screen.tsx'), 'utf8');
  const styles = fs.readFileSync(path.join(projectRoot, 'src/components/aof/v4/reference-styles.ts'), 'utf8');
  assert.match(game, /const showMultiplierCodes = inRound \|\| roundEnded/);
  assert.match(game, /\{showMultiplierCodes && \([\s\S]*?×\{MULT_STR\[lvl\]\}/);
  assert.match(styles, /backgroundDimmer:[\s\S]*?rgba\(0, 15, 10, 0\.06\)/);
  assert.match(styles, /balancePill:[\s\S]*?rgba\(0, 18, 15, 0\.50\)/);
  assert.match(styles, /betChip:[\s\S]*?backgroundColor: '#3D7FCB'/);
});

test('Apple Fortune fait défiler les deux premiers choix puis stabilise le plateau à x1,93', () => {
  const game = fs.readFileSync(path.join(projectRoot, 'src/components/aof/v4/game-screen.tsx'), 'utf8');
  const styles = fs.readFileSync(path.join(projectRoot, 'src/components/aof/v4/reference-styles.ts'), 'utf8');
  assert.match(game, /const rowsToShift = Math\.min\(Math\.max\(progressedRows, 0\), 2\);/);
  assert.match(styles, /betSection:[^}]*maxWidth: 286/);
  assert.match(styles, /betPanel:[^}]*borderRadius: 8/);
});

test('Apple Fortune n’applique plus d’ombre noire rectangulaire sur les cases', () => {
  const cell = fs.readFileSync(path.join(projectRoot, 'src/components/aof/v4/barrel-cell.tsx'), 'utf8');
  assert.doesNotMatch(cell, /hiddenShade/);
  assert.match(cell, /opacity: target/);
});

test('le root retarde le préchargement au login et ne prépare que le loader de jeu', () => {
  const layout = fs.readFileSync(path.join(projectRoot, 'src/app/_layout.tsx'), 'utf8');
  const routes = fs.readFileSync(path.join(projectRoot, 'src/services/gameLaunchRoutes.ts'), 'utf8');
  const loader = fs.readFileSync(path.join(projectRoot, 'src/app/xgame-loading.tsx'), 'utf8');
  assert.match(layout, /prefetchAppRoutes\(router\)/);
  assert.match(layout, /if \(!isUnlocked\) return;\s*prefetchAppRoutes\(router\)/);
  assert.match(routes, /APP_PREFETCH_ROUTES = \['\/xgame-loading'\] as const/);
  assert.doesNotMatch(routes, /requestIdleCallback|deferredRoutes/);
  assert.match(loader, /prefetchGameLaunchRoute\(router, destination\)/);
});

test('les deux accès du menu et le filtre Casino mènent aux sections protégées', () => {
  const menu = fs.readFileSync(path.join(projectRoot, 'src/components/tabs/MenuTab.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(projectRoot, 'src/app/casino.tsx'), 'utf8');
  const casino = fs.readFileSync(path.join(projectRoot, 'src/components/tabs/CasinoTab.tsx'), 'utf8');
  const popular = fs.readFileSync(path.join(projectRoot, 'src/components/tabs/PopularTab.tsx'), 'utf8');
  const layout = fs.readFileSync(path.join(projectRoot, 'src/app/_layout.tsx'), 'utf8');
  assert.equal((menu.match(/router\.push\(['"]\/casino['"]\)/g) || []).length, 2);
  assert.match(route, /return <CasinoTab \/>/);
  assert.match(layout, /if \(!isUnlocked && !localAofPreview\)\s*\{\s*return <AuthScreen/);
  assert.match(popular, /id: 'casino', label: 'Casino'/);
  assert.match(popular, /activeTopTab === 'casino'/);
  for (const section of ['Exclusives', '1xLive', 'Machines à sous Populaire']) {
    assert.ok(casino.includes(`title="${section}"`), `section ${section} absente`);
  }
});

test('le bouton de l’historique vide ouvre l’onglet Populaire', () => {
  const index = fs.readFileSync(path.join(projectRoot, 'src/app/index.tsx'), 'utf8');
  assert.match(index, /onPress=\{\(\) => useBetStore\.getState\(\)\.setActiveTab\(['"]populaire['"]\)\}/);
  assert.match(index, /Placer un pari/);
});

test('une restauration réseau incertaine finit par afficher une voie de reprise', () => {
  const layout = fs.readFileSync(path.join(projectRoot, 'src/app/_layout.tsx'), 'utf8');
  assert.match(layout, /RETRYABLE_AUTH_SPLASH_TIMEOUT_MS/);
  assert.match(layout, /setAccessError\(errorMsg \|\|/);
  assert.match(layout, /\{accessError\}/);
});

test('la configuration Android autorise le geste Retour prédictif', () => {
  const config = fs.readFileSync(path.join(projectRoot, 'app.config.ts'), 'utf8');
  assert.match(config, /predictiveBackGestureEnabled:\s*true/);
});

test('le suivi global appelle le règlement automatique FIFA', () => {
  const layout = fs.readFileSync(path.join(projectRoot, 'src/app/_layout.tsx'), 'utf8');
  assert.match(layout, /store\.autoSettleFifaCoupon\(coupon\.id\)/);
  assert.match(layout, /event\.sport === ['"]FIFA['"]/);
});
