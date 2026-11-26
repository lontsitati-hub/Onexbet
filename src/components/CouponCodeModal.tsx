import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getBackgroundPalette } from '../constants/theme';
import { useBetStore } from '../store/useBetStore';
import { publishCouponShare } from '../services/sharedCoupons';
import type { BetSlip } from '../types/bet';

interface CouponCodeModalProps {
  visible: boolean;
  onClose: () => void;
  couponCode?: string;
}

export const CouponCodeModal: React.FC<CouponCodeModalProps> = ({
  visible,
  onClose,
  couponCode,
}) => {
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const selectedHistoryItem = useBetStore((state) => state.selectedHistoryId
    ? state.betHistory.find((item) => item.id === state.selectedHistoryId) ?? null
    : null);
  const currentBetSlip = useBetStore((state) => state.currentBetSlip);

  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);

  // Active theme accent color for primary buttons / highlights
  const activeColor =
    theme === 'red_mega'
      ? '#E60000'
      : theme === 'light_green'
      ? '#7CB342'
      : theme === 'green'
        ? '#008264'
        : theme === 'royal_blue'
          ? '#2e45d1'
          : theme === 'gold'
            ? '#E5A93B'
            : '#2E79C9';

  const modalTextColor = bg.textPrimary;
  const modalSecondaryTextColor = bg.textSecondary;
  const modalSoftColor = bg.inputBg;

  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState('');
  const iconMotion = useRef(new Animated.Value(0)).current;
  const confirmationMotion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      iconMotion.stopAnimation();
      iconMotion.setValue(0);
      setCopied(false);
      setCopyError('');
      return;
    }

    const motion = Animated.loop(
      Animated.sequence([
        Animated.timing(iconMotion, {
          toValue: 1,
          duration: 520,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(iconMotion, {
          toValue: 0,
          duration: 520,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    motion.start();
    return () => motion.stop();
  }, [iconMotion, visible]);

  useEffect(() => {
    if (!visible || !copied) {
      confirmationMotion.stopAnimation();
      confirmationMotion.setValue(0);
      return;
    }

    const confirmationBounce = Animated.loop(
      Animated.sequence([
        Animated.timing(confirmationMotion, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(confirmationMotion, {
          toValue: 0,
          duration: 440,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    confirmationBounce.start();
    return () => confirmationBounce.stop();
  }, [confirmationMotion, copied, visible]);

  const iconAnimatedStyle = {
    opacity: iconMotion.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }),
    transform: [
      { translateY: iconMotion.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
      { scale: iconMotion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) },
    ],
  };
  const confirmationIconAnimatedStyle = {
    opacity: confirmationMotion.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }),
    transform: [
      { translateY: confirmationMotion.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) },
      { scale: confirmationMotion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
      { rotate: confirmationMotion.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) },
    ],
  };

  // Derives short coupon code (e.g., 5DUJJ or currentBetSlip.code)
  const displayCode =
    couponCode ||
    currentBetSlip?.code ||
    (currentBetSlip?.id ? currentBetSlip.id.substring(0, 5).toUpperCase() : '5DUJJ');

  const couponToShare: BetSlip | null = selectedHistoryItem && selectedHistoryItem.code === displayCode
    ? {
        id: selectedHistoryItem.id,
        type: selectedHistoryItem.type,
        date: selectedHistoryItem.date,
        eventCount: selectedHistoryItem.events?.length || selectedHistoryItem.eventCount,
        finishedCount: (selectedHistoryItem.events || []).filter((event) => event.status === 'Gagné' || event.status === 'Perdu' || event.status === 'Payé').length,
        totalOdds: selectedHistoryItem.totalOdds,
        stake: selectedHistoryItem.stake,
        potentialGain: selectedHistoryItem.potentialGain,
        status: selectedHistoryItem.status,
        events: selectedHistoryItem.events || [],
        sellAmount: selectedHistoryItem.sellAmount,
        code: displayCode,
      }
    : currentBetSlip.code === displayCode && currentBetSlip.events.length > 0
      ? currentBetSlip
      : null;

  const handleCopy = async () => {
    if (copying) return;
    setCopyError('');
    setCopying(true);
    try {
      if (!couponToShare) {
        throw new Error('Ce coupon ne contient pas de code partageable. Enregistrez-le à nouveau avant de le copier.');
      }
      await publishCouponShare(couponToShare);
      await Clipboard.setStringAsync(displayCode);
      setCopied(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Impossible de publier le coupon avant sa copie.';
      console.warn('Erreur de partage ou de copie du coupon:', e);
      setCopyError(message);
    } finally {
      setCopying(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.backdrop, { backgroundColor: backgroundMode === 'light' ? 'rgba(31, 45, 57, 0.42)' : 'rgba(0, 0, 0, 0.58)' }]}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: bg.cardBg,
                  borderColor: bg.divider,
                },
              ]}
            >
              {copied ? (
                <View style={styles.copiedConfirmation}>
                  <Animated.View style={[styles.infoIconWrap, confirmationIconAnimatedStyle]}>
                    <Text accessibilityLabel="Confirmation de copie" style={styles.infoIcon}>!</Text>
                  </Animated.View>
                  <Text style={[styles.confirmationTitle, { color: modalTextColor }]}>Coupon</Text>
                  <Text style={[styles.confirmationMessage, { color: modalSecondaryTextColor }]}>Code copié</Text>
                  <TouchableOpacity
                    style={[styles.okButton, { backgroundColor: modalSoftColor }]}
                    onPress={onClose}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="OK"
                  >
                    <Text style={[styles.okButtonText, { color: activeColor }]}>OK</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Animated.View style={[styles.warningIconWrap, iconAnimatedStyle]}>
                    <Text accessibilityLabel="Attention" style={styles.warningIcon}>⚠️</Text>
                  </Animated.View>

                  <Text style={[styles.title, { color: modalTextColor }]}>Enregistrer</Text>

                  <Text style={[styles.description, { color: modalSecondaryTextColor }]}> 
                    Coupon de pari enregistré avec succès avec le code{' '}
                    <Text style={[styles.codeHighlight, { color: modalSecondaryTextColor }]}>{displayCode}</Text>
                    . Vous pouvez charger votre coupon de pari à l'aide de ce code ou le partager avec vos amis afin de jouer ensemble !
                  </Text>
                  {copyError ? <Text style={styles.copyError}>{copyError}</Text> : null}

                  <View style={styles.buttonsRow}>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        styles.cancelBtn,
                        { backgroundColor: modalSoftColor, borderColor: 'transparent' },
                      ]}
                      onPress={onClose}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.cancelBtnText, { color: activeColor }]}>Annuler</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.copyBtn, { backgroundColor: modalSoftColor }]}
                      onPress={handleCopy}
                      activeOpacity={0.8}
                      disabled={copying}
                      accessibilityRole="button"
                      accessibilityLabel="Publier et copier le code du coupon"
                    >
                      <Text style={[styles.copyBtnText, { color: activeColor }]}>{copying ? 'Enregistrement…' : 'Copier'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(31, 45, 57, 0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 25,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 8,
  },
  warningIconWrap: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  warningIcon: {
    fontSize: 78,
    lineHeight: 88,
    textAlign: 'center',
  },
  copiedConfirmation: {
    alignItems: 'center',
    paddingTop: 12,
  },
  infoIconWrap: {
    width: 108,
    height: 108,
    borderRadius: 40,
    backgroundColor: '#687DE2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    shadowColor: '#687DE2',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 5,
  },
  infoIcon: {
    color: '#FFFFFF',
    fontSize: 76,
    lineHeight: 88,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: -5,
  },
  confirmationTitle: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: 'System',
  },
  confirmationMessage: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'System',
  },
  okButton: {
    alignSelf: 'stretch',
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  okButtonText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'System',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
    fontFamily: 'System',
  },
  description: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    fontFamily: 'System',
  },
  copyError: {
    color: '#C62828',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: -14,
    marginBottom: 16,
  },
  codeHighlight: {
    fontWeight: '400',
    fontFamily: 'System',
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 0,
  },
  cancelBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    fontFamily: 'System',
  },
  copyBtn: {},
  copyBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    fontFamily: 'System',
  },
});
