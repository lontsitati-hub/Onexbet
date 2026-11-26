/**
 * @file BetHeader.tsx
 * @description En-tête du ticket de pari affichant la date, le badge du tournoi,
 * le type de coupon (Simple/Combiné) et son identifiant unique.
 * Cette version a été épurée pour ressembler exactement à la capture d'écran 1xBet.
 */

import React from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getBackgroundPalette } from '../constants/theme';
import { BetSlip } from '../types/bet';
import { useBetStore } from '../store/useBetStore';
import { formatTicketNumberForDisplay } from '../services/couponCode';
import { TicketSeparator } from './TicketSeparator';
import { isMortalKombatEvent } from '../utils/mortalKombat';
import { isPokerEvent } from '../utils/localPokerSimulation';

// Helper pour analyser et formater la date du ticket de manière uniforme
const parseCouponDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  try {
    const cleanStr = dateStr.trim();
    const timeMatch = cleanStr.match(/(\d{1,2}):(\d{2})/);
    let hours = 0;
    let minutes = 0;
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
    }

    const matchISO = cleanStr.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (matchISO) {
      const [_, year, month, day] = matchISO;
      return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), hours, minutes);
    }

    const matchEuro = cleanStr.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (matchEuro) {
      const [_, day, month, year] = matchEuro;
      return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), hours, minutes);
    }
  } catch (e) {
    console.warn('Erreur parsing date dans BetHeader:', e);
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
  const yyyy = parsed.getFullYear();
  const hh = String(parsed.getHours()).padStart(2, '0');
  const min = String(parsed.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} (${hh}:${min})`;
};

const getTournamentBadge = (tournament: string): string => {
  if (!tournament) return 'WC2026';
  const clean = tournament.toLowerCase();
  if (clean.includes('coupe du monde') || clean.includes('world cup')) {
    return 'WC2026';
  }
  if (clean.includes('champions league') || clean.includes('ligue des champions')) {
    return 'UCL';
  }
  const initials = tournament.split(' ').map(w => w[0]).join('').toUpperCase();
  const yearMatch = tournament.match(/\d{4}/);
  const year = yearMatch ? yearMatch[0] : '';
  return initials + year || 'WC2026';
};

interface BetHeaderProps {
  betSlip: BetSlip;
  hideFifaCombinedIcon?: boolean;
}

export const BetHeader: React.FC<BetHeaderProps> = ({ betSlip, hideFifaCombinedIcon = false }) => {
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

  const firstEvent = betSlip.events && betSlip.events[0];
  const couponEventCount = betSlip.events?.length || betSlip.eventCount || 0;
  const isFifa = Boolean(firstEvent?.tournament?.trim().toUpperCase().startsWith('FIFA'));
  const normalizedStatus = String(betSlip.status || '').toLowerCase();
  const isWonOrPaid = normalizedStatus === 'gagné' || normalizedStatus === 'gagne' || normalizedStatus === 'payé' || normalizedStatus === 'paye';
  const isLost = normalizedStatus === 'perdu';
  const isTerminalStatus = isWonOrPaid || isLost;
  const hasFifaEvent = Boolean(betSlip.events?.some((event) =>
    event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA')
  ));
  const hasScheduledGameEvent = Boolean(betSlip.events?.some((event) =>
    isMortalKombatEvent(event) || isPokerEvent(event)
  ));
  // Le badge rouge des jeux programmés apparaît dès la création du coupon.
  // Les compteurs temporels restent, eux, liés à l’heure programmée.
  const hasLiveEvent = !isTerminalStatus && (
    hasFifaEvent || hasScheduledGameEvent || Boolean(betSlip.events?.some((event) => {
      const eventIsFifa = event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA');
      return !eventIsFifa && Boolean(event.isLive);
    }))
  );
  const editableSimpleEvent = couponEventCount === 1 && !isFifa && Boolean(firstEvent?.isLive);
  const [isTimeModalVisible, setIsTimeModalVisible] = React.useState(false);
  const [timeDraft, setTimeDraft] = React.useState(firstEvent?.liveTime || '00:00');

  const openTimeEditor = () => {
    if (!editableSimpleEvent || !firstEvent) return;
    setTimeDraft(/^\d{1,3}:\d{2}$/.test(firstEvent.liveTime || '') ? firstEvent.liveTime! : '00:00');
    setIsTimeModalVisible(true);
  };

  const saveTime = () => {
    const normalizedTime = timeDraft.trim();
    if (!firstEvent || !/^\d{1,3}:\d{2}$/.test(normalizedTime)) return;
    useBetStore.getState().toggleEventLive(betSlip.id, firstEvent.id, true, normalizedTime);
    setIsTimeModalVisible(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: bg.cardBg }]}>

      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
        {/* Ligne 1 : date et badge de direct, exactement comme sur la maquette */}
        <View style={styles.dateRow}>
          <Text style={[styles.dateText, { color: bg.textSecondary }]}>{formatCardDate(betSlip.date)}</Text>
          {hasLiveEvent && (
            <View style={[styles.liveBadge, { backgroundColor: '#FF3838' }]}> 
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>En direct</Text>
            </View>
          )}
        </View>
        
        {/* Type et numéro sur une seule ligne, comme la référence */}
        <View style={styles.titleBlock}>
          <Text style={[styles.titleText, { color: bg.textPrimary }]}> 
            {couponEventCount === 1 ? 'Simple' : 'Combiné'}
          </Text>
          <Text style={[styles.idText, { color: bg.textPrimary }]}>№ {formatTicketNumberForDisplay(betSlip.id)}</Text>
        </View>
        </View>
      </View>
      {/* Perforation alignée sur toute la largeur du ticket, comme entre les matchs. */}
      <View style={styles.separatorBleed}>
        <TicketSeparator cardColor={bg.cardBg} pageColor={bg.appBg} dividerColor={bg.divider} />
      </View>
      <Modal
        visible={isTimeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTimeModalVisible(false)}
      >
        <View style={styles.timeModalBackdrop}>
          <View style={[styles.timeModalCard, { backgroundColor: bg.cardBg }]}> 
            <Text style={[styles.timeModalTitle, { color: bg.textPrimary }]}>Configurer le temps écoulé</Text>
            <TextInput
              value={timeDraft}
              onChangeText={setTimeDraft}
              keyboardType="numbers-and-punctuation"
              placeholder="00:00"
              placeholderTextColor={bg.textSecondary}
              style={[styles.timeInput, { color: bg.textPrimary, borderColor: bg.divider }]}
              maxLength={6}
            />
            <View style={styles.timeModalActions}>
              <TouchableOpacity onPress={() => setIsTimeModalVisible(false)} style={styles.timeCancelButton}>
                <Text style={{ color: bg.textSecondary, fontWeight: '700' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveTime} style={[styles.timeSaveButton, { backgroundColor: activeColor }]}>
                <Text style={styles.timeSaveText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  fifaBadge: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: '#F0F3F8',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 13,
  },
  fifaBadgeText: {
    color: '#7890A6',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  couponBadge: {
    width: 55,
    height: 55,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 13,
  },
  statusBadge: {
    position: 'absolute',
    right: -5,
    bottom: -3,
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  fifaCheck: {
    position: 'absolute',
    right: -4,
    bottom: -3,
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  dateText: {
    fontSize: 12,
    color: '#63809C',
    fontWeight: '600',
    fontFamily: 'System',
    marginRight: 6,
  },
  badgeBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  badgeBadgeText: {
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '800',
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
  headerLiveBadge: {
    alignSelf: 'flex-start',
    marginTop: 2,
    marginLeft: 8,
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'System',
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  separatorBleed: {
    // BetHeader applique 12 px de padding horizontal ; on annule ce retrait
    // pour placer les encoches exactement sur les bords du ticket.
    marginHorizontal: -12,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#082A4D',
    fontFamily: 'System',
    lineHeight: 22,
  },
  idText: {
    fontSize: 16,
    color: '#082A4D',
    fontWeight: '500',
    fontFamily: 'System',
    lineHeight: 18,
  },
  timeModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  timeModalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
  },
  timeModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  timeInput: {
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 18,
    textAlign: 'center',
  },
  timeModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    marginTop: 18,
  },
  timeCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  timeSaveButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  timeSaveText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
