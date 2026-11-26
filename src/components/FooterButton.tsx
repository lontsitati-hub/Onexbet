import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBetStore } from '../store/useBetStore';
import { BetSlip } from '../types/bet';
import { getBackgroundPalette } from '../constants/theme';
import { ReplaceCouponModal } from './ReplaceCouponModal';
import { getCombinedCashoutState } from '@/utils/combinedCashout';
import { isMortalKombatEvent } from '@/utils/localMortalKombatSimulation';
import { isPokerEvent } from '@/utils/localPokerSimulation';

interface FooterButtonProps {
  betSlip?: BetSlip;
}

export const FooterButton: React.FC<FooterButtonProps> = ({ betSlip }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentBetSlip = useBetStore((state) => state.currentBetSlip);
  const duplicateCoupon = useBetStore((state) => state.duplicateCoupon);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [clockMs, setClockMs] = useState(Date.now());

  const activeSlip = betSlip || currentBetSlip;
  const normalizedStatus = String(activeSlip?.status || '').trim().toLowerCase();
  const isTerminalStatus = ['gagné', 'gagne', 'perdu', 'payé', 'paye'].includes(normalizedStatus);
  const timedEvents = activeSlip?.events?.filter((event) => (
    event.isLive
    || String(event.status || '').toLowerCase() === 'en direct'
    || event.sport === 'FIFA'
    || event.tournament.trim().toUpperCase().startsWith('FIFA')
    || isMortalKombatEvent(event)
    || isPokerEvent(event)
  )) ?? [];
  useEffect(() => {
    if (timedEvents.length === 0) return undefined;
    const timer = setInterval(() => setClockMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [timedEvents.length]);
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);

  if (!activeSlip || activeSlip.isDraft || isTerminalStatus) {
    return null;
  }

  const handleDuplicatePress = () => {
    // Si le coupon courant contient déjà des événements, afficher la modal de confirmation
    if (currentBetSlip && currentBetSlip.events && currentBetSlip.events.length > 0) {
      setIsReplaceModalOpen(true);
    } else {
      duplicateCoupon(activeSlip);
    }
  };

  const handleConfirmReplace = () => {
    setIsReplaceModalOpen(false);
    duplicateCoupon(activeSlip);
  };

  const cashout = getCombinedCashoutState(activeSlip, clockMs);
  const sellAmount = cashout.sellAmount;
  // Le bouton reste présent pendant toute la partie. Le calcul évolue chaque
  // seconde sur l'ensemble des jeux du coupon, y compris un combiné.
  const canShowSell = cashout.canSell;
  // Dupliquer reste disponible avant le coup d’envoi des matchs FIFA, Poker
  // et Mortal Kombat, puis disparaît dès que l’un de ces matchs commence.
  const hasLiveSpecialEvent = cashout.hasSpecialLive;
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);

  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#6898D6';
  const activeBgColor = backgroundMode === 'light'
    ? (theme === 'red_mega' ? '#FFF5F5' : theme === 'light_green' ? '#F2F9E6' : theme === 'green' ? '#E6F2EF' : theme === 'royal_blue' ? '#E8EAFA' : theme === 'gold' ? '#FEF8EC' : '#EBF3FC')
    : backgroundMode === 'navy' ? '#3A4F6A' : 'rgba(255, 255, 255, 0.08)';
  const formatCurrency = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  return (
    <>
      <View style={[styles.container, { backgroundColor: bg.cardBg, borderTopColor: bg.divider, paddingBottom: 12 }]}>
        {canShowSell && (
          <TouchableOpacity
            style={[styles.sellButton, { backgroundColor: activeColor }]}
            onPress={() => router.push({ pathname: '/edit-sell-amount', params: { couponId: activeSlip.id } })}
            activeOpacity={0.8}
          >
            <Text style={styles.sellButtonText}>Vendre pour {formatCurrency(sellAmount)} ₣</Text>
          </TouchableOpacity>
        )}

        {!hasLiveSpecialEvent ? (
          <TouchableOpacity
            style={[styles.duplicateButton, { backgroundColor: activeBgColor }]}
            onPress={handleDuplicatePress}
            activeOpacity={0.8}
          >
            <Text style={[styles.duplicateButtonText, { color: activeColor }]}>DUPLIQUER LE COUPON DE PARI</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ReplaceCouponModal
        visible={isReplaceModalOpen}
        onConfirm={handleConfirmReplace}
        onCancel={() => setIsReplaceModalOpen(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  sellButton: {
    backgroundColor: '#5299DE',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'System',
  },
  duplicateButton: {
    backgroundColor: '#E6F0FC', // Very light soft blue matching image
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  duplicateButtonText: {
    color: '#3882C7', // Defined medium blue text matching image
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'System',
    letterSpacing: 0.5,
  },
});
