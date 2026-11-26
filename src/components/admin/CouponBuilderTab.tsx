import { CircularFlag } from '@/components/CircularFlag';
import { TeamLogo } from '@/components/TeamLogo';
import { COLORS } from '@/constants/theme';
import { getThemeAccentColor } from '@/constants/themeBranding';
import { FIFA_CATALOG_CATEGORIES } from '@/constants/teamLogos';
import DateTimePickerModal from '@/components/DateTimePickerModal';
import { BetOption, useAdminStore } from '@/store/useAdminStore';
import { useBetStore } from '@/store/useBetStore';
import { formatOdd } from '@/utils/format';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const BET_OPTIONS: BetOption[] = [
  'V1', 'Nul', 'V2',
  'DC 1X', 'DC 12', 'DC X2',
  'V1 — Plus de 0.5', 'V2 — Plus de 0.5',
  'Plus de 0.5', 'Plus 1.5', 'Plus 2.5', 'Plus 3.5',
  'Total 2 (0.5) Plus',
  'Moins de 0.5', 'Moins 1.5', 'Moins 2.5', 'Moins 3.5',
  'Plus de 1.5 corner', 'Moins de 1.5 corner',
  'Plus de 2.5 corners', 'Moins de 2.5 corners',
  'Corners V1', 'Corners V2',
  'N’importe quelle équipe gagne',
  'Cartons — Plus de 3.5', 'Cartons — Moins de 3.5',
  'Cartons V1', 'Cartons V2',
  'Cartons rouges — Plus de 0.5', 'Cartons rouges — Moins de 0.5',
  'Cartons rouges V1', 'Cartons rouges V2',
  'Les deux marquent Oui', 'Les deux marquent Non',
  '1X2 + Chaque équipe va marquer — V1 et Oui',
  '1X2 + Chaque équipe va marquer — V2 et Oui',
  'Score exact', 'HT V1', 'HT Nul', 'HT V2', 'Handicap -1.5',
];
const POKER_BET_OPTIONS: BetOption[] = [
  'Carte haute', 'Une paire', 'Deux paires', 'Brelan', 'Quinte', 'Couleur', 'Full House', 'Carré', 'Quinte flush', 'Quinte flush royale',
  'Main 1', 'Main 2', 'Main 3', 'Main 4', 'Main 5', 'Main 6',
];

const BET_COLORS: Record<BetOption, string> = {
  V1: COLORS.primaryBlue,
  Nul: '#F5A623',
  V2: '#E74C3C',
  'DC 1X': '#3498DB',
  'DC 12': '#2ECC71',
  'DC X2': '#9B59B6',
  'V1 — Plus de 0.5': '#15803D',
  'V2 — Plus de 0.5': '#B91C1C',
  'Plus de 0.5': '#20A464',
  'Plus 1.5': '#27AE60',
  'Plus 2.5': '#2ECC71',
  'Plus 3.5': '#1ABC9C',
  'Total 2 (0.5) Plus': '#2563EB',
  'Moins de 0.5': '#D97706',
  'Moins 1.5': '#E67E22',
  'Moins 2.5': '#F39C12',
  'Moins 3.5': '#E74C3C',
  'Plus de 1.5 corner': '#0891B2',
  'Moins de 1.5 corner': '#0E7490',
  'Plus de 2.5 corners': '#06B6D4',
  'Moins de 2.5 corners': '#155E75',
  'Plus de 2.5 corner': '#0EA5E9',
  'Moins de 2.5 corner': '#075985',
  'N’importe quelle équipe gagne': '#7C3AED',
  'Cartons — Plus de 3.5': '#CA8A04',
  'Cartons — Moins de 3.5': '#A16207',
  'Corners V1': '#0369A1',
  'Corners V2': '#7C2D12',
  'Cartons V1': '#B45309',
  'Cartons V2': '#991B1B',
  'Cartons rouges — Plus de 0.5': '#DC2626',
  'Cartons rouges — Moins de 0.5': '#9CA3AF',
  'Cartons rouges V1': '#B91C1C',
  'Cartons rouges V2': '#7F1D1D',
  'Les deux marquent Oui': '#16A085',
  'Les deux marquent Non': '#C0392B',
  '1X2 + Chaque équipe va marquer — V1 et Oui': '#0F766E',
  '1X2 + Chaque équipe va marquer — V2 et Oui': '#9F1239',
  'Score exact': '#8E44AD',
  'HT V1': '#2980B9',
  'HT Nul': '#F5A623',
  'HT V2': '#C0392B',
  'Handicap -1.5': '#34495E',
  'Carte haute': '#64748B', 'Une paire': '#2563EB', 'Deux paires': '#16A085', 'Brelan': '#15803D', 'Quinte': '#DC2626',
  'Couleur': '#0F766E', 'Full House': '#7C3AED', 'Carré': '#B45309', 'Quinte flush': '#9F1239', 'Quinte flush royale': '#7F1D1D',
  'Main 1': '#176B87', 'Main 2': '#176B87', 'Main 3': '#176B87', 'Main 4': '#176B87', 'Main 5': '#176B87', 'Main 6': '#176B87',
};

export default function CouponBuilderTab({ onPublish }: { onPublish: () => void }) {
  const store = useAdminStore();
  const theme = useBetStore((state) => state.theme);
  const activeColor = getThemeAccentColor(theme);
  const activeBgColor = theme === 'red_mega' ? '#FFF5F5'
    : theme === 'light_green' ? '#F2F9E6'
      : theme === 'green' ? '#E6F2EF'
        : theme === 'royal_blue' ? '#E8EAFA'
          : theme === 'gold' ? '#FEF8EC' : '#EBF3FC';
  const { selectedMatches, stake, couponType, customBetOptions, mortalKombatBetOptions } = store;
  const totalOdds = store.totalOdds();
  const potentialGain = store.potentialGain();

  const [stakeText, setStakeText] = React.useState(String(stake));
  const [oddDrafts, setOddDrafts] = React.useState<Record<string, string>>({});
  const [datePickerVisible, setDatePickerVisible] = React.useState(false);
  const [customOptionText, setCustomOptionText] = React.useState('');
  React.useEffect(() => {
    void AsyncStorage.getItem('onexbet:mortal-kombat-bet-options:v1').then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) saved.forEach((label) => store.addMortalKombatBetOption(String(label)));
      } catch { /* valeurs locales invalides : les valeurs par défaut restent actives */ }
    });
  }, []);

  const addCustomOption = () => {
    const normalized = customOptionText.trim().replace(/\s+/g, ' ');
    if (!normalized) return;
    if (store.addCustomBetOption(normalized)) setCustomOptionText('');
  };
  const addMortalOption = () => {
    const normalized = customOptionText.trim().replace(/\s+/g, ' ');
    if (!normalized || !store.addMortalKombatBetOption(normalized)) return;
    setCustomOptionText('');
    const nextOptions = useAdminStore.getState().mortalKombatBetOptions;
    void AsyncStorage.setItem('onexbet:mortal-kombat-bet-options:v1', JSON.stringify(nextOptions));
  };
  const hasMortalKombatMatch = selectedMatches.some((m) => m.sport === 'mortal-kombat' || /mortal\s+(kombat|combat)/i.test(m.league));

  const formatCurrency = (val: number) => {
    if (val % 1 !== 0) {
      return val.toFixed(2);
    }
    return val.toString();
  };

  if (selectedMatches.length === 0) {
    return (
      <View style={s.empty}>
        <FontAwesome name="ticket" size={48} color="#D0DDE8" />
        <Text style={s.emptyTitle}>Aucun match sélectionné</Text>
        <Text style={s.emptySubtitle}>Allez dans &quot;Recherche&quot; ou &quot;Créer Match&quot; et ajoutez des matchs à votre coupon.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Coupon header summary */}
      <View style={s.summaryCard}>
        <View style={s.summaryRow}>
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Matchs</Text>
            <Text style={s.summaryValue}>{selectedMatches.length}</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Cotes totales</Text>
            <Text style={[s.summaryValue, { color: activeColor }]}>{formatOdd(totalOdds)}</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Gain potentiel</Text>
            <Text style={[s.summaryValue, { color: COLORS.successGreen }]}>
              {formatCurrency(potentialGain)} ₣
            </Text>
          </View>
        </View>

        {/* Type + Mise */}
        <View style={s.controlRow}>
          <View style={s.typeRow}>
            {(['Combiné', 'Simple'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.typeBtn, { backgroundColor: activeBgColor }, couponType === t && { backgroundColor: activeColor }]}
                onPress={() => store.setCouponType(t)}
              >
                <Text style={[s.typeBtnText, couponType === t && s.typeBtnTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.stakeRow}>
            <Text style={s.stakeLabel}>Mise (₣)</Text>
            <TextInput
              style={s.stakeInput}
              value={stakeText}
              onChangeText={(v) => {
                const cleanValue = v.replace(',', '.');
                if (cleanValue === '' || /^\d*\.?\d*$/.test(cleanValue)) {
                  setStakeText(v);
                  const parsed = parseFloat(cleanValue);
                  if (!isNaN(parsed)) {
                    store.setStake(parsed);
                  } else {
                    store.setStake(0);
                  }
                }
              }}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Statut du coupon */}
        <View style={[s.controlRow, { marginTop: 10, borderTopWidth: 0, paddingTop: 0 }]}>
          <Text style={s.stakeLabel}>Statut du coupon</Text>
          <View style={s.typeRow}>
            {(['Accepté', 'Payé'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  s.typeBtn,
                  store.couponStatus === status && (
                    status === 'Accepté' ? { backgroundColor: COLORS.primaryBlue } : { backgroundColor: COLORS.successGreen }
                  )
                ]}
                onPress={() => store.setCouponStatus(status)}
              >
                <Text style={[s.typeBtnText, store.couponStatus === status && { color: '#FFF' }]}>{status}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date et heure uniques du coupon */}
        <TouchableOpacity style={s.dateControlRow} onPress={() => setDatePickerVisible(true)} activeOpacity={0.8}>
          <View style={s.dateLabelWrapper}>
            <FontAwesome name="calendar" size={13} color="#758C9E" />
            <Text style={s.dateLabelText}>Date et heure du coupon</Text>
          </View>
          <View style={s.dateInputWrapper}>
            <Text style={[s.dateInput, { color: store.couponDate ? COLORS.darkBlue : '#9EAEC1' }]} numberOfLines={1}>
              {store.couponDate || 'Choisir dans le calendrier'}
            </Text>
            <View style={[s.nowBtn, { backgroundColor: activeBgColor }]}><Text style={[s.nowBtnText, { color: activeColor }]}>Modifier</Text></View>
          </View>
        </TouchableOpacity>
        <DateTimePickerModal
          visible={datePickerVisible}
          onClose={() => setDatePickerVisible(false)}
          onConfirm={(date) => store.setCouponDate(`${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} (${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')})`)}
        />
        {selectedMatches.some((m) => m.sport === 'poker' || /^(?:LTAR|TvBet)\s+Poker$/i.test(m.league.trim())) && (
          <View style={s.pokerDurationNotice}>
            <FontAwesome name="clock-o" size={13} color="#176B87" />
            <View style={{ flex: 1 }}>
              <Text style={s.pokerDurationText}>Durée de la manche Poker après l’heure programmée</Text>
              <View style={s.pokerDurationInputRow}>
                <TextInput
                  style={s.pokerDurationInput}
                  value={String(store.pokerDurationMinutes)}
                  onChangeText={(value) => {
                    const parsed = Number(value.replace(/[^0-9]/g, ''));
                    if (value === '') store.setPokerDurationMinutes(1);
                    else if (Number.isFinite(parsed)) store.setPokerDurationMinutes(Math.max(1, Math.min(60, parsed)));
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={s.pokerDurationUnit}>minute(s), de 1 à 60</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Match list */}
      <FlatList
        data={selectedMatches}
        keyExtractor={(m) => String(m.fixtureId)}
        contentContainerStyle={{ padding: 12, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: m }) => (
          <View style={s.matchCard}>
            {(() => {
              const isMortalKombat = m.sport === 'mortal-kombat' || /mortal\s+(kombat|combat)/i.test(m.league);
              const isPoker = m.sport === 'poker' || /^(?:LTAR|TvBet)\s+Poker$/i.test(m.league.trim());
              return isMortalKombat ? <Text style={s.mortalMarketLabel}>Options Mortal Kombat</Text> : isPoker ? <Text style={s.pokerMarketLabel}>Options TvBet Poker</Text> : null;
            })()}
            {/* Header : Poker ne réutilise ni équipes, ni joueurs, ni logos de football. */}
            <View style={s.matchHeader}>
              {(m.sport === 'poker' || /^(?:LTAR|TvBet)\s+Poker$/i.test(m.league.trim())) ? (
                <>
                  <Image source={require('../../../assets/images/poker-controller-icon.png')} style={s.pokerBuilderIcon} resizeMode="contain" />
                  <View style={s.matchInfo}>
                    <Text style={s.matchTitle} numberOfLines={1}>TvBet. POKER</Text>
                    <Text style={s.matchLeague} numberOfLines={1}>{m.league}</Text>
                  </View>
                </>
              ) : (
                <>
                  {(() => {
                    const fifa = FIFA_CATALOG_CATEGORIES.find((cat) => m.league === cat.title);
                    return fifa ? (
                      <View style={[s.fifaBadge, { backgroundColor: activeBgColor }]}>
                        <FontAwesome name={fifa.icon as any} size={12} color={activeColor} />
                        <Text style={[s.fifaBadgeText, { color: activeColor }]}>FIFA</Text>
                      </View>
                    ) : null;
                  })()}
                  {String(m.sport || 'football').trim().toLowerCase() === 'football'
                    ? <TeamLogo uri={m.homeLogo} size={28} accessibilityLabel={`Écusson ${m.homeTeam}`} />
                    : <CircularFlag countryCode={m.homeLogo} size={28} teamName={m.homeTeam} />}
                  <View style={s.matchInfo}>
                    <Text style={s.matchTitle} numberOfLines={1}>{m.homeTeam} vs {m.awayTeam}</Text>
                    <Text style={s.matchLeague} numberOfLines={1}>{m.league}</Text>
                  </View>
                  {String(m.sport || 'football').trim().toLowerCase() === 'football'
                    ? <TeamLogo uri={m.awayLogo} size={28} accessibilityLabel={`Écusson ${m.awayTeam}`} />
                    : <CircularFlag countryCode={m.awayLogo} size={28} teamName={m.awayTeam} />}
                </>
              )}
              <TouchableOpacity onPress={() => store.removeMatch(m.fixtureId)} style={s.removeBtn}>
                <FontAwesome name="trash" size={14} color={COLORS.dangerRed} />
              </TouchableOpacity>
            </View>

            {/* Sélection FIFA au moment de valider le coupon */}
            {(m.sport !== 'poker' && !/^(?:LTAR|TvBet)\s+Poker$/i.test(m.league.trim())) && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fifaSelector}>
              {FIFA_CATALOG_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.fifaOption, { borderColor: m.league === cat.title ? activeColor : '#DFE7F0', backgroundColor: m.league === cat.title ? activeColor : activeBgColor }]}
                  onPress={() => store.updateMatchLeague(m.fixtureId, cat.title)}
                  activeOpacity={0.8}
                >
                  <FontAwesome name={cat.icon as any} size={11} color={m.league === cat.title ? '#FFF' : activeColor} />
                  <Text numberOfLines={1} style={[s.fifaOptionText, { color: activeColor }, m.league === cat.title && s.fifaOptionTextActive]}>{cat.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>}

            {/* Bet option selector — toutes les options de paris */}
            <View style={s.betRow}>
              <Text style={s.betLabel}>Pronostic :</Text>
              <View style={s.customOptionRow}>
                <TextInput
                  style={s.customOptionInput}
                  value={customOptionText}
                  onChangeText={setCustomOptionText}
                  onSubmitEditing={hasMortalKombatMatch ? addMortalOption : addCustomOption}
                  placeholder={hasMortalKombatMatch ? 'Ajouter une option Mortal Kombat' : 'Créer votre propre option'}
                  placeholderTextColor="#9EAEC1"
                  maxLength={60}
                  returnKeyType="done"
                />
                <TouchableOpacity style={s.customOptionAddBtn} onPress={hasMortalKombatMatch ? addMortalOption : addCustomOption} activeOpacity={0.8}>
                  <FontAwesome name="plus" size={12} color="#FFF" />
                  <Text style={s.customOptionAddText}>Ajouter</Text>
                </TouchableOpacity>
              </View>
              <View style={s.betGrid}>
                {(m.sport === 'poker' || /^(?:LTAR|TvBet)\s+Poker$/i.test(m.league.trim())) && POKER_BET_OPTIONS.map((opt) => {
                  const isActive = m.betOption === opt;
                  return (
                    <TouchableOpacity key={`poker-${opt}`} style={[s.betGridBtn, s.pokerOptionBtn, { backgroundColor: isActive ? '#176B87' : '#EDF9FC', borderColor: isActive ? '#176B87' : '#B9DDE7' }]} onPress={() => store.updateMatchBetOption(m.fixtureId, opt)} activeOpacity={0.7}>
                      <Text numberOfLines={2} style={[s.betGridBtnText, { color: isActive ? '#FFF' : '#176B87', fontSize: opt.length > 14 ? 10 : 12 }]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
                {(m.sport !== 'mortal-kombat' && m.sport !== 'poker' && !/mortal\s+(kombat|combat)/i.test(m.league) && !/^(?:LTAR|TvBet)\s+Poker$/i.test(m.league.trim())) && BET_OPTIONS.map((opt) => {
                  const isActive = m.betOption === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        s.betGridBtn,
                        {
                          backgroundColor: isActive ? BET_COLORS[opt] : '#F4F6F9',
                          borderColor: isActive ? BET_COLORS[opt] : '#DFE7F0',
                        },
                      ]}
                      onPress={() => store.updateMatchBetOption(m.fixtureId, opt)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          s.betGridBtnText,
                          {
                            color: isActive ? '#FFF' : '#758C9E',
                            fontSize: opt.length > 16 ? 10 : 12,
                          },
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {(m.sport !== 'mortal-kombat' && m.sport !== 'poker' && !/mortal\s+(kombat|combat)/i.test(m.league) && !/^(?:LTAR|TvBet)\s+Poker$/i.test(m.league.trim())) && customBetOptions.map((opt) => {
                  const customOption = opt as BetOption;
                  const isActive = m.betOption === customOption && m.customBetOption === true;
                  return (
                    <TouchableOpacity
                      key={`custom-${opt}`}
                      style={[s.betGridBtn, s.customOptionBtn, { backgroundColor: isActive ? '#6D28D9' : '#F5F3FF', borderColor: isActive ? '#6D28D9' : '#C4B5FD' }]}
                      onPress={() => store.updateMatchBetOption(m.fixtureId, customOption, true)}
                      activeOpacity={0.7}
                    >
                      <Text numberOfLines={2} style={[s.betGridBtnText, { color: isActive ? '#FFF' : '#6D28D9', fontSize: opt.length > 16 ? 10 : 12 }]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
                {(m.sport === 'mortal-kombat' || /mortal\s+(kombat|combat)/i.test(m.league)) && mortalKombatBetOptions.map((opt) => {
                  const customOption = opt as BetOption;
                  const isActive = m.betOption === customOption && m.customBetOption === true;
                  return (
                    <TouchableOpacity
                      key={`mortal-${opt}`}
                      style={[s.betGridBtn, s.mortalOptionBtn, { backgroundColor: isActive ? '#B7791F' : '#FFF8E7', borderColor: isActive ? '#B7791F' : '#E5C477' }]}
                      onPress={() => store.updateMatchBetOption(m.fixtureId, customOption, true)}
                      activeOpacity={0.7}
                    >
                      <Text numberOfLines={2} style={[s.betGridBtnText, { color: isActive ? '#FFF' : '#8A5A08', fontSize: opt.length > 16 ? 10 : 12 }]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Odd and Score input in a single row */}
            <View style={s.editRow}>
              <View style={s.inputWrapper}>
                <Text style={s.inlineLabel}>Cote :</Text>
                <TextInput
                  style={s.smallInput}
                  value={oddDrafts[String(m.fixtureId)] ?? String(m.odd).replace('.', ',')}
                  onChangeText={(v) => {
                    setOddDrafts((current) => ({ ...current, [String(m.fixtureId)]: v }));
                    const cleanValue = v.replace(',', '.');
                    if (/^\d*(\.\d*)?$/.test(cleanValue)) {
                      const n = parseFloat(cleanValue);
                      if (!isNaN(n) && n > 0) store.updateMatchOdd(m.fixtureId, n);
                    }
                  }}
                  onBlur={() => {
                    const current = oddDrafts[String(m.fixtureId)];
                    if (current !== undefined) {
                      const n = parseFloat(current.replace(',', '.'));
                      if (!isNaN(n) && n > 0) {
                        store.updateMatchOdd(m.fixtureId, n);
                        setOddDrafts((drafts) => ({ ...drafts, [String(m.fixtureId)]: current.replace('.', ',') }));
                      }
                    }
                  }}
                  keyboardType="decimal-pad"
                />
              </View>

              {m.betOption === 'Score exact' && (
                <View style={s.inputWrapper}>
                  <Text style={s.inlineLabel}>Score Exact :</Text>
                  <TextInput
                    style={s.smallInput}
                    value={m.score || '0 - 0'}
                    onChangeText={(v) => store.updateMatchScore(m.fixtureId, v)}
                    placeholder="0 - 0"
                    placeholderTextColor="#9EAEC1"
                  />
                </View>
              )}
            </View>
          </View>
        )}
      />

      {/* Publish button */}
      <View style={s.publishBar}>
        <TouchableOpacity style={s.publishBtn} onPress={onPublish} activeOpacity={0.85}>
          <FontAwesome name="check-circle" size={16} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={s.publishBtnText}>Valider le coupon ({selectedMatches.length} matchs)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.darkBlue, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 13.5, color: '#9EAEC1', textAlign: 'center', lineHeight: 20 },
  summaryCard: { backgroundColor: '#FFF', margin: 12, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E8EFF6' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: '#9EAEC1', fontWeight: '600', marginBottom: 4 },
  summaryValue: { fontSize: 17, fontWeight: '800', color: COLORS.darkBlue },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EBF2FC', paddingTop: 10 },
  typeRow: { flexDirection: 'row', gap: 6 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#EBF2FC' },
  typeBtnText: { fontSize: 12, fontWeight: '600', color: '#758C9E' },
  typeBtnTextActive: { color: '#FFF' },
  stakeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stakeLabel: { fontSize: 12, fontWeight: '600', color: '#758C9E' },
  stakeInput: { backgroundColor: '#F4F6F9', borderRadius: 6, borderWidth: 1, borderColor: '#DFE7F0', paddingHorizontal: 10, paddingVertical: 5, fontSize: 14, fontWeight: '700', color: COLORS.darkBlue, width: 90 },
  pokerDurationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EDF9FC',
    borderWidth: 1,
    borderColor: '#B9DDE7',
  },
  pokerDurationText: {
    flex: 1,
    color: '#176B87',
    fontSize: 11.5,
    fontWeight: '700',
  },
  pokerDurationInputRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 },
  pokerDurationInput: { width: 58, height: 34, borderRadius: 7, borderWidth: 1, borderColor: '#8FC6D5', backgroundColor: '#FFFFFF', color: '#176B87', fontSize: 14, fontWeight: '800', textAlign: 'center', paddingHorizontal: 6 },
  pokerDurationUnit: { color: '#176B87', fontSize: 11, fontWeight: '600' },
  dateControlRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EBF2FC' },
  dateLabelWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  dateLabelText: { fontSize: 12, fontWeight: '600', color: '#758C9E' },
  dateInputWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateInput: { flex: 1, backgroundColor: '#F4F6F9', borderRadius: 6, borderWidth: 1, borderColor: '#DFE7F0', paddingHorizontal: 10, paddingVertical: 6, fontSize: 13.5, fontWeight: '700', color: COLORS.darkBlue },
  nowBtn: { backgroundColor: '#EBF2FC', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  nowBtnText: { fontSize: 11, fontWeight: '700' },
  matchCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E8EFF6' },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pokerBuilderIcon: { width: 36, height: 36 },
  fifaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 5, borderRadius: 8, backgroundColor: '#EAF3FF' },
  fifaBadgeText: { fontSize: 9, fontWeight: '800' },
  fifaSelector: { gap: 6, paddingTop: 8, paddingBottom: 2 },
  fifaOption: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 220, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F4F7FB', borderWidth: 1, borderColor: '#DFE7F0' },
  fifaOptionText: { maxWidth: 185, fontSize: 9.5, fontWeight: '600' },
  fifaOptionTextActive: { color: '#FFF', fontWeight: '700' },
  matchInfo: { flex: 1, marginHorizontal: 8 },
  matchTitle: { fontSize: 13, fontWeight: '700', color: COLORS.darkBlue },
  matchLeague: { fontSize: 11, color: '#9EAEC1', marginTop: 2 },
  removeBtn: { padding: 6 },
  betRow: { flexDirection: 'column', alignItems: 'stretch', gap: 8, marginBottom: 10 },
  betLabel: { fontSize: 12, fontWeight: '600', color: '#758C9E', paddingTop: 2 },
  betGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  betGridBtn: { width: '30%', paddingVertical: 7, borderRadius: 6, backgroundColor: '#F4F6F9', borderWidth: 1, borderColor: '#DFE7F0', alignItems: 'center', paddingHorizontal: 4 },
  betGridBtnText: { fontSize: 12, fontWeight: '700', color: '#758C9E', textAlign: 'center', lineHeight: 15 },
  customOptionRow: { flexDirection: 'row', gap: 8 },
  customOptionInput: { flex: 1, minHeight: 40, borderWidth: 1, borderColor: '#D8E2EC', borderRadius: 8, paddingHorizontal: 10, color: COLORS.darkBlue, backgroundColor: '#FAFCFE', fontSize: 12 },
  customOptionAddBtn: { minHeight: 40, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#6D28D9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  customOptionAddText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  customOptionBtn: { backgroundColor: '#F5F3FF' },
  mortalOptionBtn: { minWidth: 120 },
  mortalMarketLabel: { color: '#8A5A08', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  pokerOptionBtn: { minWidth: 112 },
  pokerMarketLabel: { color: '#176B87', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  betBtn: { flex: 1, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F4F6F9', borderWidth: 1, borderColor: '#DFE7F0', alignItems: 'center' },
  betBtnText: { fontSize: 12, fontWeight: '700', color: '#758C9E' },
  editRow: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#F4F6F9', paddingTop: 8 },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineLabel: { fontSize: 11.5, fontWeight: '600', color: '#758C9E' },
  smallInput: { flex: 1, backgroundColor: '#F4F6F9', borderRadius: 6, borderWidth: 1, borderColor: '#DFE7F0', paddingHorizontal: 8, paddingVertical: 4, fontSize: 12.5, fontWeight: '700', color: COLORS.darkBlue },
  publishBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E8EFF6' },
  publishBtn: { backgroundColor: COLORS.successGreen, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14 },
  publishBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
