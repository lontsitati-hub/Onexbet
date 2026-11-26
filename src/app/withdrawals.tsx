import { getBackgroundPalette } from '@/constants/theme';
import { useBetStore } from '@/store/useBetStore';
import {
  decideWithdrawalStatus,
  getWithdrawals,
  requestWithdrawal,
  type Withdrawal,
  type WithdrawalStatus
} from '@/services/withdrawals';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDate } from '@/services/withdrawals';
import { checkAccess } from '@/services/access';

// ─────────────────────────────────────────────────────────────────────────────
// Écran Paramètres — Simulateur de retraits
// Le joueur demande un retrait depuis son solde ; une réponse d'approbation
// (ou de refus) arrive automatiquement dans la messagerie.
// ─────────────────────────────────────────────────────────────────────────────

const METHODS = ['Orange Money', 'MTN Money', 'Moov Money', 'Wave', 'Virement bancaire'];

export default function WithdrawalsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const balance = useBetStore((state) => state.balance);
  const updateBalance = useBetStore((state) => state.updateBalance);
  const sessionRole = useBetStore((state) => state.sessionRole);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);

  const activeColor =
    theme === 'red_mega'
      ? '#E60000' : theme === 'light_green'
      ? '#7CB342'
      : theme === 'green'
        ? '#008264'
        : theme === 'royal_blue'
          ? '#2e45d1'
          : theme === 'gold'
            ? '#E5A93B'
            : '#2E79C9';
  const activeBgColor =
    theme === 'red_mega'
      ? '#FFF5F5' : theme === 'light_green'
      ? '#F2F9E6'
      : theme === 'green'
        ? '#E6F2EF'
        : theme === 'royal_blue'
          ? '#E8EAFA'
          : theme === 'gold'
            ? '#FEF8EC'
            : '#EBF3FC';

  const [amountText, setAmountText] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('Orange Money');
  const [accountRef, setAccountRef] = useState('');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const accountNumber = '1541930241';

  const loadWithdrawals = useCallback(async () => {
    const list = await getWithdrawals();
    setWithdrawals(list);
    return list;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const access = checkAccess('/withdrawals');
      if (!access.allowed) {
        if (access.reason === 'no-session') {
          router.replace('/');
        } else {
          Alert.alert('Accès refusé', access.message, [{ text: 'OK', onPress: () => router.replace('/') }]);
        }
        return;
      }
      void loadWithdrawals();
    }, [loadWithdrawals])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWithdrawals();
    setRefreshing(false);
  }, [loadWithdrawals]);

  const chooseStatus = useCallback(
    (w: Withdrawal) => {
      if (w.status !== 'pending') return;
      Alert.alert(
        `Statut du retrait — ${w.amount.toFixed(2)} ₣`,
        'Décidez du statut de cette demande de retrait :',
        [
          {
            text: 'Approuver',
            onPress: async () => {
              // Le montant a déjà été débité à la demande ; l'approbation
              // confirme le départ des fonds — on ne crédite rien.
              await decideWithdrawalStatus(w.id, 'approved');
              await loadWithdrawals();
            },
            style: 'default',
          },
          {
            text: 'Refuser',
            onPress: async () => {
              // Le retrait refusé est remboursé sur le solde.
              await decideWithdrawalStatus(w.id, 'rejected');
              updateBalance(Number((balance + w.amount).toFixed(2)));
              await loadWithdrawals();
            },
            style: 'destructive',
          },
          {
            text: 'En attente',
            onPress: async () => {
              // Statut inchangé : le solde reste débité en attendant.
              await decideWithdrawalStatus(w.id, 'pending');
              await loadWithdrawals();
            },
            style: 'cancel',
          },
        ]
      );
    },
    [loadWithdrawals, updateBalance, balance]
  );

  const handleRequest = async () => {
    const amount = parseFloat(amountText.replace(/[^0-9.]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Montant invalide', 'Veuillez entrer un montant supérieur à 0.');
      return;
    }
    if (amount > balance) {
      Alert.alert('Solde insuffisant', `Votre solde est de ${balance.toFixed(2)} ₣.`);
      return;
    }
    // Un retrait déjà en attente du même montant et de la même référence
    // ne doit pas être doublonné (protection des doubles demandes).
    const existing = await getWithdrawals();
    const duplicate = existing.find(
      (e) => e.status === 'pending' && e.amount === amount && e.method === selectedMethod && e.accountRef === accountRef.trim()
    );
    if (duplicate) {
      Alert.alert('Demande en cours', 'Une demande identique est déjà en attente de traitement.');
      return;
    }
    const ref = accountRef.trim();
    if (ref.length < 4) {
      Alert.alert('Référence invalide', 'Entrez le numéro de compte ou l\'IBAN associé (4 caractères minimum).');
      return;
    }

    setRequesting(true);
    try {
      await requestWithdrawal(amount, selectedMethod, ref);
      updateBalance(Number((balance - amount).toFixed(2)));
      setAmountText('');
      Alert.alert(
        'Demande envoyée',
        `Votre demande de retrait de ${amount.toFixed(2)} ₣ a été enregistrée. La réponse arrivera dans votre messagerie dans quelques instants.`
      );
      await loadWithdrawals();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'envoyer la demande. Réessayez.');
    } finally {
      setRequesting(false);
    }
  };

  const statusConfig: Record<Withdrawal['status'], { label: string; color: string; bgTint: string; icon: any }> = {
    pending: { label: 'En traitement', color: '#F5B041', bgTint: '#FEF8EC', icon: 'clock-outline' },
    approved: { label: 'Approuvé', color: '#27BE6D', bgTint: '#E9F9EF', icon: 'check-circle-outline' },
    rejected: { label: 'Refusé', color: '#E74C3C', bgTint: '#FBEAEA', icon: 'close-circle-outline' },
  };

  const formatCurrency = (val: number) => (val % 1 !== 0 ? val.toFixed(2) : val.toString());

  return (
    <View style={[styles.container, { backgroundColor: bg.appBg }]}> 
      {/* Header */}
      <View style={[styles.header, { backgroundColor: bg.headerBg, borderBottomColor: bg.divider, borderBottomWidth: 1 }]}> 
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={activeColor} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: bg.textPrimary }]}>Retirer des fonds</Text>
        </View>
        <TouchableOpacity onPress={() => void loadWithdrawals()} activeOpacity={0.7} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={28} color={bg.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={activeColor} />}
      >
        <View style={styles.accountHeading}>
          <Text style={[styles.accountTitle, { color: bg.textPrimary }]}>RETRAIT DU COMPTE {accountNumber}</Text>
          <TouchableOpacity onPress={() => Alert.alert('Compte copié', accountNumber)} style={styles.copyAccountBtn}>
            <Ionicons name="copy-outline" size={25} color="#5B9C72" />
          </TouchableOpacity>
        </View>

        <View style={styles.selectorRow}>
          <TouchableOpacity style={[styles.blueSelector, { backgroundColor: activeColor }]} onPress={() => setRequestModalVisible(true)}>
            <Text style={styles.selectorText}>Types de systèmes de paiement</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.greenSelector, { backgroundColor: activeColor }]} onPress={() => setShowHistory((value) => !value)}>
            <Text style={styles.selectorText}>Demandes de retrait</Text>
            <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={23} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.confirmRow}>
          <Text style={[styles.confirmText, { color: bg.textPrimary }]}>Confirmez les transactions via:</Text>
          <TouchableOpacity style={[styles.smsButton, { backgroundColor: activeColor }]} onPress={() => Alert.alert('Confirmation', 'Les transactions seront confirmées par SMS.')}>
            <Text style={styles.selectorText}>SMS</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.noticeBox, { backgroundColor: bg.cardBg, borderColor: bg.divider, borderWidth: 1 }]}>
          <Text style={[styles.noticeText, { color: bg.textSecondary }]}>Chers clients, lors de vos transactions via les méthodes de mobile money, les opérateurs Orange et MTN peuvent vous facturer une taxe de 1 % du montant de la transaction, conformément à la LOI DE FINANCES DU CAMEROUN 2025.</Text>
        </View>

        <View style={[styles.paymentSection, { backgroundColor: bg.appBg }]}>
          <Text style={[styles.paymentSectionTitle, { color: bg.textPrimary }]}>PAIEMENTS MOBILES</Text>
          <View style={styles.paymentGrid}>
            <PaymentCard label="MTN" kind="mtn" onPress={() => { setSelectedMethod('MTN Money'); setRequestModalVisible(true); }} />
            <PaymentCard label="Orange" kind="orange" onPress={() => { setSelectedMethod('Orange Money'); setRequestModalVisible(true); }} />
            <PaymentCard label="Express Union" kind="express" onPress={() => { setSelectedMethod('Express Union'); setRequestModalVisible(true); }} />
          </View>
        </View>

        <View style={[styles.cashSection, { backgroundColor: bg.appBg }]}>
          <Text style={[styles.paymentSectionTitle, { color: bg.textPrimary }]}>ESPÈCES</Text>
          <PaymentCard label="Total" kind="total" onPress={() => { setSelectedMethod('Total'); setRequestModalVisible(true); }} />
        </View>

        {showHistory ? (
          <View style={[styles.historyCard, { backgroundColor: bg.cardBg, borderColor: bg.divider }]}>
            <Text style={[styles.sectionTitle, { color: bg.textPrimary }]}>Historique des retraits</Text>
            {withdrawals.length === 0 ? (
              <Text style={[styles.emptyText, { color: bg.textMuted }]}>Aucune demande de retrait.</Text>
            ) : (
              withdrawals.map((w) => {
                const cfg = statusConfig[w.status];
                return (
                  <View key={w.id} style={[styles.withdrawalRow, { borderBottomColor: bg.divider }]}> 
                    <View style={[styles.wIconRow, { backgroundColor: cfg.bgTint }]}>
                      <MaterialCommunityIcons name={cfg.icon as any} size={20} color={cfg.color} />
                    </View>
                    <View style={styles.wBody}>
                      <Text style={[styles.wAmount, { color: bg.textPrimary }]}>{w.amount.toFixed(2)} ₣</Text>
                      <Text style={[styles.wMethod, { color: bg.textMuted }]}>{w.method} • {w.accountRef}</Text>
                      <Text style={[styles.wDate, { color: bg.textMuted }]}>{formatDate(w.createdAt)}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: cfg.bgTint }]}>
                      <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    {w.status === 'pending' && (
                      <View style={styles.decisionBtns}>
                        <TouchableOpacity style={[styles.decisionBtn, { backgroundColor: '#27BE6D' }]} activeOpacity={0.7} onPress={() => chooseStatus(w)}>
                          <Text style={styles.decisionBtnText}>Approuver</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.decisionBtn, { backgroundColor: '#E74C3C' }]} activeOpacity={0.7} onPress={() => chooseStatus(w)}>
                          <Text style={styles.decisionBtnText}>Refuser</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : null}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal visible={requestModalVisible} transparent animationType="slide" onRequestClose={() => setRequestModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.requestModal, { backgroundColor: bg.cardBg }]}>
            <TouchableOpacity onPress={() => setRequestModalVisible(false)} style={styles.modalClose}><Ionicons name="close" size={29} color="#C8C8C8" /></TouchableOpacity>
            <View style={styles.modalLogo}>
              <Image source={logoSourceForMethod(selectedMethod)} resizeMode="contain" style={styles.modalLogoImage} />
            </View>
            <View style={[styles.modalFormArea, { backgroundColor: bg.appBg }]}>
              <View style={styles.modalFieldRow}>
                <Text style={[styles.modalFieldLabel, { color: bg.textPrimary }]}>Montant (Min {selectedMethod === 'Orange Money' ? '100.00' : '900.00'} XAF /{`\n`}Max {selectedMethod === 'Total' ? '1 500 000.00' : '1 000 000.00'} XAF):</Text>
                <TextInput value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" placeholder={selectedMethod === 'Orange Money' ? '100.00' : '900.00'} placeholderTextColor={bg.textSecondary} style={[styles.referenceInput, { borderColor: bg.divider, backgroundColor: bg.inputBg, color: bg.textPrimary }]} />
              </View>
              {selectedMethod === 'Total' ? (
                <Text style={[styles.otpInstruction, { color: bg.textPrimary }]}>Après avoir créé une demande de retrait, vous recevrez un code OTP. Pour terminer l'opération, vous devez vous rendre à Total Station ou TouchPoint.</Text>
              ) : (
                <>
                  <View style={styles.modalFieldRow}>
                    <Text style={[styles.modalFieldLabel, { color: bg.textPrimary }]}>Numéro de téléphone:</Text>
                    <TextInput value={accountRef} onChangeText={setAccountRef} keyboardType="phone-pad" placeholder="237__________" placeholderTextColor={bg.textSecondary} style={[styles.referenceInput, { borderColor: bg.divider, backgroundColor: bg.inputBg, color: bg.textPrimary }]} />
                  </View>
                </>
              )}
              <TouchableOpacity onPress={async () => { await handleRequest(); setRequestModalVisible(false); }} style={styles.confirmWithdrawalButton} disabled={requesting}>
                <Text style={styles.confirmWithdrawalText}>CONFIRMER</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function logoSourceForMethod(method: string) {
  if (method === 'MTN Money') return require('../../assets/payments/mtn-momo.png');
  if (method === 'Orange Money') return require('../../assets/payments/orange-money.jpg');
  if (method === 'Total') return require('../../assets/payments/touchpoint.png');
  return require('../../assets/payments/express-union.png');
}

function PaymentCard({ label, kind, onPress }: { label: string; kind: 'mtn' | 'orange' | 'express' | 'total'; onPress: () => void }) {
  const logoSource = kind === 'mtn'
    ? require('../../assets/payments/mtn-momo.png')
    : kind === 'orange'
      ? require('../../assets/payments/orange-money.jpg')
      : kind === 'express'
        ? require('../../assets/payments/express-union.png')
        : require('../../assets/payments/touchpoint.png');
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.paymentCard}>
      <View style={styles.paymentLogo}>
        <Image source={logoSource} resizeMode="contain" style={styles.paymentLogoImage} />
      </View>
      <View style={styles.paymentLabel}><Text style={styles.paymentLabelText}>{label}</Text></View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  accountHeading: { alignItems: 'flex-start', paddingHorizontal: 30, paddingTop: 18, paddingBottom: 8 },
  accountTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 0.2 },
  copyAccountBtn: { padding: 4, marginTop: 4 },
  selectorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, gap: 12 },
  blueSelector: { minHeight: 46, paddingHorizontal: 16, justifyContent: 'center' },
  greenSelector: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, backgroundColor: '#6C9F2F' },
  selectorText: { color: '#FFFFFF', fontSize: 16, fontWeight: '500' },
  confirmRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 },
  confirmText: { flex: 1, fontSize: 16 },
  smsButton: { paddingHorizontal: 18, paddingVertical: 12 },
  noticeBox: { marginHorizontal: 18, marginTop: 18, paddingHorizontal: 16, paddingVertical: 12 },
  noticeText: { color: '#30343A', fontSize: 16, lineHeight: 23 },
  paymentSection: { marginTop: 14, paddingTop: 12, paddingHorizontal: 18, paddingBottom: 18 },
  cashSection: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 22 },
  paymentSectionTitle: { textAlign: 'center', fontSize: 17, fontWeight: '500', marginBottom: 16 },
  paymentGrid: { flexDirection: 'row', gap: 16 },
  paymentCard: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF' },
  paymentLogo: { height: 128, alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: '#FFFFFF' },
  paymentLogoImage: { width: '88%', height: '88%' },
  paymentLogoText: { color: '#F27D22', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  mtnLogo: { backgroundColor: '#FFFFFF' },
  mtnLogoText: { backgroundColor: '#FFD200', color: '#0A6E9E', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 1, fontStyle: 'italic' },
  orangeLogo: { backgroundColor: '#FFFFFF' },
  expressLogo: { backgroundColor: '#FFFFFF' },
  totalLogo: { backgroundColor: '#FFFFFF' },
  paymentLabel: { minHeight: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4C8CB9' },
  paymentLabelText: { color: '#FFFFFF', fontSize: 16, fontWeight: '500' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  requestModal: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  modalMethod: { fontSize: 15, fontWeight: '800' },
  modalInput: { height: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 15 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  modalSubmit: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  modalClose: { position: 'absolute', right: 14, top: 10, zIndex: 2, padding: 4 },
  modalLogo: { height: 154, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', marginHorizontal: -20, marginTop: -20, marginBottom: 0 },
  modalLogoImage: { width: 220, height: 112 },
  modalLogoText: { color: '#F27D22', fontSize: 20, lineHeight: 23, fontWeight: '800', textAlign: 'center' },
  modalFormArea: { marginHorizontal: -20, marginBottom: -20, padding: 20, gap: 12 },
  modalFieldRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  modalFieldLabel: { fontSize: 16, lineHeight: 22, fontWeight: '800', flex: 1 },
  referenceInput: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: '#A5A9AD', backgroundColor: '#FFFFFF', color: '#28739D', fontSize: 17, textAlign: 'center', paddingHorizontal: 10 },
  otpInstruction: { fontSize: 16, lineHeight: 23, marginTop: 2 },
  confirmWithdrawalButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#78A928', marginTop: 2 },
  confirmWithdrawalText: { color: '#FFFFFF', fontSize: 17, fontWeight: '500' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  headerTitle: { fontSize: 22, fontWeight: '500', letterSpacing: 0.1 },
  refreshBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 0, gap: 0 },
  balanceCard: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 4,
  },
  balanceLabel: { fontSize: 12.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceValue: { fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'] },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  historyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  label: { fontSize: 12.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    padding: 0,
  },
  methodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodPill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  methodPillText: { fontSize: 12.5, fontWeight: '800' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  hint: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', paddingTop: 8 },
  withdrawalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  wIconRow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wBody: { flex: 1, gap: 1 },
  wAmount: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  wMethod: { fontSize: 12 },
  wDate: { fontSize: 11 },
  statusPill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  bottomSpacer: { height: 24 },
  decisionBtns: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginLeft: 46,
  },
  decisionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  decisionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
