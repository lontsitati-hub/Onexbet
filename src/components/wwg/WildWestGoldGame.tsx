import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, ImageBackground, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { useBetStore } from '@/store/useBetStore';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { createInitialWildWestRound, wildWestAppChannelPatch } from '@/services/wildWestProtocol';
import { navigateTo1xGames } from '@/utils/gameNavigation';
import { getWildWestLayout } from './wwgLayout';

type Mode = 2 | 3;
type Phase = 'idle' | 'playing' | 'lost' | 'won';

const A = {
  desert: require('./individual-assets/reference-desert.png'), bonusEmpty: require('./individual-assets/bonus-empty-reference.png'), wheel: require('./individual-assets/lucky-wheel-reference.png'), bag: require('./individual-assets/victory-bag-cutout.png'), gold2: require('./individual-assets/gold-cell-2x-reference.png'), gold3: require('./individual-assets/gold-cell-3x-reference.png'), bomb: require('./individual-assets/bomb-cell-2x-reference.png'), leftSvg: require('./individual-assets/icon-arrow-left.svg'), rightSvg: require('./individual-assets/icon-arrow-right.svg'),
  boardFrame: require('./individual-assets/board-frame-reference.png'), woodPanel: require('./individual-assets/wood-panel-reference.png'), tab2IdleSelected: require('./individual-assets/mode-2x-idle-selected.png'), tab2IdleInactive: require('./individual-assets/mode-2x-idle-inactive.png'), tab3IdleSelected: require('./individual-assets/mode-3x-idle-selected.png'), tab3IdleInactive: require('./individual-assets/mode-3x-idle-inactive.png'), tab2GameSelected: require('./individual-assets/mode-2x-game-selected.png'), tab3GameSelected: require('./individual-assets/mode-3x-game-selected.png'), statusIdle: require('./individual-assets/status-banner-idle.png'), statusLoss: require('./individual-assets/status-banner-loss.png'), statusCurrent: require('./individual-assets/status-banner-current.png'), statusWin: require('./individual-assets/status-banner-win.png'), sky: require('./individual-assets/sky-background-reference.png'), backExact: require('./individual-assets/back-icon-reference.png'), settingsExact: require('./individual-assets/settings-icon-reference.png'), helpExact: require('./individual-assets/help-button-reference.png'), balancePill: require('./individual-assets/balance-pill-reference.png'), betField: require('./individual-assets/bet-field-reference.png'), betKeyOn: require('./individual-assets/bet-key-active-reference.png'), betKeyOff: require('./individual-assets/bet-key-disabled-reference.png'), playButton: require('./individual-assets/play-button-reference.png'), cashoutOn: require('./individual-assets/cashout-active-reference.png'), cashoutOff: require('./individual-assets/cashout-disabled-reference.png'),
  back: require('./individual-assets/icon-back.svg'), settings: require('./individual-assets/icon-settings.svg'), plus: require('./individual-assets/icon-plus.svg'), help: require('./individual-assets/icon-help.svg'), keyboard: require('./individual-assets/icon-keyboard.svg'), play: require('./individual-assets/icon-play.svg'),
};
const cells = [require('./individual-assets/cell-ref-2x-01.png'), require('./individual-assets/cell-ref-2x-02.png'), require('./individual-assets/cell-ref-2x-03.png'), require('./individual-assets/cell-ref-2x-04.png'), require('./individual-assets/cell-ref-2x-05.png'), require('./individual-assets/cell-ref-2x-06.png'), require('./individual-assets/cell-ref-2x-07.png'), require('./individual-assets/cell-ref-2x-08.png'), require('./individual-assets/cell-ref-2x-09.png'), require('./individual-assets/cell-ref-2x-10.png'), require('./individual-assets/cell-ref-2x-11.png'), require('./individual-assets/cell-ref-2x-12.png')];
const cells3 = [require('./individual-assets/cell-ref-3x-01.png'), require('./individual-assets/cell-ref-3x-02.png'), require('./individual-assets/cell-ref-3x-03.png'), require('./individual-assets/cell-ref-3x-04.png'), require('./individual-assets/cell-ref-3x-05.png'), require('./individual-assets/cell-ref-3x-06.png'), require('./individual-assets/cell-ref-3x-07.png'), require('./individual-assets/cell-ref-3x-08.png'), require('./individual-assets/cell-ref-3x-09.png'), require('./individual-assets/cell-ref-3x-10.png'), require('./individual-assets/cell-ref-3x-11.png'), require('./individual-assets/cell-ref-3x-12.png'), require('./individual-assets/cell-ref-3x-13.png'), require('./individual-assets/cell-ref-3x-14.png'), require('./individual-assets/cell-ref-3x-15.png'), require('./individual-assets/cell-ref-3x-16.png'), require('./individual-assets/cell-ref-3x-17.png'), require('./individual-assets/cell-ref-3x-18.png')];
const activeCells2 = [require('./individual-assets/cell-active-2x-1.png'),require('./individual-assets/cell-active-2x-2.png')];
const activeCells3 = [require('./individual-assets/cell-active-3x-1.png'),require('./individual-assets/cell-active-3x-2.png'),require('./individual-assets/cell-active-3x-3.png')];
const money = (v: number) => `${Math.round(v)} XAF`;
type ChannelPatch = Record<string, unknown>;
type FailedChannelWrite =
  | { kind: 'patch'; uid: string; patch: ChannelPatch; context: string }
  | { kind: 'round-started'; uid: string; mode: Mode; commandId: string; context: string };

function newRoundCommandId() {
  return globalThis.crypto?.randomUUID?.() ?? `onexbet-wwg-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function commitRoundStarted(uid: string, mode: Mode, commandId: string) {
  const channel = doc(db, 'wild_west_gold_channels', uid);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(channel);
    const patch = { game: 'wild-west-gold', action: 'reveal', status: 'round-started', mode, row: 5, col: 0, commandId, source: 'onexbet-app', updatedAt: serverTimestamp() };
    if (snapshot.exists()) {
      transaction.update(channel, patch);
    } else {
      transaction.set(channel, createInitialWildWestRound(mode, commandId, serverTimestamp()));
    }
  });
}

function networkErrorMessage(error: unknown, context: string) {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
  if (code === 'permission-denied') return `Synchronisation refusée pendant ${context}. Vérifiez votre session et vos droits Firebase.`;
  if (code === 'unavailable' || code === 'failed-precondition') return `Réseau indisponible pendant ${context}. Vérifiez votre connexion puis réessayez.`;
  return `Impossible de synchroniser ${context}. Vérifiez votre connexion puis réessayez.`;
}

type GameSvgIconName = 'arrow-left' | 'arrow-right' | 'back';

function GameSvgIcon({ name, style }: { name: GameSvgIconName; style: { width: number; height: number } }) {
  if (name === 'back') {
    return (
      <Svg width={style.width} height={style.height} viewBox="0 0 24 24">
        <Path d="M15.5 4.5 8 12l7.5 7.5" fill="none" stroke="#73818a" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  return (
    <Svg width={style.width} height={style.height} viewBox="0 0 43 24">
      {name === 'arrow-left' ? (
        <>
          <Path d="M3 12h31" stroke="#9b6b2b" strokeWidth={5} />
          <Path d="m3 12 10-9M3 12l10 9" fill="none" stroke="#9b6b2b" strokeWidth={4} />
          <Path d="m34 4 8 8-8 8Z" fill="#c08b3d" />
        </>
      ) : (
        <>
          <Path d="M40 12H9" stroke="#9b6b2b" strokeWidth={5} />
          <Path d="m40 12-10-9M40 12l-10 9" fill="none" stroke="#9b6b2b" strokeWidth={4} />
          <Path d="m9 4-8 8 8 8Z" fill="#c08b3d" />
        </>
      )}
    </Svg>
  );
}

function BonusTicket() { return <View style={styles.emptyArtWrap}><Svg width="86" height="48" viewBox="0 0 86 48"><Rect x="5" y="8" width="73" height="32" rx="5" fill="#d6eaf2" stroke="#9cc9dc" strokeWidth="2"/><Path d="M10 12 H73 V36 H10 Z" fill="#f2f8fa"/><Circle cx="17" cy="14" r="1.5" fill="#4c91b8"/><Circle cx="29" cy="14" r="1.5" fill="#4c91b8"/><Circle cx="41" cy="14" r="1.5" fill="#4c91b8"/><Circle cx="53" cy="14" r="1.5" fill="#4c91b8"/><Circle cx="65" cy="14" r="1.5" fill="#4c91b8"/><Circle cx="78" cy="9" r="5" fill="#c9e2ed"/></Svg><Text style={styles.empty777}>7 7 7</Text></View>; }

function SkyBackground() { return <View pointerEvents="none" style={StyleSheet.absoluteFill}><Image source={A.sky} style={StyleSheet.absoluteFill} resizeMode="stretch" /></View>; }

function VictoryParchment() { return <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 280 160" preserveAspectRatio="none" style={StyleSheet.absoluteFill}><Path d="M5 4 L42 6 L63 2 L89 5 L112 2 L137 5 L160 2 L185 5 L207 3 L232 6 L253 2 L276 6 L274 25 L279 43 L275 59 L279 76 L274 94 L278 111 L274 128 L278 151 L251 154 L228 151 L205 157 L181 153 L159 157 L134 153 L110 157 L88 153 L63 157 L40 153 L5 156 L7 136 L2 118 L6 101 L2 83 L6 66 L2 49 L7 32 Z" fill="#5c3d22" stroke="#c4a156" strokeWidth="2"/><Path d="M11 10 L269 10 L269 149 L11 149 Z" fill="none" stroke="#886234" strokeWidth="1"/></Svg>; }

function BetParchment() { return <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 285 280" preserveAspectRatio="none" style={StyleSheet.absoluteFill}><Path d="M5 4 L36 3 L58 6 L89 2 L116 5 L142 2 L173 5 L201 2 L229 5 L251 3 L280 6 L278 24 L282 40 L278 57 L281 74 L278 93 L282 109 L278 127 L282 145 L278 164 L282 181 L278 200 L282 218 L278 237 L281 256 L276 274 L249 272 L226 276 L200 272 L175 276 L148 272 L122 276 L98 272 L72 276 L46 273 L24 276 L4 271 L7 251 L3 233 L7 214 L3 196 L7 177 L3 158 L7 140 L3 121 L7 102 L3 83 L7 65 L3 47 L7 29 Z" fill="#e2d09b" stroke="#b39152" strokeWidth="2"/><Path d="M17 21 H267" stroke="#f4e7bf" strokeWidth="2" opacity=".75"/></Svg>; }

function ParchmentFrame() { return <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 340 335" preserveAspectRatio="none" style={StyleSheet.absoluteFill}><Path d="M9 1 L329 2 L332 8 L338 11 L336 20 L340 28 L335 35 L337 57 L334 67 L339 81 L335 94 L339 113 L334 127 L338 145 L334 156 L339 173 L335 191 L340 205 L334 219 L338 236 L334 250 L339 270 L335 283 L338 299 L333 309 L336 322 L329 331 L12 334 L7 328 L2 323 L5 308 L0 298 L5 283 L1 271 L6 254 L2 241 L6 225 L1 211 L5 195 L1 180 L6 164 L2 149 L6 133 L1 118 L5 101 L1 88 L6 74 L2 61 L6 48 L1 37 L5 27 L2 15 L8 10 Z M13 11 L327 11 L327 324 L13 324 Z" fill="#cbb17a" fillRule="evenodd" stroke="#8b6b3d" strokeWidth="2" /></Svg>; }

function WoodPanel() { return <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 400 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}><Defs><LinearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#bd9255" /><Stop offset="0.42" stopColor="#a77c43" /><Stop offset="1" stopColor="#8e6637" /></LinearGradient></Defs><Rect width="400" height="100" fill="url(#wood)" /><Path d="M0 10 H400 M0 14 H400 M0 85 H400 M0 89 H400" stroke="#604421" strokeOpacity=".48" strokeWidth="2"/><Path d="M0 32 H400 M0 63 H400" stroke="#e1b36c" strokeOpacity=".14" strokeWidth="2"/></Svg>; }

function setup(mode: Mode) { const safe = new Set<number>(); for (let row = 0; row < 6; row++) safe.add(row * mode + Math.floor(Math.random() * mode)); return { safe }; }

function Reveal({ children }: { children: React.ReactNode }) { const p = useRef(new Animated.Value(0)).current; useEffect(() => { Animated.sequence([Animated.timing(p, { toValue: .72, duration: 80, useNativeDriver: true }), Animated.spring(p, { toValue: 1, speed: 22, bounciness: 3, useNativeDriver: true })]).start(); }, [p]); const scale = p.interpolate({ inputRange: [0, .72, 1], outputRange: [.86, 1.02, 1] }); const opacity = p.interpolate({ inputRange: [0, 1], outputRange: [.15, 1] }); return <Animated.View style={{ flex: 1, transform: [{ scale }], opacity }}>{children}</Animated.View>; }

export default function WildWestGoldGame() {
  const { width, height } = useWindowDimensions(); const insets = useSafeAreaInsets(); const { appWidth, gameTopPadding, boardScale, boardWidth, boardScrollHeight } = getWildWestLayout({ width, height, topInset: insets.top, bottomInset: insets.bottom });
  const [screen, setScreen] = useState<'game' | 'bonus'>('game'); const [mode, setMode] = useState<Mode>(2); const [phase, setPhase] = useState<Phase>('idle'); const [bet, setBet] = useState(500); const [betText, setBetText] = useState('500'); const balance = useBetStore((state) => state.balance); const balanceHydrated = useBetStore((state) => state.isHydrated); const updateBalance = useBetStore((state) => state.updateBalance); const [lastPayout, setLastPayout] = useState(0); const [round, setRound] = useState(0); const [selected, setSelected] = useState<Set<number>>(new Set()); const [safe, setSafe] = useState<Set<number>>(new Set()); const [mine, setMine] = useState(-1); const [win, setWin] = useState(0); const [showBet, setShowBet] = useState(false); const [showWin, setShowWin] = useState(false); const [networkError, setNetworkError] = useState<string | null>(null); const [retrying, setRetrying] = useState(false);
  const screenAnim = useRef(new Animated.Value(1)).current; const modalAnim = useRef(new Animated.Value(0)).current;
  const pendingBot = useRef<{ uid: string; commandId: string; row: number; col: number } | null>(null);
  const lastBotCommandId = useRef<string | null>(null);
  const failedWrite = useRef<FailedChannelWrite | null>(null);
  const gameStateRef = useRef({ mode, phase, safe, selected });
  useEffect(() => {
    gameStateRef.current = { mode, phase, safe, selected };
  }, [mode, phase, safe, selected]);
  const writeChannel = async (uid: string, patch: ChannelPatch, context: string) => {
    try {
      await updateDoc(doc(db, 'wild_west_gold_channels', uid), wildWestAppChannelPatch(patch));
      failedWrite.current = null;
      setNetworkError(null);
      return true;
    } catch (error) {
      failedWrite.current = { kind: 'patch', uid, patch, context };
      setNetworkError(networkErrorMessage(error, context));
      return false;
    }
  };
  const writeRoundStarted = async (uid: string, mode: Mode) => {
    const commandId = newRoundCommandId();
    try {
      await commitRoundStarted(uid, mode, commandId);
      failedWrite.current = null;
      setNetworkError(null);
      return true;
    } catch (error) {
      failedWrite.current = { kind: 'round-started', uid, mode, commandId, context: 'le démarrage de la manche' };
      setNetworkError(networkErrorMessage(error, 'le démarrage de la manche'));
      return false;
    }
  };
  const retryChannelWrite = async () => {
    const pending = failedWrite.current;
    if (!pending) return;
    setRetrying(true);
    try {
      if (pending.kind === 'round-started') {
        await commitRoundStarted(pending.uid, pending.mode, pending.commandId);
      } else {
        await updateDoc(doc(db, 'wild_west_gold_channels', pending.uid), wildWestAppChannelPatch(pending.patch));
      }
      failedWrite.current = null;
      setNetworkError(null);
    } catch (error) {
      setNetworkError(networkErrorMessage(error, pending.context));
    } finally {
      setRetrying(false);
    }
  };
  const total = mode === 2 ? 12 : 18; const statusSkin = phase === 'lost' ? A.statusLoss : phase === 'won' || (phase === 'idle' && lastPayout > 0) ? A.statusWin : phase === 'playing' && selected.size > 0 ? A.statusCurrent : A.statusIdle; const status = useMemo(() => { if (phase === 'lost') return ['Pas de chance. On rejoue?', '#843729']; if (phase === 'won') return [`Gains récupérés : ${money(win)}`, '#72b32e']; if (phase === 'idle' && lastPayout > 0) return [`GAINS RÉCUPÉRÉS : ${money(lastPayout)}`, '#72b32e']; if (phase === 'playing' && selected.size) return [`Gains actuels : ${money(win)}`, '#686034']; if (phase === 'playing') return ["Devinez où est caché l'or!", '#64582d']; return ['Sélectionnez le niveau de difficulté et placez votre pari !', '#64582d']; }, [phase, selected.size, win, lastPayout]);

  useEffect(() => { if (showBet || showWin) { modalAnim.setValue(0); Animated.timing(modalAnim, { toValue: 1, duration: 190, useNativeDriver: true }).start(); } }, [showBet, showWin, modalAnim]);
  const navigate = (next: 'game' | 'bonus') => { screenAnim.setValue(0); setScreen(next); Animated.timing(screenAnim, { toValue: 1, duration: 240, useNativeDriver: true }).start(); };
  const start = () => { if (!balanceHydrated) { Alert.alert('Solde en cours de chargement', 'Patientez un instant puis réessayez.'); return; } if (bet > balance) { Alert.alert('Solde insuffisant', `Votre solde disponible est de ${money(balance)}.`); return; } const s = setup(mode); setLastPayout(0); setPhase('playing'); setSelected(new Set()); setSafe(s.safe); setMine(-1); setWin(0); setShowWin(false); setRound((r) => r + 1); pendingBot.current = null; const uid = auth.currentUser?.uid; if (uid) void writeRoundStarted(uid, mode); };
  const changeMode = (next: Mode) => { if (phase !== 'idle' || next === mode) return; setMode(next); };
  const pick = (index: number) => { const pending = pendingBot.current; if (pending && (Math.floor(index / mode) !== pending.row || index % mode !== pending.col)) { Alert.alert('Case verrouillée', 'Touchez exactement la case sélectionnée dans BotX pour continuer.'); return; } if (phase !== 'playing' || Math.floor(index / mode) !== selected.size) return; const next = new Set(selected); next.add(index); setSelected(next); const hitSafe = safe.has(index); if (!hitSafe) { setMine(index); updateBalance(Number(Math.max(0, useBetStore.getState().balance - bet).toFixed(2))); setPhase('lost'); setWin(0); } else setWin(bet * (mode === 3 ? 3 : 2)); if (pending && pending.row === Math.floor(index / mode) && pending.col === index % mode) { pendingBot.current = null; void writeChannel(pending.uid, { status: hitSafe ? 'revealed' : 'lost', updatedAt: serverTimestamp() }, hitSafe ? 'la confirmation du gain' : 'la confirmation de la perte'); } else if (!hitSafe) { const uid = auth.currentUser?.uid; if (uid) void writeChannel(uid, { status: 'round-ended', updatedAt: serverTimestamp() }, 'la clôture de la manche'); } };
  // Bot Wild West : prépare uniquement la case annoncée.
  // La révélation et la perte éventuelle doivent toujours provenir d'un toucher
  // explicite dans le jeu, comme dans le flux West Gold de référence.
  useEffect(() => {
    let stopChannel: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopChannel?.(); stopChannel = undefined; pendingBot.current = null; lastBotCommandId.current = null;
      if (!user?.uid) return;
      stopChannel = onSnapshot(doc(db, 'wild_west_gold_channels', user.uid), (snapshot) => {
        const d = snapshot.data();
        if (d?.source === 'botx-web' && d?.game === 'wild-west-gold' && d?.action === 'reset' && (d?.status === 'waiting' || d?.status === 'reset')) {
          pendingBot.current = null; lastBotCommandId.current = null; setPhase('idle'); setSelected(new Set()); setWin(0); setShowWin(false); return;
        }
        const commandId = typeof d?.commandId === 'string' ? d.commandId : '';
        const updated = typeof d?.updatedAt?.toMillis === 'function' ? d.updatedAt.toMillis() : 0;
        const row = d?.row; const col = d?.col; const requestedMode = d?.mode;
        const valid = d?.source === 'botx-web' && d?.game === 'wild-west-gold' && d?.action === 'reveal' && d?.status === 'pending' && !!commandId && commandId !== lastBotCommandId.current && Date.now() - updated >= -60000 && Date.now() - updated <= 600000 && (requestedMode === 2 || requestedMode === 3) && Number.isInteger(row) && row >= 0 && row <= 5 && Number.isInteger(col) && col >= 0 && col < requestedMode;
        if (!valid) return;
        lastBotCommandId.current = commandId;
        const state = gameStateRef.current;
        const activeRow = state.selected.size;
        if (state.phase === 'playing' && state.mode === requestedMode && row === activeRow) {
          const nextSafe = new Set(state.safe);
          for (let c = 0; c < requestedMode; c++) nextSafe.delete(row * requestedMode + c);
          nextSafe.add(row * requestedMode + col);
          setSafe(nextSafe);
          pendingBot.current = { uid: user.uid, commandId, row, col };
          gameStateRef.current = { ...state, safe: nextSafe };
          // Ne pas appeler pick() ici : le joueur doit toucher la case
          // préparée dans l'écran du jeu. pick() enverra alors revealed/lost.
          void writeChannel(user.uid, { status: 'prepared', updatedAt: serverTimestamp() }, 'la préparation de la case');
        } else {
          void writeChannel(user.uid, { status: 'unavailable', updatedAt: serverTimestamp() }, 'le signalement de manche indisponible');
        }
      }, (error) => { setNetworkError(networkErrorMessage(error, 'la réception des commandes')); });
    });
    return () => { stopAuth(); stopChannel?.(); };
  }, []);

  const submitBet = () => { const value = Math.max(1, Number(betText) || 500); setBet(value); setBetText(String(value)); setShowBet(false); };
  const collectWin = () => { updateBalance(Number((useBetStore.getState().balance + win).toFixed(2))); setPhase('won'); const p = pendingBot.current; pendingBot.current = null; const uid = p?.uid || auth.currentUser?.uid; if (uid) void writeChannel(uid, { game: 'wild-west-gold', action: 'reset', status: 'waiting', mode, row: 0, col: 0, updatedAt: serverTimestamp() }, 'la remise à zéro après encaissement'); setShowWin(true); }; const closeWin = () => { setLastPayout(win); setShowWin(false); setPhase('idle'); setSelected(new Set()); };
  useEffect(() => { if (phase !== 'lost') return; const timer = setTimeout(() => { setPhase('idle'); setSelected(new Set()); setWin(0); }, 1800); return () => clearTimeout(timer); }, [phase]);
  const modalStyle = { opacity: modalAnim, transform: [{ scale: modalAnim.interpolate({ inputRange: [0, 1], outputRange: [.94, 1] }) }] };
  const renderCell = (index: number) => {
    const revealed = phase === 'lost' || phase === 'won' || selected.has(index);
    const isMine = mine === index;
    const isSafe = safe.has(index);
    const activeRow = (phase === 'playing' || (phase === 'idle' && lastPayout > 0)) && Math.floor(index / mode) === selected.size;
    const disabled = phase !== 'playing' || !activeRow || selected.has(index);
    const botTarget = pendingBot.current?.row === Math.floor(index / mode) && pendingBot.current?.col === index % mode;
    const cellSource = activeRow
      ? (mode === 2 ? activeCells2[index % 2] : activeCells3[index % 3])
      : mode === 2 ? cells[index % 12] : cells3[index];
    const revealSource = phase === 'lost'
      ? (isSafe ? (mode === 3 ? A.gold3 : A.gold2) : A.bomb)
      : revealed && (isMine || isSafe)
        ? (isMine ? A.bomb : mode === 3 ? A.gold3 : A.gold2)
        : null;

    return (
      <Pressable
        key={index}
        accessibilityLabel={botTarget ? 'Case sélectionnée et révélée automatiquement par BotX' : undefined}
        accessibilityHint={botTarget ? 'Aucune interaction manuelle requise' : undefined}
        disabled={disabled}
        onPress={() => pick(index)}
        style={({ pressed }) => [styles.cell, { width: mode === 2 ? '48.6%' : '31.6%', height: 44 * boardScale, opacity: 1 }, botTarget && { borderWidth: 2, borderColor: '#f5d889' }, pressed && !disabled && styles.cellPressed]}
      >
        <View style={styles.cellImage}>
          <Image
            source={cellSource}
            style={[StyleSheet.absoluteFill, styles.cellRadius]}
            resizeMode="cover"
            accessible={false}
          />
          {revealSource ? (
            <Reveal><Image source={revealSource} style={styles.revealed} /></Reveal>
          ) : null}
        </View>
      </Pressable>
    );
  };
  const grid = (
    <View style={[styles.grid, { rowGap: 9 * boardScale }]}>
      {Array.from({ length: 6 }, (_, displayRow) => {
        const row = 5 - displayRow;
        return (
          <View key={row} style={[styles.gridRow, { columnGap: 8 * boardScale }]}>
            {Array.from({ length: mode }, (_, col) => renderCell(row * mode + col))}
          </View>
        );
      })}
    </View>
  );
  const game = (
    <View style={[styles.game, { paddingTop: gameTopPadding }]}>
      <SkyBackground />
      <Image source={A.desert} style={styles.desert} />
      {networkError ? (
        <View style={styles.networkNotice}>
          <Text style={styles.networkNoticeText}>{networkError}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Réessayer la synchronisation" onPress={() => void retryChannelWrite()} disabled={retrying} style={styles.networkRetry}>
            <Text style={styles.networkRetryText}>{retrying ? 'Nouvel essai…' : 'Réessayer'}</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.tools}>
        <Pressable onPress={() => navigate('bonus')} style={styles.help}>
          <Image source={A.helpExact} style={StyleSheet.absoluteFill} resizeMode="stretch" />
        </Pressable>
        <ImageBackground source={statusSkin} style={styles.status} imageStyle={styles.stretchImage}>
          <Text style={styles.statusText}>{status[0]}</Text>
        </ImageBackground>
      </View>
      <View style={styles.modeRow}>
        {phase === 'idle' && lastPayout === 0 ? (
          <>
            <Pressable onPress={() => changeMode(2)}><GameSvgIcon name="arrow-left" style={styles.arrowSvg} /></Pressable>
            <Pressable onPress={() => changeMode(2)}><ImageBackground source={mode === 2 ? A.tab2IdleSelected : A.tab2IdleInactive} style={styles.modeTab} imageStyle={styles.stretchImage} /></Pressable>
            <Pressable onPress={() => changeMode(3)}><ImageBackground source={mode === 3 ? A.tab3IdleSelected : A.tab3IdleInactive} style={styles.modeTab} imageStyle={styles.stretchImage} /></Pressable>
            <Pressable onPress={() => changeMode(3)}><GameSvgIcon name="arrow-right" style={styles.arrowSvg} /></Pressable>
          </>
        ) : (
          <ImageBackground source={mode === 2 ? A.tab2GameSelected : A.tab3GameSelected} style={[styles.modeTab, styles.selectedMode, mode === 2 ? styles.modeTwoSelected : styles.modeThreeSelected]} imageStyle={styles.stretchImage} />
        )}
      </View>
      <ScrollView
        style={[styles.boardScroll, { height: boardScrollHeight, maxHeight: boardScrollHeight, flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }]}
        contentContainerStyle={styles.boardScrollContent}
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        <View style={[styles.board, { width: boardWidth, paddingTop: 14 * boardScale, paddingBottom: 12 * boardScale, paddingHorizontal: 13 * boardScale }]}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Image source={A.boardFrame} style={StyleSheet.absoluteFill} resizeMode="stretch" />
          </View>
          {grid}
        </View>
      </ScrollView>
      <View style={styles.control}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={A.woodPanel} style={StyleSheet.absoluteFill} resizeMode="stretch" />
        </View>
        <Pressable disabled={phase !== 'idle'} style={styles.betReadout} onPress={() => { setBetText(String(bet)); setShowBet(true); }}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Image source={A.betField} style={StyleSheet.absoluteFill} resizeMode="stretch" />
          </View>
          <Text style={styles.betText}>{money(bet)}</Text>
        </Pressable>
        <Pressable disabled={phase !== 'idle'} style={styles.betKey} onPress={() => { setBetText(String(bet)); setShowBet(true); }}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Image source={phase === 'idle' ? A.betKeyOn : A.betKeyOff} style={StyleSheet.absoluteFill} resizeMode="stretch" />
          </View>
        </Pressable>
        {phase === 'playing' && win > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Récupérer les gains" style={styles.cashout} onPress={collectWin}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Image source={A.cashoutOn} style={StyleSheet.absoluteFill} resizeMode="stretch" />
            </View>
          </Pressable>
        ) : phase === 'playing' || phase === 'lost' || phase === 'won' ? (
          <View style={styles.cashout}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Image source={A.cashoutOff} style={StyleSheet.absoluteFill} resizeMode="stretch" />
            </View>
          </View>
        ) : phase === 'idle' && lastPayout > 0 ? (
          <View style={[styles.cashout, { zIndex: 0 }]}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Image source={A.cashoutOff} style={StyleSheet.absoluteFill} resizeMode="stretch" />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Jouer" style={[styles.play, { position: 'absolute', left: 0, top: -5, zIndex: 1 }]} onPress={start}>
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Image source={A.playButton} style={StyleSheet.absoluteFill} resizeMode="stretch" />
              </View>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Jouer" style={styles.play} onPress={start}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Image source={A.playButton} style={StyleSheet.absoluteFill} resizeMode="stretch" />
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
  const bonus = <View style={styles.bonus}><View style={styles.bonusTop}><Pressable onPress={() => navigate('game')} style={styles.icon}><GameSvgIcon name="back" style={styles.backSvg} /></Pressable><Text style={styles.bonusTitle}>Bonus</Text><View style={{ width: 28 }} /></View><ScrollView contentContainerStyle={styles.bonusContent} bounces={false}><BonusTicket /><Text style={styles.emptyText}>Vous n'avez pas de bonus</Text><Text style={styles.hint}>Jouez et récoltez des bonus !</Text><View style={styles.bonusCard}><Image source={A.wheel} style={styles.wheel} /><Text style={styles.bonusCopy}>Jouez à la Lucky Wheel et gagnez des{`\n`}bonus uniques</Text><Text style={styles.link}>Jouer</Text></View></ScrollView></View>;
  return <SafeAreaView style={styles.safe}><StatusBar style="dark" /><Animated.View style={[styles.app, { width: appWidth, opacity: screenAnim, transform: [{ translateX: screenAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>{screen === 'game' ? <View style={styles.topbar}><View style={{width:28}} /><ImageBackground source={A.balancePill} style={[styles.balance, phase !== 'idle' && styles.balanceDim]} imageStyle={styles.stretchImage}><Text style={styles.balanceText}>{balance.toFixed(2)} F</Text></ImageBackground><View style={{width:24}} /><Pressable onPress={navigateTo1xGames} style={styles.headerBack} accessibilityRole="button" accessibilityLabel="Retour aux jeux"><Image source={A.backExact} style={StyleSheet.absoluteFill} resizeMode="stretch" /></Pressable><Image source={A.settingsExact} style={styles.headerSettings} resizeMode="stretch" /></View> : null}{screen === 'game' ? game : bonus}</Animated.View>
    <Modal transparent visible={showBet} animationType="none" onRequestClose={() => setShowBet(false)}><View style={styles.overlay}><Animated.View style={[styles.betModal, modalStyle]}><BetParchment /><View style={styles.betHead}><TextInput value={betText} onChangeText={setBetText} keyboardType="numeric" style={styles.betInput} /><Pressable onPress={() => setShowBet(false)} style={styles.closeButton}><Text style={styles.close}>×</Text></Pressable></View><View style={styles.options}>{[[200, 400], [1000, 2000], [5000, 10000]].map((pair, i) => <View key={i} style={styles.optionRow}>{pair.map((v) => <Pressable key={v} onPress={() => setBetText(String(v))} style={styles.option}><Text style={styles.optionText}>{v}</Text></Pressable>)}</View>)}</View><Pressable onPress={submitBet} style={styles.place}><Text style={styles.placeText}>PLACER UN PARI</Text></Pressable></Animated.View></View></Modal>
    <Modal transparent visible={showWin} animationType="none" onRequestClose={closeWin}><View style={[styles.overlay, styles.winOverlay]}><Animated.View style={[styles.winModal, modalStyle]}><VictoryParchment /><View style={styles.winCopy}><Text style={styles.winTitle}>GAINS RÉCUPÉRÉS !</Text><Text style={styles.winLabel}>VOUS AVEZ GAGNÉ :</Text><Text style={styles.winAmount}>{money(win)}</Text></View><Image source={A.bag} style={styles.bag} /><Pressable onPress={closeWin} style={[styles.continue, { backgroundColor: '#5baa37', borderColor: '#c6df8b', borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }]} accessibilityRole="button" accessibilityLabel="Continuer"><Text style={{ color: '#fff9da', fontSize: 8, fontWeight: '900' }}>CONTINUER</Text></Pressable></Animated.View></View></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ networkNotice: { position: 'absolute', top: 44, left: 10, right: 10, zIndex: 20, backgroundColor: '#7a2f26', borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }, networkNoticeText: { color: '#fff7e1', flex: 1, fontSize: 12, fontWeight: '600' }, networkRetry: { backgroundColor: '#f1c75b', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 }, networkRetryText: { color: '#3b261b', fontSize: 12, fontWeight: '700' }, safe: { flex: 1, backgroundColor: '#d5d0c7' }, app: { flex: 1, minHeight: 0, alignSelf: 'center', backgroundColor: '#f7f8fb', overflow: 'hidden' }, topbar: { height: 39, position: 'relative', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, backgroundColor: '#fff' }, icon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }, back: { color: '#89939b', fontSize: 31, lineHeight: 29 }, backSvg: { width: 18, height: 22 }, settingsSvg: { width: 31, height: 26 }, plusSvg: { width: 25, height: 25 }, helpSvg: { width: 46, height: 48 }, keyboardSvg: { width: 35, height: 29 }, playSvg: { width: 41, height: 44 }, arrowSvg: { width: 43, height: 24 }, balance: { width: 130, height: 29, position: 'relative', alignItems: 'center', justifyContent: 'center' }, balanceText: { position: 'absolute', left: 2, top: 8, width: 95, textAlign: 'center', color: '#fff', fontSize: 9, fontWeight: '800' }, plus: { color: '#fff', backgroundColor: '#59b935', width: 24, height: 24, borderRadius: 12, textAlign: 'center', lineHeight: 23, fontSize: 20 }, settings: { width: 28, textAlign: 'center', color: '#89939b', fontSize: 19 }, game: { flex: 1, minHeight: 0, paddingTop: 97, position: 'relative', backgroundColor: '#f3f5f0' }, tools: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingLeft: 22, paddingRight: 32 }, help: { width: 46, height: 47, borderRadius: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#159aa2' }, helpText: { color: '#fff', fontSize: 30, fontWeight: '900' }, status: { flex: 1, height: 45, minHeight: 45, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 }, statusText: { color: '#fff5df', fontSize: 12, lineHeight: 15, textAlign: 'center', fontWeight: '500' }, modeRow: { height: 36, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 3 }, arrow: { width: 42, height: 28 }, modeTab: { width: 120, height: 36 }, selectedMode: { width: 120, height: 38 }, modeTwoSelected: { transform: [{ translateX: -57 }] }, modeThreeSelected: { transform: [{ translateX: 57 }] }, stretchImage: { resizeMode: 'stretch' }, board: { alignSelf: 'center', position: 'relative', backgroundColor: 'transparent', borderWidth: 0, shadowColor: '#554024', shadowOpacity: 0.24, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  boardScroll: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minHeight: 0, width: '100%', zIndex: 1, elevation: 1 },
  boardScrollContent: { flexGrow: 1, justifyContent: 'flex-start', alignItems: 'center' }, grid: { width: '100%', flexDirection: 'column', rowGap: 9, backgroundColor: '#e2cb91', zIndex: 2, elevation: 2 }, gridRow: { width: '100%', flexDirection: 'row', columnGap: 8 }, cell: { height: 44 }, cellImage: { width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#d6c08c', borderRadius: 5 }, activeGlow: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255, 232, 0, 0.52)', borderRadius: 5 }, cellRadius: { borderRadius: 5 }, cellPressed: { transform: [{ translateY: 2 }, { scale: .98 }] }, revealed: { width: '100%', height: '100%', resizeMode: 'cover' }, control: { height: 102, minHeight: 102, flexShrink: 0, position: 'relative', zIndex: 2, elevation: 2, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, backgroundColor: '#a27a43', borderTopWidth: 0, borderBottomWidth: 0, shadowColor: '#3e2b17', shadowOpacity: 0.28, shadowRadius: 5, shadowOffset: { width: 0, height: -2 } }, betReadout: { width: 81, height: 51, flexShrink: 0, position: 'relative', alignItems: 'center', justifyContent: 'center' }, betText: { color: '#5e4c27', fontSize: 10, fontWeight: '900' }, betKey: { width: 64, height: 64, flexShrink: 0, position: 'relative', marginHorizontal: 0 }, key: { color: '#fff0c6', fontSize: 28 }, play: { width: 74, height: 74, marginLeft: 12, flexShrink: 0, position: 'relative' }, playText: { color: '#fff4ca', fontSize: 28 }, cashout: { flex: 1, minWidth: 68, height: 63, marginLeft: 13, position: 'relative' }, disabledCashout: { opacity: .92 }, cashoutActive: { backgroundColor: '#64aa31', borderColor: '#438326' }, balanceDim: { opacity: .65 }, headerBack: { position: 'absolute', left: 20, top: 4, width: 23, height: 28 }, headerSettings: { position: 'absolute', right: 19, top: 4, width: 28, height: 28 }, controlDisabled: { opacity: .72 }, betKeyDisabled: { backgroundColor: '#77766f' }, cashoutText: { color: '#f9f4cf', fontSize: 9, fontWeight: '900' }, desert: { position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 120, resizeMode: 'cover', zIndex: 0 }, bonus: { flex: 1, backgroundColor: '#e7ebf3' }, bonusTop: { height: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, backgroundColor: '#fff' }, bonusTitle: { color: '#60666d', fontSize: 12, fontWeight: '800' }, bonusContent: { minHeight: 777, paddingTop: 78 }, emptyArtWrap: { width: 86, height: 48, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, empty777: { position: 'absolute', top: 16, color: '#4e88a9', fontSize: 15, fontWeight: '900', letterSpacing: 2 }, emptyText: { marginTop: 16, textAlign: 'center', color: '#6d8090', fontSize: 13, fontWeight: '800' }, hint: { marginTop: 12, textAlign: 'center', color: '#6d8090', fontSize: 11 }, bonusCard: { height: 83, marginTop: 23, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#dfe4ea' }, wheel: { width: 66, height: 66 }, bonusCopy: { flex: 1, color: '#22384d', fontSize: 12, lineHeight: 15, fontWeight: '800' }, link: { color: '#52769b', fontSize: 12 }, overlay: { flex: 1, backgroundColor: 'rgba(27,25,17,.7)', alignItems: 'center', justifyContent: 'center', padding: 20 }, winOverlay: { backgroundColor: 'rgba(30,24,16,.52)' }, betModal: { width: 285, minHeight: 275, position: 'relative', paddingHorizontal: 20, paddingBottom: 18, backgroundColor: 'transparent', borderWidth: 0 }, betHead: { height: 58, position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 7 }, betInput: { flex: 1, height: 34, backgroundColor: '#fff6cf', color: '#6e5322', paddingHorizontal: 8, fontSize: 14, fontWeight: '800' }, closeButton: { position: 'absolute', top: 0, right: -11, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#76551f', zIndex: 2 }, close: { color: '#fff0bd', fontSize: 20, lineHeight: 22 }, options: { gap: 8 }, optionRow: { flexDirection: 'row', justifyContent: 'space-between' }, option: { width: 117, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#76551f', borderWidth: 2, borderColor: '#a17a43', borderRadius: 3 }, optionText: { color: '#ffeeb7', fontSize: 14, fontWeight: '900' }, place: { height: 38, marginTop: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5baa37' }, placeText: { color: '#fff9da', fontSize: 12, fontWeight: '900' }, winModal: { width: 280, height: 160, position: 'relative', overflow: 'hidden', borderWidth: 0, backgroundColor: 'transparent', padding: 23 }, winCopy: { width: 145, zIndex: 2, gap: 3 }, winTitle: { color: '#fff8e8', fontSize: 18, fontWeight: '900' }, winLabel: { color: '#fff4c8', fontSize: 12, fontWeight: '900' }, winAmount: { color: '#fff8e8', fontSize: 14, fontWeight: '900' }, bag: { position: 'absolute', right: 7, bottom: -3, width: 97, height: 129, resizeMode: 'contain' }, continue: { position: 'absolute', right: 8, bottom: 8, width: 80, height: 28 } });
