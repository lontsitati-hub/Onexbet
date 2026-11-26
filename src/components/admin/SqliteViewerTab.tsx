import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput,
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { AT } from '@/constants/adminTheme';
import { COLORS } from '@/constants/theme';
import * as Clipboard from 'expo-clipboard';
import { useBetStore } from '@/store/useBetStore';
import {
  getAllMaches, getAllCoupons, getCompteInfo,
  clearMachesTable, clearCouponsTable, updateCompteBalance,
} from '@/services/db';

export default function SqliteViewerTab() {
  const [balance, setBalance] = useState(0);
  const [sessionId, setSessionId] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);

  const [selectedCouponToPay, setSelectedCouponToPay] = useState<any | null>(null);
  const [editingEvents, setEditingEvents] = useState<any[]>([]);
  const [isPayModalVisible, setIsPayModalVisible] = useState(false);

  const handleCopyCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      Alert.alert('Copié', `Le code coupon "${code}" a été copié.`);
    } catch (error) {
      console.warn('Failed to copy code:', error);
    }
  };

  const loadDatabaseData = () => {
    try {
      const info = getCompteInfo();
      setBalance(info.balance);
      setSessionId(info.sessionId);
      setMatches(getAllMaches());
      setCoupons(getAllCoupons());
    } catch (error) {
      console.warn('Failed to load SQLite data:', error);
    }
  };

  useEffect(() => {
    loadDatabaseData();
  }, []);

  const handlePayCouponClick = (coupon: any) => {
    let parsedEvents: any[] = [];
    try {
      parsedEvents = JSON.parse(coupon.eventsJson || '[]');
    } catch (e) {
      console.warn('Failed to parse events JSON:', e);
    }
    parsedEvents = parsedEvents.map(ev => ({
      ...ev,
      score: ev.score || '1 - 0',
      scorePeriod1: ev.scorePeriod1 || '1 - 0',
      scorePeriod2: ev.scorePeriod2 || '0 - 0',
    }));
    setSelectedCouponToPay(coupon);
    setEditingEvents(parsedEvents);
    setIsPayModalVisible(true);
  };

  const handleUpdateEventScore = (index: number, field: string, val: string) => {
    const updated = [...editingEvents];
    updated[index] = { ...updated[index], [field]: val };
    setEditingEvents(updated);
  };

  const handleConfirmPayment = () => {
    if (!selectedCouponToPay) return;
    const payCoupon = useBetStore.getState().payCoupon;
    payCoupon(selectedCouponToPay.id, editingEvents);

    setIsPayModalVisible(false);
    setSelectedCouponToPay(null);
    setEditingEvents([]);
    loadDatabaseData();
    Alert.alert('Succès', 'Le coupon a été payé et le solde crédité.');
  };

  const handleReset = () => {
    Alert.alert(
      'Réinitialiser SQLite',
      'Effacer tous les matchs et coupons stockés dans SQLite ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Vider SQLite',
          style: 'destructive',
          onPress: () => {
            clearMachesTable();
            clearCouponsTable();
            updateCompteBalance(15000.0);

            useBetStore.getState().updateBalance(15000.0);
            useBetStore.getState().setBetSlip({
              id: '', type: 'Combiné', date: '', eventCount: 0, finishedCount: 0,
              totalOdds: 1, stake: 0, potentialGain: 0, status: 'Accepté', events: [],
            });
            useBetStore.setState({ betHistory: [] });

            loadDatabaseData();
            Alert.alert('Succès', 'La base SQLite a été réinitialisée.');
          },
        },
      ]
    );
  };

  const handleAddDemoBalance = () => {
    const newBal = balance + 5000;
    updateCompteBalance(newBal);
    useBetStore.getState().updateBalance(newBal);
    loadDatabaseData();
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Header Actions */}
      <View style={s.headerActions}>
        <View style={s.titleWrap}>
          <FontAwesome5 name="database" size={16} color={AT.red} style={{ marginRight: 8 }} />
          <Text style={s.title}>SQLite Inspector</Text>
        </View>
        <View style={s.btnRow}>
          <TouchableOpacity style={s.actionBtn} onPress={loadDatabaseData} activeOpacity={0.7}>
            <Ionicons name="reload" size={14} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={s.actionBtnText}>Rafraîchir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.resetBtn]} onPress={handleReset} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={14} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={s.actionBtnText}>Vider SQLite</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* COMPTE TABLE */}
      <View style={AT.card}>
        <View style={s.cardHeader}>
          <FontAwesome5 name="wallet" size={14} color={AT.accent} style={{ marginRight: 8 }} />
          <Text style={s.cardTitle}>Table : Compte</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.label}>Solde Actuel :</Text>
          <Text style={[s.value, { color: AT.green }]}>{balance.toFixed(2)} ₣</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.label}>ID Session :</Text>
          <Text style={s.valueAccent}>{sessionId}</Text>
        </View>
        <TouchableOpacity style={s.helperBtn} onPress={handleAddDemoBalance} activeOpacity={0.8}>
          <FontAwesome5 name="plus" size={11} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={s.helperBtnText}>Ajouter +5 000 ₣ au solde</Text>
        </TouchableOpacity>
      </View>

      {/* MACHE TABLE */}
      <View style={AT.card}>
        <View style={s.cardHeader}>
          <FontAwesome5 name="football-ball" size={14} color={AT.gold} style={{ marginRight: 8 }} />
          <Text style={s.cardTitle}>Table : Mache (Matchs - {matches.length})</Text>
        </View>
        {matches.length === 0 ? (
          <Text style={s.emptyText}>Aucun match enregistré en BDD.</Text>
        ) : (
          matches.map((item, idx) => (
            <View key={idx} style={s.rowItem}>
              <View style={s.rowMain}>
                <Text style={s.rowTitle}>
                  {item.homeTeam} vs {item.awayTeam}
                </Text>
                <Text style={s.rowBadge}>{item.betOption} ({item.odd}x)</Text>
              </View>
              <Text style={s.rowSub}>
                Ligue: {item.league} · Score: {item.score} · P1/P2: {item.scorePeriod1 || '0 - 0'} / {item.scorePeriod2 || '0 - 0'}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* COUPON TABLE */}
      <View style={AT.card}>
        <View style={s.cardHeader}>
          <FontAwesome5 name="receipt" size={14} color={AT.purple} style={{ marginRight: 8 }} />
          <Text style={s.cardTitle}>Table : Coupon (Paris - {coupons.length})</Text>
        </View>
        {coupons.length === 0 ? (
          <Text style={s.emptyText}>Aucun coupon enregistré en BDD.</Text>
        ) : (
          coupons.map((item, idx) => (
            <View key={idx} style={s.rowItem}>
              <View style={s.rowMain}>
                <Text style={s.rowTitle}>ID: {item.id}</Text>
                <View style={[s.statusBadge, item.status === 'Payé' ? s.statusPaid : s.statusPending]}>
                  <Text style={[s.statusBadgeText, item.status === 'Payé' ? { color: AT.green } : { color: AT.gold }]}>
                    {item.status}
                  </Text>
                </View>
              </View>
              <Text style={s.rowSub}>
                Type: {item.type} · Cote: {item.totalOdds} · Mise: {item.stake}₣ · Gain: {item.potentialGain}₣
              </Text>
              {item.code ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 3, gap: 8 }}>
                  <Text style={[s.rowSub, { fontWeight: '700', color: AT.accent }]}>
                    Code: {item.code}
                  </Text>
                  <TouchableOpacity onPress={() => handleCopyCode(item.code)} style={{ padding: 2 }}>
                    <Ionicons name="copy-outline" size={14} color={AT.accent} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {item.status === 'Accepté' && (
                <TouchableOpacity style={s.payBtn} onPress={() => handlePayCouponClick(item)} activeOpacity={0.8}>
                  <Ionicons name="checkmark-circle-outline" size={14} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={s.payBtnText}>Marquer comme Payé</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </View>

      {/* Score Edit Modal */}
      <Modal visible={isPayModalVisible} transparent animationType="slide" onRequestClose={() => setIsPayModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <Text style={s.modalTitle}>🏆 Scores du Coupon (ID: {selectedCouponToPay?.id})</Text>
            <Text style={s.modalSubtitle}>Saisissez les scores des matchs avant de valider le paiement.</Text>

            <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
              {editingEvents.map((ev, index) => (
                <View key={index} style={s.modalEventCard}>
                  <Text style={s.modalEventTeams}>⚽ {ev.team1} vs {ev.team2}</Text>
                  <View style={s.modalInputsRow}>
                    <View style={s.modalInputWrapper}>
                      <Text style={s.modalInputLabel}>Score Final</Text>
                      <TextInput style={s.modalInput} value={ev.score}
                        onChangeText={(text) => handleUpdateEventScore(index, 'score', text)} placeholder="2 - 1" placeholderTextColor={AT.textMuted} />
                    </View>
                    <View style={s.modalInputWrapper}>
                      <Text style={s.modalInputLabel}>P1</Text>
                      <TextInput style={s.modalInput} value={ev.scorePeriod1}
                        onChangeText={(text) => handleUpdateEventScore(index, 'scorePeriod1', text)} placeholder="1 - 0" placeholderTextColor={AT.textMuted} />
                    </View>
                    <View style={s.modalInputWrapper}>
                      <Text style={s.modalInputLabel}>P2</Text>
                      <TextInput style={s.modalInput} value={ev.scorePeriod2}
                        onChangeText={(text) => handleUpdateEventScore(index, 'scorePeriod2', text)} placeholder="1 - 1" placeholderTextColor={AT.textMuted} />
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={s.modalActions}>
              <TouchableOpacity style={[s.modalBtn, s.modalCancelBtn]} onPress={() => setIsPayModalVisible(false)} activeOpacity={0.7}>
                <Text style={s.modalCancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalConfirmBtn]} onPress={handleConfirmPayment} activeOpacity={0.85}>
                <Text style={s.modalConfirmBtnText}>Valider & Payer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: AT.contentBg },
  content: { padding: 14, paddingBottom: 60 },
  headerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titleWrap: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: AT.textPrimary },
  btnRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: AT.accent, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  actionBtnText: { color: '#FFF', fontSize: 11.5, fontWeight: '700' },
  resetBtn: { backgroundColor: AT.red },

  cardHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: AT.border, paddingBottom: 8, marginBottom: 10 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: AT.textPrimary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontSize: 12, color: AT.textSecondary, fontWeight: '600' },
  value: { fontSize: 13, fontWeight: '800' },
  valueAccent: { fontSize: 12, color: AT.accent, fontWeight: '800' },
  helperBtn: { backgroundColor: AT.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 8, marginTop: 10 },
  helperBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  emptyText: { fontSize: 12, color: AT.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },
  rowItem: { borderBottomWidth: 1, borderBottomColor: AT.cardBg2, paddingVertical: 8 },
  rowMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rowTitle: { fontSize: 12.5, fontWeight: '700', color: AT.textPrimary },
  rowBadge: { fontSize: 10, fontWeight: '700', color: AT.textSecondary, backgroundColor: AT.cardBg2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  rowSub: { fontSize: 11, color: AT.textMuted, marginTop: 1 },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  statusPaid: { backgroundColor: AT.greenL },
  statusPending: { backgroundColor: AT.goldL },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },

  payBtn: { backgroundColor: AT.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start', marginTop: 6 },
  payBtnText: { color: '#FFF', fontSize: 11.5, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { backgroundColor: AT.cardBg, borderRadius: 16, width: '100%', maxHeight: '80%', padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: AT.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: 12, color: AT.textMuted, marginBottom: 16 },
  modalScroll: { marginBottom: 16 },
  modalEventCard: { backgroundColor: AT.cardBg2, borderWidth: 1, borderColor: AT.border, borderRadius: 10, padding: 12, marginBottom: 10 },
  modalEventTeams: { fontSize: 13, fontWeight: '700', color: AT.textPrimary, marginBottom: 8 },
  modalInputsRow: { flexDirection: 'row', gap: 8 },
  modalInputWrapper: { flex: 1 },
  modalInputLabel: { fontSize: 10.5, color: AT.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  modalInput: { backgroundColor: AT.cardBg, borderWidth: 1, borderColor: AT.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, color: AT.textPrimary, textAlign: 'center', fontWeight: '700' },

  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  modalCancelBtn: { backgroundColor: AT.cardBg2 },
  modalCancelBtnText: { color: AT.textSecondary, fontSize: 13, fontWeight: '700' },
  modalConfirmBtn: { backgroundColor: AT.green },
  modalConfirmBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});
