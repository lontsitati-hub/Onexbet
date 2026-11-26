import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useBetStore } from '@/store/useBetStore';
import { getThemeAccentColor } from '@/constants/themeBranding';
import { checkAccess } from '@/services/access';
import { auth, db } from '@/services/firebase';
import { navigateTo1xGames } from '@/utils/gameNavigation';
import { BetPanel } from '@/components/crash-point/BetPanel';
import { BetsTable } from '@/components/crash-point/BetsTable';
import { CrashChart } from '@/components/crash-point/CrashChart';
import {
  addPanel,
  cancelBet,
  cashOut,
  createInitialState,
  GameState,
  GameTab,
  MAX_PANELS,
  placeBet,
  removePanel,
  setForcedCrashPoint,
  tickGame,
  updateSetting,
} from '@/components/crash-point/engine';

const MONEY = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CrashPointScreen() {
  const balance = useBetStore((state) => state.balance);
  const theme = useBetStore((state) => state.theme);
  const activeColor = getThemeAccentColor(theme);
  const updateBalance = useBetStore((state) => state.updateBalance);
  const [game, setGame] = useState<GameState>(() => ({ ...createInitialState(), balance: useBetStore.getState().balance }));
  const [tab, setTab] = useState<GameTab>('current');
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const lastBotCrashCommandId = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const access = checkAccess('/crash-point');
      if (!access.allowed) router.replace('/');
    }, []),
  );

  useEffect(() => {
    let stopChannel: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopChannel?.();
      stopChannel = undefined;
      lastBotCrashCommandId.current = null;
      if (!user?.uid) return;
      stopChannel = onSnapshot(doc(db, 'crash_point_channels', user.uid), (snapshot) => {
        const data = snapshot.data();
        const commandId = typeof data?.commandId === 'string' ? data.commandId : '';
        const updatedAt = typeof data?.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : 0;
        const age = Date.now() - updatedAt;
        const target = typeof data?.target === 'number' ? data.target : Number(data?.target);
        if (
          data?.source === 'botx-web' && commandId && commandId !== lastBotCrashCommandId.current &&
          age >= -60_000 && age <= 10 * 60_000 && Number.isFinite(target) && target >= 1 && target <= 1000
        ) {
          lastBotCrashCommandId.current = commandId;
          setGame((state) => setForcedCrashPoint(state, target));
        }
      }, () => undefined);
    });
    return () => {
      stopAuth();
      stopChannel?.();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setGame((state) => tickGame(state, Date.now(), 'reference')), 100);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (Math.abs(game.balance - balance) > 0.001) updateBalance(game.balance);
  }, [game.balance, balance, updateBalance]);

  useEffect(() => {
    if (!game.toast) return;
    const id = game.toast.id;
    const timer = setTimeout(() => setGame((state) => state.toast?.id === id ? { ...state, toast: null } : state), 2600);
    return () => clearTimeout(timer);
  }, [game.toast?.id]);

  const handlePlace = (index: number, amount: number) => setGame((state) => placeBet(state, index, amount));
  const handleCashOut = (index: number) => setGame((state) => cashOut(state, index));
  const handleCancel = (index: number) => setGame((state) => cancelBet(state, index));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={navigateTo1xGames} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Retour aux jeux">
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.walletGroup}>
          <View style={styles.balanceCapsule}><Text style={styles.balanceText}>{MONEY.format(game.balance)} F</Text></View>
          <View style={[styles.addCredit, { backgroundColor: activeColor }]} accessibilityLabel="Ajouter des fonds"><Ionicons name="add" size={22} color="#FFF" /></View>
        </View>
        <View style={styles.settingsButton} accessibilityLabel="Paramètres"><Ionicons name="settings-outline" size={22} color="#7E8A95" /></View>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.historyStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyItems}>
            <View style={[styles.historyPill, styles.historyPlaceholder]}><Text style={styles.historyText}>x--</Text></View>
            {game.history.slice(0, 8).map((value, index) => <View key={`${value}-${index}`} style={[styles.historyPill, value < 1.5 ? styles.lowHistory : value < 2 ? styles.midHistory : value < 5 ? styles.goodHistory : styles.highHistory]}><Text style={styles.historyText}>{`x${value.toFixed(2)}`}</Text></View>)}
          </ScrollView>
        </View>
        <CrashChart state={game} />
        <View style={styles.panels}>
          {game.bets.map((bet, index) => <BetPanel key={`panel-${index}`} index={index} bet={bet} settings={game.settings[index]} phase={game.phase} multiplier={game.multiplier} canRemove={game.bets.length > 1} onPlace={(amount) => handlePlace(index, amount)} onCancel={() => handleCancel(index)} onCashOut={() => handleCashOut(index)} onRemove={() => setGame((state) => removePanel(state, index))} onSetting={(patch) => setGame((state) => updateSetting(state, index, patch))} />)}
        </View>
        <Pressable disabled={game.bets.length >= MAX_PANELS} onPress={() => setGame((state) => addPanel(state))} style={[styles.addPanelButton, game.bets.length >= MAX_PANELS && styles.disabled]} accessibilityRole="button" accessibilityLabel="Ajouter un pari"><Text style={styles.addPanelText}>＋ Ajouter un pari</Text></Pressable>
        <BetsTable state={game} tab={tab} onTabChange={setTab} />
      </ScrollView>
      {game.toast && <View pointerEvents="none" style={[styles.toast, game.toast.kind === 'win' ? styles.winToast : game.toast.kind === 'error' ? styles.errorToast : styles.successToast]}><Text style={styles.toastText}>{game.toast.text}</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#100F30' },
  header: { height: 58, zIndex: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, backgroundColor: '#F7F7F9', borderBottomWidth: 1, borderBottomColor: '#DFE0E8' },
  backButton: { width: 45, height: 46, justifyContent: 'center' }, backGlyph: { color: '#68707A', fontSize: 33, lineHeight: 38, fontWeight: '300' },
  walletGroup: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }, balanceCapsule: { minWidth: 120, height: 29, paddingHorizontal: 9, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#A8A9B4', backgroundColor: '#D3D4D8', shadowColor: '#69727C', shadowOpacity: 0.38, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 5 }, balanceText: { color: '#41434C', fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }, addCredit: { width: 28, height: 29, marginLeft: 2, alignItems: 'center', justifyContent: 'center', borderTopRightRadius: 8, borderBottomRightRadius: 8 }, plus: { color: '#FFF', fontSize: 22, lineHeight: 25, fontWeight: '600' }, settingsButton: { width: 43, height: 44, alignItems: 'flex-end', justifyContent: 'center' }, gear: { color: '#7E8A95', fontSize: 22 }, settingsPopover: { position: 'absolute', top: 48, right: 8, width: 250, padding: 12, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D8D8E2', elevation: 7 }, settingsNote: { color: '#55566A', fontSize: 12, lineHeight: 17 }, 
  scroll: { flex: 1, backgroundColor: '#100F30' }, content: { paddingBottom: 20 }, historyStrip: { height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#100F30' }, historyItems: { alignItems: 'center', paddingHorizontal: 7, gap: 5 }, historyPill: { minWidth: 44, height: 27, paddingHorizontal: 7, justifyContent: 'center', alignItems: 'center', borderRadius: 7, backgroundColor: '#282653' }, historyPlaceholder: { minWidth: 38, borderWidth: 1, borderColor: '#45416D' }, lowHistory: { backgroundColor: '#373166' }, midHistory: { backgroundColor: '#45427D' }, goodHistory: { backgroundColor: '#17689B' }, highHistory: { backgroundColor: '#176944' }, historyText: { color: '#E4E3F5', fontSize: 9, fontWeight: '700', fontVariant: ['tabular-nums'] }, panels: { paddingTop: 1 }, addPanelButton: { alignSelf: 'center', height: 32, marginTop: 6, marginBottom: 2, paddingHorizontal: 17, borderRadius: 17, borderWidth: 1, borderColor: '#403B75', backgroundColor: '#25234F', alignItems: 'center', justifyContent: 'center' }, addPanelText: { color: '#B8B4E4', fontSize: 12, fontWeight: '600' }, disabled: { opacity: 0.4 }, footerText: { color: '#777492', fontSize: 8, letterSpacing: 0.8, textAlign: 'center', paddingHorizontal: 20, paddingVertical: 12 }, toast: { position: 'absolute', top: 67, left: 16, right: 16, minHeight: 38, paddingHorizontal: 12, paddingVertical: 8, zIndex: 20, borderRadius: 9, justifyContent: 'center', elevation: 6 }, successToast: { backgroundColor: '#17835D' }, errorToast: { backgroundColor: '#AB3B48' }, winToast: { backgroundColor: '#D37C17' }, toastText: { color: '#FFF', textAlign: 'center', fontSize: 12, fontWeight: '700' },
});
