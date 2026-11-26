import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Image } from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBetStore } from '@/store/useBetStore';
import { BackgroundMode, getBackgroundPalette } from '@/constants/theme';

export default function AdminThemeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const betStore = useBetStore();

  const [selectedTheme, setSelectedTheme] = useState<'blue' | 'royal_blue' | 'green' | 'gold' | 'light_green' | 'red_mega'>(
    betStore.theme || 'blue'
  );

  const [selectedBgMode, setSelectedBgMode] = useState<BackgroundMode>(
    betStore.backgroundMode || 'light'
  );
  const [selectedBgOpacity, setSelectedBgOpacity] = useState(betStore.backgroundOpacity || 1);

  const getThemeDetails = (themeKey: 'blue' | 'royal_blue' | 'green' | 'gold' | 'light_green' | 'red_mega') => {
    switch (themeKey) {
      case 'red_mega':
        return { title: 'Red Mega', color: '#E60000', bg: '#FFF5F5', description: 'Style rouge Red Mega avec le logo MegaPari et l’icône Coupon dédiée.', icon: require('../../assets/images/icon_coupon_tab_red_mega.png') };
      case 'light_green':
        return {
          title: 'Vert Lime / 1xBet Clair',
          color: '#7CB342',
          bg: '#F2F9E6',
          description: 'Style moderne sur fond blanc avec accents vert pomme vifs et l\'icône WW officielle.',
          icon: require('../../assets/images/icon_coupon_tab_light_green.png'),
        };
      case 'gold':
        return {
          title: 'Or / Jaune Classique',
          color: '#E5A93B',
          bg: '#FEF8EC',
          description: 'Style jaune orangé chaleureux inspiré du menu 1xBet avec boutons dorés.',
          icon: require('../../assets/images/icon_coupon_tab_gold.png'),
        };
      case 'green':
        return {
          title: 'Vert Émeraude Foncé',
          color: '#008264',
          bg: '#E6F2EF',
          description: 'Style vert forêt et blanc offrant un contraste reposant et épuré.',
          icon: require('../../assets/images/icon_coupon_tab_green.png'),
        };
      case 'royal_blue':
        return {
          title: 'Bleu Royal',
          color: '#2e45d1',
          bg: '#E8EAFA',
          description: 'Nouveau bleu électrique avec l\'icône de coupon customisée.',
          icon: require('../../assets/images/icon_coupon_tab_royal_transparent.png'),
        };
      default:
        return {
          title: 'Bleu Classique 1xBet',
          color: '#2E79C9',
          bg: '#EBF3FC',
          description: 'Colorimétrie historique standard avec l\'icône de coupon traditionnelle.',
          icon: require('../../assets/images/icon_coupon_tab.png'),
        };
    }
  };

  const getBgModeDetails = (mode: BackgroundMode) => {
    switch (mode) {
      case 'dark':
        return {
          title: 'Sombre',
          emoji: '🌑',
          preview: '#24303E',
          card: '#2E3D52',
          text: '#F0F4F8',
          textSub: '#9AAEC3',
          intensityPalette: ['#34465C', '#2E3D52', '#29384C', '#24303E'],
          description: 'Interface sombre avec tons bleu acier. Idéal pour la nuit.',
        };
      case 'navy':
        return {
          title: 'Marine',
          emoji: '🌊',
          preview: '#0C2040',
          card: '#13304F',
          text: '#D6E8F5',
          textSub: '#7AACCB',
          intensityPalette: ['#3A5068', '#2E3D52', '#283749', '#24303E'],
          description: 'Fond bleu marine profond, inspiré du design 1xBet officiel.',
        };
      case 'midnight':
        return {
          title: 'Minuit',
          emoji: '🌃',
          preview: '#000000',
          card: '#1C1C1C',
          text: '#F0F0F0',
          textSub: '#9A9A9A',
          intensityPalette: ['#282828', '#1C1C1C', '#101010', '#000000'],
          description: 'Fond quasi-noir ultra-sombre pour une expérience immersive.',
        };
      default:
        return {
          title: 'Clair',
          emoji: '☀️',
          preview: '#EEF2F6',
          card: '#FFFFFF',
          text: '#1A3D5C',
          textSub: '#5C7C99',
          intensityPalette: ['#F7F9FB', '#EEF2F6', '#E3EAF0', '#D7E2EA'],
          description: 'Interface lumineuse et épurée, fond gris très clair classique.',
        };
    }
  };

  const handleSave = () => {
    betStore.setTheme(selectedTheme);
    betStore.setBackgroundMode(selectedBgMode);
    betStore.setBackgroundOpacity(selectedBgOpacity);
    betStore.setActiveTab('populaire');
    router.replace('/');
  };

  const activeColor = getThemeDetails(selectedTheme).color;
  const activeBgColor = getThemeDetails(selectedTheme).bg;
  const selectedPalette = getBackgroundPalette(selectedBgMode, selectedBgOpacity);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2751" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome name="arrow-left" size={17} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🎨 Colorimétrie & Thèmes</Text>
          <View style={{ width: 36 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Choisissez le style de l'application</Text>
        <Text style={styles.sectionSubtitle}>
          Ce choix mettra à jour globalement l'apparence des boutons, indicateurs de cotes, badges, et boutons de navigation.
        </Text>

        {/* Themes List */}
        {(['light_green', 'blue', 'royal_blue', 'green', 'gold', 'red_mega'] as const).map((t) => {
          const details = getThemeDetails(t);
          const isSelected = selectedTheme === t;
          return (
            <TouchableOpacity
              key={t}
              style={[
                styles.themeCard,
                isSelected && { borderColor: details.color, borderWidth: 2, backgroundColor: '#FFF' },
              ]}
              onPress={() => {
                setSelectedTheme(t);
                // Appliquer immédiatement le thème global, notamment sur Web.
                // Le bouton de sauvegarde reste disponible pour conserver le flux
                // existant et revenir à l’accueil.
                betStore.setTheme(t);
              }}
              activeOpacity={0.9}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.colorIndicator, { backgroundColor: details.color }]} />
                <Text style={[styles.themeCardTitle, isSelected && { color: details.color }]}>
                  {details.title}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={22} color={details.color} style={styles.checkIcon} />
                )}
              </View>

              <Text style={styles.themeCardDesc}>{details.description}</Text>

              {/* Assets Preview */}
              <View style={styles.previewContainer}>
                <View style={styles.previewItem}>
                  <Text style={styles.previewLabel}>Icône de Coupon :</Text>
                  <Image source={details.icon} style={styles.couponIconPreview} resizeMode="contain" />
                </View>

                <View style={styles.previewItem}>
                  <Text style={styles.previewLabel}>Boutons :</Text>
                  <View style={[styles.btnPreview, { backgroundColor: details.color }]}>
                    <Text style={styles.btnPreviewText}>Parier</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ─── Section : Mode de fond ──────────────────────────────────────── */}
        <View style={styles.bgSectionDivider} />
        <Text style={styles.sectionTitle}>Mode de fond</Text>
        <Text style={styles.sectionSubtitle}>
          Ce choix modifie la couleur de fond de toutes les pages de l'application.
        </Text>

        {/* Background Mode Cards */}
        <View style={styles.bgModesGrid}>
          {(['light', 'dark', 'navy', 'midnight'] as BackgroundMode[]).map((mode) => {
            const bg = getBgModeDetails(mode);
            const isSelectedBg = selectedBgMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.bgModeCard,
                  { backgroundColor: bg.preview },
                  isSelectedBg && styles.bgModeCardSelected,
                ]}
                onPress={() => {
                  setSelectedBgMode(mode);
                  betStore.setBackgroundMode(mode);
                }}
                activeOpacity={0.85}
              >
                {/* Mini preview */}
                <View style={[styles.bgMiniCard, { backgroundColor: bg.card }]}> 
                  <View style={[styles.bgMiniLine, { backgroundColor: bg.text, width: '70%' }]} />
                  <View style={[styles.bgMiniLine, { backgroundColor: bg.textSub, width: '50%', marginTop: 4 }]} />
                </View>
                <View style={styles.bgPaletteRow}>
                  {bg.intensityPalette.map((color, index) => {
                    const intensity = [0.4, 0.6, 0.8, 1][index];
                    const isActiveIntensity = isSelectedBg && selectedBgOpacity === intensity;
                    return (
                      <TouchableOpacity
                        key={color}
                        accessibilityLabel={`${bg.title}, intensité ${Math.round(intensity * 100)}%`}
                  onPress={() => {
                    setSelectedBgMode(mode);
                    setSelectedBgOpacity(intensity);
                  }}
                        style={[styles.bgPaletteSwatch, { backgroundColor: color }, isActiveIntensity && styles.bgPaletteSwatchSelected]}
                      />
                    );
                  })}
                </View>
                <Text style={styles.bgModeEmoji}>{bg.emoji}</Text>
                <Text style={[styles.bgModeTitle, { color: bg.text }]}>{bg.title}</Text>
                {isSelectedBg && (
                  <View style={styles.bgModeCheckBadge}>
                    <Ionicons name="checkmark" size={12} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Background Mode Description */}
        <View style={[styles.bgModeDescCard, { backgroundColor: selectedPalette.cardBg, borderColor: selectedPalette.border }]}>
          <Text style={[styles.bgModeDescTitle, { color: selectedPalette.textPrimary }]}>
            {getBgModeDetails(selectedBgMode).emoji} {getBgModeDetails(selectedBgMode).title}
          </Text>
          <Text style={[styles.bgModeDescText, { color: selectedPalette.textSecondary }]}>
            {getBgModeDetails(selectedBgMode).description}
          </Text>
        </View>

        <View style={styles.opacityControl}>
          <View style={styles.opacityHeader}>
            <Text style={styles.opacityTitle}>Opacité du fond</Text>
            <Text style={[styles.opacityValue, { color: activeColor }]}>{Math.round(selectedBgOpacity * 100)}%</Text>
          </View>
          <Text style={styles.opacityHint}>Augmentez l'opacité pour rendre le mode choisi plus intense.</Text>
          <View style={styles.opacityOptions}>
            {[0.4, 0.6, 0.8, 1].map((value) => (
              <TouchableOpacity
                key={value}
                onPress={() => {
                  setSelectedBgOpacity(value);
                }}
                style={[
                  styles.opacityOption,
                  selectedBgOpacity === value && { backgroundColor: activeColor, borderColor: activeColor },
                ]}
              >
                <Text style={[styles.opacityOptionText, selectedBgOpacity === value && styles.opacityOptionTextSelected]}>
                  {Math.round(value * 100)}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Dynamic Live Card Preview */}
        <View style={[styles.livePreviewSection, { backgroundColor: selectedPalette.appBg }]}>
          <Text style={[styles.livePreviewTitle, { color: selectedPalette.textPrimary }]}>Palette d'analyse — aperçu en direct</Text>
          <Text style={[styles.opacityHint, { color: selectedPalette.textSecondary, marginBottom: 10 }]}>Le rendu suit immédiatement l'opacité sélectionnée.</Text>
          <View style={[styles.mockEventCard, { backgroundColor: selectedPalette.cardBg, borderColor: selectedPalette.border }]}>
            <View style={styles.mockEventHeader}>
              <Text style={[styles.mockLeague, { color: selectedPalette.textSecondary }]}>Ligue des Champions UEFA</Text>
              <View style={[styles.mockBadge, { backgroundColor: activeBgColor }]}>
                <Text style={[styles.mockBadgeText, { color: activeColor }]}>Gagné</Text>
              </View>
            </View>

            <View style={styles.mockTeamsRow}>
              <Text style={[styles.mockTeamName, { color: selectedPalette.textPrimary }]}>Real Madrid</Text>
              <Text style={[styles.mockScore, { color: selectedPalette.textPrimary }]}>2 - 1</Text>
              <Text style={[styles.mockTeamName, { color: selectedPalette.textPrimary }]}>Bayern Munich</Text>
            </View>

            <View style={styles.mockOddsRow}>
              <View style={[styles.mockOddItem, { backgroundColor: selectedPalette.inputBg }]}>
                <Text style={[styles.mockOddLabel, { color: selectedPalette.textSecondary }]}>V1</Text>
                <Text style={[styles.mockOddValue, { color: activeColor }]}>1.95</Text>
              </View>
              <View style={[styles.mockOddItem, { borderColor: activeColor, borderWidth: 1, backgroundColor: activeBgColor }]}> 
                <Text style={[styles.mockOddLabel, { color: activeColor }]}>X</Text>
                <Text style={[styles.mockOddValue, { color: activeColor }]}>3.40</Text>
              </View>
              <View style={[styles.mockOddItem, { backgroundColor: selectedPalette.inputBg }]}>
                <Text style={[styles.mockOddLabel, { color: selectedPalette.textSecondary }]}>V2</Text>
                <Text style={[styles.mockOddValue, { color: activeColor }]}>3.80</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: activeColor }]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>Appliquer ce style</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0C2751',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 12.5,
    color: '#5C7C99',
    lineHeight: 18,
    marginBottom: 20,
  },
  themeCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  colorIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  themeCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A3D5C',
    flex: 1,
  },
  checkIcon: {
    marginLeft: 10,
  },
  themeCardDesc: {
    fontSize: 12.5,
    color: '#758C9E',
    lineHeight: 18,
    marginBottom: 14,
  },
  previewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  previewItem: {
    alignItems: 'center',
    flex: 1,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C7C99',
    marginBottom: 6,
  },
  couponIconPreview: {
    width: 52,
    height: 52,
  },
  btnPreview: {
    height: 32,
    width: 80,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  btnPreviewText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  livePreviewSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  livePreviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3D5C',
    marginBottom: 10,
  },
  mockEventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EFF6',
  },
  mockEventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mockLeague: {
    fontSize: 11.5,
    color: '#758C9E',
    fontWeight: '600',
  },
  mockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  mockBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  mockTeamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mockTeamName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A3D5C',
    flex: 1,
  },
  mockScore: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A3D5C',
    marginHorizontal: 10,
  },
  mockOddsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mockOddItem: {
    flex: 1,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#F4F6F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockOddLabel: {
    fontSize: 10,
    color: '#758C9E',
    fontWeight: '600',
  },
  mockOddValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  saveBtn: {
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // ─── Background Mode Styles ────────────────────────────────────────────────
  bgSectionDivider: {
    height: 1,
    backgroundColor: '#DFE7F0',
    marginVertical: 24,
  },
  bgModesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  bgModeCard: {
    width: '47%',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 110,
  },
  bgModeCardSelected: {
    borderColor: '#FFFFFF',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  bgMiniCard: {
    width: '80%',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  bgMiniLine: {
    height: 6,
    borderRadius: 3,
  },
  bgPaletteRow: {
    width: '86%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  bgPaletteSwatch: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  bgPaletteSwatchSelected: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  bgModeEmoji: {
    fontSize: 18,
    marginBottom: 4,
  },
  bgModeTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  bgModeCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgModeDescCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bgModeDescTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  bgModeDescText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  opacityControl: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DFE7F0',
  },
  opacityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  opacityTitle: {
    color: '#1A3D5C',
    fontSize: 14,
    fontWeight: '800',
  },
  opacityValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  opacityHint: {
    color: '#758C9E',
    fontSize: 12,
    marginTop: 5,
    marginBottom: 12,
  },
  opacityOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  opacityOption: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8E2EC',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F8FB',
  },
  opacityOptionText: {
    color: '#5C7C99',
    fontSize: 12,
    fontWeight: '700',
  },
  opacityOptionTextSelected: {
    color: '#FFFFFF',
  },
});
