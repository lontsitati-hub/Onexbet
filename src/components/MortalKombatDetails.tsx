import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView } from 'expo-video';
import { BetEvent } from '@/types/bet';
import { MORTAL_KOMBAT_FIGHTERS } from '@/data/mortalKombatFighters';
const PINNED_ICON = require('../../assets/images/custom-icons/pinned.png');

type Simulation = { isLive?: boolean; isFinished?: boolean; displayScore?: string; liveTime?: string; elapsedMs?: number; currentRound?: number; totalRounds?: number; rounds?: { team1: number; team2: number }; roundScores?: Array<{ team1: number; team2: number }> } | null;
type MarketRow = { label: string; odd: string; locked?: boolean };
type Market = { title: string; count?: number; rows?: MarketRow[]; defaultOpen?: boolean };

const FIGHTER_IMAGES: Record<string, any> = {
  reiko: require('../../assets/images/mortal-kombat/fighters/kano.jpg'),
  stryker: require('../../assets/images/mortal-kombat/fighters/jax-briggs.jpg'),
  scorpion: require('../../assets/images/mortal-kombat/fighters/scorpion.jpg'),
  subzero: require('../../assets/images/mortal-kombat/fighters/sub-zero.jpg'),
};

const fighterImage = (name: string, fallback: 'reiko' | 'stryker', selectedLogo?: string) => {
  const selectedKey = selectedLogo?.startsWith('mortal:') ? selectedLogo.slice('mortal:'.length) : '';
  const normalizedName = name.toLowerCase().replace(/[^a-z]/g, '');
  const selected = MORTAL_KOMBAT_FIGHTERS.find((fighter) => fighter.id === selectedKey || fighter.name.toLowerCase().replace(/[^a-z]/g, '') === normalizedName);
  return selected?.image || FIGHTER_IMAGES[normalizedName] || FIGHTER_IMAGES[fallback];
};

const selectedFighterName = (name: string, selectedLogo?: string) => {
  const selectedKey = selectedLogo?.startsWith('mortal:') ? selectedLogo.slice('mortal:'.length) : '';
  return MORTAL_KOMBAT_FIGHTERS.find((fighter) => fighter.id === selectedKey)?.name || name;
};

const mkMarkets: Market[] = [
  { title: '1X2', rows: [{ label: 'V1', odd: '1.165' }, { label: 'V2', odd: '4.87' }], defaultOpen: true },
  { title: 'Total', rows: [{ label: '(7.5) Plus de', odd: '1.61' }, { label: '(7.5) Moins de', odd: '2.2' }, { label: '(8.5) Plus de', odd: '2.784' }, { label: '(8.5) Moins de', odd: '1.395' }], defaultOpen: true },
  { title: 'Méthode de Victoire Dans Le Round', count: 7 },
  { title: 'Total 2', count: 4 },
  { title: 'Totaux supplémentaires', count: 10 },
  { title: 'Flawless Victory dans Round', count: 2 },
  { title: 'Total de Babality', rows: [{ label: 'Plus de (0.5)', odd: '19', locked: true }, { label: 'Moins de (0.5)', odd: '1.001', locked: true }] },
  { title: 'Mercy dans le Round', count: 4 },
];

function MarketAccordion({ market, onSelect }: { market: Market; onSelect: (label: string, odd: number) => void }) {
  const [open, setOpen] = React.useState(Boolean(market.defaultOpen));
  return <View style={styles.marketCard}>
    <TouchableOpacity style={styles.marketHeader} onPress={() => setOpen(v => !v)} activeOpacity={0.8}>
      <Text style={styles.marketTitle} numberOfLines={1}>{market.title}</Text>
      {market.count !== undefined && <Text style={styles.marketCount}>({market.count})</Text>}
      <View style={styles.marketActions}><Image source={PINNED_ICON} style={{ width: 19, height: 19 }} resizeMode="contain" /><View style={styles.actionCircle}><Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#5D89AE" /></View></View>
    </TouchableOpacity>
    {open && market.rows && <View style={styles.rows}>{market.rows.map((row) => <TouchableOpacity key={`${market.title}-${row.label}`} style={[styles.oddCell, row.locked && styles.lockedCell]} onPress={() => !row.locked && onSelect(`${market.title}. ${row.label}`, Number(row.odd))} activeOpacity={row.locked ? 1 : 0.75}>
      <Text style={[styles.oddLabel, row.locked && styles.lockedText]} numberOfLines={1}>{row.label}</Text>
      <Text style={[styles.oddValue, row.locked && styles.lockedText]}>{row.locked && <Ionicons name="lock-closed" size={11} color="#9CA8B1" />} {row.odd}</Text>
    </TouchableOpacity>)}</View>}
  </View>;
}

export function MortalKombatVideo({ player, simulation, team1, team2, event }: { player: any; simulation: Simulation; team1: string; team2: string; event: BetEvent }) {
  if (simulation?.isLive) return <View style={styles.videoFrame}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <VideoView pointerEvents="none" player={player} style={styles.video} contentFit="contain" nativeControls={false} fullscreenOptions={{ enable: false }} />
    </View>
    <View pointerEvents="none" style={styles.videoNameOverlay}>
      <View style={[styles.videoNameplate, styles.videoNameplateLeft]}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.videoName}>{selectedFighterName(team1, event.team1Logo)}</Text></View>
      <View style={[styles.videoNameplate, styles.videoNameplateRight]}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.videoName}>{selectedFighterName(team2, event.team2Logo)}</Text></View>
    </View>
  </View>;
  return <View style={styles.videoFrame}><Image source={simulation?.elapsedMs && simulation.elapsedMs > 45000 ? require('../../assets/images/mortal-kombat-transition-poster.jpg') : require('../../assets/images/mortal-kombat-stats-poster.jpg')} style={styles.videoPoster} resizeMode="cover" /></View>;
}

export default function MortalKombatDetails({ event, team1, team2, simulation, player, onSelect }: { event: BetEvent; team1: string; team2: string; simulation: Simulation; player: any; onSelect: (label: string, odd: number) => void }) {
  const roundScores = simulation?.roundScores || [];
  const fighter1Name = selectedFighterName(team1 || 'Reiko', event.team1Logo);
  const fighter2Name = selectedFighterName(team2 || 'Stryker', event.team2Logo);
  const roundLabel = simulation?.isFinished
    ? `Combat terminé · ${simulation.rounds?.team1 || 0}-${simulation.rounds?.team2 || 0}`
    : simulation?.isLive
      ? `Round ${simulation.currentRound || 1}/${simulation.totalRounds || 3}`
      : 'Combat à venir';
  return <>
    <View style={styles.combatMeta}>
      <View style={styles.fighter}><Image source={fighterImage(fighter1Name, 'reiko', event.team1Logo)} style={styles.fighterPortrait} /><Text style={styles.fighterName}>{fighter1Name}</Text><View style={styles.fighterHealth}><View style={[styles.healthFill, styles.healthFillLeft, { width: simulation?.rounds?.team1 ? `${Math.min(100, simulation.rounds.team1 * 50)}%` : '0%' }]} /></View></View>
      <View style={styles.score}><Text style={styles.clock}>{simulation?.liveTime || 'À venir'}</Text><Text style={styles.scoreText}>{simulation?.displayScore || 'VS'}</Text><Text style={styles.round}>{roundLabel}</Text><Text style={styles.roundScores}>{roundScores.length > 0 ? `(${roundScores.map((score) => `${score.team1}:${score.team2}`).join(', ')})` : ''}</Text><Text style={styles.matchId}>N° {String(event.id).replace(/\D/g, '').slice(-3) || '247'}</Text></View>
      <View style={[styles.fighter, styles.fighterRight]}><Image source={fighterImage(fighter2Name, 'stryker', event.team2Logo)} style={styles.fighterPortrait} /><Text style={styles.fighterName}>{fighter2Name}</Text><View style={styles.fighterHealth}><View style={[styles.healthFill, styles.healthFillRight, { width: simulation?.rounds?.team2 ? `${Math.min(100, simulation.rounds.team2 * 50)}%` : '0%' }]} /></View></View>
    </View>
    <View style={styles.leagueRow}><Ionicons name="trophy" size={15} color="#FFF" /><Text style={styles.leagueText}>Mortal Kombat 3</Text><Ionicons name="chevron-forward" size={17} color="#FFF" /></View>
    <MortalKombatVideo player={player} simulation={simulation} team1={fighter1Name} team2={fighter2Name} event={event} />
    <View style={styles.periodBar}><TouchableOpacity style={styles.periodPill}><Text style={styles.periodText}>Temps réglementaire</Text></TouchableOpacity></View>
    <View style={styles.marketList}>{mkMarkets.map((market) => <MarketAccordion key={market.title} market={market} onSelect={onSelect} />)}<View style={{ height: 90 }} /></View>
  </>;
}

const styles = StyleSheet.create({
  combatMeta: { height: 122, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, backgroundColor: 'rgba(3,8,10,.92)' },
  fighter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }, fighterRight: { alignItems: 'center' }, fighterName: { color: '#FFF', fontSize: 16, fontWeight: '700' }, fighterHint: { color: '#91B2CC', fontSize: 18, marginTop: 8 }, fighterPortrait: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'rgba(255,255,255,.55)' }, fighterHealth: { width: 62, height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: '#26343D' }, healthFill: { height: '100%', width: '78%', borderRadius: 3 }, healthFillLeft: { backgroundColor: '#35C78A' }, healthFillRight: { backgroundColor: '#3C91E6', alignSelf: 'flex-end' },
  score: { width: 125, alignItems: 'center' }, clock: { color: '#D6DDE0', fontSize: 12, fontWeight: '600' }, scoreText: { color: '#FFF', fontSize: 27, lineHeight: 31, fontWeight: '800' }, round: { color: '#E4E8EA', fontSize: 12, textAlign: 'center' }, roundScores: { color: '#B8C7D1', fontSize: 10, minHeight: 12, textAlign: 'center' }, matchId: { color: '#D6DDE0', fontSize: 11, marginTop: 3 },
  leagueRow: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, backgroundColor: 'rgba(4,7,8,.96)', borderTopWidth: 1, borderTopColor: '#1B2022' }, leagueText: { flex: 1, color: '#FFF', fontSize: 14 },
  videoFrame: { marginHorizontal: 6, aspectRatio: 16 / 9, borderRadius: 15, overflow: 'hidden', backgroundColor: '#060708', borderWidth: 1, borderColor: '#333B40', position: 'relative' }, video: { width: '100%', height: '100%' }, videoPoster: { width: '100%', height: '100%' }, videoNameOverlay: { ...StyleSheet.absoluteFill }, videoNameplate: { position: 'absolute', top: '8%', width: '17%', height: '9%', minHeight: 15, justifyContent: 'center', paddingHorizontal: 3, backgroundColor: 'rgba(7,13,21,.97)' }, videoNameplateLeft: { left: '11%' }, videoNameplateRight: { right: '11%' }, videoName: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', textAlign: 'center', letterSpacing: 0.2 },
  periodBar: { height: 82, backgroundColor: '#EEF1F8', paddingHorizontal: 10, paddingTop: 29 }, periodPill: { alignSelf: 'flex-start', backgroundColor: '#4C91D2', borderRadius: 22, paddingHorizontal: 20, paddingVertical: 11 }, periodText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  marketList: { backgroundColor: '#EEF1F8', paddingHorizontal: 5 }, marketCard: { backgroundColor: '#FFF', borderRadius: 14, marginBottom: 7, paddingHorizontal: 9, paddingVertical: 8, shadowColor: '#98A7B5', shadowOpacity: .1, shadowRadius: 3, elevation: 1 }, marketHeader: { minHeight: 37, flexDirection: 'row', alignItems: 'center' }, marketTitle: { flexShrink: 1, color: '#12283B', fontSize: 18, fontWeight: '500' }, marketCount: { color: '#12283B', fontSize: 16, marginLeft: 'auto', marginRight: 10 }, marketActions: { flexDirection: 'row', alignItems: 'center', gap: 10 }, actionCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EEF2F6', alignItems: 'center', justifyContent: 'center' }, rows: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingTop: 7 }, oddCell: { flexBasis: '48%', flexGrow: 1, minHeight: 45, borderRadius: 10, backgroundColor: '#E8EDF5', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, oddLabel: { color: '#8B9BAA', fontSize: 13, flex: 1 }, oddValue: { color: '#17364F', fontSize: 16, fontWeight: '800' }, lockedCell: { backgroundColor: '#F1F3F6' }, lockedText: { color: '#A4ADB4' },
});
