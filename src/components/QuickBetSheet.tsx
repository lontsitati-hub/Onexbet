import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBetStore } from '@/store/useBetStore';
import { BetEvent, BetSlip } from '@/types/bet';
import { formatOdd } from '@/utils/format';
import { getBackgroundPalette } from '@/constants/theme';

type Props = {
  visible: boolean;
  event: BetEvent | null;
  selectionLabel: string;
  odd: number;
  onClose: () => void;
};

const canonicalBetType = (label: string) => label.trim().replace(/^1X2[.\s·:-]+X$/i, '1X2. Nul');
const isFifaEvent = (event: BetEvent) => event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA');
const formatAmount = (value: number) => Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function QuickBetSheet({ visible, event, selectionLabel, odd, onClose }: Props) {
  const balance = useBetStore((state) => state.balance);
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const upsertEventToSlip = useBetStore((state) => state.upsertEventToSlip);
  const placeBet = useBetStore((state) => state.placeBet);
  const [stakeText, setStakeText] = useState('500');
  const [followed, setFollowed] = useState(false);
  const stake = Number(stakeText.replace(/\s/g, '').replace(',', '.'));
  const validOdd = Number.isFinite(odd) && odd > 0 ? odd : 1;
  const potentialGain = Number.isFinite(stake) && stake > 0 ? Number((stake * validOdd).toFixed(2)) : 0;
  const isReferenceFootball = event?.sport === 'Football';
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#2E79C9';
  const oddColor = activeColor;
  const softAccent = theme === 'red_mega' ? '#FFF5F5' : theme === 'light_green' ? '#EAF4DC' : theme === 'green' ? '#DDEFEA' : theme === 'royal_blue' ? '#E4E8FC' : theme === 'gold' ? '#FEF3D8' : backgroundMode === 'light' ? '#E4F0FB' : bg.inputBg;

  const selectedEvent = useMemo<BetEvent | null>(() => {
    if (!event) return null;
    const betType = canonicalBetType(selectionLabel);
    const is1x2 = /^1X2[.\s·:-]/i.test(betType);
    const fifaSimulation = event.fifaSimulation && isFifaEvent(event) && is1x2
      ? {
          ...event.fifaSimulation,
          option: /\bNul\b/i.test(betType) ? 'draw' as const : /\bV2\b/i.test(betType) ? 'v2' as const : 'v1' as const,
        }
      : event.fifaSimulation;
    return { ...event, betType, odd: validOdd, status: 'Accepté', fifaSimulation };
  }, [event, selectionLabel, validOdd]);

  useEffect(() => {
    if (visible) {
      setStakeText('500');
      setFollowed(false);
    }
  }, [visible, event?.id, selectionLabel]);

  const addToCoupon = () => {
    if (!selectedEvent) return;
    upsertEventToSlip(selectedEvent);
    onClose();
  };

  const submitBet = () => {
    if (!selectedEvent) return;
    if (!Number.isFinite(stake) || stake <= 0) {
      Alert.alert('Mise invalide', 'Saisissez un montant supérieur à zéro.');
      return;
    }
    if (stake > balance) {
      Alert.alert('Solde insuffisant', 'La mise dépasse le solde disponible.');
      return;
    }
    const quickSlip: BetSlip = {
      id: '', type: 'Simple', date: '', eventCount: 1, finishedCount: 0,
      totalOdds: validOdd, stake, potentialGain, status: 'Accepté',
      events: [selectedEvent], isDraft: true,
    };
    const result = placeBet(stake, quickSlip);
    if (result.success === false) {
      Alert.alert('Impossible de placer le pari', result.error || 'Veuillez réessayer.');
      return;
    }
    onClose();
    Alert.alert('Pari placé', `Mise : ${formatAmount(stake)} ₣\nGains potentiels : ${formatAmount(result.coupon.potentialGain)} ₣\nRéférence : ${result.coupon.code || result.coupon.id}`);
  };

  const setQuickStake = (amount: number) => setStakeText(String(amount));
  const adjustStake = (delta: number) => {
    const next = Math.max(0, (Number.isFinite(stake) ? stake : 0) + delta);
    setStakeText(String(next));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, isReferenceFootball && referenceStyles.sheet, isReferenceFootball && { backgroundColor: bg.cardBg }]}>
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.followButton, { backgroundColor: followed ? softAccent : bg.inputBg }]} onPress={() => setFollowed((value) => !value)}>
              <Ionicons name={followed ? 'eye' : 'eye-outline'} size={17} color={followed ? activeColor : bg.textSecondary} />
              <Text style={[styles.followText, { color: followed ? activeColor : bg.textSecondary }]}>{followed ? 'Suivi' : 'Suivre'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addButton, { backgroundColor: activeColor }, isReferenceFootball && referenceStyles.addButton]} onPress={addToCoupon} disabled={!selectedEvent}>
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Ajouter au coupon de pari</Text>
            </TouchableOpacity>
            {!isReferenceFootball && <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Fermer">
              <Ionicons name="close" size={21} color={bg.textSecondary} />
            </TouchableOpacity>}
          </View>

          <View style={[styles.selectionCard, isReferenceFootball && referenceStyles.selectionCard, { backgroundColor: bg.cardBg, borderColor: bg.divider }]}>
            <View style={styles.selectionCopy}>
              <Text style={[styles.selectionTitle, isReferenceFootball && referenceStyles.selectionTitle, { color: bg.textPrimary }]} numberOfLines={2}>{selectionLabel}</Text>
              <Text style={[styles.selectionTeams, isReferenceFootball && referenceStyles.selectionTeams, { color: bg.textSecondary }]} numberOfLines={1}>{event ? `${event.team1} - ${event.team2}` : ''}</Text>
            </View>
            <Text style={[styles.selectionOdd, isReferenceFootball && referenceStyles.selectionOdd, { color: oddColor }]}>{formatOdd(validOdd)}</Text>
          </View>

          <View style={styles.balanceRow}>
            <Text style={[styles.label, { color: bg.textSecondary }]}>Solde</Text>
            <Text style={[styles.balance, { color: bg.textPrimary }]}>{formatAmount(balance)} ₣</Text>
          </View>

          <View style={[styles.tabsRow, isReferenceFootball && referenceStyles.tabsRow, { backgroundColor: bg.inputBg }]}>
            <View style={[styles.tabActive, isReferenceFootball && referenceStyles.tabActive, { backgroundColor: activeColor }]}><Text style={styles.tabActiveText}>Mise</Text></View>
            <View style={[styles.tab, { borderLeftColor: bg.divider }]}><Text style={[styles.tabText, { color: bg.textSecondary }]}>Code promo</Text></View>
            <View style={[styles.tab, { borderLeftColor: bg.divider }]}><Text style={[styles.tabText, { color: bg.textSecondary }]}>Cote de référence</Text></View>
          </View>

          <View style={styles.stakeRow}>
            <TextInput
              value={stakeText}
              onChangeText={(value) => setStakeText(value.replace(/[^0-9.,]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="500"
              placeholderTextColor={bg.textSecondary}
              style={[styles.stakeInput, { backgroundColor: bg.inputBg, color: bg.textPrimary, borderColor: bg.divider }]}
              accessibilityLabel="Montant de la mise"
            />
            <TouchableOpacity style={[styles.stepButton, { borderColor: bg.divider }]} onPress={() => adjustStake(-100)}><Ionicons name="remove" size={21} color={bg.textSecondary} /></TouchableOpacity>
            <TouchableOpacity style={[styles.stepButton, { borderColor: bg.divider }]} onPress={() => adjustStake(100)}><Ionicons name="add" size={21} color={bg.textSecondary} /></TouchableOpacity>
            <TouchableOpacity style={[styles.placeButton, { backgroundColor: isReferenceFootball ? '#39BF67' : activeColor }, isReferenceFootball && referenceStyles.placeButton, (!Number.isFinite(stake) || stake <= 0) && styles.placeButtonDisabled]} onPress={submitBet} disabled={!selectedEvent}>
              <Text style={styles.placeButtonText}>Pari</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.gainText, { color: bg.textSecondary }]}>Gains potentiels : <Text style={[styles.gainValue, { color: activeColor }]}>{formatAmount(potentialGain)} ₣</Text></Text>

          <View style={styles.quickStakes}>
            {[90, 1000, 2500].map((amount) => (
              <TouchableOpacity key={amount} style={[styles.quickStakeButton, { backgroundColor: activeColor }, isReferenceFootball && referenceStyles.quickStakeButton]} onPress={() => setQuickStake(amount)}>
                <Text style={styles.quickStakeText}>{formatAmount(amount)} ₣</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!isReferenceFootball && <Text style={[styles.disclaimer, { color: bg.textMuted }]}>Le gain potentiel est calculé selon la cote sélectionnée et la mise saisie.</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.22)' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 26, maxHeight: '78%' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  followButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#F0F4F7' },
  followButtonActive: { backgroundColor: '#E8F2FC' },
  followText: { fontSize: 11, color: '#526B7B', fontWeight: '700' },
  followTextActive: { color: '#2E79C9' },
  addButton: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 7, backgroundColor: '#287FC0' },
  addButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  selectionCard: { minHeight: 64, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, backgroundColor: '#F1F4F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectionCopy: { flex: 1, paddingRight: 12 },
  selectionTitle: { color: '#1B3344', fontSize: 13, fontWeight: '800' },
  selectionTeams: { color: '#718393', fontSize: 10, marginTop: 4 },
  selectionOdd: { color: '#1C3345', fontSize: 18, fontWeight: '900' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, paddingVertical: 10 },
  label: { color: '#63798A', fontSize: 12 },
  balance: { color: '#1E3E52', fontSize: 14, fontWeight: '800' },
  tabsRow: { height: 31, flexDirection: 'row', backgroundColor: '#E8EEF3', borderRadius: 7, overflow: 'hidden', marginBottom: 10 },
  tabActive: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#347FC2' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: '#D5DEE6' },
  tabActiveText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  tabText: { color: '#63798A', fontSize: 9, fontWeight: '600' },
  stakeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stakeInput: { flex: 1, height: 42, borderRadius: 7, backgroundColor: '#F0F2F5', paddingHorizontal: 11, color: '#263A49', fontSize: 16, fontWeight: '800' },
  stepButton: { width: 35, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D6DEE4', borderRadius: 7 },
  placeButton: { width: 76, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#39A864', marginLeft: 3 },
  placeButtonDisabled: { opacity: 0.55 },
  placeButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  gainText: { color: '#243C4D', fontSize: 12, marginTop: 10 },
  gainValue: { color: '#309563', fontWeight: '900' },
  quickStakes: { flexDirection: 'row', gap: 8, marginTop: 13 },
  quickStakeButton: { flex: 1, height: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#347FC2' },
  quickStakeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  disclaimer: { color: '#8A9AA5', fontSize: 9, marginTop: 10, textAlign: 'center' },
});

const referenceStyles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 10, borderTopRightRadius: 10, paddingTop: 6, paddingBottom: 18 },
  addButton: { borderRadius: 5 },
  selectionCard: { minHeight: 52, borderWidth: 0, borderRadius: 8, paddingVertical: 7 },
  selectionTitle: { fontFamily: 'Roboto', fontSize: 12, fontWeight: '500' },
  selectionTeams: { fontFamily: 'Roboto', fontSize: 10 },
  selectionOdd: { fontFamily: 'Roboto', fontSize: 16, fontWeight: '800' },
  tabsRow: { borderRadius: 4 },
  tabActive: {},
  placeButton: { borderRadius: 5 },
  quickStakeButton: { borderRadius: 5 },
});
