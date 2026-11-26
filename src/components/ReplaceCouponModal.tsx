import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { getBackgroundPalette } from '../constants/theme';
import { useBetStore } from '../store/useBetStore';

interface ReplaceCouponModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ReplaceCouponModal: React.FC<ReplaceCouponModalProps> = ({
  visible,
  onConfirm,
  onCancel,
}) => {
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);

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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: bg.cardBg,
                  borderColor: bg.border,
                },
              ]}
            >
              {/* Title Header */}
              <Text style={[styles.title, { color: activeColor }]}>
                Votre coupon de pari n'est pas vide
              </Text>

              {/* Message Body */}
              <Text style={[styles.message, { color: bg.textSecondary }]}>
                Votre coupon de pari contient déjà des événements. Les remplacer ?
              </Text>

              {/* Divider line before buttons */}
              <View style={[styles.divider, { backgroundColor: bg.divider }]} />

              {/* Top Action Button: OK */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={onConfirm}
                activeOpacity={0.7}
              >
                <Text style={[styles.okText, { color: activeColor }]}>OK</Text>
              </TouchableOpacity>

              {/* Inner divider line */}
              <View style={[styles.divider, { backgroundColor: bg.divider }]} />

              {/* Bottom Action Button: Annuler */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={onCancel}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelText, { color: activeColor }]}>
                  Annuler
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 18,
    borderWidth: 1,
    paddingTop: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    fontFamily: 'System',
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    paddingHorizontal: 22,
    marginBottom: 18,
    lineHeight: 20,
    fontFamily: 'System',
  },
  divider: {
    width: '100%',
    height: 1,
  },
  actionBtn: {
    width: '100%',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  okText: {
    fontSize: 15.5,
    fontWeight: '700',
    fontFamily: 'System',
  },
  cancelText: {
    fontSize: 15.5,
    fontWeight: '600',
    fontFamily: 'System',
  },
});
