import { COLORS, getBackgroundPalette } from '@/constants/theme';
import { useBetStore } from '@/store/useBetStore';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { formatOdd } from '@/utils/format';
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Sub-filter tabs definition ────────────────────────────────────────────────
type SubTab = 'evenements' | 'autre' | 'suivi' | 'vu';

interface SubTabItem {
  key: SubTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const SUB_TABS: SubTabItem[] = [
  { key: 'evenements', label: 'Événements', icon: 'layers-outline' },
  { key: 'autre', label: 'Autre', icon: 'star' },
  { key: 'suivi', label: 'Suivi', icon: 'eye-outline' },
  { key: 'vu', label: 'Vu', icon: 'flag-outline' },
];

// ─── Sample recommended matches (static demo data) ────────────────────────────
interface RecommendedMatch {
  id: string;
  tournament: string;
  tournamentIcon: string;
  isLive: boolean;
  liveLabel?: string;
  team1: string;
  team2: string;
  team1Color: string;
  team2Color: string;
  team1Initial: string;
  team2Initial: string;
  score1?: number;
  score2?: number;
  periodLabel?: string;
  periodScores?: string;
  betLabel: string;
  odds: { label: string; value: number; locked?: boolean }[];
  setScores?: { set: number; t1: number; t2: number }[];
}

const RECOMMENDED_MATCHES: RecommendedMatch[] = [
  {
    id: 'rec-1',
    tournament: 'Championnat de Nouvelle-Zélande. NBL',
    tournamentIcon: '🏀',
    isLive: true,
    liveLabel: '',
    team1: 'Canterbury Rams',
    team2: "Hawke's Bay Hawks",
    team1Color: '#8B0000',
    team2Color: '#1B5E20',
    team1Initial: 'RAMS',
    team2Initial: 'HAWKS',
    score1: 63,
    score2: 59,
    periodLabel: '4x10 Prolongation incluse, 3ème quart-temps, temps écoulé : 26:22',
    periodScores: '(30-16, 18-19, 15-24)',
    betLabel: 'Equipe gagne',
    odds: [
      { label: 'V1', value: 1.1 },
      { label: 'V2', value: 6.27 },
    ],
  },
  {
    id: 'rec-2',
    tournament: "Coupe d'Asie",
    tournamentIcon: '🏐',
    isLive: true,
    liveLabel: '1er set',
    team1: 'Taïwan',
    team2: 'Qatar',
    team1Color: '#C62828',
    team2Color: '#5D4037',
    team1Initial: '🇹🇼',
    team2Initial: '🇶🇦',
    score1: undefined,
    score2: undefined,
    betLabel: '1X2',
    odds: [
      { label: 'V1', value: 4.53, locked: true },
      { label: 'V2', value: 1.18, locked: true },
    ],
    setScores: [
      { set: 1, t1: 14, t2: 19 },
    ],
  },
  {
    id: 'rec-3',
    tournament: 'États-Unis. MLB',
    tournamentIcon: '⚾',
    isLive: true,
    team1: 'NY Yankees',
    team2: 'Boston Red Sox',
    team1Color: '#003087',
    team2Color: '#BD3039',
    team1Initial: 'NYY',
    team2Initial: 'BOS',
    score1: 3,
    score2: 2,
    betLabel: '1X2',
    odds: [
      { label: 'V1', value: 1.95 },
      { label: 'V2', value: 1.85 },
    ],
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────
export default function FavorisTab() {
  const insets = useSafeAreaInsets();
  const balance = useBetStore((state) => state.balance);
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);

  const activeColor = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#2E79C9';

  const [refreshing, setRefreshing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('evenements');

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const formatCurrency = (val: number) => {
    if (val % 1 !== 0) {
      return val.toFixed(2);
    }
    return val.toString();
  };

  // ─── Render a single match card ──────────────────────────────────────────────
  const renderMatchCard = (match: RecommendedMatch) => (
    <View key={match.id} style={[styles.matchCard, { backgroundColor: bg.cardBg, borderColor: bg.divider }]}>
      {/* Tournament Header Row */}
      <View style={styles.matchTournamentRow}>
        <View style={styles.tournamentLeft}>
          <Text style={styles.tournamentIcon}>{match.tournamentIcon}</Text>
          <Text style={[styles.tournamentText, { color: bg.textSecondary }]} numberOfLines={1}>{match.tournament}</Text>
        </View>
        <View style={styles.tournamentRight}>
          <TouchableOpacity style={styles.actionIconBtn}>
            <Ionicons name="play-circle-outline" size={22} color="#7A9AB5" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconBtn}>
            <Ionicons name="notifications-outline" size={20} color="#7A9AB5" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconBtn}>
            <Ionicons name="star-outline" size={20} color="#7A9AB5" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Live Label (if any) */}
      {match.liveLabel ? (
        <Text style={styles.liveLabel}>{match.liveLabel}</Text>
      ) : null}

      {/* Teams & Score Section */}
      {match.id === 'rec-1' ? (
        // Basketball style: horizontal layout with score in center
        <>
          <View style={styles.basketballRow}>
            <View style={styles.basketTeamLeft}>
              <Text style={[styles.basketTeamName, { color: bg.textPrimary }]} numberOfLines={1}>{match.team1}</Text>
              <View style={[styles.teamBadge, { backgroundColor: match.team1Color }]}>
                <Text style={styles.teamBadgeText}>{match.team1Initial}</Text>
              </View>
            </View>
            <View style={styles.scoreCenter}>
              <Text style={[styles.scoreBig, { color: bg.textPrimary }]}>{match.score1}</Text>
              <Text style={[styles.scoreColon, { color: bg.textSecondary }]}> : </Text>
              <Text style={[styles.scoreBig, { color: bg.textPrimary }]}>{match.score2}</Text>
            </View>
            <View style={styles.basketTeamRight}>
              <View style={[styles.teamBadge, { backgroundColor: match.team2Color }]}>
                <Text style={styles.teamBadgeText}>{match.team2Initial}</Text>
              </View>
              <Text style={[styles.basketTeamName, { color: bg.textPrimary }]} numberOfLines={1}>{match.team2}</Text>
            </View>
          </View>
          {match.periodLabel && (
            <Text style={styles.periodText}>{match.periodLabel}</Text>
          )}
          {match.periodScores && (
            <Text style={styles.periodScores}>{match.periodScores}</Text>
          )}
        </>
      ) : match.id === 'rec-2' ? (
        // Volleyball style: table with set scores
        <>
          <View style={styles.volleyTable}>
            <View style={styles.volleyHeader}>
              <View style={{ flex: 1 }} />
              <View style={styles.volleyScoreHeaders}>
                <Text style={styles.volleySetHeader}>1</Text>
                <Text style={styles.volleySetHeaderScore}>Score</Text>
              </View>
            </View>
            {/* Team 1 Row */}
            <View style={styles.volleyTeamRow}>
              <View style={styles.volleyTeamInfo}>
                <View style={[styles.volleyFlag, { backgroundColor: match.team1Color }]}>
                  <Text style={styles.volleyFlagText}>{match.team1Initial}</Text>
                </View>
                <Text style={styles.volleyTeamName}>{match.team1}</Text>
              </View>
              <View style={styles.volleyScoresRow}>
                {match.setScores?.map((s, i) => (
                  <View key={i} style={styles.volleyScoreCell}>
                    <Text style={styles.volleyScoreVal}>{s.t1}</Text>
                  </View>
                ))}
                <View style={[styles.volleyScoreCell, styles.volleyScoreCellTotal]}>
                  <Text style={styles.volleyScoreValBold}>0</Text>
                </View>
              </View>
            </View>
            {/* Team 2 Row */}
            <View style={styles.volleyTeamRow}>
              <View style={styles.volleyTeamInfo}>
                <View style={[styles.volleyFlag, { backgroundColor: match.team2Color }]}>
                  <Text style={styles.volleyFlagText}>{match.team2Initial}</Text>
                </View>
                <Text style={styles.volleyTeamName}>{match.team2}</Text>
              </View>
              <View style={styles.volleyScoresRow}>
                {match.setScores?.map((s, i) => (
                  <View key={i} style={styles.volleyScoreCell}>
                    <Text style={styles.volleyScoreVal}>{s.t2}</Text>
                  </View>
                ))}
                <View style={[styles.volleyScoreCell, styles.volleyScoreCellTotal]}>
                  <Text style={styles.volleyScoreValBold}>0</Text>
                </View>
              </View>
            </View>
          </View>
        </>
      ) : null}

      {/* Bet Label */}
      <Text style={styles.betTypeLabel}>{match.betLabel}</Text>

      {/* Odds Row */}
      <View style={styles.oddsRow}>
        {match.odds.map((odd, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.oddBtn,
              i < match.odds.length - 1 && { marginRight: 8 },
            ]}
            activeOpacity={0.7}
          >
            <View style={styles.oddBtnContent}>
              <Text style={styles.oddLabel}>{odd.label}</Text>
              {odd.locked && (
                <Ionicons name="lock-closed" size={10} color="#A0B4C8" style={{ marginLeft: 2, marginRight: -2 }} />
              )}
            </View>
            <Text style={[styles.oddValue, odd.locked && { color: '#A0B4C8' }]}>{formatOdd(odd.value)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top || 44, backgroundColor: bg.headerBg }]}>
      <StatusBar barStyle={bg.statusBarStyle} backgroundColor="transparent" translucent={true} />

      {/* ─── Header ────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: bg.headerBg, borderBottomColor: bg.divider }]}>
        {/* Balance pill */}
        <TouchableOpacity style={[styles.balancePill, { backgroundColor: bg.pillBg }]} activeOpacity={0.8}>
          <View style={styles.balancePlusCircle}>
            <Ionicons name="add" size={14} color="#FFF" />
          </View>
          <Text style={[styles.balanceText, { color: bg.textPrimary }]}>{formatCurrency(balance)} ₣</Text>
        </TouchableOpacity>

        {/* Title */}
        <Text style={[styles.headerTitle, { color: bg.textPrimary }]}>Favoris</Text>

        {/* Trash icon */}
        <TouchableOpacity style={styles.trashBtn} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={22} color={bg.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ─── Sub-tabs row ───────────────────────────────────────── */}
      <View style={[styles.subTabsContainer, { backgroundColor: bg.headerBg, borderBottomColor: bg.divider }]}>
        {SUB_TABS.map((tab) => {
          const isActive = activeSubTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.subTabItem, isActive && [styles.subTabItemActive, { borderBottomColor: activeColor }]]}
              activeOpacity={0.7}
              onPress={() => setActiveSubTab(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={20}
                color={isActive ? activeColor : bg.textSecondary}
              />
              <Text style={[
                styles.subTabLabel,
                { color: bg.textSecondary },
                isActive && { color: activeColor, fontWeight: '700' },
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── Scrollable Content ───────────────────────────────────── */}
      <ScrollView
        style={[styles.scrollView, { backgroundColor: bg.appBg }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[activeColor]}
            tintColor={activeColor}
          />
        }
      >
        {/* Empty State */}
        <View style={[styles.emptySection, { backgroundColor: bg.cardBg }]}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="layers" size={36} color="#FFF" />
          </View>
          <Text style={[styles.emptyTitle, { color: bg.textPrimary }]}>Votre liste de jeux favoris est vide</Text>
          <Text style={[styles.emptySubtitle, { color: bg.textSecondary }]}>
            Ajoutez les événements qui vous intéressent pour{'\n'}un accès rapide
          </Text>
        </View>

        {/* "Nous recommandons" Section */}
        <Text style={[styles.sectionTitle, { color: bg.textPrimary }]}>Nous recommandons</Text>

        {RECOMMENDED_MATCHES.map((match) => renderMatchCard(match))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
 
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },

  // ─── Header ────────────────────────────
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 0,
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F5FA',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    paddingRight: 12,
  },
  balancePlusCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  balanceText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#082A4D',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#082A4D',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  trashBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },

  // ─── Sub-tabs ──────────────────────────
  subTabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 4,
  },
  subTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  subTabItemActive: {
    borderBottomColor: 'transparent',
  },
  subTabLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#7A9AB5',
    marginTop: 3,
  },

  // ─── Scroll ────────────────────────────
  scrollView: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // ─── Empty State ───────────────────────
  emptySection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 32,
    backgroundColor: '#FFF',
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#5BBFBA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#5BBFBA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#082A4D',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#7A9AB5',
    textAlign: 'center',
    lineHeight: 19,
  },

  // ─── Section Title ─────────────────────
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#082A4D',
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 14,
  },

  // ─── Match Card ────────────────────────
  matchCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#1A3A5C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },

  // Tournament Row
  matchTournamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tournamentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  tournamentIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  tournamentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5A7894',
    flex: 1,
  },
  tournamentRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIconBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Live Label
  liveLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5A7894',
    marginBottom: 6,
    marginLeft: 2,
  },

  // Basketball-style layout
  basketballRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  basketTeamLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  basketTeamRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  basketTeamName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#082A4D',
    marginHorizontal: 6,
    flexShrink: 1,
  },
  teamBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    minWidth: 36,
    alignItems: 'center',
  },
  teamBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  scoreCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  scoreBig: {
    fontSize: 22,
    fontWeight: '800',
    color: '#C62828',
  },
  scoreColon: {
    fontSize: 20,
    fontWeight: '800',
    color: '#C62828',
  },
  periodText: {
    fontSize: 11,
    color: '#7A9AB5',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 15,
  },
  periodScores: {
    fontSize: 11,
    color: '#7A9AB5',
    textAlign: 'center',
    marginBottom: 6,
  },

  // Volleyball-style table
  volleyTable: {
    marginBottom: 6,
  },
  volleyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  volleyScoreHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  volleySetHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7A9AB5',
    width: 32,
    textAlign: 'center',
  },
  volleySetHeaderScore: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7A9AB5',
    width: 40,
    textAlign: 'center',
  },
  volleyTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EDF2F7',
  },
  volleyTeamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  volleyFlag: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  volleyFlagText: {
    fontSize: 13,
  },
  volleyTeamName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#082A4D',
  },
  volleyScoresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  volleyScoreCell: {
    width: 32,
    height: 26,
    borderRadius: 5,
    backgroundColor: '#EDF2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  volleyScoreCellTotal: {
    backgroundColor: '#DDE8F0',
    width: 40,
  },
  volleyScoreVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#082A4D',
  },
  volleyScoreValBold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#082A4D',
  },

  // Bet type label
  betTypeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#082A4D',
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 2,
  },

  // Odds
  oddsRow: {
    flexDirection: 'row',
  },
  oddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F4F7FB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5ECF3',
  },
  oddBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  oddLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#5A7894',
  },
  oddValue: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#7A9AB5',
  },
});
