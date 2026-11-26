import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, StatusBar, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useBetStore } from '@/store/useBetStore';
import { getBackgroundPalette } from '@/constants/theme';

export default function EditSellAmountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { couponId } = useLocalSearchParams<{ couponId: string }>();
  const currentBetSlip = useBetStore((state) => state.currentBetSlip);
  const betHistory = useBetStore((state) => state.betHistory);
  const updateCouponSellAmount = useBetStore((state) => state.updateCouponSellAmount);

  const targetId = couponId || currentBetSlip?.id;

  const activeCoupon = targetId 
    ? (betHistory.find(item => item.id === targetId) || (currentBetSlip.id === targetId ? currentBetSlip : null))
    : currentBetSlip;

  const initialAmount = activeCoupon?.sellAmount ?? 470;
  const [amountText, setAmountText] = useState(String(initialAmount));

  const handleSave = () => {
    const val = parseFloat(amountText.replace(',', '.'));
    if (!isNaN(val) && val >= 0) {
      if (targetId) {
        updateCouponSellAmount(targetId, val);
      } else {
        useBetStore.setState((state) => ({
          currentBetSlip: { ...state.currentBetSlip, sellAmount: val }
        }));
      }
      router.back();
    }
  };

  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#2E79C9';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.root, { backgroundColor: bg.appBg }]}
    >
      <StatusBar barStyle={bg.statusBarStyle} backgroundColor="transparent" translucent={true} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: bg.headerBg, borderBottomWidth: 1, borderBottomColor: bg.divider }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome name="arrow-left" size={17} color={bg.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: bg.textPrimary }]}>Modifier le montant de vente</Text>
          <View style={{ width: 36 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: bg.cardBg, borderColor: bg.divider }]}>
          <Text style={[styles.label, { color: bg.textPrimary }]}>Montant de vente (₣)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: bg.appBg, borderColor: bg.divider, color: bg.textPrimary }]}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            placeholder="Ex: 470"
            placeholderTextColor={bg.textSecondary}
            autoFocus
          />
          <Text style={[styles.description, { color: bg.textSecondary }]}>
            Ce montant sera affiché sur le bouton bleu "Vendre pour ... ₣" dans les détails du coupon.
          </Text>

          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: activeColor }]} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Valider et Enregistrer</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  header: {
    backgroundColor: '#0C2751',
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8EFF6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3D5C',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F4F6F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '800',
    color: '#1A3D5C',
  },
  description: {
    fontSize: 12.5,
    color: '#758C9E',
    marginTop: 8,
    lineHeight: 18,
    marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: '#2E79C9',
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
