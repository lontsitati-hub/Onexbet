/**
 * Écran Aviator — style officiel (rouge #E4331E / vert #17C653 / noir profond).
 *
 * Second jeu de l'onglet Fast Games, intégré depuis le projet fourni par
 * l'utilisateur (aviator-game). Conversion 100 % locale : aucune connexion
 * réseau. Le solde global SQLite finance les paris et reçoit les gains.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { navigateTo1xGames } from '@/utils/gameNavigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
// Note : le haptic utilise require() dynamique (expo-haptics).
import { useBetStore } from '@/store/useBetStore';
import { getThemeAccentColor } from '@/constants/themeBranding';
import { auth, db } from '@/services/firebase';
import { useAviatorGame } from '@/components/aviator/useAviatorGame';
import { GameViewport } from '@/components/aviator/GameViewport';
import { BetPanel } from '@/components/aviator/BetPanel';
import { HistoryStrip } from '@/components/aviator/HistoryStrip';
import { DepositMenu } from '@/components/aviator/DepositMenu';
import { AVIATOR_PROFILE_AVATARS, getRandomAviatorAvatars } from '@/components/aviator/avatarAssets';
import {
  AVIATOR_COMPACT_LAYOUT_BREAKPOINT_DP,
  getAviatorCompactChartHeight,
} from '@/components/aviator/aviatorLayout';

const TOKEN_COLORS: Record<'red' | 'blue' | 'pink', { bg: string; text: string }> = {
  red: { bg: 'rgba(74,144,226,0.18)', text: '#5A9FE8' },
  blue: { bg: 'rgba(74,100,226,0.22)', text: '#7B8FF0' },
  pink: { bg: 'rgba(160,80,230,0.25)', text: '#C084F0' },
};

type LiveTab = 'all' | 'my' | 'top';

export type AviatorGameMode = 'aviator' | 'crash';

export default function AviatorGameScreen({ gameMode = 'aviator' }: { gameMode?: AviatorGameMode }) {
  const isAviatorGame = gameMode === 'aviator';
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const usableHeight = height - insets.top - insets.bottom;
  const compactLayout = usableHeight < AVIATOR_COMPACT_LAYOUT_BREAKPOINT_DP;
  const canvasHeightHint = compactLayout ? getAviatorCompactChartHeight(usableHeight) : undefined;
  const balance = useBetStore((state) => state.balance);
  const theme = useBetStore((state) => state.theme);
  const activeColor = getThemeAccentColor(theme);
  const updateBalance = useBetStore((state) => state.updateBalance);
  const getLatestBalance = useCallback(() => useBetStore.getState().balance, []);

  const {
    sessions,
    phase,
    bets,
    pendingBets,
    liveMultiplier,
    placeBet,
    cancelBet,
    cashOut,
    placePendingBet,
    cancelPendingBet,
    winNotifications,
    controlledCrash,
    controlledCrashMax,
    controlledCrashRounds,
    setControlledCrash: applyControlledCrash,
    setControlledCrashInterval,
    addBalance,
  } = useAviatorGame({ getBalance: getLatestBalance, updateBalance });

  const [menuOpen, setMenuOpen] = useState(false);

  const [liveTab, setLiveTab] = useState<LiveTab>('all');
  const [connectedPlayers, setConnectedPlayers] = useState(2909);
  const lastBotxCommandId = useRef<string | null>(null);
  // Le bot Aviator utilise la session Firebase globale déjà ouverte par l’application.
  // Aucun écran ni second login n’est déclenché dans ce jeu.
  useEffect(() => {
    if (!isAviatorGame) return;
    let stopChannel: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopChannel?.();
      stopChannel = undefined;
      lastBotxCommandId.current = null;
      if (!user?.uid) return;
      stopChannel = onSnapshot(
        doc(db, 'aviator_channels', user.uid),
        (snapshot) => {
          const data = snapshot.data();
          const commandId = typeof data?.commandId === 'string' ? data.commandId : '';
          const updatedAt = typeof data?.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : 0;
          const commandAge = Date.now() - updatedAt;
          const target = typeof data?.target === 'number' ? data.target : Number(data?.target);
          if (
            data?.source === 'botx-web' &&
            commandId && commandId !== lastBotxCommandId.current &&
            commandAge >= -60_000 && commandAge <= 10 * 60_000 &&
            Number.isFinite(target) && target >= 1 && target <= 1000
          ) {
            lastBotxCommandId.current = commandId;
            setControlledCrashInterval(target, target, 1, true);
          }
        },
        () => {
          // Le jeu local reste utilisable si le canal bot est indisponible.
        },
      );
    });
    return () => {
      stopAuth();
      stopChannel?.();
    };
  }, [isAviatorGame, setControlledCrashInterval]);

    const countdown = phase.kind === 'waiting' ? Math.ceil(phase.remainingMs / 1000) : undefined;
  const viewportState =
    phase.kind === 'waiting'
      ? 'waiting'
      : phase.kind === 'flying'
        ? { kind: 'flying' as const, multiplier: liveMultiplier ?? 1 }
        : { kind: 'crashed' as const, multiplier: phase.crashPoint };

  // Profils de démonstration locaux : l’écran porte aussi le badge DEMO.
  // Ils ne représentent pas des comptes réels ni un flux de paris du backend.
  const [roundAvatars, setRoundAvatars] = useState<ImageSourcePropType[]>(() =>
    Array.from({ length: 24 }, (_, index) => AVIATOR_PROFILE_AVATARS[index % AVIATOR_PROFILE_AVATARS.length]),
  );
  const flyingRoundStart = phase.kind === 'flying' ? phase.startAt : null;
  useEffect(() => {
    if (flyingRoundStart !== null) setRoundAvatars(getRandomAviatorAvatars(24));
  }, [flyingRoundStart]);

  const liveBets = useMemo(() => {
    if (phase.kind !== 'flying' && phase.kind !== 'crashed') return [];
    const profileNames = [
      'Player_7x', 'LuckyAce', 'Momo225', 'FlyHigh99', 'BigWin_CI', 'Tchoko', 'StarKiller', 'ProGamer',
      'CloudChaser', 'JetStream', 'SkyPilot', 'LuckyStar', 'RocketAce', 'GoldWing', 'RedComet', 'BlueOrbit',
      'FastLuna', 'FlyMax', 'AeroKing', 'HighFlyer', 'Wingman24', 'TurboAce', 'StarPilot', 'NovaJet',
    ];
    const betAmounts = [1, 2, 5, 10, 20, 50, 10, 5, 2, 10, 5, 20, 1, 50, 10, 5, 20, 2, 10, 1, 50, 5, 20, 2];
    const cashTargets = [1.2, 1.5, 2, 3, 5, 8, 12, 20, 1.3, 1.8, 2.5, 4, 6, 10, 15, 25, 1.4, 2.2, 3.5, 7, 9, 18, 30, 50];
    const profiles = profileNames.map((name, index) => ({
      name,
      avatar: roundAvatars[index],
      bet: betAmounts[index],
      cashTarget: cashTargets[index],
    }));
    const out: { name: string; avatar: ImageSourcePropType; bet: number; cashedOut: number | null }[] = [];
    for (const profile of profiles) {
      const crash = phase.kind === 'flying' ? (liveMultiplier ?? 99) : phase.crashPoint;
      const cashedOut = profile.cashTarget <= crash ? profile.cashTarget : null;
      out.push({ name: profile.name, avatar: profile.avatar, bet: profile.bet, cashedOut });
    }
    return out;
  }, [phase, liveMultiplier, roundAvatars]);

  const totalLiveBets = 2909 + sessions.length * 12;
  useEffect(() => {
    const updateConnectedPlayers = () => {
      const phaseActivity = phase.kind === 'flying' ? 24 : phase.kind === 'waiting' ? 8 : -12;
      const localActivity = liveBets.length * 3 + sessions.length * 2;
      const naturalDrift = Math.round(Math.sin(Date.now() / 4200) * 26);
      setConnectedPlayers(Math.max(4, totalLiveBets + phaseActivity + localActivity + naturalDrift));
    };
    updateConnectedPlayers();
    const timer = setInterval(updateConnectedPlayers, 2500);
    return () => clearInterval(timer);
  }, [phase.kind, liveBets.length, sessions.length, totalLiveBets]);

  const cashedOutCount = liveBets.filter((bet) => bet.cashedOut !== null).length;
  const totalBetCount = liveBets.length;
  const cashoutProgress = totalBetCount > 0 ? (cashedOutCount / totalBetCount) * 100 : 0;
  const totalWin = liveBets.reduce((sum, bet) => sum + (bet.cashedOut === null ? 0 : bet.bet * bet.cashedOut), 0);

  const tabContent = (() => {
    if (liveTab === 'my') {
      const played = sessions.filter((s) => s.bets.some((b) => b.amount > 0));
      if (played.length === 0) return null;
      return played.slice(0, 20).map((s) => {
        const myBets = s.bets;
        const totalBet = myBets.reduce((acc, b) => acc + b.amount, 0);
        const totalPayout = myBets.reduce((acc, b) => acc + b.payout, 0);
        return (
          <View key={s.id} style={styles.betRow}>
            <Text style={styles.betName}>{s.crashPoint.toFixed(2)}×</Text>
            <Text style={styles.betAmount}>{totalBet.toFixed(2)} XAF</Text>
            {totalPayout > 0 ? (
              <Text style={styles.betCashOut}>+{totalPayout.toFixed(2)} XAF</Text>
            ) : (
              <Text style={styles.betLost}>−{totalBet.toFixed(2)} XAF</Text>
            )}
          </View>
        );
      });
    }
    if (liveTab === 'top') {
      const sorted = [...liveBets].sort((a, b) => b.bet - a.bet);
      return sorted.map((b) => renderLiveBetRow(b));
    }
    return liveBets.map((b) => renderLiveBetRow(b));
  })();

  function renderLiveBetRow(b: (typeof liveBets)[number]) {
    const didCashOut = b.cashedOut !== null;
    const win = didCashOut ? b.bet * b.cashedOut! : 0;
    return (
      <View key={b.name} style={[styles.betRow, didCashOut && styles.betRowWon]}>
        <Image source={b.avatar} style={styles.playerAvatar} accessibilityLabel={`Profil de ${b.name}`} />
        <Text numberOfLines={1} style={styles.betName}>{b.name}</Text>
        <Text style={styles.betAmount}>{b.bet.toFixed(2)}</Text>
        {didCashOut ? (
          <Text style={[styles.betMultiplier, b.cashedOut! >= 10 && styles.betMultiplierHigh]}>{b.cashedOut!.toFixed(2)}×</Text>
        ) : (
          <Text style={styles.betPending}>—</Text>
        )}
        <Text style={styles.betWin}>{didCashOut ? win.toFixed(2) : '—'}</Text>
      </View>
    );
  }

  const playedSessions = sessions.filter((s) => s.bets.some((b) => b.amount > 0));

  const haptic = () => {
    if (Platform.OS !== 'web') {
      try {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        /* expo-haptics indisponible : aucun effet visible */
      }
    }
  };

  const roundPhase = phase.kind === 'waiting' ? 'waiting' : phase.kind === 'flying' ? 'flying' : 'crashed';

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={[styles.screenContent, { paddingBottom: 16 }]}
        nestedScrollEnabled
        showsVerticalScrollIndicator
        removeClippedSubviews={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled">
        {/* ===== Barre supérieure : version du ZIP Aviator de référence ===== */}
        <View style={[styles.topToolbar, compactLayout && styles.compactToolbar]}>
          <Pressable onPress={navigateTo1xGames} style={styles.topIconBtn} accessibilityLabel="Retour aux jeux">
            <Ionicons name="arrow-back" size={30} color="#fff" />
          </Pressable>
          <View style={styles.topBalancePill}>
            <Text style={styles.topBalanceAmount}>{balance.toFixed(0)} F</Text>
            {isAviatorGame && (
              <Pressable onPress={() => setMenuOpen(true)} style={[styles.topPlus, { backgroundColor: '#17C653' }]} accessibilityLabel="Ajouter des fonds">
                <Ionicons name="add" size={24} color="#fff" />
              </Pressable>
            )}
          </View>
          <View style={styles.topActions}>
            <View style={styles.demoBadge}>
              <Ionicons name="play" size={16} color="#050505" />
              <Text style={styles.demoLabel}>DEMO</Text>
            </View>
            <Pressable onPress={haptic} style={styles.topIconBtn} accessibilityLabel="Favori">
              <Ionicons name="star-outline" size={31} color="#fff" />
            </Pressable>
            <Pressable onPress={haptic} style={styles.topIconBtn} accessibilityLabel="Plein écran">
              <Ionicons name="expand" size={32} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* ===== En-tête logo / solde : version du ZIP de référence ===== */}
        <View style={[styles.header, compactLayout && styles.compactHeader]}>
          <Image
            source={require('@/assets/game/aviator-logo-custom.png')}
            style={[styles.logoImage, compactLayout && styles.compactLogo]}
            resizeMode="contain"
            accessibilityLabel="Logo Aviator"
          />
          <View style={styles.balanceWrap}>
            {isAviatorGame && (
              <Pressable
                onPress={() => setMenuOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Ajouter des fonds"
                style={({ pressed }) => [styles.addFundsBtn, pressed && { opacity: 0.65, transform: [{ scale: 0.94 }] }]}>
                <Ionicons name="add-circle" size={28} color="#17C653" />
              </Pressable>
            )}
            <Text style={styles.balanceText}>{balance.toFixed(2)}</Text>
            <Text style={styles.balanceUsd}>XAF</Text>
          </View>
          {isAviatorGame && (
            <Pressable onPress={() => setMenuOpen(true)} style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.7 }]}>
              <Ionicons name="menu-outline" size={30} color="#C9CBD4" />
            </Pressable>
          )}
        </View>

        {isAviatorGame && (
          <DepositMenu
            visible={menuOpen}
            onClose={() => setMenuOpen(false)}
            balance={balance}
            controlledCrash={controlledCrash}
            controlledCrashMax={controlledCrashMax}
            controlledCrashRounds={controlledCrashRounds}
            onAddBalance={addBalance}
            onSetControlledCrash={applyControlledCrash}
            onSetControlledCrashInterval={setControlledCrashInterval}
          />
        )}
        {/* ===== Historique des crashs ===== */}
        <HistoryStrip sessions={sessions} />

        {/* ===== Zone de jeu ===== */}
        <GameViewport phase={viewportState} countdown={countdown} connectedPlayers={connectedPlayers} winNotifications={winNotifications} canvasHeightHint={canvasHeightHint} />

        {/* ===== Panneaux de mise (2 identiques) ===== */}
        <View style={styles.panelsWrap}>
          <BetPanel
            balance={balance}
            bet={bets[0]}
            pending={pendingBets[0]}
            phase={roundPhase}
            liveMultiplier={liveMultiplier}
            crashMultiplier={phase.kind === 'crashed' ? phase.crashPoint : null}
            onPlace={(amount) => placeBet(0, amount)}
            onCancel={() => cancelBet(0)}
            onCashOut={() => cashOut(0)}
            onPlacePending={(amount) => placePendingBet(0, amount)}
            onCancelPending={() => cancelPendingBet(0)}
          />
          <View style={styles.panelGap} />
          <BetPanel
            balance={balance}
            bet={bets[1]}
            pending={pendingBets[1]}
            phase={roundPhase}
            liveMultiplier={liveMultiplier}
            crashMultiplier={phase.kind === 'crashed' ? phase.crashPoint : null}
            onPlace={(amount) => placeBet(1, amount)}
            onCancel={() => cancelBet(1)}
            onCashOut={() => cashOut(1)}
            onPlacePending={(amount) => placePendingBet(1, amount)}
            onCancelPending={() => cancelPendingBet(1)}
          />
        </View>

        {/* ===== Onglet paris : All Bets / My Bets / Top ===== */}
        <View style={styles.betsSection}>
          <View style={styles.tabRow}>
            {(
              [
                { key: 'all', label: 'All Bets' },
                { key: 'my', label: 'Previous' },
                { key: 'top', label: 'Top' },
              ] as { key: LiveTab; label: string }[]
            ).map((t) => (
              <Pressable
                key={t.key}
                onPress={() => {
                  setLiveTab(t.key);
                  haptic();
                }}
                style={({ pressed }) => [
                  styles.tabPill,
                  liveTab === t.key && styles.tabPillActive,
                  pressed && { opacity: 0.7 },
                ]}>
                <Text style={[styles.tabText, liveTab === t.key && { color: '#fff' }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.roundSummary}>
            <View style={styles.roundSummaryLeft}>
              <View style={styles.avatarStack}>
                {liveBets.filter((bet) => bet.cashedOut !== null).slice(0, 3).map((bet) => (
                  <Image key={bet.name} source={bet.avatar} style={styles.summaryAvatar} />
                ))}
              </View>
              <Text style={styles.roundCount}>{cashedOutCount}/{totalBetCount} <Text style={styles.roundCountMuted}>Bets</Text></Text>
            </View>
            <View style={styles.totalWinWrap}>
              <Text style={styles.totalWinAmount}>{totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              <Text style={styles.totalWinLabel}>Total win USD</Text>
            </View>
            <View
              style={styles.progressTrack}
              accessibilityRole="progressbar"
              accessibilityLabel={`${cashedOutCount} sur ${totalBetCount} paris encaissés`}
              accessibilityValue={{ min: 0, max: totalBetCount || 1, now: cashedOutCount }}>
              <View style={[styles.progressFill, { width: `${cashoutProgress}%` }]} />
            </View>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeading, styles.playerColumn]}>Player</Text>
            <Text style={[styles.tableHeading, styles.amountColumn]}>Bet USD</Text>
            <Text style={[styles.tableHeading, styles.multiplierColumn]}>X</Text>
          <Text style={[styles.tableHeading, styles.winColumn]}>Win USD</Text>
          </View>
          <ScrollView style={styles.betListViewport} nestedScrollEnabled showsVerticalScrollIndicator>
            {tabContent ?? <Text style={styles.emptyHistory}>Aucune partie jouée</Text>}
          </ScrollView>
          <View style={styles.fairFooter}>
            <View style={styles.fairFooterLeft}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#B7BBC2" />
              <Text style={styles.fairFooterText}>Provably Fair Game</Text>
            </View>
            <Text style={styles.fairFooterText}>Powered by <Text style={styles.spribeText}>SPRIBE</Text></Text>
          </View>
        </View>
      </ScrollView>


    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B12' },
  screenScroll: { flex: 1 },
  screenContent: { flexGrow: 1 },
  compactToolbar: { height: 56 },
  compactHeader: { height: 56 },
  compactLogo: { width: 104, height: 40 },
  topToolbar: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: '#020203',
  },
  topIconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  topBalancePill: { height: 38, minWidth: 92, paddingLeft: 14, paddingRight: 4, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#282A2E' },
  topBalanceAmount: { color: '#fff', fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  topPlus: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  demoBadge: { width: 34, height: 39, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  demoLabel: { color: '#111', fontSize: 7, lineHeight: 9, fontWeight: '900', letterSpacing: 0.2 },
  header: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#1D1F22',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D31',
  },
  balanceWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addFundsBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  balanceText: { color: '#17C653', fontSize: 17, fontWeight: '800', lineHeight: 22, fontVariant: ['tabular-nums'] },
  balanceUsd: { color: '#8A8C98', fontSize: 12, fontWeight: '700', lineHeight: 16 },
  menuBtn: { padding: 6 },
  logoImage: { width: 132, height: 44 },
  panelsWrap: { padding: 10, backgroundColor: '#121419', gap: 0 },
  panelGap: { height: 10 },
  betsSection: { backgroundColor: '#121419', paddingHorizontal: 12, paddingBottom: 8 },
  tabRow: { flexDirection: 'row', backgroundColor: '#0E1014', borderRadius: 20, padding: 3, marginBottom: 8 },
  tabPill: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 18 },
  tabPillActive: { backgroundColor: '#24272E' },
  tabText: { color: '#8A8C98', fontSize: 13, fontWeight: '700', lineHeight: 17 },
  roundSummary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingTop: 9, paddingBottom: 10, marginBottom: 10, backgroundColor: '#1A1C20', borderRadius: 12 },
  roundSummaryLeft: { minHeight: 45, justifyContent: 'center' },
  avatarStack: { flexDirection: 'row', alignItems: 'center', height: 25, marginBottom: 2 },
  summaryAvatar: { width: 25, height: 25, borderRadius: 13, marginRight: -5 },
  roundCount: { color: '#E1E2E5', fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  roundCountMuted: { color: '#93969C' },
  totalWinWrap: { alignItems: 'flex-end', justifyContent: 'center', minHeight: 45 },
  totalWinAmount: { color: '#E6E7E9', fontSize: 19, lineHeight: 25, fontWeight: '700', fontVariant: ['tabular-nums'] },
  totalWinLabel: { color: '#8E9096', fontSize: 11, lineHeight: 15 },
  progressTrack: { width: '100%', height: 8, padding: 1, marginTop: 8, overflow: 'hidden', borderRadius: 5, backgroundColor: '#303238' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#31BC22' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingBottom: 5 },
  betListViewport: { maxHeight: 440, flexGrow: 0 },
  tableHeading: { color: '#898C92', fontSize: 11, lineHeight: 16, fontWeight: '500' },
  playerColumn: { flex: 1 },
  amountColumn: { width: 62, textAlign: 'right' },
  multiplierColumn: { width: 57, textAlign: 'right' },
  winColumn: { width: 67, textAlign: 'right' },
  betRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B1E24',
    borderRadius: 20,
    minHeight: 51,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginBottom: 4,
  },
  betRowWon: { backgroundColor: '#193D0D' },
  playerAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 7 },
  betName: { flex: 1, minWidth: 0, color: '#D0D2D5', fontSize: 12, fontWeight: '500', lineHeight: 16 },
  betAmount: { width: 62, color: '#D6D7D9', fontSize: 12, fontWeight: '500', lineHeight: 17, textAlign: 'right', fontVariant: ['tabular-nums'] },
  betMultiplier: { width: 57, color: '#35A7EF', fontSize: 12, fontWeight: '600', lineHeight: 17, textAlign: 'right', fontVariant: ['tabular-nums'] },
  betMultiplierHigh: { color: '#D343CE' },
  betWin: { width: 67, color: '#D6D7D9', fontSize: 12, fontWeight: '500', lineHeight: 17, textAlign: 'right', fontVariant: ['tabular-nums'] },
  betCashOut: { color: '#17C653', fontSize: 13, fontWeight: '800', lineHeight: 18, marginLeft: 10, fontVariant: ['tabular-nums'] },
  betLost: { color: '#E4331E', fontSize: 13, fontWeight: '800', lineHeight: 18, marginLeft: 10, fontVariant: ['tabular-nums'] },
  betPending: { width: 57, color: '#8A8C98', fontSize: 12, lineHeight: 16, textAlign: 'right' },
  emptyHistory: { color: '#8A8C98', fontSize: 11, lineHeight: 15 },
  fairFooter: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, marginTop: 2, borderTopWidth: 1, borderTopColor: '#22252A' },
  fairFooterLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fairFooterText: { color: '#858991', fontSize: 10, lineHeight: 14 },
  spribeText: { color: '#C9CBD4', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
});
