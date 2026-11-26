import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getBackgroundPalette } from '@/constants/theme';
import { useBetStore } from '@/store/useBetStore';

const ACCENTS: Record<string, string> = {
  blue: '#4B91D1',
  light_green: '#7CB342',
  green: '#008264',
  royal_blue: '#2e45d1',
  gold: '#E5A93B',
  red_mega: '#E60000',
};

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const balance = useBetStore((state) => state.balance);
  const updateBalance = useBetStore((state) => state.updateBalance);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const accent = ACCENTS[theme] || ACCENTS.blue;
  const softAccent = theme === 'gold' ? '#FEF3D8' : theme === 'green' ? '#DDEFEA' : theme === 'red_mega' ? '#FFF5F5' : theme === 'light_green' ? '#EAF4DC' : theme === 'royal_blue' ? '#E4E8FC' : '#E4F0FB';
  const [depositVisible, setDepositVisible] = useState(false);
  const [depositText, setDepositText] = useState('');
  const [faceId, setFaceId] = useState(true);
  const [haptic, setHaptic] = useState(true);
  const [push, setPush] = useState(true);

  const confirmDeposit = async () => {
    const amount = Number(depositText.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Montant invalide', 'Entre un montant supérieur à zéro.');
      return;
    }
    updateBalance(balance + amount);
    const { addDepositMessage } = await import('@/services/withdrawals');
    await addDepositMessage(amount);
    setDepositText('');
    setDepositVisible(false);
    Alert.alert('Dépôt enregistré', `Votre dépôt de ${amount.toFixed(2)} ₣ a été ajouté au solde.`);
  };

  const Row = ({ icon, title, subtitle, onPress, right }: { icon: React.ReactNode; title: string; subtitle?: string; onPress?: () => void; right?: React.ReactNode }) => (
    <TouchableOpacity style={styles.row} activeOpacity={onPress ? 0.7 : 1} onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: softAccent }]}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: bg.textPrimary }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSubtitle, { color: bg.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {right || <Ionicons name="chevron-forward" size={23} color={bg.textSecondary} />}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: bg.appBg }]}>
      <StatusBar barStyle={bg.statusBarStyle} backgroundColor={bg.headerBg} />
      <View style={[styles.header, { paddingTop: (insets.top || 24) + 8, backgroundColor: bg.headerBg }]}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}><Ionicons name="chevron-back" size={31} color={accent} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: accent }]}>Paramètres</Text>
        <View style={styles.headerActions}><Ionicons name="information-circle-outline" size={30} color={accent} /><View style={[styles.userCircle, { backgroundColor: accent }]}><FontAwesome name="user" size={17} color="#FFF" /></View></View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: bg.textSecondary }]}>Gestion du compte</Text>
        <View style={[styles.group, { backgroundColor: bg.cardBg }]}>
          <Row icon={<MaterialCommunityIcons name="cash-plus" size={27} color={accent} />} title="Effectuer un dépôt" onPress={() => setDepositVisible(true)} />
          <View style={[styles.separator, { backgroundColor: bg.divider }]} />
          <Row icon={<MaterialCommunityIcons name="cash-minus" size={27} color={accent} />} title="Retirer du compte" onPress={() => router.push('/withdrawals')} />
        </View>

        <Text style={[styles.sectionTitle, { color: bg.textSecondary }]}>Sécurité</Text>
        <View style={[styles.group, { backgroundColor: bg.cardBg }]}>
          <Row icon={<MaterialCommunityIcons name="face-recognition" size={27} color={accent} />} title="Déverrouiller avec Face ID" right={<Switch value={faceId} onValueChange={setFaceId} trackColor={{ false: '#CBD5E1', true: accent }} thumbColor="#FFF" />} />
          <View style={[styles.separator, { backgroundColor: bg.divider }]} />
          <Row icon={<MaterialCommunityIcons name="shield-check" size={27} color={accent} />} title="Authentificateur" subtitle="Pas activé" />
          <View style={[styles.separator, { backgroundColor: bg.divider }]} />
          <Row icon={<Ionicons name="lock-closed" size={25} color={accent} />} title="Paramètres de sécurité" subtitle="Profil faiblement protégé" />
          <View style={[styles.separator, { backgroundColor: bg.divider }]} />
          <Row icon={<MaterialCommunityIcons name="history" size={28} color={accent} />} title="Historique des connexions" />
        </View>

        <Text style={[styles.sectionTitle, { color: bg.textSecondary }]}>Paramètres des paris</Text>
        <View style={[styles.group, { backgroundColor: bg.cardBg }]}>
          <Row icon={<MaterialCommunityIcons name="currency-usd" size={27} color={accent} />} title="Paramètres généraux de pari" />
          <View style={[styles.separator, { backgroundColor: bg.divider }]} />
          <Row icon={<MaterialCommunityIcons name="gesture-tap" size={28} color={accent} />} title="Pari en un clic" />
        </View>

        <Text style={[styles.sectionTitle, { color: bg.textSecondary }]}>Paramètres de l'application</Text>
        <View style={[styles.group, { backgroundColor: bg.cardBg }]}>
          <Row icon={<MaterialCommunityIcons name="view-grid-outline" size={27} color={accent} />} title="Format cotes" subtitle="Décimal" />
          <View style={[styles.separator, { backgroundColor: bg.divider }]} />
          <Row icon={<MaterialCommunityIcons name="vibrate" size={27} color={accent} />} title="Haptic Scroll" right={<Switch value={haptic} onValueChange={setHaptic} trackColor={{ false: '#CBD5E1', true: accent }} thumbColor="#FFF" />} />
          <View style={[styles.separator, { backgroundColor: bg.divider }]} />
          <Row icon={<Ionicons name="notifications" size={26} color={accent} />} title="Notifications push" right={<Switch value={push} onValueChange={setPush} trackColor={{ false: '#CBD5E1', true: accent }} thumbColor="#FFF" />} />
        </View>
      </ScrollView>

      <Modal visible={depositVisible} transparent animationType="fade" onRequestClose={() => setDepositVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.depositModal, { backgroundColor: bg.cardBg }]}>
            <Text style={[styles.modalTitle, { color: bg.textPrimary }]}>Effectuer un dépôt</Text>
            <Text style={[styles.modalHint, { color: bg.textSecondary }]}>Montant à ajouter au solde</Text>
            <TextInput autoFocus value={depositText} onChangeText={setDepositText} keyboardType="decimal-pad" placeholder="Montant en ₣" placeholderTextColor={bg.textSecondary} style={[styles.amountInput, { color: bg.textPrimary, borderColor: bg.divider, backgroundColor: bg.appBg }]} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: softAccent }]} onPress={() => setDepositVisible(false)}><Text style={[styles.modalButtonText, { color: accent }]}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: accent }]} onPress={confirmDeposit}><Text style={styles.confirmText}>Confirmer</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 82, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 25, fontWeight: '600' },
  headerActions: { width: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  sectionTitle: { fontSize: 20, fontWeight: '600', marginTop: 18, marginBottom: 12, marginLeft: 20 },
  group: { borderRadius: 25, overflow: 'hidden', paddingHorizontal: 20 },
  row: { minHeight: 86, flexDirection: 'row', alignItems: 'center' },
  rowIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginRight: 20 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 19, fontWeight: '500' },
  rowSubtitle: { fontSize: 15, marginTop: 3 },
  separator: { height: 1, marginLeft: 74 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(26, 39, 52, 0.42)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  depositModal: { width: '100%', maxWidth: 360, borderRadius: 22, padding: 22 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  modalHint: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 14 },
  amountInput: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 16 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalButton: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalButtonText: { fontSize: 14, fontWeight: '800' },
  confirmText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
});
