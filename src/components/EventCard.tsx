/**
 * @file EventCard.tsx
 * @description Composant d'affichage d'un événement (match) individuel au sein d'un coupon de pari.
 * Il respecte fidèlement la charte graphique et la structure visuelle de 1xBet :
 * - Séparateurs ticket en pointillés avec encoches (cutouts) latérales transparentes.
 * - En-tête avec icône de sport, nom du tournoi, date formatée et badge du tournoi.
 * - Affichage symétrique des équipes, de leurs drapeaux circulaires et du score.
 * - Affichage du score par période sous le score principal.
 * - Détails du pronostic choisi et de sa cote.
 * - Ligne de statut dynamique avec icône (coche verte pour Gain, moins rouge pour Perte).
 */

import { Ionicons } from '@expo/vector-icons';
import { useFonts, Roboto_700Bold } from '@expo-google-fonts/roboto';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, getBackgroundPalette } from '../constants/theme';
import { useBetStore } from '../store/useBetStore';
import { BetEvent } from '../types/bet';
import { CircularFlag } from './CircularFlag';
import { TicketSeparator } from './TicketSeparator';
import { formatOdd } from '@/utils/format';
import { getFifaSimulationState } from '@/utils/localFifaSimulation';
import { getMortalKombatSimulationState } from '@/utils/localMortalKombatSimulation';
import { isMortalKombatEvent } from '@/utils/mortalKombat';
import { getPokerSimulationState } from '@/utils/localPokerSimulation';
import { MORTAL_KOMBAT_FIGHTERS } from '@/data/mortalKombatFighters';

const getMortalKombatInfoNumber = (event: BetEvent): number => {
  if (Number.isFinite(event.mortalKombatInfoNumber)) {
    return Math.min(1000, Math.max(1, Math.round(event.mortalKombatInfoNumber as number)));
  }
  const fallback = [...event.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (fallback % 1000) + 1;
};

const getMortalFighterImage = (eventLogo: string | undefined, name: string) => {
  const key = eventLogo?.startsWith('mortal:') ? eventLogo.slice('mortal:'.length) : '';
  const normalizedName = name.toLowerCase().replace(/[^a-z]/g, '');
  return MORTAL_KOMBAT_FIGHTERS.find((fighter) => fighter.id === key || fighter.name.toLowerCase().replace(/[^a-z]/g, '') === normalizedName)?.image;
};

// Interface définissant les propriétés attendues par le composant EventCard
interface EventCardProps {
  event: BetEvent; // Les informations détaillées du match (équipes, équipes, cotes, etc.)
  couponId?: string;
  couponDate?: string; // Date globale optionnelle du coupon
  couponStatus?: string; // Statut global du coupon, utilisé pour révéler les résultats
  isLast?: boolean; // Indique si le match est le dernier du coupon pour arrondir les coins inférieurs du ticket
  showSeparator?: boolean; // Affiche la perforation uniquement quand elle sépare deux lignes
}

/**
 * Analyse et convertit une chaîne de date en objet Date.
 * Supporte divers formats : ISO (YYYY-MM-DD), Européen (DD/MM/YYYY), et dates textuelles françaises.
 * @param dateStr Chaîne représentant la date
 * @returns Objet Date correspondant ou null en cas d'erreur de parsing
 */
const parseCouponDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  try {
    const cleanStr = dateStr.trim();

    // Recherche de l'heure au format HH:MM
    const timeMatch = cleanStr.match(/(\d{1,2}):(\d{2})/);
    let hours = 0;
    let minutes = 0;
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
    }

    // 1. Format ISO : YYYY-MM-DD
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

    // 2. Format Européen : DD/MM/YYYY ou DD-MM-YYYY
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

    // 3. Format textuel français avec mois complet ou abrégé
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

    // 4. Format textuel français sans année spécifiée
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
    console.warn('Erreur lors du parsing de la date :', e);
  }
  return null;
};

/**
 * Formate la date du match sous la forme standard de 1xBet : DD.MM.YYYY (HH:MM)
 * @param dateStr Chaîne brute de date
 * @returns Chaîne formatée
 */
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

/**
 * Génère le badge abrégé du tournoi (ex: Coupe du Monde -> WC2026, Ligue des Champions -> UCL)
 * @param tournament Nom complet du tournoi
 * @returns Badge textuel abrégé
 */
const getTournamentBadge = (tournament: string): string => {
  if (!tournament) return 'WC2026';
  const clean = tournament.toLowerCase();
  if (clean.includes('coupe du monde') || clean.includes('world cup')) {
    return 'WC2026';
  }
  if (clean.includes('champions league') || clean.includes('ligue des champions')) {
    return 'UCL';
  }
  // Récupération des initiales
  const initials = tournament
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase();
  const yearMatch = tournament.match(/\d{4}/);
  const year = yearMatch ? yearMatch[0] : '';
  return initials + year || 'WC2026';
};

type PokerReveal = {
  label: string;
  community: string[];
  hands: string[][];
  winner: number;
};

const POKER_SUIT_ICONS: Record<string, any> = {
  '♠': require('../../assets/images/poker-suits/spade.png'),
  '♥': require('../../assets/images/poker-suits/heart.png'),
  '♣': require('../../assets/images/poker-suits/club.png'),
  '♦': require('../../assets/images/poker-suits/diamond.png'),
};
const POKER_SUIT_ICON_SIZE = 16;

const PokerCardsLine: React.FC<{ cards: string[]; style?: any }> = ({ cards, style }) => (
  <View style={[style, { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }]}>
    {cards.map((card, index) => (
      <View key={`${card}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
        <Text style={{ color: '#63809C', fontSize: 16, fontWeight: '700' }}>{card.replace(/[♥♦♣♠]/u, '')}</Text>
        {card.match(/[♥♦♣♠]/u)?.[0] && <Image source={POKER_SUIT_ICONS[card.match(/[♥♦♣♠]/u)![0]]} style={{ width: POKER_SUIT_ICON_SIZE, height: POKER_SUIT_ICON_SIZE, marginLeft: 1 }} resizeMode="contain" />}
        {index < cards.length - 1 && <Text style={{ color: '#63809C', fontSize: 16, fontWeight: '700' }}>, </Text>}
      </View>
    ))}
  </View>
);

const getPokerReveal = (betType: string): PokerReveal => {
  const normalized = betType.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const mainMatch = normalized.match(/main\s*([1-6])/i);
  const requestedMain = mainMatch ? Number(mainMatch[1]) : 1;

  // Les cartes sont des scénarios déterministes et vérifiables : la table ne
  // contient jamais à elle seule la combinaison annoncée et la main gagnante
  // complète réellement cette combinaison avec les cartes communes.
  const safeHands = [
    ['Q♣', 'J♥'], ['10♣', '8♦'], ['6♠', '3♥'], ['K♦', '5♣'], ['Q♦', '9♣'], ['J♣', '6♦'],
  ];
  const scenarios: Record<string, { label: string; community: string[]; winningHand: string[] }> = {
    'carte haute': { label: 'Carte haute', community: ['A♠', '9♥', '7♦', '4♣', '2♠'], winningHand: ['K♦', 'Q♣'] },
    'une paire': { label: 'Une Paire', community: ['A♣', '9♦', '7♠', '4♥', '2♣'], winningHand: ['A♦', 'K♣'] },
    'deux paires': { label: 'Deux paires', community: ['A♣', '9♦', '7♠', '4♥', '2♣'], winningHand: ['A♦', '9♣'] },
    'brelan': { label: 'Brelan', community: ['A♣', '9♦', '7♠', '4♥', '2♣'], winningHand: ['A♦', 'A♥'] },
    'quinte': { label: 'Quinte', community: ['9♠', '8♥', '7♦', '2♣', 'A♠'], winningHand: ['6♣', '5♥'] },
    'couleur': { label: 'Couleur', community: ['A♦', 'J♦', '8♦', '4♦', '2♣'], winningHand: ['10♦', '6♦'] },
    'full house': { label: 'Full House', community: ['K♠', 'K♥', '4♦', '7♣', '2♠'], winningHand: ['K♦', '4♥'] },
    'carre': { label: 'Carré', community: ['A♠', 'A♥', 'A♦', '7♣', '2♠'], winningHand: ['A♣', 'K♦'] },
    'quinte flush': { label: 'Quinte flush', community: ['9♥', '8♥', '7♥', '2♣', 'A♠'], winningHand: ['6♥', '5♥'] },
    'quinte flush royale': { label: 'Quinte flush royale', community: ['A♠', 'K♠', 'Q♠', 'J♠', '2♦'], winningHand: ['10♠', '9♦'] },
  };
  // Tester les libellés les plus longs en premier évite qu'une Quinte flush
  // royale soit interprétée comme une simple Quinte flush.
  const key = Object.keys(scenarios)
    .sort((left, right) => right.length - left.length)
    .find((name) => normalized.includes(name)) || 'carte haute';
  const scenario = scenarios[key];
  const hands = safeHands.map((hand) => [...hand]);
  hands[requestedMain - 1] = [...scenario.winningHand];
  const used = new Set([...scenario.community, ...scenario.winningHand]);
  // Remplace les cartes de sécurité qui entreraient en collision avec la table
  // ou la main gagnante, sans changer le rendu ni le nombre de cartes.
  const replacements = [['Q♥', '8♣'], ['10♥', '3♠'], ['6♦', '5♠'], ['K♣', 'J♦'], ['Q♦', '10♣'], ['J♣', '3♦'], ['9♣', '6♣']];
  let replacementIndex = 0;
  for (let i = 0; i < hands.length; i += 1) {
    for (let j = 0; j < hands[i].length; j += 1) {
      const card = hands[i][j];
      if (i === requestedMain - 1 || !used.has(card)) {
        used.add(card);
        continue;
      }
      while (replacementIndex < replacements.length && used.has(replacements[replacementIndex][1])) replacementIndex += 1;
      hands[i][j] = replacements[replacementIndex]?.[1] || `3${j ? '♦' : '♣'}`;
      used.add(hands[i][j]);
      replacementIndex += 1;
    }
  }
  return { label: scenario.label, community: scenario.community, hands, winner: requestedMain };
};

export const EventCard: React.FC<EventCardProps> = ({ event, couponId, couponDate, couponStatus, isLast, showSeparator = true }) => {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Roboto_700Bold });
  const setSelectedEvent = useBetStore((state) => state.setSelectedEvent);
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);

  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#6898D6';

  const statusLower = event.status?.toLowerCase() || '';
  const isAccepted = statusLower === 'accepté' || statusLower === 'accepte' || statusLower === 'accepted';
  const isWonOrPaid = statusLower === 'gagné' || statusLower === 'gagne' || statusLower === 'payé' || statusLower === 'paye';
  const isFifaEvent = event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA');
  const isMortalKombat = isMortalKombatEvent(event);
  const isPokerEvent = event.sport === 'Poker' || /^(?:LTAR|TvBet)\s+Poker$/i.test(event.tournament.trim());
  const [clockMs, setClockMs] = useState(Date.now());
  useEffect(() => {
    if ((!isFifaEvent && !isMortalKombat && !isPokerEvent) || (!event.scheduledAt && !event.liveStartedAt && !event.isLive)) return undefined;
    const timer = setInterval(() => setClockMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isFifaEvent, isMortalKombat, event.scheduledAt, event.liveStartedAt, event.isLive]);
  const fifaSimulation = isFifaEvent ? getFifaSimulationState(event, clockMs) : null;
  const mortalSimulation = isMortalKombat ? getMortalKombatSimulationState(event, clockMs) : null;
  const pokerSimulation = isPokerEvent ? getPokerSimulationState(event, clockMs) : null;
  const pokerElapsedMs = pokerSimulation?.elapsedMs || 0;
  const pokerElapsedLabel = `${String(Math.floor(pokerElapsedMs / 60000)).padStart(2, '0')}:${String(Math.floor((pokerElapsedMs % 60000) / 1000)).padStart(2, '0')}`;
  const displayedScore = mortalSimulation?.isLive || mortalSimulation?.isFinished
    ? mortalSimulation.displayScore
    : fifaSimulation?.isLive || fifaSimulation?.isFinished
      ? fifaSimulation.displayScore
      : event.score;
  // Pour Poker, le statut global validé du coupon est la source de vérité.
  // Cela évite qu'un ancien statut d'événement « Perdu » masque un coupon
  // officiellement validé comme gagnant.
  const globalPokerWon = isPokerEvent && ['gagné', 'gagne', 'payé', 'paye'].includes(String(couponStatus || '').toLowerCase());
  // Le coupon global devient Payé, mais la ligne de l’option Poker doit rester
  // « Gain » pour distinguer le résultat de la main du règlement financier.
  const couponStatusLower = String(couponStatus || '').toLowerCase();
  const couponIsTerminal = ['gagné', 'gagne', 'perdu', 'payé', 'paye'].includes(couponStatusLower);
  const mortalIsLive = isMortalKombat && Boolean(mortalSimulation?.isLive) && !Boolean(mortalSimulation?.isFinished) && !couponIsTerminal;
  const effectiveEventStatus = globalPokerWon ? 'Gagné' : (mortalIsLive ? 'Accepté' : (fifaSimulation?.status || event.status));
  const effectiveStatusLower = effectiveEventStatus?.toLowerCase() || '';
  const effectiveIsAccepted = effectiveStatusLower === 'accepté' || effectiveStatusLower === 'accepte' || effectiveStatusLower === 'accepted';
  const effectiveIsWonOrPaid = effectiveStatusLower === 'gagné' || effectiveStatusLower === 'gagne' || effectiveStatusLower === 'payé' || effectiveStatusLower === 'paye';
  const effectiveIsPaid = effectiveStatusLower === 'payé' || effectiveStatusLower === 'paye';
  const displayPokerGain = isPokerEvent && effectiveIsWonOrPaid;
  // Un match classique chronométré est encore en cours : son statut visuel
  // reste Accepté même si une ancienne valeur d'événement vaut « Perdu ».
  const displayClassicLiveAsAccepted = !isFifaEvent && !isMortalKombat && Boolean(event.isLive) && !couponIsTerminal;
  // Les badges rouges FIFA et Mortal Kombat sont visibles dès la création du coupon.
  // La ligne « EN DIRECT / temps écoulé » reste strictement pilotée par l’horaire.
  const showLiveBadge = !couponIsTerminal && (isFifaEvent || isMortalKombat || isPokerEvent || (!isMortalKombat && !isPokerEvent && Boolean(event.isLive)));
  // Les badges Mortal Kombat et Poker sont immédiats, mais leurs compteurs
  // démarrent uniquement lorsque l’heure programmée est atteinte.
  const showLiveClock = !couponIsTerminal && Boolean(
    (isMortalKombat && mortalSimulation?.isLive)
      || (isPokerEvent && pokerSimulation?.isLive)
      || (isFifaEvent && fifaSimulation?.isLive)
      || (!isMortalKombat && !isPokerEvent && !isFifaEvent && event.isLive)
  );
  const [isTimeModalVisible, setIsTimeModalVisible] = useState(false);
  const [timeDraft, setTimeDraft] = useState(event.liveTime || '00:00');
  const editableClassicEvent = !isFifaEvent && Boolean(event.isLive);

  const openTimeEditor = () => {
    if (!editableClassicEvent) return;
    setTimeDraft(/^\d{1,3}:\d{2}$/.test(event.liveTime || '') ? event.liveTime! : '00:00');
    setIsTimeModalVisible(true);
  };

  const saveTime = () => {
    const normalizedTime = timeDraft.trim();
    if (!couponId || !/^\d{1,3}:\d{2}$/.test(normalizedTime)) return;
    useBetStore.getState().toggleEventLive(couponId, event.id, true, normalizedTime);
    setIsTimeModalVisible(false);
  };
  const canRevealResult = couponIsTerminal;
  // Le statut de l’événement peut devenir Gain avant la mise à jour du statut global du coupon.
  // Dans ce cas, le score final doit tout de même remplacer VS entre les logos.
  const shouldShowFinalScore = Boolean(
    displayedScore && (canRevealResult || effectiveIsWonOrPaid || mortalSimulation?.isLive || mortalSimulation?.isFinished || fifaSimulation?.isLive || fifaSimulation?.isFinished)
  );
  const rawBetType = event.betType || '1X2. V1';
  // Le libellé complet de l’option choisie reste toujours visible sur le coupon.
  // Cela concerne aussi les options personnalisées, les seuils et les sélections combinées.
  const displayedBetType = rawBetType;
  const pokerReveal = getPokerReveal(displayedBetType);
  const pokerSessionId = event.id.toUpperCase().startsWith('PB')
    ? event.id
    : `PB${event.id.replace(/\D/g, '').slice(-6).padStart(6, '0')}`;

  return (
    <View style={[
      styles.outerContainer,
      { backgroundColor: bg.cardBg, borderWidth: 0 },
      isFifaEvent && { marginBottom: 0, borderRadius: 0, overflow: 'visible' }
    ]}>
      {/* ────────────────────────────────────────────────────────────────────────
          🗂️ BOÎTE DE CONTENU DU MATCH (TOUCHABLE)
          ──────────────────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.card, { backgroundColor: bg.cardBg }, isFifaEvent && { paddingHorizontal: 12, paddingTop: 2, paddingBottom: 4 }]}
        activeOpacity={0.9}
        onPress={() => {
          setSelectedEvent(event); // Enregistre le match dans le store
          router.push('/match-details'); // Navigue vers les détails du match
        }}
      >
        {/* En-tête du coupon : tournoi et date. Le logo FIFA est réservé à l’historique. */}
        <View style={[styles.cardHeader, isFifaEvent && { marginBottom: 2 }, isPokerEvent && styles.pokerCardHeader]}>
          {!isFifaEvent ? (
            <View style={[styles.classicSportIcon, isPokerEvent && styles.pokerIconBox]}>
              <Image
                source={isMortalKombatEvent(event)
                  ? require('../../assets/images/mortal-kombat/mortal-kombat-sport-icon.png')
                  : isPokerEvent
                    ? require('../../assets/images/poker-controller-icon.png')
                  : require('../../assets/images/icon_sport_football.png')}
                style={[styles.footballIcon, isPokerEvent && styles.pokerHeaderIcon]}
                resizeMode="contain"
              />
            </View>
          ) : (
            <View style={styles.fifaLabel}>
              <Text style={styles.fifaLabelText}>FIFA</Text>
            </View>
          )}
          <View style={styles.tournamentContainer}>
            <Text style={[styles.tournamentText, { color: bg.textPrimary }]} numberOfLines={1}>
              {isFifaEvent ? event.tournament : isPokerEvent ? 'TvBet. POKER' : `${event.sport} . ${event.tournament}`}
            </Text>
            <View style={styles.dateRow}>
              <Text style={[styles.dateText, { color: bg.textSecondary }]}>{formatCardDate(event.date)}</Text>
              {showLiveBadge && !isPokerEvent && (
                <View style={[styles.liveBadge, { backgroundColor: '#FF3838' }]}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>En direct</Text>
                </View>
              )}
            </View>
            {isPokerEvent && showLiveBadge && <View style={[styles.pokerLiveBadge, { backgroundColor: '#FF3838' }]}><View style={styles.liveDot} /><Text style={styles.liveBadgeText}>En direct</Text></View>}
          </View>
        </View>

        {isPokerEvent ? (
          <View style={[styles.pokerRoundSection, isPokerEvent && styles.pokerRoundSectionReference]}>
            <Text style={[styles.pokerRoundTitle, { color: bg.textPrimary }, fontsLoaded && styles.pokerRoundTitleRoboto]}>POKER</Text>
            {canRevealResult && (
              <>
                {pokerReveal.hands.map((hand, index) => (
                  <View key={`poker-hand-${index + 1}`} style={styles.pokerHandRow}>
                    <Text style={[styles.pokerHandLabel, { color: bg.textSecondary }]} numberOfLines={1}>Main {index + 1}:</Text>
                    <PokerCardsLine cards={hand} style={[styles.pokerHandCards, { color: bg.textSecondary }]} />
                  </View>
                ))}
                <View style={styles.pokerTableRow}>
                  <Text style={[styles.pokerHandLabel, { color: bg.textSecondary }]} numberOfLines={1}>Table :</Text>
                  <PokerCardsLine cards={pokerReveal.community} style={[styles.pokerHandCards, { color: bg.textSecondary }]} />
                </View>
                <Text style={[styles.pokerWinnerText, { color: bg.textSecondary }]}>Gagnant : {pokerReveal.winner} ({pokerReveal.label})</Text>
              </>
            )}
          </View>
        ) : (
        /* Section symétrique : équipe, écusson/logo, score, écusson/logo, équipe */
        <View style={[styles.teamsRow, isFifaEvent && { marginVertical: 2 }]}> 
          {/* Équipe 1 (Gauche) : alignée à droite */}
          <View style={styles.teamLeft}>
            <Text style={[styles.teamNameTextLeft, { color: bg.textPrimary }]} numberOfLines={2}>
              {event.team1}
            </Text>
            <View style={styles.flagWrapperLeft}>
              {isMortalKombat && getMortalFighterImage(event.team1Logo || event.team1CountryCode, event.team1)
                ? <Image source={getMortalFighterImage(event.team1Logo || event.team1CountryCode, event.team1)} style={styles.mortalFighterLogo} resizeMode="cover" />
                : event.team1Logo?.startsWith('http')
                  ? <Image source={{ uri: event.team1Logo }} style={{ width: 42, height: 42 }} resizeMode="contain" />
                  : <CircularFlag countryCode={event.team1CountryCode} size={42} teamName={event.team1} />}
            </View>
          </View>

          {/* Affichage du Score ou "VS" */}
          <View style={styles.vsContainer}>
            {shouldShowFinalScore ? (
              <Text style={[styles.scoreText, { color: bg.textPrimary }]}>
                {displayedScore!.replace(/\s*-\s*/g, ' : ').trim()}
              </Text>
            ) : (
              <Text style={[styles.vsText, { color: bg.textPrimary }]}>VS</Text>
            )}
          </View>

          {/* Équipe 2 (Droite) : alignée à gauche */}
          <View style={styles.teamRight}>
            <View style={styles.flagWrapperRight}>
              {isMortalKombat && getMortalFighterImage(event.team2Logo || event.team2CountryCode, event.team2)
                ? <Image source={getMortalFighterImage(event.team2Logo || event.team2CountryCode, event.team2)} style={styles.mortalFighterLogo} resizeMode="cover" />
                : event.team2Logo?.startsWith('http')
                  ? <Image source={{ uri: event.team2Logo }} style={{ width: 42, height: 42 }} resizeMode="contain" />
                  : <CircularFlag countryCode={event.team2CountryCode} size={42} teamName={event.team2} />}
            </View>
            <Text style={[styles.teamNameTextRight, { color: bg.textPrimary }]} numberOfLines={2}>
              {event.team2}
            </Text>
          </View>
        </View>
        )}

        {/* Affichage des scores par période sous le score principal (si disponible) */}
        {shouldShowFinalScore && !isPokerEvent ? (
          <View style={styles.periodScoreContainer}>
            <Text style={[styles.periodScoreText, { color: bg.textSecondary }]}> 
              {isMortalKombat
                ? `${displayedScore!.replace(/\s*[:\-]\s*/g, ':')}${mortalSimulation?.roundScores?.length ? ` (${mortalSimulation.roundScores.map((score) => `${score.team1}:${score.team2}`).join(',')})` : ''}`
                : `${displayedScore!.replace(/\s*-\s*/g, ':')} (${fifaSimulation ? fifaSimulation.displayPeriod1 : event.scorePeriod1?.replace(/\s*-\s*/g, ':') || '0:0'},${fifaSimulation ? fifaSimulation.displayPeriod2 : event.scorePeriod2?.replace(/\s*-\s*/g, ':') || '0:0'})`}
            </Text>
          </View>
        ) : null}

        {/* Ligne d'informations sur le type de pari (Pronostic) et sa cote associée */}
        <View style={[styles.betDetailsRow, isFifaEvent && { marginTop: 4, marginBottom: 6 }]}> 
          <Text style={[styles.betTypeText, { color: bg.textPrimary }]}>{displayedBetType}</Text>
          <Text style={[styles.oddText, { color: bg.textPrimary }]}>{formatOdd(event.odd)}</Text>
        </View>

        {showLiveClock && !isMortalKombat ? (
          <View style={styles.matchClockRow}>
            <Text style={[styles.matchClockLabel, { color: bg.textSecondary }]}>{isPokerEvent ? 'TEMPS ÉCOULÉ' : 'EN DIRECT'}</Text>
            <Text style={[styles.matchClockValue, { color: bg.statusBarStyle === 'light-content' ? '#FFFFFF' : '#000000' }]}> 
              {isPokerEvent ? pokerElapsedLabel : isFifaEvent
                ? (fifaSimulation?.displayMatchTime || '00:00')
                : (event.liveTime || '00:00')}
            </Text>
          </View>
        ) : null}

        {/* Ligne affichant le statut du pari (Gain / Perte / Accepté) */}
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabelText, { color: bg.textSecondary }]}>Statut :</Text>
          <View style={styles.statusValueContainer}>
            {effectiveIsAccepted || displayClassicLiveAsAccepted || mortalIsLive ? (
              <Text style={[styles.statusValueText, { color: activeColor }]}>Accepté</Text>
            ) : effectiveIsWonOrPaid ? (
              <>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.successGreen} style={{ marginRight: 5 }} />
                  <Text style={[styles.statusValueText, { color: COLORS.successGreen }]}>{displayPokerGain ? 'Gain' : effectiveIsPaid ? 'Payé' : 'Gain'}</Text>
              </>
            ) : (
              <>
                <Ionicons name="remove-circle" size={16} color={COLORS.dangerRed} style={{ marginRight: 4 }} />
                <Text style={[styles.statusValueText, { color: COLORS.dangerRed }]}>Perte</Text>
              </>
            )}
          </View>
        </View>
        {((isMortalKombat && isLast) || isPokerEvent) && (
          <View style={[styles.additionalInfoSection, isPokerEvent && styles.pokerAdditionalInfoSection]}>
            <Text style={[styles.additionalInfoTitle, { color: activeColor }]}>Informations supplémentaires</Text>
            <Text style={[styles.additionalInfoValue, { color: bg.textPrimary }]}>{isPokerEvent ? pokerSessionId : String(getMortalKombatInfoNumber(event))}</Text>
          </View>
        )}
      </TouchableOpacity>
      {showSeparator && <TicketSeparator cardColor={bg.cardBg} pageColor={bg.appBg} dividerColor={bg.divider} />}
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

// Déclaration de la feuille de styles du composant
const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: '#FFF',
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 0,
    width: '100%',
    alignSelf: 'stretch',
    shadowOpacity: 0,
    elevation: 0,
  },
  card: {
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  pokerCardHeader: {
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  pokerIconBox: {
    width: 27,
    height: 27,
    marginRight: 14,
    marginTop: 0,
  },
  pokerHeaderIcon: {
    width: 25,
    height: 25,
  },
  classicSportIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    marginTop: 1,
  },
  footballIcon: {
    width: 19,
    height: 19,
  },
  mortalFighterLogo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#D7E0E8',
  },
  fifaLabel: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 18,
  },
  fifaLabelText: {
    color: '#547690',
    fontSize: 11,
    fontWeight: '800',
  },
  sportIconWrapper: {
    marginRight: 8,
    marginTop: 2,
  },
  genericSportBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F3F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  tournamentContainer: {
    flex: 1,
  },
  tournamentText: {
    fontSize: 13.5,
    color: '#082A4D',
    fontWeight: '700',
    fontFamily: 'System',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  dateText: {
    fontSize: 11.5,
    color: '#63809C',
    fontWeight: '600',
    fontFamily: 'System',
    marginRight: 6,
  },
  badgeBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
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
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginRight: 4,
  },
  pokerLiveBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'System',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 9,
  },
  teamLeft: {
    flex: 1.2,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  teamRight: {
    flex: 1.2,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  teamNameTextLeft: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#082A4D',
    fontFamily: 'System',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    lineHeight: 16,
    textAlign: 'right',
  },
  teamNameTextRight: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#082A4D',
    fontFamily: 'System',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    lineHeight: 16,
    textAlign: 'left',
  },
  flagWrapperLeft: {
    width: 46,
    height: 46,
    marginLeft: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagWrapperRight: {
    width: 46,
    height: 46,
    marginRight: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsContainer: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 58,
  },
  vsText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#082A4D',
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#082A4D',
    letterSpacing: 1,
  },
  periodScoreContainer: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  matchClockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },
  matchClockLabel: {
    color: '#63809C',
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '500',
    fontFamily: 'System',
  },
  matchClockValue: {
    color: '#082A4D',
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '700',
    fontFamily: 'System',
  },
  periodScoreText: {
    fontSize: 11.5,
    color: '#63809C',
    fontWeight: '700',
    fontFamily: 'System',
  },
  matchDetailDivider: {
    height: 1,
    width: '100%',
    marginTop: 8,
    marginBottom: 9,
  },
  betDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 8,
  },
  betTypeText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#082A4D',
    fontFamily: 'System',
  },
  oddText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#082A4D',
    fontFamily: 'System',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabelText: {
    fontSize: 12,
    color: '#8392A5',
    fontWeight: '900',
    fontFamily: 'System',
  },
  statusValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusValueText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'System',
  },
  additionalInfoSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5EAF0',
    marginTop: 10,
    marginHorizontal: -14,
    paddingHorizontal: 14,
    paddingTop: 9,
  },
  additionalInfoTitle: {
    color: '#3B82C7',
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 19,
  },
  additionalInfoValue: {
    color: '#082A4D',
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 2,
  },
  pokerRevealSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5EAF0',
    marginTop: 10,
    paddingTop: 9,
  },
  pokerRoundSection: {
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  pokerRoundSectionReference: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 13,
  },
  pokerAdditionalInfoSection: {
    borderTopWidth: 0,
  },
  pokerRoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#093A59',
    textAlign: 'center',
    marginBottom: 12,
  },
  pokerRoundTitleRoboto: {
    fontFamily: 'Roboto_700Bold',
    letterSpacing: 0,
  },
  pokerHandRow: {
    width: '64%',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  pokerTableRow: {
    width: '76%',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    marginTop: 1,
    paddingTop: 2,
  },
  pokerHandLabel: {
    width: 60,
    fontSize: 16,
    fontWeight: '700',
  },
  pokerHandCards: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '700',
  },
  pokerWinnerText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  pokerRevealLabel: { fontSize: 12.5, fontWeight: '700', marginTop: 5 },
  pokerCardsRow: { flexDirection: 'row', gap: 6, marginTop: 7, marginBottom: 5 },
  pokerCard: { width: 36, height: 49, borderRadius: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  pokerCardText: { color: '#172A3B', fontSize: 12, fontWeight: '900' },
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
