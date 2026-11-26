/**
 * @file BetSummary.tsx
 * @description Résumé du coupon (nombre d'événements, cote globale, mise, statut).
 * Il s'intègre sous le BetHeader avec un séparateur pointillé et des encoches.
 */

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getBackgroundPalette } from '../constants/theme';
import { BetSlip } from '../types/bet';
import { useBetStore } from '../store/useBetStore';
import { formatOdd } from '@/utils/format';

interface BetSummaryProps {
  betSlip: BetSlip;
}

export const BetSummary: React.FC<BetSummaryProps> = ({ betSlip }) => {
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
          : '#6898D6';

  const statusLower = betSlip.status?.toLowerCase() || '';
  const isWonOrPaid = statusLower === 'gagné' || statusLower === 'gagne' || statusLower === 'payé' || statusLower === 'paye';
  const isLost = statusLower === 'perdu';

  // Formatage des montants monétaires en francs (insertion d'espaces tous les 3 chiffres)
  const formatCurrency = (val: number) => {
    if (val % 1 !== 0) {
      return val.toFixed(2);
    }
    return val.toString();
  };

  const isFinishedStatus = isWonOrPaid || isLost;
  // finishedCount est calculé dynamiquement depuis les events en amont (HistoryDetailsTab)
  const displayFinishedCount = betSlip.finishedCount ?? 0;
  const eventCount = betSlip.events?.length || betSlip.eventCount || 0;

  return (
    <View style={{ backgroundColor: bg.cardBg }}>
      <View style={[styles.container, { backgroundColor: bg.cardBg }]}> 
        {/* Ligne 1 : Nombre d'événements et état terminé */}
        {eventCount > 1 && (
          <View style={styles.eventsRow}>
            <View style={styles.eventCountContainer}>
              <View style={[styles.eventsIconSurface, { backgroundColor: bg.cardBg }]}>
                <Image
                  source={require('../../assets/images/icon_combine_new.png')}
                  style={styles.eventsIcon}
                  resizeMode="contain"
                  accessibilityLabel="Icône coupon combiné"
                />
              </View>
              <Text
                style={[styles.eventCountText, { color: bg.textPrimary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                Nombre d'événements : {eventCount}
              </Text>
            </View>
            <Text
              style={[styles.finishedText, { color: bg.textPrimary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {displayFinishedCount} sur {eventCount} terminés
            </Text>
          </View>
        )}

        {/* Liste des détails (Cote, Mise, Statut) */}
        <View style={styles.detailsList}>
          <View style={styles.detailRow}>
              <Text style={[styles.label, { color: bg.textSecondary }]}>Cotes :</Text>
            <Text style={[styles.value, { color: bg.textPrimary }]}>
              {formatOdd(betSlip.totalOdds)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: bg.textSecondary }]}>Mise :</Text>
              <Text style={[styles.value, { color: bg.textPrimary }]}>{formatCurrency(betSlip.stake)} ₣</Text>
          </View>

          {!isLost && (
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: bg.textSecondary }]}>{isWonOrPaid ? 'Gains : ' : 'Gains potentiels :'}</Text>
              <Text style={[styles.value, { color: bg.textPrimary }, isWonOrPaid ? { color: COLORS.successGreen } : null]}>
                {formatCurrency(betSlip.potentialGain)} ₣
              </Text>
            </View>
          )}

          {/* Ligne Statut */}
          <View style={[styles.detailRow, { marginBottom: 0 }]}>
            <Text style={[styles.label, { color: bg.textSecondary }]}>Statut :</Text>
            <View style={styles.statusContainer}>
              {isLost ? (
                <Text style={[styles.statusText, { color: COLORS.dangerRed }]}>Perdu</Text>
              ) : statusLower === 'gagné' || statusLower === 'gagne' ? (
                <>
                  <View style={[styles.acceptedCheck, { backgroundColor: COLORS.successGreen }]}><Ionicons name="checkmark" size={12} color="#FFFFFF" /></View>
                  <Text style={[styles.statusText, { color: COLORS.successGreen }]}>Gagné</Text>
                </>
              ) : statusLower === 'payé' || statusLower === 'paye' ? (
                <>
                  <View style={[styles.acceptedCheck, { backgroundColor: COLORS.successGreen }]}><Ionicons name="checkmark" size={12} color="#FFFFFF" /></View>
                  <Text style={[styles.statusText, { color: COLORS.successGreen }]}>Payé</Text>
                </>
              ) : (
                <>
                  <View style={[styles.acceptedCheck, { backgroundColor: activeColor }]}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.statusText, { color: activeColor }]}>Accepté</Text>
                </>
              )}
            </View>
          </View>
        </View>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    backgroundColor: '#FFF',
  },
  container: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingTop: 7,
    paddingBottom: 15,
  },
  eventsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 11,
  },
  eventCountContainer: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  eventCountText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '700',
    color: '#082A4D',
    fontFamily: 'System',
  },
  finishedText: {
    flexShrink: 0,
    fontSize: 15,
    fontWeight: '700',
    color: '#082A4D',
    fontFamily: 'System',
    marginLeft: 4,
  },
  detailsList: {
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 15.5,
    color: '#63809C',
    fontWeight: '600',
    fontFamily: 'System',
  },
  value: {
    fontSize: 15.5,
    color: '#082A4D',
    fontWeight: '800',
    fontFamily: 'System',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  acceptedCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  statusText: {
    fontSize: 14.5,
    fontWeight: '800',
    fontFamily: 'System',
  },
  eventsIcon: {
    width: 30,
    height: 28,
  },
  eventsIconSurface: {
    width: 36,
    height: 32,
    marginLeft: -1,
    marginRight: 7,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
