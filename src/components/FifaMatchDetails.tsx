import React, { useMemo, useState } from 'react';
import { Image, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView } from 'expo-video';
import Svg, { Circle } from 'react-native-svg';
import { BetEvent } from '@/types/bet';
import { FifaSimulationState } from '@/utils/localFifaSimulation';
import { formatOdd } from '@/utils/format';

const BLUE = '#4A8FC7';
const GREEN = '#27C76B';
const ORANGE = '#F3B623';
const RED = '#F05252';
const PINNED_ICON = require('../../assets/images/custom-icons/pinned.png');
type Props = { event: BetEvent; player?: any; simulation: FifaSimulationState | null; team1: string; team2: string; team1Logo?: string; team2Logo?: string; score: string; nowMs: number; onBack: () => void; onSelect: (label: string, oddValue: number) => void };
type Market = { title: string; options: Array<{ label: string; odd: string }> };
const getTeamLogo = (_team: string, explicitLogo?: string): string | null =>
  explicitLogo && /^https:\/\//i.test(explicitLogo) ? explicitLogo : null;

const TeamLogo = ({ team, explicitLogo }: { team: string; explicitLogo?: string }) => {
  const logo = getTeamLogo(team, explicitLogo);
  return logo ? <Image source={{ uri: logo }} style={styles.teamLogo} resizeMode="contain" /> : <View style={styles.teamLogoFallback} />;
};

const makeOdd = (seed: number, floor = 1.15) => (floor + ((seed * 37) % 170) / 100).toFixed(3);
const buildMarkets = (event: BetEvent): Market[] => [
  { title: '1X2', options: [
    { label: 'V1', odd: Number(event.marketOdds?.v1 ?? event.odd ?? 1.8).toFixed(2) },
    { label: 'X', odd: Number(event.marketOdds?.draw ?? 3.2).toFixed(2) },
    { label: 'V2', odd: Number(event.marketOdds?.v2 ?? 2.4).toFixed(2) },
  ] },
  { title: 'Double chance', options: [{ label: '1X', odd: '1.425' }, { label: '12', odd: '1.184' }, { label: '2X', odd: '1.58' }] },
  { title: 'Deux équipes vont marquer', options: [{ label: 'Oui', odd: '1.74' }, { label: 'Non', odd: '2.09' }] },
  { title: 'Total', options: [{ label: '(0.5) Plus de', odd: '1.185' }, { label: '(0.5) Moins de', odd: '4.2' }, { label: '(1.5) Plus de', odd: '2.16' }, { label: '(1.5) Moins de', odd: '1.696' }] },
  { title: 'Handicap', options: [{ label: 'Équipe 1 (-1.5)', odd: makeOdd(5) }, { label: 'Équipe 2 (+1.5)', odd: makeOdd(6) }, { label: 'Équipe 1 (-2.5)', odd: makeOdd(7) }, { label: 'Équipe 2 (+2.5)', odd: makeOdd(8) }] },
  { title: 'Total 1', options: [{ label: '(0.5) Plus de', odd: '1.33' }, { label: '(0.5) Moins de', odd: '3.20' }, { label: '(1) Plus de', odd: '1.66' }, { label: '(1) Moins de', odd: '2.17' }] },
  { title: 'Total 2', options: [{ label: '(0.5) Plus de', odd: '1.185' }, { label: '(0.5) Moins de', odd: '4.2' }, { label: '(1.5) Plus de', odd: '2.16' }, { label: '(1.5) Moins de', odd: '1.696' }] },
  { title: 'Prochain but', options: [{ label: '1', odd: '1.85' }, { label: 'Aucun but', odd: '5.40' }, { label: '2', odd: '2.25' }] },
  { title: 'MT-Fin', options: [{ label: '1/1', odd: '3.475' }, { label: 'X/1', odd: '6.05' }, { label: '2/1', odd: '28' }, { label: '1/X', odd: '15' }, { label: 'X/X', odd: '6.08' }, { label: '2/2', odd: '13' }] },
  { title: 'Score exact', options: [{ label: '0 : 0', odd: '4.50' }, { label: '1 : 0', odd: '3.50' }, { label: '1 : 1', odd: '3.50' }, { label: '2 : 1', odd: '5.50' }] },
];

const DonutStats = () => {
  const radius = 38; const circumference = 2 * Math.PI * radius; const values = [13, 7, 10]; const colors = [GREEN, ORANGE, RED]; let offset = 0;
  return <View style={styles.donutWrap}><Svg width={112} height={112} viewBox="0 0 112 112"><Circle cx="56" cy="56" r={radius} stroke="#27302C" strokeWidth="9" fill="none" />{values.map((value, index) => { const segment = circumference * (value / 30); const node = <Circle key={colors[index]} cx="56" cy="56" r={radius} stroke={colors[index]} strokeWidth="9" fill="none" strokeDasharray={`${segment} ${circumference - segment}`} strokeDashoffset={-offset} strokeLinecap="round" rotation="-90" origin="56, 56" />; offset += segment + 4; return node; })}</Svg><View style={styles.donutCenter}><Text style={styles.donutNumber}>30</Text><Text style={styles.donutLabel}>jeux</Text></View></View>;
};

export default function FifaMatchDetails({ event, player, simulation, team1, team2, team1Logo, team2Logo, score, nowMs, onBack, onSelect }: Props) {
  const [activeStatsTab, setActiveStatsTab] = useState<'team1' | 'team2' | 'table'>('team1');
  const [activePeriod, setActivePeriod] = useState('Temps réglementaire');
  const [expanded, setExpanded] = useState<string | null>('1X2');
  const markets = useMemo(() => buildMarkets(event), [event.marketOdds, event.odd]);
  const displayScore = score.replace(/\s*[-:]\s*/g, ' : ');
  const countdown = useMemo(() => { const scheduled = event.scheduledAt ? new Date(event.scheduledAt).getTime() : NaN; const remaining = Number.isFinite(scheduled) && scheduled > nowMs ? Math.floor((scheduled - nowMs) / 1000) : 0; const hours = Math.floor(remaining / 3600); const minutes = Math.floor((remaining % 3600) / 60); const seconds = remaining % 60; return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }, [event.scheduledAt, nowMs]);
  const matchTimeLabel = simulation?.isLive || simulation?.isFinished
    ? `Temps écoulé : ${simulation.displayMatchTime}`
    : simulation?.isScheduled
      ? `Le match commence dans ${countdown}`
      : 'Horaire de match non défini';
  const statsTeam = activeStatsTab === 'team2' ? team2 : team1;
  return <View style={styles.screen}>
    <ImageBackground source={require('../../assets/images/stadium_bg.png')} imageStyle={styles.headerBackgroundImage} style={styles.matchHeader}><View pointerEvents="none" style={styles.headerTint} /><View style={styles.matchTopLine}><TouchableOpacity onPress={onBack} hitSlop={8}><Ionicons name="chevron-back" size={23} color="#FFFFFF" /></TouchableOpacity><Text style={styles.headerFifa}>FIFA</Text><Ionicons name="flash" size={19} color="#FFFFFF" /><Ionicons name="ellipsis-horizontal" size={21} color="#FFFFFF" /></View><View style={styles.teamsRow}><View style={styles.teamSide}><TeamLogo team={team1 || 'Suède'} explicitLogo={team1Logo} /><Text style={styles.teamName}>{team1 || 'Suède'}</Text></View><View style={styles.scoreColumn}><Text style={styles.vsText}>{displayScore === 'VS' ? 'VS' : displayScore}</Text><Text style={styles.countdown}>{matchTimeLabel}</Text></View><View style={[styles.teamSide, styles.teamSideRight]}><TeamLogo team={team2 || 'Allemagne'} explicitLogo={team2Logo} /><Text style={[styles.teamName, styles.teamNameRight]}>{team2 || 'Allemagne'}</Text></View></View><View style={styles.tournamentRow}><Ionicons name="trophy-outline" size={13} color="#FFFFFF" /><Text style={styles.tournamentText}>{event.tournament || 'FC 26. Championnat du monde'}</Text><Ionicons name="chevron-forward" size={14} color="#FFFFFF" /></View></ImageBackground>
    {simulation?.isLive ? (
      <View style={styles.videoFrame}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <VideoView pointerEvents="none" player={player} style={styles.video} contentFit="contain" nativeControls={false} fullscreenOptions={{ enable: false }} />
        </View>
        <View pointerEvents="none" style={styles.videoBadge}><View style={styles.liveDot} /><Text style={styles.videoBadgeText}>EN DIRECT</Text></View>
      </View>
    ) : (
      <View style={[styles.videoFrame, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#151D19', gap: 8 }]}>
        <Ionicons name={simulation?.isFinished ? 'checkmark-circle-outline' : 'time-outline'} size={24} color="#D4E2D8" />
        <Text style={{ color: '#D4E2D8', fontSize: 11, fontWeight: '700' }}>{simulation?.isFinished ? 'Match terminé' : 'La diffusion apparaîtra au coup d’envoi'}</Text>
      </View>
    )}
    <View style={styles.statsBlock}><Text style={styles.statsTitle}>Stats des équipes</Text><View style={styles.statsTabs}>{([["team1", team1 || 'Suède'], ["team2", team2 || 'Allemagne'], ["table", 'Tableau du tournoi']] as const).map(([key, label]) => <TouchableOpacity key={key} onPress={() => setActiveStatsTab(key)} style={[styles.statsTab, activeStatsTab === key && styles.statsTabActive]}><Text style={[styles.statsTabText, activeStatsTab === key && styles.statsTabTextActive]}>{label}</Text></TouchableOpacity>)}</View>{activeStatsTab === 'table' ? <View style={styles.tablePanel}><Text style={styles.tablePanelTitle}>Tableau du tournoi</Text><Text style={styles.tableLine}>{team1 || 'Suède'} · 46 points · DB 51-42</Text><Text style={styles.tableLine}>{team2 || 'Allemagne'} · 41 points · DB 48-44</Text></View> : <><View style={styles.statsContent}><DonutStats /><View style={styles.legend}><Text style={styles.legendTeam}>{statsTeam}</Text><View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: GREEN }]} /><Text style={styles.legendLabel}>Victoires</Text><Text style={styles.legendValue}>13</Text></View><View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: ORANGE }]} /><Text style={styles.legendLabel}>Matchs nuls</Text><Text style={styles.legendValue}>7</Text></View><View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: RED }]} /><Text style={styles.legendLabel}>Défaites</Text><Text style={styles.legendValue}>10</Text></View></View></View><View style={styles.statsFooter}><Text style={styles.footerText}>Points : 46</Text><Text style={styles.footerText}>DB : 51-42</Text></View></>}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodScroll} style={styles.periodBar}>{['Temps réglementaire', '1ère mi-temps', '2ème mi-temps', 'Prolongations', 'Corners', 'Cartons'].map((period) => <TouchableOpacity key={period} onPress={() => setActivePeriod(period)} style={[styles.periodPill, activePeriod === period && styles.periodPillActive]}><Text style={[styles.periodText, activePeriod === period && styles.periodTextActive]}>{period}</Text></TouchableOpacity>)}</ScrollView>
    <View style={styles.marketArea}>{markets.map((market) => <View key={market.title} style={styles.marketSection}><TouchableOpacity style={styles.marketHeader} onPress={() => setExpanded(expanded === market.title ? null : market.title)}><Text style={styles.marketTitle}>{market.title} <Text style={styles.marketCount}>({market.options.length})</Text></Text><View style={styles.marketActions}><Image source={PINNED_ICON} style={styles.pinnedIcon} resizeMode="contain" /><Ionicons name={expanded === market.title ? 'chevron-up' : 'chevron-down'} size={17} color="#8D9497" /></View></TouchableOpacity>{expanded === market.title && <View style={styles.optionsGrid}>{market.options.map((option) => <TouchableOpacity key={`${market.title}-${option.label}`} onPress={() => onSelect(`${market.title}. ${option.label}`, Number(option.odd))} style={styles.optionCell}><Text style={styles.optionLabel}>{option.label}</Text><Text style={styles.optionOdd}>{formatOdd(Number(option.odd))}</Text></TouchableOpacity>)}</View>}</View>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#101615' }, videoFrame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000000', overflow: 'hidden', position: 'relative' }, video: { width: '100%', height: '100%' }, videoBadge: { position: 'absolute', top: 4, left: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F33B3B', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', marginRight: 4 }, videoBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' }, matchHeader: { paddingHorizontal: 10, paddingTop: 4, overflow: 'hidden' }, headerBackgroundImage: { resizeMode: 'cover' }, headerTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4, 67, 36, .90)' }, matchTopLine: { height: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 15 }, headerFifa: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1, marginRight: 'auto', marginLeft: 14 }, teamsRow: { minHeight: 83, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, teamSide: { width: '30%', flexDirection: 'row', alignItems: 'center', gap: 5 }, teamSideRight: { justifyContent: 'flex-start' }, teamName: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', flexShrink: 1 }, teamNameRight: { textAlign: 'left' }, teamLogo: { width: 24, height: 24 }, teamLogoFallback: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }, scoreColumn: { alignItems: 'center', maxWidth: '42%' }, vsText: { color: '#FFFFFF', fontSize: 18, lineHeight: 21, fontWeight: '900' }, countdown: { color: '#CDE6D4', fontSize: 7.5, marginTop: 5, textAlign: 'center' }, tournamentRow: { height: 27, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.16)', flexDirection: 'row', alignItems: 'center', gap: 5 }, tournamentText: { color: '#FFFFFF', fontSize: 9, flex: 1 }, statsBlock: { paddingHorizontal: 13, paddingTop: 8, backgroundColor: '#121817' }, statsTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', marginBottom: 5 }, statsTabs: { flexDirection: 'row', gap: 5 }, statsTab: { paddingHorizontal: 11, height: 25, borderRadius: 13, justifyContent: 'center', backgroundColor: '#2C3933' }, statsTabActive: { backgroundColor: '#D9E0D9' }, statsTabText: { color: '#D4DDD5', fontSize: 8.5, fontWeight: '700' }, statsTabTextActive: { color: '#1C3024' }, statsContent: { marginTop: 6, minHeight: 119, borderRadius: 8, backgroundColor: '#1C2420', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, donutWrap: { width: 116, height: 116, alignItems: 'center', justifyContent: 'center' }, donutCenter: { position: 'absolute', alignItems: 'center' }, donutNumber: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', lineHeight: 20 }, donutLabel: { color: '#FFFFFF', fontSize: 9 }, legend: { width: 135, gap: 4 }, legendTeam: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', marginBottom: 3 }, legendRow: { flexDirection: 'row', alignItems: 'center' }, legendDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 }, legendLabel: { color: '#FFFFFF', fontSize: 8.5, flex: 1 }, legendValue: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', width: 18, textAlign: 'right' }, statsFooter: { height: 27, borderTopWidth: 1, borderTopColor: '#29332E', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }, footerText: { color: '#FFFFFF', fontSize: 8, fontWeight: '600' }, tablePanel: { minHeight: 119, marginTop: 6, borderRadius: 8, backgroundColor: '#1C2420', padding: 14, gap: 8 }, tablePanelTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' }, tableLine: { color: '#C9D7CE', fontSize: 9 }, periodBar: { backgroundColor: '#F7F8F9', maxHeight: 56 }, periodScroll: { alignItems: 'center', gap: 7, paddingHorizontal: 7 }, periodPill: { height: 32, paddingHorizontal: 13, borderRadius: 17, backgroundColor: '#FFFFFF', justifyContent: 'center', borderWidth: 1, borderColor: '#EEF1F2' }, periodPillActive: { backgroundColor: BLUE, borderColor: BLUE }, periodText: { color: '#65757B', fontSize: 9, fontWeight: '700' }, periodTextActive: { color: '#FFFFFF' }, marketArea: { backgroundColor: '#F7F8F9', paddingBottom: 30 }, marketSection: { borderTopWidth: 1, borderTopColor: '#E1E6E8', backgroundColor: '#FFFFFF' }, marketHeader: { minHeight: 43, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, marketTitle: { color: '#1F3139', fontSize: 12, fontWeight: '800' }, marketCount: { color: '#68777D', fontWeight: '700' }, marketActions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, pinnedIcon: { width: 19, height: 19 }, optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 10, paddingBottom: 10 }, optionCell: { minHeight: 35, minWidth: '30%', flexGrow: 1, flexBasis: '30%', borderRadius: 6, paddingHorizontal: 9, backgroundColor: '#E8EEF1', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, optionLabel: { color: '#718088', fontSize: 8.5, flex: 1 }, optionOdd: { color: '#263B45', fontSize: 10, fontWeight: '900', marginLeft: 5 },
});
