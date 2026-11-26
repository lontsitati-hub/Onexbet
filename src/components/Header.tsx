import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, getBackgroundPalette } from '../constants/theme';
import { useBetStore } from '../store/useBetStore';
import { CouponCodeModal } from './CouponCodeModal';

interface HeaderProps {
  onBack?: () => void;
  couponCode?: string;
}

export const Header: React.FC<HeaderProps> = ({ onBack, couponCode }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#2E79C9';

  const [isCouponModalVisible, setIsCouponModalVisible] = useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <>
      <View style={[styles.headerContainer, { paddingTop: insets.top || 44, backgroundColor: bg.headerBg }]}>
        <View style={[styles.container, { backgroundColor: bg.headerBg, borderBottomWidth: 1, borderBottomColor: bg.divider }]}>
          <TouchableOpacity style={styles.iconButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={activeColor} />
          </TouchableOpacity>

            <Text style={[styles.title, { color: activeColor }]}>Détails du pari</Text>

          <View style={styles.rightActions}>
            {backgroundMode !== 'light' && (
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="notifications-outline" size={22} color={activeColor} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setIsCouponModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={activeColor} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <CouponCodeModal
        visible={isCouponModalVisible}
        onClose={() => setIsCouponModalVisible(false)}
        couponCode={couponCode}
      />
    </>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: COLORS.white,
  },
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.badgeBlue,
    textAlign: 'center',
    fontFamily: 'System',
    letterSpacing: -0.3,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellContainer: {
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B30',
  },
});
