import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GameState, GameTab } from './engine';

const PARTICIPANTS = ['*******73', '*******69', '*******83', '*******51', '*******01', '*******37', '*******81', '*******44', '*******28', '*******92', '*******16'];
const BASE_STAKES = [600.01, 526.95, 500, 400, 316.17, 316.17, 200, 200, 200, 188.93, 115];

type BetRow = { name: string; amount: number; target: number; payout: number };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundSeed(state: GameState): number {
  return state.roundNumber * 37 + Math.floor(state.multiplier) + (state.phase === 'crashed' ? 11 : state.phase === 'waiting' ? 5 : 0);
}

function makeRows(state: GameState, top = false): BetRow[] {
  const seed = roundSeed(state) + (top ? 101 : 0);
  const rowCount = top ? 5 : 7 + (Math.abs(seed) % 5);
  return PARTICIPANTS.slice(0, rowCount).map((name, index) => {
    const base = top ? BASE_STAKES[index] * (2.8 + ((seed + index * 7) % 5) / 10) : BASE_STAKES[index];
    const amount = round2(base * (1 + ((seed + index * 11) % 9) / 100));
    const target = round2(1.2 + ((seed + index * 17) % 510) / 100);
    const cashed = top || state.phase === 'crashed' ? (index + seed) % 4 !== 1 : state.phase === 'flying' ? target <= state.multiplier && (index + seed) % 3 === 0 : (index + seed) % 3 !== 0;
    return { name, amount, target: cashed ? target : 0, payout: cashed ? round2(amount * target) : 0 };
  });
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.max(0, Math.round(value)));
}

function number(value: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(value);
}

export function BetsTable({ state, tab, onTabChange }: { state: GameState; tab: GameTab; onTabChange: (tab: GameTab) => void }) {
  const ownBets = state.bets.filter(Boolean);
  const currentRows = makeRows(state);
  const topRows = makeRows(state, true);
  const simulatedStake = currentRows.reduce((total, row) => total + row.amount, 0) + ownBets.reduce((total, bet) => total + (bet?.amount ?? 0), 0);
  const playerCount = 2200 + state.roundNumber * 43 + Math.floor(state.multiplier * 29) + Math.floor(simulatedStake / 90);
  const isMine = tab === 'mine';
  const rows = tab === 'top' ? topRows : isMine ? ownBets.map((bet, index) => ({
    name: `Vous • Pari ${index + 1}`,
    amount: bet!.amount,
    target: bet!.cashedAt ?? 0,
    payout: bet!.payout,
  })) : currentRows;
  const totalCount = currentRows.length + ownBets.length + 78 + state.roundNumber * 9 + Math.floor(state.multiplier * 6);

  return (
    <View style={styles.section}>
      <View style={styles.tabs}>
        {([['current', 'Tour en cours'], ['mine', 'Mes paris'], ['top', 'Top']] as const).map(([key, title]) => (
          <Pressable key={key} onPress={() => onTabChange(key)} style={[styles.tab, tab === key && styles.selectedTab]} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected: tab === key }}>
            <Text style={[styles.tabText, tab === key && styles.selectedTabText]}>{title}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.playerCount}>{tab === 'current' ? `${compactNumber(playerCount)} joueurs` : tab === 'mine' ? `${ownBets.length} paris` : 'Meilleurs gains'}</Text>
        <Text style={styles.total}>{tab === 'current' ? `Total des paris : ${totalCount}` : ''}</Text>
        <Pressable style={styles.previous} accessibilityRole="button" accessibilityLabel="Tour précédent"><Text style={styles.previousText}>◉  Tour précédent</Text></Pressable>
      </View>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerText, styles.userColumn]}>Utilisateur</Text>
        <Text style={[styles.headerText, styles.betColumn]}>Pari</Text>
        <Text style={[styles.headerText, styles.multiplierColumn]}>X</Text>
        <Text style={[styles.headerText, styles.gainColumn]}>Gain</Text>
      </View>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={styles.rows}>
        {rows.length === 0 ? <Text style={styles.empty}>Aucun pari personnel pour le moment.</Text> : rows.map((row, index) => {
          const hasCashout = row.target > 0 && row.payout > 0;
          return (
            <View key={`${row.name}-${index}`} style={[styles.row, index === 0 && styles.rowHighlight]}>
              <Text numberOfLines={1} style={[styles.cell, styles.userColumn]}>{row.name}</Text>
              <Text numberOfLines={1} style={[styles.cell, styles.betColumn]}>{number(row.amount)} XAF</Text>
              <View style={styles.multiplierColumn}>
                {hasCashout ? <Text style={[styles.multiplierChip, row.target >= 3 ? styles.highChip : null]}>{`x${row.target.toFixed(2)}`}</Text> : <Text style={styles.dash}>-</Text>}
              </View>
              <Text numberOfLines={1} style={[styles.cell, styles.gainColumn, hasCashout && styles.gainText]}>{hasCashout ? `${number(row.payout)} XAF` : '-'}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 7, paddingHorizontal: 8, paddingBottom: 18, backgroundColor: '#100F30' },
  tabs: { height: 36, flexDirection: 'row', borderWidth: 1, borderColor: '#393662', borderRadius: 16, overflow: 'hidden', backgroundColor: '#211f4d' },
  tab: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  selectedTab: { backgroundColor: '#332e72' },
  tabText: { color: '#aaa8c6', fontSize: 11, fontWeight: '600' },
  selectedTabText: { color: '#fff' },
  summaryRow: { minHeight: 41, flexDirection: 'row', alignItems: 'center', gap: 5 },
  playerCount: { color: '#f1efff', fontSize: 11, fontWeight: '700' },
  total: { flex: 1, color: '#cfcee0', fontSize: 11 },
  previous: { minWidth: 105, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#45416f', alignItems: 'center' },
  previousText: { color: '#aaa8c5', fontSize: 9 },
  tableHeader: { height: 26, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5 },
  headerText: { color: '#908da9', fontSize: 9 },
  userColumn: { width: '25%' },
  betColumn: { width: '31%', textAlign: 'center' },
  multiplierColumn: { width: '18%', alignItems: 'center' },
  gainColumn: { width: '26%', textAlign: 'right' },
  rows: { maxHeight: 530 },
  row: { minHeight: 39, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, marginBottom: 4, borderRadius: 6, backgroundColor: '#211e51' },
  rowHighlight: { backgroundColor: '#332e78' },
  cell: { color: '#eeedf9', fontSize: 10, fontVariant: ['tabular-nums'] },
  multiplierChip: { color: '#d7d5f4', backgroundColor: '#514caa', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, fontSize: 9, fontWeight: '700' },
  highChip: { color: '#a2f1c2', backgroundColor: '#217b5a' },
  dash: { color: '#aaa8c5', fontSize: 12 },
  gainText: { color: '#80e5ad', fontWeight: '700' },
  empty: { paddingVertical: 22, textAlign: 'center', color: '#a19ebd', fontSize: 12 },
});
