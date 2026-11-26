import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { CachedSvgLogo } from '@/components/CachedSvgLogo';
import { TeamLogo } from '@/components/TeamLogo';
import { AT } from '@/constants/adminTheme';
import {
  buildInternalFixtureGroups,
  buildInternalFixturePairs,
  InternalFixtureGroup,
  InternalFixturePair,
  loadClubLeagueRecords,
  searchInternalFixtureGroups,
  searchInternalFixturePairs,
} from '@/constants/internalFixtureCatalog';

interface InternalFixturePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectFixture: (fixture: InternalFixturePair) => void;
}

function FixtureTeamBadge({ name, logoUrl }: { name: string; logoUrl: string }) {
  if (/\.svg(?:[?#]|$)/i.test(logoUrl)) {
    return <CachedSvgLogo uri={logoUrl} width={30} height={30} />;
  }
  return <TeamLogo uri={logoUrl} size={30} accessibilityLabel={`Écusson ${name}`} />;
}

export function InternalFixturePickerModal({ visible, onClose, onSelectFixture }: InternalFixturePickerModalProps) {
  const [groups, setGroups] = useState<InternalFixtureGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<InternalFixtureGroup | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    setActiveGroup(null);
    setQuery('');
    setLoading(true);
    setLoadError(false);
    void loadClubLeagueRecords()
      .then((records) => {
        if (active) setGroups(buildInternalFixtureGroups(records));
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [visible]);

  const visibleGroups = useMemo(() => searchInternalFixtureGroups(groups, query), [groups, query]);
  const visiblePairs = useMemo(() => {
    if (!activeGroup) return [];
    return searchInternalFixturePairs(buildInternalFixturePairs(activeGroup), query);
  }, [activeGroup, query]);

  const selectFixture = (fixture: InternalFixturePair) => {
    onSelectFixture(fixture);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          {activeGroup ? (
            <TouchableOpacity style={styles.backButton} onPress={() => setActiveGroup(null)} accessibilityLabel="Retour aux championnats">
              <Ionicons name="arrow-back" size={21} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.backButton} onPress={onClose} accessibilityLabel="Fermer">
              <Ionicons name="close" size={21} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>{activeGroup?.league || 'Affiches par championnat'}</Text>
            {activeGroup ? <Text style={styles.subtitle}>{activeGroup.country}</Text> : null}
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={17} color={AT.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={activeGroup ? 'Rechercher une équipe' : 'Rechercher un club ou championnat'}
            placeholderTextColor={AT.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
          />
          {query ? <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color={AT.textMuted} /></TouchableOpacity> : null}
        </View>

        {loading ? (
          <View style={styles.state}><ActivityIndicator color={AT.accent} /></View>
        ) : loadError ? (
          <View style={styles.state}><Text style={styles.emptyText}>Catalogue indisponible.</Text></View>
        ) : activeGroup ? (
          <FlatList
            data={visiblePairs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={6}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pairCard} onPress={() => selectFixture(item)} activeOpacity={0.8}>
                <View style={styles.pairTeams}>
                  <View style={styles.teamSide}>
                    <FixtureTeamBadge name={item.homeTeam.name} logoUrl={item.homeTeam.logoUrl} />
                    <Text style={styles.teamName} numberOfLines={2}>{item.homeTeam.name}</Text>
                  </View>
                  <Text style={styles.vs}>VS</Text>
                  <View style={styles.teamSide}>
                    <FixtureTeamBadge name={item.awayTeam.name} logoUrl={item.awayTeam.logoUrl} />
                    <Text style={styles.teamName} numberOfLines={2}>{item.awayTeam.name}</Text>
                  </View>
                </View>
                <Text style={styles.pairLeague} numberOfLines={1}>{item.league}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucune affiche disponible.</Text>}
          />
        ) : (
          <FlatList
            data={visibleGroups}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={14}
            maxToRenderPerBatch={14}
            windowSize={6}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.groupRow} onPress={() => setActiveGroup(item)} activeOpacity={0.8}>
                <View style={styles.groupIcon}><FontAwesome5 name="trophy" size={14} color={AT.gold} /></View>
                <View style={styles.groupText}>
                  <Text style={styles.groupLeague} numberOfLines={1}>{item.league}</Text>
                  <Text style={styles.groupCountry} numberOfLines={1}>{item.country}</Text>
                </View>
                <Text style={styles.groupCount}>{item.pairCount}</Text>
                <Ionicons name="chevron-forward" size={18} color={AT.textMuted} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucun championnat trouvé.</Text>}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AT.contentBg },
  header: { minHeight: 74, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 18, paddingBottom: 10, gap: 12, backgroundColor: '#0A1932' },
  backButton: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.09)' },
  headerText: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  subtitle: { color: '#A8B6C8', fontSize: 11, marginTop: 2 },
  searchWrap: { height: 43, margin: 12, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, borderColor: AT.border, backgroundColor: AT.cardBg },
  searchInput: { flex: 1, color: AT.textPrimary, fontSize: 13 },
  list: { paddingHorizontal: 12, paddingBottom: 30, gap: 8 },
  groupRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, gap: 10, borderRadius: 11, borderWidth: 1, borderColor: AT.border, backgroundColor: AT.cardBg },
  groupIcon: { width: 33, height: 33, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: AT.accentL },
  groupText: { flex: 1 },
  groupLeague: { color: AT.textPrimary, fontSize: 12.5, fontWeight: '700' },
  groupCountry: { color: AT.textMuted, fontSize: 10.5, marginTop: 3 },
  groupCount: { minWidth: 29, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 12, textAlign: 'center', color: AT.textSecondary, backgroundColor: AT.cardBg2, fontSize: 10.5, fontWeight: '700' },
  pairCard: { padding: 11, borderRadius: 11, borderWidth: 1, borderColor: AT.border, backgroundColor: AT.cardBg },
  pairTeams: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamSide: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  teamName: { minHeight: 28, color: AT.textPrimary, fontSize: 10.5, fontWeight: '700', textAlign: 'center' },
  vs: { color: AT.accent, fontSize: 10, fontWeight: '900' },
  pairLeague: { marginTop: 6, color: AT.textMuted, fontSize: 9.5, textAlign: 'center' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { padding: 24, color: AT.textMuted, fontSize: 12, textAlign: 'center' },
});
