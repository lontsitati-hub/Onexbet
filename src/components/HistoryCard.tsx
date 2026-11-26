import { formatOdd } from '@/utils/format';
import { getFifaSimulationState } from '@/utils/localFifaSimulation';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { COLORS, SPACING, getBackgroundPalette } from '../constants/theme';
import { BetHistoryItem, useBetStore } from '../store/useBetStore';
import { BetStatus } from '../types/bet';
import { formatTicketNumberForDisplay } from '../services/couponCode';
import { isMortalKombatEvent } from '../utils/mortalKombat';
import { isPokerEvent } from '../utils/localPokerSimulation';

const parseCouponDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  try {
    const cleanStr = dateStr.trim();

    // Extract time (HH:MM)
    const timeMatch = cleanStr.match(/(\d{1,2}):(\d{2})/);
    let hours = 0;
    let minutes = 0;
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
    }

    // 1. Try format: YYYY-MM-DD
    const matchISO = cleanStr.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (matchISO) {
      const [_, year, month, day] = matchISO;
      return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        hours,
        minutes
      );
    }

    // 2. Try format: DD/MM/YYYY or DD-MM-YYYY
    const matchEuro = cleanStr.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (matchEuro) {
      const [_, day, month, year] = matchEuro;
      return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        hours,
        minutes
      );
    }

    // 3. Try French months: "21 juin 2026 (19:00)"
    const monthsFr: { [key: string]: number } = {
      'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
      'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11,
      'janv.': 0, 'févr.': 1, 'avr.': 3, 'juil.': 6, 'sept.': 8, 'oct.': 9, 'nov.': 10, 'déc.': 11
    };
    const matchFr = cleanStr.match(/(\d{1,2})\s+([a-zA-Zàâéèêëîïôûùüçé.]+)\s+(\d{4})/i);
    if (matchFr) {
      const [_, day, monthStr, year] = matchFr;
      const month = monthsFr[monthStr.toLowerCase().trim()];
      if (month !== undefined) {
        return new Date(
          parseInt(year, 10),
          month,
          parseInt(day, 10),
          hours,
          minutes
        );
      }
    }

    // 4. Try French months without year: "21 juin (19:00)"
    const matchFrNoYear = cleanStr.match(/(\d{1,2})\s+([a-zA-Zàâéèêëîïôûùüçé.]+)/i);
    if (matchFrNoYear) {
      const [_, day, monthStr] = matchFrNoYear;
      const month = monthsFr[monthStr.toLowerCase().trim()];
      if (month !== undefined) {
        return new Date(
          new Date().getFullYear(),
          month,
          parseInt(day, 10),
          hours,
          minutes
        );
      }
    }
  } catch (e) {
    console.warn('Error parsing date:', e);
  }
  return null;
};

const formatCardDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parsed = parseCouponDate(dateStr);
  if (!parsed || isNaN(parsed.getTime())) {
    return dateStr;
  }
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yy = String(parsed.getFullYear()).substring(2);
  const hh = String(parsed.getHours()).padStart(2, '0');
  const min = String(parsed.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yy} (${hh}:${min})`;
};

interface HistoryCardProps {
  item: BetHistoryItem;
}

// Dérive le statut effectif depuis les statuts individuels des matchs
const deriveStatus = (item: BetHistoryItem): BetStatus => {
  // Le statut global décidé par l’administration est prioritaire :
  // un coupon passé à Perdu ne doit pas redevenir Gagné à cause d’anciens événements.
  if (item.status === 'Perdu') return 'Perdu';
  const events = item.events ?? [];
  // Pour un coupon Poker validé gagnant, conserver le statut global même si
  // un ancien statut d’événement n’a pas encore été synchronisé.
  if ((item.status === 'Gagné' || item.status === 'Payé') && events.length > 0 && events.every(isPokerEvent)) {
    return item.status;
  }
  if (events.length > 0) {
    const allWon = events.every((ev) => ev.status === 'Gagné' || ev.status === 'Payé');
    if (allWon) return item.status === 'Payé' ? 'Payé' : 'Gagné';
    const anyLost = events.some((ev) => ev.status === 'Perdu');
    if (anyLost) return 'Perdu';
  }
  return item.status;
};

export const HistoryCard: React.FC<HistoryCardProps> = ({ item }) => {
  const router = useRouter();
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#2E79C9';

  const [clockMs, setClockMs] = useState(Date.now());
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
  const fifaEvents = (item.events ?? []).filter((event) => event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA'));
  useEffect(() => {
    if (!fifaEvents.some((event) => event.scheduledAt)) return undefined;
    const timer = setInterval(() => setClockMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [fifaEvents.map((event) => event.id + event.scheduledAt).join('|')]);
  const fifaStates = fifaEvents.map((event) => getFifaSimulationState(event, clockMs));
  const simulatedLive = fifaStates.some((state) => state?.isLive);
  const simulatedFinished = fifaEvents.length > 0 && fifaStates.every((state) => state?.isFinished);
  const effectiveStatus = item.status === 'Accepté' && simulatedFinished ? 'Payé' : deriveStatus(item);
  const statusLower = effectiveStatus?.toLowerCase() || '';
  const isAccepted = statusLower === 'accepté' || statusLower === 'accepte' || statusLower === 'accepted';
  const isWonOrPaid = statusLower === 'payé' || statusLower === 'paye' || statusLower === 'gagné' || statusLower === 'gagne';
  const isLost = statusLower === 'perdu';
  const statusBadgeColor = isAccepted ? activeColor : isLost ? COLORS.dangerRed : COLORS.successGreen;
  const isTerminalStatus = isWonOrPaid || isLost;
  const hasScheduledGameEvent = Boolean((item.events ?? []).some((event) =>
    isMortalKombatEvent(event) || isPokerEvent(event)
  ));
  // Pour les jeux programmés, le badge rouge est visible dès la création du coupon.
  // La simulation et le temps écoulé restent indépendants et attendent l’horaire.
  const hasLiveEvent = !isTerminalStatus && (
    fifaEvents.length > 0 || hasScheduledGameEvent || simulatedLive || Boolean((item.events ?? []).some((event) => {
      const eventIsFifa = event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA');
      return !eventIsFifa && event.isLive;
    }))
  );
  const couponEventCount = item.events?.length || item.eventCount || 0;
  const isFifaSimple = couponEventCount === 1 && fifaEvents.length > 0;
  const isMortalKombatSimple = couponEventCount === 1 && Boolean(item.events?.[0] && isMortalKombatEvent(item.events[0]));
  const isPokerSimple = couponEventCount === 1 && Boolean(item.events?.[0] && isPokerEvent(item.events[0]));

  const formatCurrency = (val: number) => {
    if (val % 1 !== 0) {
      return val.toFixed(2);
    }
    return val.toString();
  };
  const handleDelete = () => {
    setDeleteConfirmationVisible(true);
  };
  const confirmDelete = () => {
    setDeleteConfirmationVisible(false);
    useBetStore.getState().deleteBetHistoryItem(item.id);
  };
  const setSelectedHistoryId = useBetStore((state) => state.setSelectedHistoryId);

  return (
    <>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: bg.cardBg, borderColor: bg.divider }]}
        activeOpacity={0.9}
        onPress={() => {
          setSelectedHistoryId(item.id);
        }}
      >
      {/* Top Header of the History Card */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          {/* Les icônes des coupons sont réservées à l’historique. */}
          {(couponEventCount === 1 || couponEventCount >= 2) && (
            <TouchableOpacity
              style={[styles.iconWrapper, isMortalKombatSimple && styles.mortalIconWrapper]}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/edit-coupon', params: { couponId: item.id } })}
              accessibilityLabel={couponEventCount === 1 ? 'Modifier le coupon simple' : 'Modifier le coupon combiné'}
            >
              {couponEventCount === 1 && isMortalKombatSimple ? (
                <>
                  <Image
                    source={require('../../assets/images/mortal-kombat/mortal-kombat-sport-icon.png')}
                    style={styles.historyFootballIcon}
                    resizeMode="contain"
                  />
                  <View style={[styles.checkmarkBadge, { backgroundColor: statusBadgeColor }]}>
                    <Ionicons name={isLost ? 'remove' : 'checkmark'} size={10} color="#FFFFFF" />
                  </View>
                </>
              ) : couponEventCount === 1 && isFifaSimple ? (
                <>
                  <Text style={[styles.fifaIconText, { color: bg.textSecondary }]}>FIFA</Text>
                  <View style={[styles.checkmarkBadge, { backgroundColor: isWonOrPaid ? COLORS.successGreen : isLost ? COLORS.dangerRed : activeColor }]}>
                    <Ionicons name={isLost ? 'close' : 'checkmark'} size={10} color="#FFFFFF" />
                  </View>
                </>
              ) : couponEventCount === 1 && isPokerSimple ? (
                <>
                  <View style={[styles.circleBg, { backgroundColor: 'transparent', borderColor: 'transparent' }]}>
                    <Image
                      source={require('../../assets/images/poker-controller-icon.png')}
                      style={styles.historyFootballIcon}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={[styles.checkmarkBadge, { backgroundColor: isWonOrPaid ? COLORS.successGreen : isLost ? COLORS.dangerRed : activeColor }]}>
                    <Ionicons name={isLost ? 'close' : 'checkmark'} size={10} color="#FFFFFF" />
                  </View>
                </>
              ) : couponEventCount === 1 ? (
                <>
                  <View style={[styles.circleBg, { backgroundColor: 'transparent', borderColor: 'transparent' }]}> 
                    <Image
                      source={require('../../assets/images/icon_sport_football.png')}
                      style={styles.historyFootballIcon}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={[styles.checkmarkBadge, { backgroundColor: isWonOrPaid ? COLORS.successGreen : isLost ? COLORS.dangerRed : activeColor }]}>
                    <Ionicons name={isLost ? 'close' : 'checkmark'} size={10} color="#FFFFFF" />
                  </View>
                </>
              ) : isWonOrPaid ? (
                <Image source={require('../../assets/images/icon_combine_won.png')} style={styles.statusImage} />
              ) : isAccepted ? (
                <Image source={require('../../assets/images/icon_combine_accepted.png')} style={styles.statusImage} />
              ) : (
                <>
                  <View style={[styles.circleBg, { backgroundColor: bg.appBg, borderColor: bg.divider }]}>
                    <View style={styles.switchIconContainer}>
                      <View style={styles.toggleRow}>
                        <View style={styles.toggleTrack}>
                          <View style={[styles.toggleThumb, { alignSelf: 'flex-end' }]} />
                        </View>
                      </View>
                      <View style={[styles.toggleRow, { marginTop: 3 }]}>
                        <View style={styles.toggleTrack}>
                          <View style={[styles.toggleThumb, { alignSelf: 'flex-start' }]} />
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={[styles.checkmarkBadge, { backgroundColor: isLost ? COLORS.dangerRed : activeColor }]}>
                    <Ionicons name={isLost ? 'close' : 'checkmark'} size={10} color="#FFFFFF" />
                  </View>
                </>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.metaContainer}>
            <Text style={[styles.dateIdText, { color: bg.textSecondary }]}>{formatCardDate(item.date)}</Text>
            <View style={styles.titleRow}>
              <Text style={[styles.titleText, { color: bg.textPrimary }]}>{couponEventCount === 1 ? 'Simple' : 'Combiné'}</Text>
              {couponEventCount >= 2 && (
                <>
                  <Ionicons name="layers" size={13} color={bg.textSecondary} style={styles.layersIcon} />
                  <Text style={[styles.eventCountText, { color: bg.textPrimary }]}>{couponEventCount}</Text>
                </>
              )}
              {hasLiveEvent && (
                <View style={[styles.liveBadge, { backgroundColor: '#FF3838' }]}> 
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>EN DIRECT</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionIconButton}>
            <Ionicons name="notifications-outline" size={24} color={activeColor} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.moreButton}
            onPress={(event) => {
              event.stopPropagation();
              handleDelete();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Supprimer ce coupon de l’historique"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={activeColor} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.detailsList}>
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: bg.textSecondary }]}>Cotes:</Text>
            <Text style={[styles.value, { color: bg.textPrimary }]}>{formatOdd(item.totalOdds)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: bg.textSecondary }]}>Mise:</Text>
            <Text style={[styles.value, { color: bg.textPrimary }]}>{formatCurrency(item.stake)} ₣</Text>
          </View>
          {!isLost && <View style={styles.detailRow}>
            <Text style={[styles.label, { color: bg.textSecondary }]}>{isAccepted ? 'Gains potentiels:' : 'Gains:'}</Text>
            <Text style={[styles.gainsValue, isAccepted ? { color: bg.textPrimary } : null]}>{formatCurrency(item.potentialGain)} ₣</Text>
          </View>}
          <View style={[styles.detailRow, { marginBottom: 0 }]}>
            <Text style={[styles.label, { color: bg.textSecondary }]}>Statut:</Text>
            <Text style={[styles.statusValue, isAccepted ? { color: activeColor } : isLost ? { color: COLORS.dangerRed } : { color: COLORS.successGreen }]}>{isWonOrPaid ? 'Payé' : effectiveStatus}</Text>
          </View>
      </View>
      </TouchableOpacity>
      <Modal
        visible={deleteConfirmationVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmationVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDeleteConfirmationVisible(false)}>
          <View style={styles.deleteModalBackdrop}>
            <TouchableWithoutFeedback onPress={(event) => event.stopPropagation()}>
              <View style={[styles.deleteDialog, { backgroundColor: bg.cardBg, borderColor: bg.divider }]}>
                <Text style={[styles.deleteTitle, { color: bg.textPrimary }]}>Supprimer le coupon</Text>
                <Text style={[styles.deleteMessage, { color: bg.textSecondary }]}>
                  Voulez-vous supprimer le coupon N° {formatTicketNumberForDisplay(item.id)} de l’historique ?
                </Text>
                <View style={styles.deleteActions}>
                  <TouchableOpacity
                    style={[styles.deleteActionButton, { backgroundColor: bg.inputBg }]}
                    onPress={() => setDeleteConfirmationVisible(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Annuler la suppression"
                  >
                    <Text style={[styles.deleteCancelText, { color: activeColor }]}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteActionButton, { backgroundColor: COLORS.dangerRed }]}
                    onPress={confirmDelete}
                    accessibilityRole="button"
                    accessibilityLabel="Confirmer la suppression du coupon"
                  >
                    <Text style={styles.deleteConfirmText}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 6,
    marginBottom: 6,
  },
  pokerHistoryCard: {
    borderRadius: 16,
    paddingHorizontal: 0,
    paddingTop: 14,
    paddingBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pokerHistoryIconWrapper: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#EEF1F7',
    marginRight: 22,
  },
  pokerHistoryImage: {
    width: 56,
    height: 56,
  },
  pokerStatusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    bottom: -1,
    right: -2,
    borderWidth: 2,
  },
  iconWrapper: {
    position: 'relative',
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs,
  },
  mortalIconWrapper: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
  },
  pokerLogoBlock: { alignItems: 'center' },
  pokerLogoText: { color: '#176B87', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  pokerLogoPokerText: { color: '#176B87', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: -1 },
  circleBg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyFootballIcon: {
    width: 28,
    height: 28,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 7,
  },
  switchIconContainer: {
    width: 22,
    height: 18,
    justifyContent: 'center',
  },
  toggleRow: {
    width: 20,
    height: 7,
  },
  toggleTrack: {
    flex: 1,
    backgroundColor: '#B5C4D7',
    borderRadius: 3.5,
    paddingHorizontal: 1,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
  checkmarkBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: COLORS.successGreen,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaContainer: {
    justifyContent: 'center',
  },
  pokerMetaContainer: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  pokerDateText: {
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 1,
  },
  pokerTitleText: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '500',
  },
  pokerNumberText: {
    fontSize: 17,
    lineHeight: 25,
    marginTop: 1,
  },
  dateIdText: {
    fontSize: 13,
    color: COLORS.textGray,
    fontWeight: '500',
    fontFamily: 'System',
    lineHeight: 17,
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.darkBlue,
    fontFamily: 'System',
  },
  layersIcon: {
    marginHorizontal: 5,
    top: 1,
  },
  eventCountText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.darkBlue,
    fontFamily: 'System',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3838',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginLeft: 6,
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginRight: 4,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'System',
  },
  moreButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
    paddingHorizontal: 24,
  },
  deleteDialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  deleteMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteActionButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  deleteConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionIconButton: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 0.5,
    backgroundColor: COLORS.divider,
    marginVertical: 6,
  },
  detailsList: {},
  pokerDetailsList: {
    paddingHorizontal: 34,
    paddingTop: 28,
    paddingBottom: 12,
  },
  pokerMarketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pokerMarketText: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '500',
  },
  pokerBetText: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    marginTop: 3,
    paddingRight: 82,
  },
  pokerOddPill: {
    minWidth: 78,
    height: 64,
    borderRadius: 34,
    backgroundColor: '#EEF1F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  pokerOddText: {
    color: '#0D365A',
    fontSize: 28,
    fontWeight: '500',
  },
  pokerSimpleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
  },
  pokerSimpleLabel: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '500',
  },
  pokerSimpleValue: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 14.5,
    color: COLORS.textGray,
    fontWeight: '600',
    fontFamily: 'System',
  },
  value: {
    fontSize: 14.5,
    color: COLORS.darkBlue,
    fontWeight: '700',
    fontFamily: 'System',
  },
  gainsValue: {
    fontSize: 14.5,
    color: COLORS.successGreen,
    fontWeight: '800',
    fontFamily: 'System',
  },
  statusValue: {
    fontSize: 14.5,
    color: COLORS.successGreen,
    fontWeight: '800',
    fontFamily: 'System',
  },
  fifaIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fifaIconText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  statusImage: {
    width: 46,
    height: 46,
    resizeMode: 'contain',
  },
});
