/* Apple of Fortune v4 — écran principal (fichier source de l'utilisateur, réinitialisé à 100 %). */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  ImageBackground,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  Alert,
  TextInput,
  useWindowDimensions,
  type LayoutChangeEvent,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { checkAccess } from '@/services/access';
import { auth, db } from '@/services/firebase';
import { useBetStore } from '@/store/useBetStore';
import { useRoundSession } from './round-session';
import { BarrelCell } from './barrel-cell';

import { useGame } from './game-store';
import {
  COLS,
  ROWS,
  createRound,
  forceSafeCell,
  multiplierAt,
  revealAll,
  createIllusionReveal,
  revealResult,
  type CellState,
  type Round,
} from './game-logic';
import { GAME_ASSETS, usePreloadGameAssets } from './use-game-assets';
import { ReferenceGearIcon, ReferenceBoltIcon } from './reference-icons';
import { referenceStyles as styles } from './reference-styles';
import { formatReferenceAmount, formatReferenceBalance, parseReferenceBet, referencePayout, visibleReferenceRows } from './reference-layout';
import { playWinSfx, playLoseSfx } from './sfx';
import { SettingsSheet } from './settings-sheet';

// The reference video uses a plain `F` suffix. Keep the shared formatter
// unchanged for the rest of the app, but normalize this game UI here.
const formatAof = formatReferenceAmount;

const BET_MIN = 200;
const BET_MAX = 706275.9;

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const { loaded: assetsLoaded } = usePreloadGameAssets();
  const game = useGame();
  const { setInRound } = useRoundSession();

  // Garde de route : redirige vers l'accueil si la session est invalide ou
  // Fast Games non activé (sécurité par jeu, contrôlée par l'admin).
  useFocusEffect(
    React.useCallback(() => {
      const access = checkAccess('/apple-of-fortune');
      if (!access.allowed) {
        if (access.reason === 'no-session') {
          router.replace('/');
        } else {
          Alert.alert('Accès refusé', access.message, [{ text: 'OK', onPress: () => router.replace('/') }]);
        }
      }
      // Les jeux Fast Games sont accessibles à tous les utilisateurs connectés,
      // sans activation individuelle par l'administrateur.
    }, [])
  );

  const [round, setRound] = useState<Round | null>(null);
  const [revealedAll, setRevealedAll] = useState<Map<string, CellState>>(new Map());
  const [sweepMap, setSweepMap] = useState<Map<string, CellState>>(new Map());
  const [roundEnded, setRoundEnded] = useState(false);
  const [showCashOutDock, setShowCashOutDock] = useState(false);
  const [lastWon, setLastWon] = useState(false);
  const [lastPayout, setLastPayout] = useState(0);
  const [resultLevel, setResultLevel] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const boardShiftY = useRef(new Animated.Value(0)).current;
  const sweepTimers = useRef<number[]>([]);
  const [betInput, setBetInput] = useState(formatAof(game.currentBet));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const roundRef = useRef<Round | null>(null);
  const busyRef = useRef(false);
  // État pour le rendu : busyRef ne doit jamais être lu pendant le render
  // (règle react-hooks/refs). Il est synchronisé ici à chaque transition.
  const [busy, setBusy] = useState(false);
  const lastBotAppleCommandId = useRef<string | null>(null);
  const pendingBotAppleCommand = useRef<{ uid: string; commandId: string; row: number; col: number } | null>(null);
  // Dernière mise jouée, mémorisée pour le PARI EN UN CLIC (⚡).
  const lastBetRef = useRef<number>(game.currentBet);

  const level = round ? round.currentRow : 0; // rows cleared so far

  // Clamp/parse bet input into a valid bet
  const clampBet = useCallback(
    (raw: string): number => {
      return parseReferenceBet(raw);
    },
    []
  );

  const applyBet = useCallback(
    (n: number) => {
      const b = Math.max(BET_MIN, Math.min(n, BET_MAX));
      game.setBet(b);
      setBetInput(formatAof(b));
    },
    [game]
  );

  const haptic = useCallback(
    (type: "light" | "success" | "error" | "medium") => {
      if (Platform.OS !== "web" && game.hapticsEnabled) {
        switch (type) {
          case "light":
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case "medium":
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case "success":
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case "error":
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
        }
      }
    },
    [game.hapticsEnabled]
  );

  const startRound = useCallback(async () => {
    Keyboard.dismiss();
    setRoundEnded(false);
    if (busyRef.current) return;
    const bet = clampBet(betInput);
    applyBet(bet);
    if (bet > game.freshBalance) {
      Alert?.alert("Solde insuffisant", "Choisis une mise plus petite ou réclame ton bonus quotidien.");
      return;
    }
    // Les commandes de gains restent masquées jusqu’au toucher de la première case.
    setShowCashOutDock(false);
    setBusy(true);
    busyRef.current = true;
    // End any lingering finish-of-round sweep and round state so a new round can start immediately.
    sweepTimers.current.forEach(clearTimeout);
    sweepTimers.current = [];
    setSweepMap(new Map());
    setRound(null);
    roundRef.current = null;
    pendingBotAppleCommand.current = null;
    setRevealedAll(new Map());
    setRoundEnded(false);
    setLastWon(false);
    setLastPayout(0);
    // Await the wager debit BEFORE creating the round so the balance check stays accurate
    // across repeated play/replay sequences (no stale-balance race).
    try {
      await game.addWager(bet);
    } catch (error) {
      busyRef.current = false;
      setBusy(false);
      setInRound(false);
      setShowCashOutDock(false);
      console.warn('AOF: mise non débitée, sauvegarde impossible', error);
      Alert.alert('Partie non démarrée', 'La mise n’a pas été débitée. Réessayez.');
      return;
    }
    // Memorize the played bet so ONE-CLICK BET can replay it.
    lastBetRef.current = bet;
    // Seules les prédictions validées dans Paramètres influencent le plateau.
    // Un brouillon reste inactif jusqu'à l'appui sur « Valider ».
    const r = createRound(
      Object.keys(game.validatedPredictions).length > 0
        ? game.validatedPredictions
        : undefined
    );
    roundRef.current = r;
    setRound({ ...r, revealed: new Map(r.revealed) });
    setInRound(true);
    const uid = auth.currentUser?.uid;
    if (uid) {
      // Le bot écoute cet événement et prépare la première case.
      void setDoc(doc(db, 'apple_channels', uid), {
        game: 'apple',
        action: 'reveal',
        status: 'round-started',
        row: 0,
        col: 0,
        commandId: `app-round-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        source: 'onexbet-app',
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
    }
    haptic("medium");
    busyRef.current = false;
    setBusy(false);
  }, [game, haptic, betInput, clampBet, applyBet]);

  const finishRound = useCallback(
    (won: boolean, payout: number, lvl: number, r: Round) => {
      // Gameplay uses the real round. After a win, the end screen uses a
      // newly generated visual illusion so the rotten-cell layout varies on
      // every round and never changes the outcome that was already won.
      const all = won ? createIllusionReveal(r.revealed) : revealAll(r);
      sweepTimers.current.forEach(clearTimeout);
      sweepTimers.current = [];
      setSweepMap(all);
      setLastWon(won);
      setLastPayout(payout);
      setRoundEnded(true);
      setShowCashOutDock(false);
      // Always release the busy lock so the next round (REJOUER / NOUVELLE MISE)
      // can start immediately — this also fixes the lockout after a loss, since
      // handleCellPress returns before releasing busyRef on the losing touch.
      busyRef.current = false;
      setBusy(false);
      setResultLevel(lvl);
      haptic(won ? "success" : "error");
      if (won && payout > 0) {
        game.addPayout(payout);
      }
      // Keep the tab bar hidden during the end-of-round screen as well.
      setInRound(true);
      game.pushHistory({
        bet: r.revealed.size > 0 ? game.currentBet : game.currentBet,
        result: won ? "win" : "loss",
        levelReached: lvl,
        cashoutMultiplier: won ? multiplierAt(lvl) : 0,
        payout,
      });
      roundRef.current = null;
      // Une manche terminée ne doit jamais laisser une commande Bot Apple
      // préparée en mémoire pour la partie suivante.
      pendingBotAppleCommand.current = null;
      setRound(null);
      const uid = auth.currentUser?.uid;
      if (uid) {
        void setDoc(doc(db, 'apple_channels', uid), {
          game: 'apple', action: 'reveal', status: 'round-ended', row: 0, col: 0,
          commandId: `app-loss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          source: 'onexbet-app', updatedAt: serverTimestamp(),
        }).catch(() => undefined);
      }
    },
    [game, haptic]
  );

  const handleCellPress = useCallback(
    (row: number, col: number) => {
      const r = roundRef.current;
      if (!r || busyRef.current) return;
      if (row !== r.currentRow) return;
      const pendingCommand = pendingBotAppleCommand.current;
      if (pendingCommand && (pendingCommand.row !== row || pendingCommand.col !== col)) {
        Alert.alert('Case verrouillée', 'Touchez exactement la case sélectionnée dans Bot Apple pour continuer.');
        return;
      }
      // Le dock apparaît seulement lorsque le joueur touche une case valide.
      setShowCashOutDock(true);
      busyRef.current = true;
      const { won } = revealResult(r, row, col);
      if (pendingCommand?.row === row) {
        pendingBotAppleCommand.current = null;
        void updateDoc(doc(db, 'apple_channels', pendingCommand.uid), {
          status: won ? 'revealed' : 'lost',
          row,
          col,
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);
      }
      const fresh = { ...r, revealed: new Map(r.revealed) };
      setRound(fresh);
      if (won) {
        playWinSfx(game.soundEnabled);
        haptic("light");
        // A second, slightly stronger nudge marks each time the player climbs
        // to the next row (visible progression milestone every 2 rows).
        if (r.currentRow % 2 === 1 && r.currentRow < ROWS) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } else {
        playLoseSfx(game.soundEnabled);
        finishRound(false, 0, r.currentRow, r);
        return;
      }
      // Même après la dernière case gagnante, la manche reste ouverte :
      // l'encaissement se fait uniquement via le bouton RÉCUPÉRER LES GAINS.
    busyRef.current = false;
    },
    [finishRound, haptic, game.currentBet]
  );

  // Bot Apple : la commande reçue prépare uniquement la case annoncée.
  // La révélation et la progression restent déclenchées par le toucher du joueur.
  useEffect(() => {
    let stopChannel: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopChannel?.();
      stopChannel = undefined;
      lastBotAppleCommandId.current = null;
      pendingBotAppleCommand.current = null;
      if (!user?.uid) return;
      stopChannel = onSnapshot(doc(db, 'apple_channels', user.uid), (snapshot) => {
        const data = snapshot.data();
        const commandId = typeof data?.commandId === 'string' ? data.commandId : '';
        const updatedAt = typeof data?.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : 0;
        const row = Number(data?.row);
        const col = Number(data?.col);
        const age = Date.now() - updatedAt;
        if (data?.source !== 'botx-web' || data?.game !== 'apple' || data?.action !== 'reveal' || data?.status !== 'pending' ||
            !commandId || commandId === lastBotAppleCommandId.current || age < -60_000 || age > 10 * 60_000 ||
            !Number.isInteger(row) || row < 0 || row >= ROWS || !Number.isInteger(col) || col < 0 || col >= COLS) return;
        lastBotAppleCommandId.current = commandId;
        const activeRound = roundRef.current;
        if (!activeRound || !forceSafeCell(activeRound, row, col)) {
          void updateDoc(doc(db, 'apple_channels', user.uid), { status: 'unavailable', updatedAt: serverTimestamp() }).catch(() => undefined);
          return;
        }
        pendingBotAppleCommand.current = { uid: user.uid, commandId, row, col };
        void updateDoc(doc(db, 'apple_channels', user.uid), {
          status: 'prepared',
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);
      }, () => undefined);
    });
    return () => { stopAuth(); stopChannel?.(); };
  }, [handleCellPress]);

  const cashOut = useCallback(() => {
    const r = roundRef.current;
    if (!r || level === 0 || busyRef.current) return;
    busyRef.current = true;
    const payout = referencePayout(game.currentBet, multiplierAt(level));
    finishRound(true, payout, level, r);
    // Signale la fin au bot : il annule sa commande et attend le prochain JOUER.
    const uid = auth.currentUser?.uid;
    if (uid) {
      void setDoc(doc(db, 'apple_channels', uid), {
        game: 'apple', action: 'reveal', status: 'round-ended', row: 0, col: 0,
        commandId: `app-end-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        source: 'onexbet-app', updatedAt: serverTimestamp(),
      }).catch(() => undefined);
    }
  }, [level, game.currentBet, finishRound]);

  const inRound = round !== null;
  const showMultiplierCodes = inRound || roundEnded;

  // ONE-CLICK BET: immediately starts a new round with the last played bet
  // (no need to re-enter the amount). Disabled while a round is in progress.
  const oneClickBet = useCallback(async () => {
    if (busyRef.current || inRound) return;
    const bet = clampBet(String(lastBetRef.current));
    applyBet(bet);
    setBetInput(String(bet));
    await startRound();
  }, [inRound, clampBet, applyBet, startRound]);

  // Match the reference camera: scroll one row after each of the first two
  // safe picks, then keep the board fixed from the x1.93 step onward.
  const { width: winW, height: winH } = useWindowDimensions();
  const safeHeight = Math.max(0, winH - insets.top - insets.bottom);
  const usableWidth = Math.max(0, (viewportWidth || winW - insets.left - insets.right) - 20);
  const scale = Math.min(1, usableWidth / 392, safeHeight / 848);
  const cellSize = Math.max(24, Math.floor(58 * scale));
  const gridGap = Math.max(4, Math.round(10 * scale));
  const multiplierColumnWidth = Math.round(52 * scale);
  const playAreaGap = Math.round(10 * scale);
  const referenceBoardWidth = multiplierColumnWidth + playAreaGap + COLS * cellSize + (COLS - 1) * gridGap;
  const boardHeight = Math.max(240, Math.round(Math.min(594 * scale, safeHeight - 230)));
  const displayedRows = visibleReferenceRows(ROWS);
  const gridHeight = displayedRows.length * cellSize + (displayedRows.length - 1) * gridGap;
  useEffect(() => {
    const progressedRows = inRound ? level : roundEnded ? resultLevel : 0;
    const rowsToShift = Math.min(Math.max(progressedRows, 0), 2);
    const animation = Animated.timing(boardShiftY, {
      toValue: rowsToShift * (cellSize + gridGap),
      duration: 420,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [boardShiftY, cellSize, gridGap, inRound, level, resultLevel, roundEnded]);
  const onGameViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setViewportWidth((current) => Math.abs(current - nextWidth) < 0.5 ? current : nextWidth);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}><SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
      <ImageBackground
        source={GAME_ASSETS.jungleBg}
        // SafeAreaView already constrains the native viewport. A second fixed
        // height can shrink the ScrollView in release builds and move the bet
        // controls below the visible area.
        style={styles.bg}
        imageStyle={styles.bgImage}
        resizeMode="cover"
      >
        <View pointerEvents="none" style={[styles.backgroundDimmer, roundEnded && styles.backgroundResultDimmer]} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scroll, { minHeight: safeHeight }, inRound && { paddingBottom: 124 }]}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          onLayout={onGameViewportLayout}
        >
          {/* Header like the original game: back arrow | balance + green plus | bonus & help */}
          <View style={[styles.header, inRound && { opacity: 0.30 }]}>
            <Pressable
              onPress={() => {
                useBetStore.getState().setActiveTab('populaire');
                router.dismissTo({ pathname: '/', params: { topTab: 'games' } } as any);
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Retour aux jeux"
              style={({ pressed }) => [styles.headerIconWrap, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.backArrow}>‹</Text>
            </Pressable>
            <View style={styles.balancePill}>
              <Text style={styles.balanceText}>{formatReferenceBalance(game.balance)}</Text>
              <Pressable
                onPress={game.claimDailyBonus}
                disabled={!game.bonusAvailable}
                style={({ pressed }) => [styles.plusButton, !game.bonusAvailable && { opacity: 0.45 }, pressed && { transform: [{ scale: 0.92 }], opacity: 0.9 }]}
              >
                <Text style={styles.plusButtonText}>+</Text>
              </Pressable>
            </View>
            <View style={styles.headerIcons}>
              <Pressable
                onPress={game.claimDailyBonus}
                disabled={!game.bonusAvailable}
                style={({ pressed }) => [styles.bonusBadge, !game.bonusAvailable && { opacity: 0.45 }, pressed && { transform: [{ scale: 0.92 }], opacity: 0.85 }]}
              >
                <ReferenceGearIcon size={28} withPlus />
              </Pressable>
              <Pressable
                onPress={() => Alert?.alert("Comment jouer", "Choisis ta mise puis touche JOUER. Touche une case de la rangée éclairée : la pomme rouge rapporte, le trognon fait tout perdre. Récupère tes gains à tout moment.")}
                style={({ pressed }) => [styles.headerIconWrap, pressed && { opacity: 0.6 }]}
              >
                <View style={styles.infoCircle}>
                  <Text style={styles.infoCircleText}>i</Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Title, centered like the original game */}
          <Text style={styles.gameTitle}>APPLE OF FORTUNE</Text>

          {/* Multiplier labels + grid */}
          <View style={[styles.playArea, { width: referenceBoardWidth, height: boardHeight }]} testID="aof-board">
            <Animated.View style={[styles.boardContent, { height: gridHeight, gap: playAreaGap, transform: [{ translateY: boardShiftY }] }]}>
            <View style={styles.multColumn}>
              {displayedRows.map((row, i) => {
                // display top-down
                const lvl = row + 1;
                const isActiveRow = inRound && round!.currentRow === row;
                const isPast = inRound && round!.currentRow > row;
                const isFuture = inRound && round!.currentRow < row;
                return (
                  <View
                    key={row}
                    style={[
                      styles.multCell,
                      {
                        height: cellSize,
                        width: multiplierColumnWidth,
                        justifyContent: "center",
                        // Même espacement que les rangées de la grille.
                        // La dernière cote n'ajoute pas de marge extérieure.
                        marginBottom: i < displayedRows.length - 1 ? gridGap : 0,
                      },
                    ]}
                  >
                    {/* Multiplier pill: dark rounded chip, green for the active row (reference screenshot) */}
                    <View
                      style={[
                        styles.multPill,
                        isActiveRow && styles.multPillActive,
                        isPast && styles.multPillPast,
                        isFuture && styles.multPillFuture,
                        !showMultiplierCodes && styles.multPillIdle,
                        !showMultiplierCodes && row === 0 && styles.multPillIdleActive,
                      ]}
                    >
                      {showMultiplierCodes && (
                        <Text
                          style={[
                            styles.multText,
                            isActiveRow && styles.multActiveText,
                            isPast && styles.multPastText,
                          ]}
                          adjustsFontSizeToFit
                          minimumFontScale={0.9}
                          numberOfLines={1}
                        >
                          ×{MULT_STR[lvl]}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={[styles.grid, { gap: gridGap }]}>
              {displayedRows.map((row) => {
                const isActiveRow = inRound && round!.currentRow === row;
                const isPast = inRound && round!.currentRow > row;
                // Keep the grid structure untouched: hidden tiles and revealed
                // symbols both receive the progressive row fade.
                return (
                  <View
                    key={row}
                    testID={`aof-row-${row}`}
                    style={[styles.gridRow, { height: cellSize, gap: gridGap }]}
                  >
                    {Array.from({ length: COLS }).map((_, c) => {
                      // Keep revealed winning apples fully visible as the player
                      // climbs; only cells without an apple recede progressively.
                      const st = sweepMap.get(`${row}-${c}`) ?? round?.revealed.get(`${row}-${c}`) ?? null;
                      let cellFade = 1;
                      if (st === 'apple') {
                        cellFade = 1;
                      } else if (!inRound && !roundEnded && st === null) {
                        // The reference menu keeps upper covers subdued and
                        // progressively brightens the lower rows.
                        cellFade = row === 0 ? 1 : Math.min(0.9, 0.42 + (9 - row) * 0.06);
                      } else if (inRound && round) {
                        if (row === round.currentRow) {
                          cellFade = 1;
                        } else if (row > round.currentRow) {
                          const distance = row - round.currentRow;
                          cellFade = Math.max(0.24, 0.76 - round.currentRow * 0.055 - distance * 0.025);
                        } else {
                          // Fade only the unpicked cells in crossed rows. A safe
                          // apple is handled above and remains at full opacity.
                          const distance = round.currentRow - row;
                          cellFade = Math.max(
                            0.14,
                            0.82 - distance * 0.13 - round.currentRow * 0.02
                          );
                        }
                      } else if (roundEnded) {
                        // On a result board, apples stay vivid and non-apple
                        // cells (cores/empty) fade instead.
                        cellFade = 0.28;
                      }
                      return (
                        <BarrelCell
                          key={c}
                          state={st}
                          playable={!!(inRound && isActiveRow)}
                          disabled={isPast || sweepMap.size > 0 || !assetsLoaded}
                          size={cellSize}
                          rowFade={cellFade}
                          vanish={false}
                          // Idle shows the mushroom row at the bottom only;
                          // unreached rows use the plain wooden cover.
                          chevronsVisible={roundEnded || isActiveRow || (!inRound && row === 0)}
                          onPress={() => handleCellPress(row, c)}
                        />
                      );
                    })}
                  </View>
                );
              })}
            </View>
            </Animated.View>
            {roundEnded && (
              <View style={[styles.resultBannerWrap, { top: boardHeight * (lastWon ? 0.45 : 0.43) }]} pointerEvents="none">
                {lastWon ? <>
                  <Text style={styles.resultBannerTitle}>Gagné !</Text>
                  <Text style={styles.resultBannerSub}>Vos gains: {formatAof(lastPayout)}</Text>
                </> : <>
                  <Text style={styles.lossTitle}>Vous aurez plus de chance la</Text>
                  <Text style={styles.lossTitle}>prochaine fois</Text>
                  <Text style={styles.lossSub}>Réessayez</Text>
                </>}
              </View>
            )}
          </View>

          {/* Bet controls: MIN / X2 / MAX + editable field + range text (like original) */}
          {!inRound && !roundEnded && (
            <View style={styles.betSection}>
              <View style={styles.betRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mise minimale"
                  onPress={() => applyBet(BET_MIN)}
                  style={({ pressed }) => [styles.betChip, pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 }]}
                >
                  <Text style={styles.betChipText}>MIN</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Doubler la mise"
                  onPress={() => applyBet(Math.min(game.currentBet * 2, BET_MAX))}
                  style={({ pressed }) => [styles.betChip, pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 }]}
                >
                  <Text style={styles.betChipText}>X2</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Diviser la mise par deux"
                  onPress={() => applyBet(Math.max(BET_MIN, game.currentBet / 2))}
                  style={({ pressed }) => [styles.betChip, pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 }]}
                >
                  <Text style={styles.betChipText}>X/2</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mise maximale"
                  onPress={() => applyBet(BET_MAX)}
                  style={({ pressed }) => [styles.betChip, pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 }]}
                >
                  <Text style={styles.betChipText}>MAX</Text>
                </Pressable>
              </View>
              <View style={styles.betPanel}>
                <View style={styles.betFieldWrap}>
                  <TextInput
                    style={styles.betInput}
                    value={betInput}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    onChangeText={(t) => {
                      setBetInput(t);
                      const n = clampBet(t);
                      game.setBet(n);
                    }}
                    onSubmitEditing={() => setBetInput(formatAof(clampBet(betInput)))}
                    blurOnSubmit
                  />
                  <Text style={styles.betRange}>
                    De {formatAof(BET_MIN)} - à {formatAof(BET_MAX)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Jouer"
                  onPress={startRound}
                  disabled={!assetsLoaded || busy}
                  style={({ pressed }) => [styles.playButton, pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 }, (!assetsLoaded || busy) && styles.playButtonDisabled]}
                >
                  <Text style={styles.playButtonText}>{!assetsLoaded ? "Chargement..." : "JOUER"}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Bottom bar: SETTINGS | ONE-CLICK BET — hidden once the round has started (like the reference screenshots) */}
          {!inRound && !roundEnded && (
          <View style={styles.bottomBar}>
            <Pressable
              onPress={() => setSettingsOpen(true)}
              style={({ pressed }) => [styles.bottomBarItem, pressed && { opacity: 0.7 }]}
            >
              <ReferenceGearIcon size={14} />
              <Text style={styles.bottomBarText}>PARAMÈTRES</Text>
            </Pressable>
            <View style={styles.bottomBarSep} />
            <Pressable
              onPress={oneClickBet}
              style={({ pressed }) => [styles.bottomBarItem, pressed && { opacity: 0.7 }]}
            >
              <ReferenceBoltIcon size={14} />
              <Text style={styles.bottomBarText}>PARI EN UN CLIC</Text>
            </Pressable>
          </View>
          )}
          {settingsOpen && <SettingsSheet visible onClose={() => setSettingsOpen(false)} />}
        </ScrollView>
        {/* End-of-round dock is deliberately outside the ScrollView. Android may
            clip absolute descendants of a scroll content container even when they
            are visually within the reference board bounds. */}
        {roundEnded && (
          <View style={styles.actionArea}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rejouer la partie"
              onPress={async () => {
                await startRound();
              }}
              style={({ pressed }) => [styles.replayButton, styles.endActionButton, pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 }]}
            >
              <View style={[styles.actionButtonSurface, styles.replaySurface]}>
                <Text style={styles.replayButtonText}>REJOUER ? ({formatAof(game.currentBet)})</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Nouvelle mise"
              onPress={() => {
                setSweepMap(new Map());
                setRoundEnded(false);
                setInRound(false);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.newBetButton,
                styles.endActionButton,
                pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 },
              ]}
            >
              <View style={[styles.actionButtonSurface, styles.newBetSurface]}>
                <Text style={styles.newBetButtonText}>NOUVELLE MISE</Text>
              </View>
            </Pressable>
          </View>
        )}
        {/* Barre fixe : le bouton d'encaissement reste visible, même si le
            contenu du plateau dépasse la hauteur disponible de l'écran. */}
        {showCashOutDock && !roundEnded && (
          <View style={styles.cashOutDock}>
            <View style={styles.gainsPill}>
              <Text style={styles.gainsPillText}>
                GAINS ACTUELS: {level > 0 ? formatAof(referencePayout(game.currentBet, multiplierAt(level))) : "0 F"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Récupérer les gains"
              onPress={cashOut}
              disabled={level === 0}
              style={({ pressed }) => [
                styles.cashButton,
                level === 0 && styles.cashButtonDisabled,
                pressed && level > 0 && { transform: [{ scale: 0.97 }], opacity: 0.92 },
              ]}
            >
              <View style={[styles.actionButtonSurface, styles.cashSurface, level === 0 && styles.cashSurfaceDisabled]}>
                <Text style={[styles.cashButtonText, level === 0 && styles.cashButtonDisabledText]}>RÉCUPÉRER LES GAINS</Text>
              </View>
            </Pressable>
          </View>
        )}
      </ImageBackground>


    </SafeAreaView></View>
  );
}

/** Human-friendly multiplier labels. */
const MULT_STR: Record<number, string> = {
  1: "1.23",
  2: "1.54",
  3: "1.93",
  4: "2.41",
  5: "4.02",
  6: "6.71",
  7: "11.18",
  8: "27.97",
  9: "69.93",
  10: "349.68",
};
