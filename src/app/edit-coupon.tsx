import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BetHistoryItem, useBetStore } from '@/store/useBetStore';
import { BetEvent, BetStatus } from '@/types/bet';
import { getBackgroundPalette } from '@/constants/theme';
import { normalizeScorePeriods } from '@/utils/scorePeriods';
import { isMortalKombatEvent } from '@/utils/mortalKombat';
import { isPokerEvent } from '@/utils/localPokerSimulation';

const STATUSES: BetStatus[] = ['Accepté', 'En direct', 'Gagné', 'Perdu', 'Remboursé', 'Payé', 'En attente'];

type GameKind = 'classic' | 'fifa' | 'mortal' | 'poker';

const parseNumber = (value: string, fallback = 0) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const identifyGame = (event: BetEvent): GameKind => {
  if (isMortalKombatEvent(event)) return 'mortal';
  if (isPokerEvent(event)) return 'poker';
  if (event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA')) return 'fifa';
  return 'classic';
};

const gameLabel: Record<GameKind, string> = {
  classic: 'Match classique',
  fifa: 'FIFA',
  mortal: 'Mortal Kombat',
  poker: 'Poker',
};

const gameIcon: Record<Exclude<GameKind, 'poker'>, keyof typeof Ionicons.glyphMap> = {
  classic: 'football-outline',
  fifa: 'game-controller-outline',
  mortal: 'flash-outline',
};

const recalculate = (events: BetEvent[], type: string, stake: number) => {
  const odds = events.map((event) => Math.max(0, Number(event.odd) || 0));
  const totalOdds = type === 'Simple'
    ? Number((odds[0] || 0).toFixed(3))
    : Number(odds.reduce((total, odd) => total * odd, 1).toFixed(3));
  return { totalOdds, potentialGain: Number((stake * totalOdds).toFixed(2)) };
};

const normalizeMortalInfo = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 1000 ? Math.round(parsed) : undefined;
};

const normalizePokerDuration = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.max(1, Math.min(60, Math.round(parsed)))
    : 3;
};

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, color, bg }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  multiline?: boolean;
  color: string;
  bg: { appBg: string; divider: string; textSecondary: string };
}) {
  return (
    <View>
      <Text style={[styles.label, { color }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={bg.textSecondary}
        style={[styles.input, multiline && styles.multiline, { color, backgroundColor: bg.appBg, borderColor: bg.divider }]}
      />
    </View>
  );
}

function StatusChips({ value, onChange, activeColor, bg, textColor }: { value: BetStatus; onChange: (status: BetStatus) => void; activeColor: string; bg: any; textColor: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
      {STATUSES.map((status) => (
        <TouchableOpacity key={status} onPress={() => onChange(status)} style={[styles.statusChip, { borderColor: status === value ? activeColor : bg.divider, backgroundColor: status === value ? activeColor : bg.appBg }]}>
          <Text style={{ color: status === value ? '#FFF' : textColor, fontSize: 11, fontWeight: '700' }}>{status}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export default function EditCouponScreen() {
  const router = useRouter();
  const { couponId } = useLocalSearchParams<{ couponId?: string }>();
  const history = useBetStore((state) => state.betHistory);
  const currentBetSlip = useBetStore((state) => state.currentBetSlip);
  const updateCouponComplete = useBetStore((state) => state.updateCouponComplete);
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#2E79C9';

  const coupon = useMemo<BetHistoryItem | null>(() => {
    const id = String(couponId || currentBetSlip?.id || '');
    return history.find((item) => item.id === id) || (currentBetSlip?.id === id ? currentBetSlip : null);
  }, [couponId, currentBetSlip, history]);

  const [date, setDate] = useState('');
  const [stakeText, setStakeText] = useState('');
  const [status, setStatus] = useState<BetStatus>('Accepté');
  const [events, setEvents] = useState<BetEvent[]>([]);
  const hydrated = useRef(false);
  const lastSaved = useRef('');

  useEffect(() => {
    if (!coupon) return;
    const nextEvents = (coupon.events || []).map((event) => ({ ...event }));
    setDate(coupon.date || '');
    setStakeText(String(coupon.stake ?? ''));
    setStatus(coupon.status || 'Accepté');
    setEvents(nextEvents);
    lastSaved.current = JSON.stringify({ date: coupon.date, stake: coupon.stake, status: coupon.status, events: nextEvents });
    hydrated.current = true;
  }, [coupon]);

  const persist = () => {
    if (!coupon || !hydrated.current || !events.length || !date.trim()) return;
    const stake = Math.max(0, parseNumber(stakeText, coupon.stake));
    const normalizedEvents = events.map((event) => {
      const kind = identifyGame(event);
      const periods = normalizeScorePeriods(event.score, event.scorePeriod1, event.scorePeriod2);
      return {
        ...event,
        scorePeriod1: kind === 'classic' || kind === 'fifa' ? periods.period1 : undefined,
        scorePeriod2: kind === 'classic' || kind === 'fifa' ? periods.period2 : undefined,
        mortalKombatInfoNumber: kind === 'mortal' ? normalizeMortalInfo(event.mortalKombatInfoNumber) : undefined,
        pokerSimulation: kind === 'poker'
          ? { ...(event.pokerSimulation || {}), durationMs: normalizePokerDuration((event.pokerSimulation?.durationMs || 3 * 60 * 1000) / 60000) * 60 * 1000 }
          : event.pokerSimulation,
      };
    });
    const signature = JSON.stringify({ date: date.trim(), stake, status, events: normalizedEvents });
    if (signature === lastSaved.current) return;
    const { totalOdds, potentialGain } = recalculate(normalizedEvents, coupon.type, stake);
    updateCouponComplete(coupon.id, { date: date.trim(), eventCount: normalizedEvents.length, totalOdds, stake, potentialGain, status, events: normalizedEvents });
    lastSaved.current = signature;
  };

  // Chaque modification est persistée automatiquement après une courte pause de saisie.
  useEffect(() => {
    if (!hydrated.current) return;
    const timer = setTimeout(persist, 450);
    return () => clearTimeout(timer);
  }, [date, stakeText, status, events]);

  const updateEvent = (index: number, patch: Partial<BetEvent>) => {
    setEvents((previous) => previous.map((event, eventIndex) => eventIndex === index ? { ...event, ...patch } : event));
  };

  if (!coupon) {
    return <View style={[styles.empty, { backgroundColor: bg.appBg }]}><Text style={{ color: bg.textPrimary, fontWeight: '700' }}>Coupon introuvable</Text><TouchableOpacity onPress={() => router.back()} style={[styles.primaryButton, { backgroundColor: activeColor }]}><Text style={styles.primaryButtonText}>Retour</Text></TouchableOpacity></View>;
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: bg.appBg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle={bg.statusBarStyle} backgroundColor={bg.headerBg} />
      <View style={[styles.header, { backgroundColor: bg.headerBg, borderBottomColor: bg.divider }]}>
        <TouchableOpacity onPress={() => { persist(); router.back(); }} style={styles.backButton}><FontAwesome name="arrow-left" size={17} color={bg.textPrimary} /></TouchableOpacity>
        <View style={styles.headerTitleBox}><Text style={[styles.headerTitle, { color: bg.textPrimary }]}>Modifier le coupon</Text><Text style={[styles.autoText, { color: activeColor }]}>● Enregistrement automatique</Text></View>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.metaCard, { backgroundColor: bg.cardBg, borderColor: bg.divider }]}>
          <Text style={[styles.metaTitle, { color: bg.textPrimary }]}>{coupon.type} · {coupon.code || 'CODE'}</Text>
          <Text style={[styles.metaSubtitle, { color: bg.textSecondary }]}>Les changements sont appliqués au même coupon, sans créer de doublon.</Text>
          <Field label="Date et heure du coupon" value={date} onChangeText={setDate} placeholder="JJ/MM/AAAA (HH:MM)" color={bg.textPrimary} bg={bg} />
          <Field label="Montant de la mise" value={stakeText} onChangeText={setStakeText} keyboardType="decimal-pad" placeholder="Montant" color={bg.textPrimary} bg={bg} />
          <Text style={[styles.label, { color: bg.textPrimary }]}>Statut global du coupon</Text>
          <StatusChips value={status} onChange={setStatus} activeColor={activeColor} bg={bg} textColor={bg.textPrimary} />
        </View>

        {events.map((event, index) => {
          const kind = identifyGame(event);
          const isCompetition = kind === 'classic' || kind === 'fifa';
          const title1 = kind === 'mortal' ? 'Combattant 1' : kind === 'poker' ? 'Joueur 1' : 'Équipe 1';
          const title2 = kind === 'mortal' ? 'Combattant 2' : kind === 'poker' ? 'Joueur 2' : 'Équipe 2';
          return (
              <View key={event.id || index} style={[styles.eventCard, { backgroundColor: bg.cardBg, borderColor: bg.divider }]}> 
              <View style={styles.eventHeading}>
                <View style={[styles.eventIcon, { backgroundColor: kind === 'poker' ? 'transparent' : activeColor }]}>
                  {kind === 'poker'
                    ? <Image source={require('../../assets/images/poker-controller-icon.png')} style={{ width: 22, height: 22 }} resizeMode="contain" />
                    : <Ionicons name={gameIcon[kind]} size={17} color="#FFF" />}
                </View>
                <View style={{ flex: 1 }}><Text style={[styles.eventTeams, { color: bg.textPrimary }]}>{event.team1 || title1}  VS  {event.team2 || title2}</Text><Text style={[styles.eventType, { color: activeColor }]}>{gameLabel[kind]}</Text></View>
              </View>

              <Field label={kind === 'poker' ? 'Table / tournoi' : 'Championnat'} value={event.tournament} onChangeText={(value) => updateEvent(index, { tournament: value, sport: kind === 'fifa' ? 'FIFA' : kind === 'mortal' ? 'Mortal Kombat' : kind === 'poker' ? 'Poker' : event.sport })} color={bg.textPrimary} bg={bg} />
              <Field label="Date et heure" value={event.date || ''} onChangeText={(value) => updateEvent(index, { date: value })} placeholder="JJ/MM/AAAA (HH:MM)" color={bg.textPrimary} bg={bg} />
              <View style={styles.twoColumns}>
                <View style={{ flex: 1 }}><Field label={title1} value={event.team1} onChangeText={(value) => updateEvent(index, { team1: value })} color={bg.textPrimary} bg={bg} /></View>
                <View style={{ flex: 1 }}><Field label={title2} value={event.team2} onChangeText={(value) => updateEvent(index, { team2: value })} color={bg.textPrimary} bg={bg} /></View>
              </View>

              {kind === 'mortal' && <Field label="Score des rounds" value={event.score || ''} onChangeText={(value) => updateEvent(index, { score: value })} placeholder="2 - 0" color={bg.textPrimary} bg={bg} />}
              {isCompetition && <Field label="Score final" value={event.score || ''} onChangeText={(value) => updateEvent(index, { score: value })} placeholder="0 - 0" color={bg.textPrimary} bg={bg} />}
              {kind === 'mortal' && <Field label="N° Informations supplémentaires (1 à 1000)" value={event.mortalKombatInfoNumber ? String(event.mortalKombatInfoNumber) : ''} onChangeText={(value) => updateEvent(index, { mortalKombatInfoNumber: value ? Number(value.replace(/\D/g, '').slice(0, 4)) : undefined })} keyboardType="number-pad" placeholder="1 à 1000" color={bg.textPrimary} bg={bg} />}
              {kind === 'poker' && <Field label="Durée de la manche (minutes réelles, 1 à 60)" value={String(normalizePokerDuration((event.pokerSimulation?.durationMs || 3 * 60 * 1000) / 60000))} onChangeText={(value) => updateEvent(index, { pokerSimulation: { ...(event.pokerSimulation || {}), durationMs: normalizePokerDuration(value) * 60 * 1000 } })} keyboardType="number-pad" placeholder="3" color={bg.textPrimary} bg={bg} />}
              {isCompetition && <View style={styles.twoColumns}><View style={{ flex: 1 }}><Field label="1re période" value={event.scorePeriod1 || ''} onChangeText={(value) => updateEvent(index, { scorePeriod1: value })} placeholder="0 - 0" color={bg.textPrimary} bg={bg} /></View><View style={{ flex: 1 }}><Field label="2e période" value={event.scorePeriod2 || ''} onChangeText={(value) => updateEvent(index, { scorePeriod2: value })} placeholder="0 - 0" color={bg.textPrimary} bg={bg} /></View></View>}
              <Field label={kind === 'poker' ? 'Option / main jouée' : 'Option de pari'} value={event.betType || ''} onChangeText={(value) => updateEvent(index, { betType: value })} placeholder={kind === 'poker' ? 'Main 1 à 6, carte haute…' : kind === 'mortal' ? 'V1, V2, Fatality Oui…' : 'Ex. 1X2. V1'} color={bg.textPrimary} bg={bg} />
              <Field label="Cote" value={String(event.odd ?? '')} onChangeText={(value) => updateEvent(index, { odd: parseNumber(value, 0) })} keyboardType="decimal-pad" placeholder="Cote" color={bg.textPrimary} bg={bg} />
              <Text style={[styles.label, { color: bg.textPrimary }]}>Statut de {kind === 'poker' ? 'la main' : kind === 'mortal' ? 'du combat' : 'la rencontre'}</Text>
              <StatusChips value={event.status || 'Accepté'} onChange={(nextStatus) => updateEvent(index, { status: nextStatus })} activeColor={activeColor} bg={bg} textColor={bg.textPrimary} />
            </View>
          );
        })}
        <View style={[styles.infoBox, { backgroundColor: bg.cardBg, borderColor: bg.divider }]}><Ionicons name="sync-outline" size={18} color={activeColor} /><Text style={[styles.infoText, { color: bg.textSecondary }]}>Les cotes, le gain potentiel et les données de simulation sont recalculés dès qu’une modification est détectée.</Text></View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  header: { minHeight: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, headerTitleBox: { alignItems: 'center' }, headerTitle: { fontSize: 17, fontWeight: '800' }, autoText: { fontSize: 9, fontWeight: '800', marginTop: 2 },
  content: { padding: 12, paddingBottom: 32, gap: 12 }, metaCard: { borderRadius: 14, borderWidth: 1, padding: 14 }, metaTitle: { fontSize: 16, fontWeight: '800' }, metaSubtitle: { fontSize: 12, marginTop: 4, marginBottom: 8 }, eventCard: { borderRadius: 14, borderWidth: 1, padding: 14 }, eventHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }, eventIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, eventTeams: { fontSize: 13, fontWeight: '800' }, eventType: { fontSize: 11, fontWeight: '700', marginTop: 3 }, label: { fontSize: 11, fontWeight: '800', marginTop: 8, marginBottom: 5 }, input: { minHeight: 40, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 }, multiline: { minHeight: 60, textAlignVertical: 'top' }, twoColumns: { flexDirection: 'row', gap: 8 }, statusRow: { gap: 6, paddingVertical: 4 }, statusChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7 }, infoBox: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, infoText: { flex: 1, fontSize: 11, lineHeight: 16 }, primaryButton: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, primaryButtonText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
});
