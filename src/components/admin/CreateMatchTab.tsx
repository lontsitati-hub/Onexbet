import { CircularFlag } from '@/components/CircularFlag';
import { LogoPickerModal } from '@/components/admin/LogoPickerModal';
import { InternalFixturePickerModal } from '@/components/admin/InternalFixturePickerModal';
import { InternalFixturePair } from '@/constants/internalFixtureCatalog';
import { MortalKombatFighter, MortalKombatPickerModal } from '@/components/admin/MortalKombatPickerModal';
import { AT } from '@/constants/adminTheme';
import { FIFA_CATALOG_CATEGORIES, RECOGNIZED_CHAMPIONSHIPS } from '@/constants/teamLogos';
import DateTimePickerModal from '@/components/DateTimePickerModal';
import { useAdminStore, AdminMatch } from '@/store/useAdminStore';
import { normalizeScorePeriods } from '@/utils/scorePeriods';
import { isValidImageUrl } from '@/utils/logoResolver';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { insertMache } from '@/services/db';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

interface Props {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}
interface FootballTeam { name: string; logo: string; }

const MORTAL_KOMBAT_CHAMPIONSHIPS = [
  'Mortal Kombat 1',
  'Mortal Kombat 2',
  'Mortal Kombat 4',
  'Mortal Kombat 5',
  'Mortal Kombat 6',
  'Mortal Kombat 7',
  'Mortal Kombat 8',
  'Mortal Kombat 9',
  'Mortal Kombat 10',
  'Mortal Kombat 11',
];

function generateDrawAndAwayOdds() {
  const randomCents = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));
  const v2Cents = randomCents(200, 699);
  const xCents = randomCents(v2Cents + 1, 700);
  return { oddV2: v2Cents / 100, oddNul: xCents / 100 };
}

const SectionHeader = ({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) => (
  <View style={s.sectionHeader}>
    <View style={s.sectionIconBg}>
      <FontAwesome5 name={icon} size={13} color={AT.accent} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  </View>
);

// ── Petit champ de cote réutilisable ──
function OddsField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.col}>
      <Text style={s.oddsLabel}>{label}</Text>
      <TextInput
        style={s.compactInput}
        value={value}
        onChangeText={onChange}
        placeholder="1.00"
        keyboardType="numeric"
        placeholderTextColor={AT.textMuted}
      />
    </View>
  );
}

export default function CreateMatchTab({ onSuccess, onError }: Props) {
  const store = useAdminStore();

  // Mode state : le bouton FIFA ouvre le même catalogue de création.
  // La valeur interne catalog est conservée pour préserver les flux existants.
  const [creationMode, setCreationMode] = useState<'catalog' | 'auto'>('catalog');
  const [fifaMode, setFifaMode] = useState(false);
  const [mortalKombatMode, setMortalKombatMode] = useState(false);
  const [pokerMode, setPokerMode] = useState(false);

  // Form Fields State
  const [tournament, setTournament] = useState('Coupe du monde 2026');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [homeLogo, setHomeLogo] = useState('');
  const [awayLogo, setAwayLogo] = useState('');
  const [exactScore, setExactScore] = useState('0 - 0');
  const [odd, setOdd] = useState('');
  const [scorePeriod1, setScorePeriod1] = useState('0 - 0');

  // ── Cotes de toutes les options de paris ──
  const [oddV1, setOddV1] = useState('');
  const [oddNul, setOddNul] = useState('');
  const [oddV2, setOddV2] = useState('');
  const [oddDc1x, setOddDc1x] = useState('');
  const [oddDc12, setOddDc12] = useState('');
  const [oddDcX2, setOddDcX2] = useState('');
  const [oddOver15, setOddOver15] = useState('');
  const [oddOver25, setOddOver25] = useState('');
  const [oddOver35, setOddOver35] = useState('');
  const [oddUnder15, setOddUnder15] = useState('');
  const [oddUnder25, setOddUnder25] = useState('');
  const [oddUnder35, setOddUnder35] = useState('');
  const [oddBttsYes, setOddBttsYes] = useState('');
  const [oddBttsNo, setOddBttsNo] = useState('');
  const [oddScoreExact, setOddScoreExact] = useState('');
  const [oddHtV1, setOddHtV1] = useState('');
  const [oddHtNul, setOddHtNul] = useState('');
  const [oddHtV2, setOddHtV2] = useState('');
  const [oddHandicap, setOddHandicap] = useState('');
  const [scorePeriod2, setScorePeriod2] = useState('0 - 0');
  const [dateTimePickerVisible, setDateTimePickerVisible] = useState(false);
  const [championshipPickerVisible, setChampionshipPickerVisible] = useState(false);
  const [championshipSearch, setChampionshipSearch] = useState('');
  const [selectedDateTime, setSelectedDateTime] = useState(() => new Date());
  const [matchDate, setMatchDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [matchTime, setMatchTime] = useState(() => new Date().toTimeString().split(' ')[0].substring(0, 5));
  const [fifaDurationMinutes, setFifaDurationMinutes] = useState('10');
  const [mortalKombatDurationMinutes, setMortalKombatDurationMinutes] = useState('3');
  const [customChampionshipName, setCustomChampionshipName] = useState('');
  const [customChampionshipType, setCustomChampionshipType] = useState<'football' | 'fifa' | 'mortal-kombat'>('football');
  const [customChampionships, setCustomChampionships] = useState<Array<{ name: string; type: 'football' | 'fifa' | 'mortal-kombat' }>>([]);

  useEffect(() => {
    void AsyncStorage.getItem('onexbet:custom-championships:v1').then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCustomChampionships(parsed.filter((item) => item?.name && (item.type === 'football' || item.type === 'fifa' || item.type === 'mortal-kombat')));
      } catch { /* stockage local invalide : on repart avec une liste vide */ }
    });
  }, []);

  const createCustomChampionship = async () => {
    const cleanName = customChampionshipName.trim().replace(/\s+/g, ' ');
    if (!cleanName) { onError('Saisissez le nom du championnat.'); return; }
    const storedName = customChampionshipType === 'fifa' && !cleanName.toUpperCase().startsWith('FIFA')
      ? `FIFA · ${cleanName}`
      : customChampionshipType === 'mortal-kombat' && !/mortal\s+(kombat|combat)/i.test(cleanName)
        ? `Mortal Kombat · ${cleanName}`
        : cleanName;
    const next = [...customChampionships.filter((item) => item.name.toLowerCase() !== storedName.toLowerCase()), { name: storedName, type: customChampionshipType }];
    setCustomChampionships(next);
    await AsyncStorage.setItem('onexbet:custom-championships:v1', JSON.stringify(next));
    setTournament(storedName);
    setFifaMode(customChampionshipType === 'fifa');
    setMortalKombatMode(customChampionshipType === 'mortal-kombat');
    setPokerMode(false);
    setCustomChampionshipName('');
    onSuccess(`Championnat ${customChampionshipType === 'fifa' ? 'FIFA' : customChampionshipType === 'mortal-kombat' ? 'Mortal Kombat' : 'Football'} créé : ${storedName}`);
  };

  const formatDateValue = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const formatTimeValue = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const handleDateTimeConfirm = (date: Date) => {
    setSelectedDateTime(date);
    setMatchDate(formatDateValue(date));
    setMatchTime(formatTimeValue(date));
  };
  const normalizeChampionshipSearch = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const allChampionships = [...RECOGNIZED_CHAMPIONSHIPS, ...MORTAL_KOMBAT_CHAMPIONSHIPS];
  const filteredChampionships = allChampionships.filter((name) =>
    normalizeChampionshipSearch(name).includes(normalizeChampionshipSearch(championshipSearch)),
  );

  // Logo picker modal state
  const [logoPickerVisible, setLogoPickerVisible] = useState(false);
  const [internalFixturePickerVisible, setInternalFixturePickerVisible] = useState(false);
  const [mortalPickerVisible, setMortalPickerVisible] = useState(false);
  const [activeTeamTarget, setActiveTeamTarget] = useState<'home' | 'away'>('home');

  // Auto Search autocomplete state
  const [homeSearchResults, setHomeSearchResults] = useState<FootballTeam[]>([]);
  const [awaySearchResults, setAwaySearchResults] = useState<FootballTeam[]>([]);
  const [searchingHome, setSearchingHome] = useState(false);
  const [searchingAway, setSearchingAway] = useState(false);

  const espnSearchTeams = async (query: string): Promise<FootballTeam[]> => {
    try {
      const res = await fetch(
        `https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(query)}&limit=15`,
        { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const items: FootballTeam[] = [];
      const cat = data.results?.find((r: any) => r.type === 'team');
      if (cat?.contents) {
        for (const item of cat.contents) {
          if (item.sport === 'soccer' && item.displayName && item.image?.default) {
            items.push({ name: item.displayName, logo: item.image.default });
          }
        }
      }
      if (items.length > 0) return items.slice(0, 8);
    } catch { /* fallback */ }
    return [];
  };

  const searchHomeTeam = async (text: string) => {
    setHomeTeam(text);
    if (creationMode === 'auto' && text.trim().length >= 3) {
      setSearchingHome(true);
      setHomeSearchResults(await espnSearchTeams(text.trim()));
      setSearchingHome(false);
    } else setHomeSearchResults([]);
  };

  const searchAwayTeam = async (text: string) => {
    setAwayTeam(text);
    if (creationMode === 'auto' && text.trim().length >= 3) {
      setSearchingAway(true);
      setAwaySearchResults(await espnSearchTeams(text.trim()));
      setSearchingAway(false);
    } else setAwaySearchResults([]);
  };

  const openLogoPicker = (target: 'home' | 'away') => {
    setActiveTeamTarget(target);
    setLogoPickerVisible(true);
  };

  const handleSelectInternalFixture = (fixture: InternalFixturePair) => {
    setTournament(fixture.league);
    setHomeTeam(fixture.homeTeam.name);
    setHomeLogo(fixture.homeTeam.logoUrl);
    setAwayTeam(fixture.awayTeam.name);
    setAwayLogo(fixture.awayTeam.logoUrl);
    setFifaMode(false);
    setMortalKombatMode(false);
    setPokerMode(false);
  };

  const openMortalPicker = (target: 'home' | 'away') => {
    setActiveTeamTarget(target);
    setMortalPickerVisible(true);
  };

  const handleSelectMortalFighter = (fighter: MortalKombatFighter) => {
    const fighterKey = `mortal:${fighter.key}`;
    if (activeTeamTarget === 'home') {
      setHomeTeam(fighter.name);
      setHomeLogo(fighterKey);
    } else {
      setAwayTeam(fighter.name);
      setAwayLogo(fighterKey);
    }
  };

  const handleSelectLogoFromModal = (selectedName: string, selectedLogo: string) => {
    if (activeTeamTarget === 'home') {
      if (!homeTeam.trim() || homeTeam === 'Équipe Domicile') {
        setHomeTeam(selectedName);
      }
      setHomeLogo(selectedLogo);
    } else {
      if (!awayTeam.trim() || awayTeam === 'Équipe Extérieure') {
        setAwayTeam(selectedName);
      }
      setAwayLogo(selectedLogo);
    }
  };

  const handleCreate = () => {
    if (!homeTeam.trim() || !awayTeam.trim()) { onError('Noms des deux équipes requis.'); return; }
    const parsedOdd = parseFloat(odd.replace(',', '.'));
    if (isNaN(parsedOdd) || parsedOdd <= 0) { onError('Cote invalide.'); return; }
    const isFifaMatch = fifaMode || tournament.trim().toUpperCase().startsWith('FIFA');
    const isMortalKombatMatch = mortalKombatMode || /mortal\s+(kombat|combat)/i.test(tournament);
    const isPokerMatch = pokerMode || /^(?:LTAR|TvBet)\s+Poker$/i.test(tournament.trim());
    const parsedFifaDuration = parseFloat(fifaDurationMinutes.replace(',', '.'));
    const parsedMortalKombatDuration = parseFloat(mortalKombatDurationMinutes.replace(',', '.'));
    if (isFifaMatch && (!Number.isFinite(parsedFifaDuration) || parsedFifaDuration <= 0)) {
      onError('La durée FIFA doit être supérieure à 0 minute.');
      return;
    }
    if (isMortalKombatMatch && (!Number.isFinite(parsedMortalKombatDuration) || parsedMortalKombatDuration <= 0)) {
      onError('La durée Mortal Kombat doit être supérieure à 0 minute.');
      return;
    }
    if (!isFifaMatch && !isMortalKombatMatch && !isPokerMatch && (!isValidImageUrl(homeLogo) || !isValidImageUrl(awayLogo))) {
      onError('Sélectionnez un écusson officiel valide pour chacune des deux équipes avant de créer le match.');
      return;
    }

    let finalDateIso = new Date().toISOString();
    try {
      const [year, month, day] = matchDate.split('-').map(Number);
      const [hours, minutes] = matchTime.split(':').map(Number);
      const d = new Date(year, month - 1, day, hours, minutes);
      if (!isNaN(d.getTime())) finalDateIso = d.toISOString();
    } catch { /* ignore */ }

    const parseO = (v: string) => {
      const n = parseFloat(v.replace(',', '.'));
      return isNaN(n) || n <= 0 ? undefined : n;
    };
    const generated1X2Odds = !isMortalKombatMatch && !isPokerMatch ? generateDrawAndAwayOdds() : null;
    const normalizedPeriods = normalizeScorePeriods(exactScore, scorePeriod1, scorePeriod2);

    const match: AdminMatch = {
      fixtureId: Date.now(),
      homeTeam: homeTeam.trim(), homeLogo: homeLogo.trim() || 'us',
      awayTeam: awayTeam.trim(), awayLogo: awayLogo.trim() || 'au',
      league: tournament.trim(),
      sport: isFifaMatch ? 'fifa' : isMortalKombatMatch ? 'mortal-kombat' : isPokerMatch ? 'poker' : 'football',
      leagueLogo: 'https://media.api-sports.io/football/leagues/1.png',
      date: finalDateIso, status: 'NS', score: exactScore.trim(),
      betOption: 'V1', odd: parsedOdd,
      scorePeriod1: normalizedPeriods.period1, scorePeriod2: normalizedPeriods.period2,
      oddV1: !isMortalKombatMatch && !isPokerMatch ? (parseO(oddV1) ?? parsedOdd) : parseO(oddV1),
      oddNul: generated1X2Odds?.oddNul ?? parseO(oddNul),
      oddV2: generated1X2Odds?.oddV2 ?? parseO(oddV2),
      oddDc1x: parseO(oddDc1x), oddDc12: parseO(oddDc12), oddDcX2: parseO(oddDcX2),
      oddOver15: parseO(oddOver15), oddOver25: parseO(oddOver25), oddOver35: parseO(oddOver35),
      oddUnder15: parseO(oddUnder15), oddUnder25: parseO(oddUnder25), oddUnder35: parseO(oddUnder35),
      oddBttsYes: parseO(oddBttsYes), oddBttsNo: parseO(oddBttsNo),
      oddScoreExact: parseO(oddScoreExact),
      oddHtV1: parseO(oddHtV1), oddHtNul: parseO(oddHtNul), oddHtV2: parseO(oddHtV2),
      oddHandicap: parseO(oddHandicap),
      fifaDurationMs: isFifaMatch ? Math.round(parsedFifaDuration * 60 * 1000) : undefined,
      mortalKombatDurationMs: isMortalKombatMatch ? Math.round(parsedMortalKombatDuration * 60 * 1000) : undefined,
    };

    store.addMatch(match);
    insertMache({
      fixtureId: match.fixtureId,
      sport: match.sport,
      fifaDurationMs: match.fifaDurationMs,
      mortalKombatDurationMs: match.mortalKombatDurationMs,
      pokerDurationMs: isPokerMatch ? 3 * 60 * 1000 : undefined,
      homeTeam: match.homeTeam, homeLogo: match.homeLogo,
      awayTeam: match.awayTeam, awayLogo: match.awayLogo,
      league: match.league, date: match.date, score: match.score || '0 - 0',
      odd: match.odd, betOption: match.betOption,
      scorePeriod1: match.scorePeriod1, scorePeriod2: match.scorePeriod2,
      oddV1: match.oddV1, oddNul: match.oddNul, oddV2: match.oddV2,
      oddDc1x: match.oddDc1x, oddDc12: match.oddDc12, oddDcX2: match.oddDcX2,
      oddOver15: match.oddOver15, oddOver25: match.oddOver25, oddOver35: match.oddOver35,
      oddUnder15: match.oddUnder15, oddUnder25: match.oddUnder25, oddUnder35: match.oddUnder35,
      oddBttsYes: match.oddBttsYes, oddBttsNo: match.oddBttsNo,
      oddScoreExact: match.oddScoreExact,
      oddHtV1: match.oddHtV1, oddHtNul: match.oddHtNul, oddHtV2: match.oddHtV2,
      oddHandicap: match.oddHandicap,
    });
    onSuccess(`Match créé : ${homeTeam} vs ${awayTeam}`);

    setHomeTeam(''); setAwayTeam(''); setHomeLogo(''); setAwayLogo('');
    setPokerMode(false);
    setExactScore('0 - 0'); setOdd('');
    setScorePeriod1('0 - 0'); setScorePeriod2('0 - 0');
    setOddV1(''); setOddNul(''); setOddV2('');
    setOddDc1x(''); setOddDc12(''); setOddDcX2('');
    setOddOver15(''); setOddOver25(''); setOddOver35('');
    setOddUnder15(''); setOddUnder25(''); setOddUnder35('');
    setOddBttsYes(''); setOddBttsNo('');
    setOddScoreExact('');
    setOddHtV1(''); setOddHtNul(''); setOddHtV2('');
    setOddHandicap('');
    setHomeSearchResults([]); setAwaySearchResults([]);
    const now = new Date();
    setMatchDate(now.toISOString().split('T')[0]);
    setMatchTime(now.toTimeString().split(' ')[0].substring(0, 5));
    setFifaDurationMinutes('10');
    setMortalKombatDurationMinutes('3');
    setMortalKombatMode(false);
  };

  const renderTeamSection = (
    isHome: boolean,
    team: string, logo: string, searching: boolean,
    results: FootballTeam[],
    onSearch: (t: string) => void,
    onSelectAuto: (t: FootballTeam) => void
  ) => (
    <View style={[AT.card, { marginBottom: 12 }]}>
      {/* Header */}
      <View style={s.teamCardHeader}>
        <View style={s.teamCardLeft}>
          <View style={[s.teamIcon, { backgroundColor: isHome ? AT.accentL : '#FFF7ED' }]}>
            <FontAwesome5 name={isHome ? 'home' : 'plane'} size={12} color={isHome ? AT.accent : AT.gold} />
          </View>
          <Text style={s.teamCardTitle}>{mortalKombatMode ? (isHome ? 'Combattant 1' : 'Combattant 2') : (isHome ? 'Équipe Domicile (Home)' : 'Équipe Extérieure (Away)')}</Text>
        </View>

        {logo ? (
          <TouchableOpacity onPress={() => mortalKombatMode ? openMortalPicker(isHome ? 'home' : 'away') : openLogoPicker(isHome ? 'home' : 'away')} activeOpacity={0.8}>
            <CircularFlag countryCode={logo} size={32} teamName={team} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.teamPlaceholder} onPress={() => openLogoPicker(isHome ? 'home' : 'away')}>
            <Ionicons name="image-outline" size={14} color={AT.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Team Name Input */}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>{mortalKombatMode ? 'NOM DU COMBATTANT' : "NOM DE L'ÉQUIPE"}</Text>
        <View style={s.searchInputWrap}>
          <Ionicons name="shield-outline" size={15} color={AT.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            value={team}
            onChangeText={onSearch}
            placeholder={mortalKombatMode ? 'Choisir dans le catalogue Mortal Kombat' : (isHome ? "Ex: Real Madrid, France..." : "Ex: FC Barcelone, Brésil...")}
            placeholderTextColor={AT.textMuted}
          />
          {searching && <ActivityIndicator size="small" color={AT.accent} />}
        </View>
      </View>

      {/* Button to Open Catalog Logo Picker */}
      <TouchableOpacity
        style={s.pickLogoBtn}
        onPress={() => mortalKombatMode ? openMortalPicker(isHome ? 'home' : 'away') : openLogoPicker(isHome ? 'home' : 'away')}
        activeOpacity={0.8}
      >
        <Ionicons name={mortalKombatMode ? 'person-circle-outline' : 'images-outline'} size={16} color={AT.accent} style={{ marginRight: 8 }} />
        <Text style={s.pickLogoBtnText}>
          {mortalKombatMode ? (logo ? 'Changer le combattant' : 'Sélectionner un combattant') : (logo ? 'Changer le logo dans le catalogue' : 'Sélectionner le logo de l\'équipe')}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={AT.accent} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      {/* Autocomplete dropdown for API mode */}
      {creationMode === 'auto' && results.length > 0 && (
        <View style={s.dropdown}>
          {results.slice(0, 5).map((t, idx) => (
            <TouchableOpacity key={idx} style={s.dropdownItem} onPress={() => onSelectAuto(t)} activeOpacity={0.7}>
              <Image source={{ uri: t.logo }} style={s.dropdownLogo} />
              <Text style={s.dropdownText} numberOfLines={1}>{t.name}</Text>
              <Ionicons name="chevron-forward" size={14} color={AT.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <ScrollView style={s.scroll} contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <SectionHeader
          icon="futbol"
          title="Création de Match & Coupon"
          subtitle="Choisissez une équipe dans le catalogue général ou le catalogue FIFA"
        />

        <TouchableOpacity style={s.internalFixturesButton} onPress={() => setInternalFixturePickerVisible(true)} activeOpacity={0.8}>
          <FontAwesome5 name="random" size={14} color={AT.accent} />
          <Text style={s.internalFixturesButtonText}>Choisir une affiche</Text>
          <Ionicons name="chevron-forward" size={15} color={AT.accent} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Mode Switcher */}
        <View style={s.modeSelector}>
          <TouchableOpacity
            style={[s.modeBtn, !fifaMode && !mortalKombatMode && s.modeBtnActive]}
            onPress={() => { setFifaMode(false); setMortalKombatMode(false); setPokerMode(false); setCreationMode('catalog'); }}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="images" size={13} color={!fifaMode ? '#FFF' : AT.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[s.modeBtnText, !fifaMode && s.modeBtnTextActive]}>
              Catalogue de Logos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.modeBtn, fifaMode && s.modeBtnActive]}
            onPress={() => {
              setFifaMode(true);
              setMortalKombatMode(false);
              setPokerMode(false);
              setCreationMode('catalog');
              if (!tournament.startsWith('FIFA')) setTournament(FIFA_CATALOG_CATEGORIES[0].title);
            }}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="futbol" size={13} color={fifaMode ? '#FFF' : AT.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[s.modeBtnText, fifaMode && s.modeBtnTextActive]}>
              FIFA
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeBtn, mortalKombatMode && s.modeBtnActive]}
            onPress={() => {
              setFifaMode(false);
              setMortalKombatMode(true);
              setPokerMode(false);
              setCreationMode('catalog');
              if (!/mortal\s+(kombat|combat)/i.test(tournament)) setTournament('Mortal Kombat 11 (BO3)');
            }}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="fist-raised" size={13} color={mortalKombatMode ? '#FFF' : AT.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[s.modeBtnText, mortalKombatMode && s.modeBtnTextActive]}>Mortal Kombat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeBtn, pokerMode && s.modeBtnActive]}
            onPress={() => {
              setFifaMode(false);
              setMortalKombatMode(false);
              setPokerMode(true);
              setTournament('TvBet Poker');
              setHomeTeam('Combinaison gagnante');
              setAwayTeam('Quelle Main va gagner ?');
            }}
            activeOpacity={0.8}
          >
            <Image source={require('../../../assets/images/poker-controller-icon.png')} style={{ width: 17, height: 17, marginRight: 6 }} resizeMode="contain" />
            <Text style={[s.modeBtnText, pokerMode && s.modeBtnTextActive]}>TvBet Poker</Text>
          </TouchableOpacity>
        </View>

        {/* Championship Name : déclencheur compact */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>CHAMPIONNAT / TOURNOI</Text>
          <TouchableOpacity style={s.compactPicker} onPress={() => setChampionshipPickerVisible(true)} activeOpacity={0.8}>
            <FontAwesome5 name="trophy" size={13} color={AT.gold} style={{ marginRight: 9 }} />
            <Text numberOfLines={1} style={s.compactPickerText}>{tournament || 'Choisir un championnat'}</Text>
            <Ionicons name="chevron-down" size={16} color={AT.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Team 1 (Home) */}
        {renderTeamSection(
          true, homeTeam, homeLogo, searchingHome, homeSearchResults, searchHomeTeam,
          (t) => { setHomeTeam(t.name); setHomeLogo(t.logo); setHomeSearchResults([]); }
        )}

        {/* Team 2 (Away) */}
        {renderTeamSection(
          false, awayTeam, awayLogo, searchingAway, awaySearchResults, searchAwayTeam,
          (t) => { setAwayTeam(t.name); setAwayLogo(t.logo); setAwaySearchResults([]); }
        )}

        {/* Match parameters */}
        <View style={[AT.card, { marginBottom: 12 }]}>
          <View style={s.teamCardHeader}>
            <View style={s.teamCardLeft}>
              <View style={[s.teamIcon, { backgroundColor: AT.greenL }]}>
                <FontAwesome5 name="chart-bar" size={12} color={AT.green} />
              </View>
              <Text style={s.teamCardTitle}>Paramètres du Match</Text>
            </View>
          </View>

          <View style={s.row}>
            <View style={s.col}>
              <Text style={s.fieldLabel}>SCORE EXACT</Text>
              <TextInput style={s.compactInput} value={exactScore} onChangeText={setExactScore} placeholder="2 - 1" placeholderTextColor={AT.textMuted} />
            </View>
            <View style={s.col}>
              <Text style={s.fieldLabel}>{mortalKombatMode || pokerMode ? 'COTE' : 'COTE V1'}</Text>
              <TextInput style={s.compactInput} value={odd} onChangeText={(value) => { setOdd(value); setOddV1(value); }} placeholder="Saisir la cote V1" keyboardType="decimal-pad" placeholderTextColor={AT.textMuted} />
            </View>
          </View>

          {!mortalKombatMode && !pokerMode && (
            <Text style={[s.durationHint, { marginTop: 7 }]}>Les cotes X et V2 seront générées à la création entre 2,00 et 7,00; X sera toujours supérieure à V2.</Text>
          )}

          <View style={[s.row, { marginTop: 10 }]}>
            <View style={s.col}>
              <Text style={s.fieldLabel}>SCORE 1ère PÉRIODE</Text>
              <TextInput style={s.compactInput} value={scorePeriod1} onChangeText={setScorePeriod1} placeholder="1 - 0" placeholderTextColor={AT.textMuted} />
            </View>
            <View style={s.col}>
              <Text style={s.fieldLabel}>SCORE 2ème PÉRIODE</Text>
              <TextInput style={s.compactInput} value={scorePeriod2} onChangeText={setScorePeriod2} placeholder="1 - 1" placeholderTextColor={AT.textMuted} />
            </View>
          </View>

          <View style={{ marginTop: 10 }}>
            <Text style={s.fieldLabel}>DATE ET HEURE DU MATCH</Text>
            <TouchableOpacity style={s.compactPicker} onPress={() => setDateTimePickerVisible(true)} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={15} color={AT.accent} style={{ marginRight: 9 }} />
              <Text style={s.compactPickerText}>{matchDate} · {matchTime}</Text>
              <Ionicons name="chevron-down" size={16} color={AT.textMuted} />
            </TouchableOpacity>
          </View>

          {(fifaMode || mortalKombatMode) && (
            <View style={{ marginTop: 10 }}>
              <Text style={s.fieldLabel}>{mortalKombatMode ? 'DURÉE DU COMBAT MORTAL KOMBAT (MINUTES RÉELLES)' : 'DURÉE DU MATCH FIFA (MINUTES RÉELLES)'}</Text>
              <TextInput
                style={s.compactInput}
                value={mortalKombatMode ? mortalKombatDurationMinutes : fifaDurationMinutes}
                onChangeText={(value) => {
                  if (value === '' || /^\d*([.,]\d*)?$/.test(value)) {
                    if (mortalKombatMode) setMortalKombatDurationMinutes(value); else setFifaDurationMinutes(value);
                  }
                }}
                placeholder={mortalKombatMode ? '3' : '10'}
                keyboardType="decimal-pad"
                placeholderTextColor={AT.textMuted}
              />
              <Text style={s.durationHint}>
                {mortalKombatMode ? 'Le combat se déroule automatiquement pendant cette durée réelle.' : 'Le match simulera 90 minutes de jeu pendant cette durée réelle.'}
              </Text>
            </View>
          )}

          <View style={[s.analystOddsNotice, { backgroundColor: AT.accentL }]}> 
            <Ionicons name="information-circle-outline" size={16} color={AT.accent} />
            <Text style={s.analystOddsNoticeText}>
              La cote saisie ci-dessus est définie uniquement par l’analyste et reste inchangée lorsque l’option de pari est sélectionnée.
            </Text>
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity style={s.createBtn} onPress={handleCreate} activeOpacity={0.85}>
          <FontAwesome5 name="plus-circle" size={16} color="#FFF" style={{ marginRight: 10 }} />
          <Text style={s.createBtnText}>Créer et ajouter au coupon</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Logo Gallery Picker Modal */}
      <LogoPickerModal
        visible={logoPickerVisible}
        onClose={() => setLogoPickerVisible(false)}
        onSelectTeam={handleSelectLogoFromModal}
        title={`Logo · Équipe ${activeTeamTarget === 'home' ? 'Domicile' : 'Extérieure'}`}
      />

      <InternalFixturePickerModal
        visible={internalFixturePickerVisible}
        onClose={() => setInternalFixturePickerVisible(false)}
        onSelectFixture={handleSelectInternalFixture}
      />

      <MortalKombatPickerModal
        visible={mortalPickerVisible}
        onClose={() => setMortalPickerVisible(false)}
        onSelect={handleSelectMortalFighter}
        title={`Combattant ${activeTeamTarget === 'home' ? '1' : '2'}`}
      />

      <DateTimePickerModal
        visible={dateTimePickerVisible}
        value={selectedDateTime}
        onClose={() => setDateTimePickerVisible(false)}
        onConfirm={handleDateTimeConfirm}
        title="Date et heure du match"
      />

      <Modal visible={championshipPickerVisible} transparent animationType="fade" onRequestClose={() => setChampionshipPickerVisible(false)}>
        <View style={s.pickerBackdrop}>
          <View style={s.championshipModal}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>Choisir un championnat</Text>
              <TouchableOpacity onPress={() => setChampionshipPickerVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={21} color={AT.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={s.compactSearchWrap}>
              <Ionicons name="search" size={15} color={AT.textMuted} />
              <TextInput
                style={s.compactSearch}
                value={championshipSearch}
                onChangeText={setChampionshipSearch}
                placeholder="Rechercher un championnat"
                placeholderTextColor={AT.textMuted}
              />
            </View>
            <View style={s.customChampionshipBox}>
              <Text style={s.customChampionshipTitle}>Créer mon championnat</Text>
              <View style={s.customTypeRow}>
                <TouchableOpacity style={[s.customTypeBtn, customChampionshipType === 'football' && s.customTypeBtnActive]} onPress={() => setCustomChampionshipType('football')}><FontAwesome5 name="futbol" size={12} color={customChampionshipType === 'football' ? '#FFF' : AT.accent} /><Text style={[s.customTypeText, customChampionshipType === 'football' && s.customTypeTextActive]}>Football</Text></TouchableOpacity>
                <TouchableOpacity style={[s.customTypeBtn, customChampionshipType === 'fifa' && s.customTypeBtnActive]} onPress={() => setCustomChampionshipType('fifa')}><FontAwesome5 name="gamepad" size={12} color={customChampionshipType === 'fifa' ? '#FFF' : AT.accent} /><Text style={[s.customTypeText, customChampionshipType === 'fifa' && s.customTypeTextActive]}>FIFA</Text></TouchableOpacity>
                <TouchableOpacity style={[s.customTypeBtn, customChampionshipType === 'mortal-kombat' && s.customTypeBtnActive]} onPress={() => setCustomChampionshipType('mortal-kombat')}><FontAwesome5 name="fist-raised" size={12} color={customChampionshipType === 'mortal-kombat' ? '#FFF' : AT.accent} /><Text style={[s.customTypeText, customChampionshipType === 'mortal-kombat' && s.customTypeTextActive]}>Mortal Kombat</Text></TouchableOpacity>
              </View>
              <TextInput style={s.manualChampionshipInput} value={customChampionshipName} onChangeText={setCustomChampionshipName} placeholder="Nom de mon championnat" placeholderTextColor={AT.textMuted} />
              <TouchableOpacity style={s.createChampionshipBtn} onPress={() => void createCustomChampionship()} activeOpacity={0.85}><Ionicons name="add-circle-outline" size={16} color="#FFF" /><Text style={s.pickerConfirmText}>Créer et sélectionner</Text></TouchableOpacity>
            </View>
            {customChampionships.length > 0 && <Text style={s.customListLabel}>Mes championnats</Text>}
            {customChampionships.map((item) => <TouchableOpacity key={`${item.type}-${item.name}`} style={[s.championshipOption, tournament === item.name && s.championshipOptionActive]} onPress={() => { setTournament(item.name); setFifaMode(item.type === 'fifa'); setMortalKombatMode(item.type === 'mortal-kombat'); setChampionshipPickerVisible(false); }}><FontAwesome5 name={item.type === 'fifa' ? 'gamepad' : item.type === 'mortal-kombat' ? 'fist-raised' : 'futbol'} size={13} color={item.type === 'fifa' ? AT.accent : item.type === 'mortal-kombat' ? '#B7791F' : AT.gold} /><Text numberOfLines={2} style={s.championshipOptionText}>{item.name}</Text>{tournament === item.name ? <Ionicons name="checkmark-circle" size={17} color={AT.accent} /> : null}</TouchableOpacity>)}
            <ScrollView style={s.championshipList} keyboardShouldPersistTaps="handled">
              {filteredChampionships.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={[s.championshipOption, tournament === name && s.championshipOptionActive]}
                  onPress={() => { setTournament(name); setFifaMode(name.startsWith('FIFA')); setMortalKombatMode(/mortal\s+(kombat|combat)/i.test(name)); setChampionshipPickerVisible(false); setChampionshipSearch(''); }}
                  activeOpacity={0.8}
                >
                  <FontAwesome5 name={name.startsWith('FIFA') ? 'futbol' : /mortal\s+(kombat|combat)/i.test(name) ? 'fist-raised' : 'trophy'} size={13} color={name.startsWith('FIFA') ? AT.accent : /mortal\s+(kombat|combat)/i.test(name) ? '#B7791F' : AT.gold} />
                  <Text numberOfLines={2} style={[s.championshipOptionText, tournament === name && { color: AT.accent, fontWeight: '800' }]}>{name}</Text>
                  {tournament === name ? <Ionicons name="checkmark-circle" size={17} color={AT.accent} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={s.manualChampionshipInput}
              value={tournament}
              onChangeText={setTournament}
              placeholder="Ou saisir un championnat personnalisé"
              placeholderTextColor={AT.textMuted}
            />
            <TouchableOpacity style={s.pickerConfirm} onPress={() => { setChampionshipPickerVisible(false); setChampionshipSearch(''); }} activeOpacity={0.85}>
              <Text style={s.pickerConfirmText}>Valider</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: AT.contentBg },
  container: { padding: 14, paddingBottom: 60 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  sectionIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: AT.accentL, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: AT.textPrimary },
  sectionSubtitle: { fontSize: 11.5, color: AT.textMuted, marginTop: 2, lineHeight: 16 },
  internalFixturesButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginBottom: 12, borderRadius: 10, borderWidth: 1, borderColor: AT.border, backgroundColor: AT.cardBg },
  internalFixturesButtonText: { color: AT.textPrimary, fontSize: 12, fontWeight: '700' },

  modeSelector: {
    flexDirection: 'row',
    backgroundColor: AT.cardBg2,
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: AT.border,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  modeBtnActive: {
    backgroundColor: AT.accent,
  },
  modeBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: AT.textSecondary,
  },
  modeBtnTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },

  fifaChip: { flexDirection: 'row', alignItems: 'center', gap: 7, maxWidth: 270, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: AT.accentL, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)' },
  fifaChipActive: { backgroundColor: AT.accent, borderColor: AT.accent },
  fifaChipText: { maxWidth: 230, fontSize: 11, fontWeight: '600', color: AT.accent },
  fifaChipTextActive: { color: '#FFF', fontWeight: '700' },

  customChampionshipBox: { marginBottom: 10, padding: 10, borderRadius: 10, backgroundColor: AT.accentL, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)' },
  customChampionshipTitle: { fontSize: 12, fontWeight: '800', color: AT.textPrimary, marginBottom: 8 },
  customTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  customTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: AT.border },
  customTypeBtnActive: { backgroundColor: AT.accent, borderColor: AT.accent },
  customTypeText: { color: AT.accent, fontSize: 11, fontWeight: '700' },
  customTypeTextActive: { color: '#FFFFFF' },
  createChampionshipBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: AT.accent, borderRadius: 8, paddingVertical: 9, marginTop: 8 },
  customListLabel: { ...AT.label, marginTop: 8, marginBottom: 4 },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { ...AT.label, marginBottom: 6 },
  compactPicker: { flexDirection: 'row', alignItems: 'center', minHeight: 42, backgroundColor: AT.cardBg2, borderRadius: 10, borderWidth: 1, borderColor: AT.border, paddingHorizontal: 12 },
  compactPickerText: { flex: 1, fontSize: 12.5, color: AT.textPrimary, fontWeight: '600' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: AT.cardBg2, borderRadius: 10, borderWidth: 1, borderColor: AT.border, paddingHorizontal: 12, paddingVertical: 10 },
  fieldInput: { flex: 1, fontSize: 13.5, color: AT.textPrimary, fontWeight: '600' },

  teamCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  teamCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  teamCardTitle: { fontSize: 13, fontWeight: '700', color: AT.textPrimary },
  teamPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: AT.border, justifyContent: 'center', alignItems: 'center' },

  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: AT.cardBg2, borderRadius: 10, borderWidth: 1, borderColor: AT.border, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 13.5, color: AT.textPrimary, fontWeight: '600' },

  pickLogoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AT.accentL,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  pickLogoBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: AT.accent,
  },

  dropdown: { marginTop: 6, backgroundColor: AT.cardBg, borderRadius: 10, borderWidth: 1, borderColor: AT.border, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 10 },
  dropdownLogo: { width: 22, height: 22, resizeMode: 'contain' },
  dropdownText: { flex: 1, fontSize: 13, fontWeight: '600', color: AT.textPrimary },

  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  compactInput: { backgroundColor: AT.cardBg2, borderWidth: 1, borderColor: AT.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: AT.textPrimary, fontWeight: '600', marginTop: 6 },
  oddsGroupTitle: { fontSize: 11.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  oddsLabel: { fontSize: 10, fontWeight: '800', color: AT.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  analystOddsNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9, marginTop: 12 },
  analystOddsNoticeText: { flex: 1, color: AT.textPrimary, fontSize: 11.5, lineHeight: 16, fontWeight: '600' },
  durationHint: { marginTop: 5, color: AT.textMuted, fontSize: 10.5, lineHeight: 15 },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 18 },
  championshipModal: { backgroundColor: '#FFF', borderRadius: 18, padding: 16, maxHeight: '82%', width: '100%', maxWidth: 430, alignSelf: 'center' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: AT.textPrimary },
  compactSearchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: AT.border, borderRadius: 9, paddingHorizontal: 10, minHeight: 40, backgroundColor: '#F8FAFC' },
  compactSearch: { flex: 1, color: AT.textPrimary, fontSize: 13 },
  championshipList: { marginTop: 8, maxHeight: 360 },
  championshipOption: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F7', borderRadius: 8 },
  championshipOptionActive: { backgroundColor: '#EAF3FF' },
  championshipOptionText: { flex: 1, color: AT.textPrimary, fontSize: 12.5, fontWeight: '600' },
  manualChampionshipInput: { marginTop: 10, borderWidth: 1, borderColor: AT.border, borderRadius: 9, paddingHorizontal: 10, minHeight: 40, color: AT.textPrimary, fontSize: 12.5 },
  pickerConfirm: { marginTop: 10, backgroundColor: AT.accent, borderRadius: 9, alignItems: 'center', paddingVertical: 10 },
  pickerConfirmText: { color: '#FFF', fontSize: 13, fontWeight: '800' },

  createBtn: { ...AT.btnPrimary, marginTop: 6 },
  createBtnText: { ...AT.btnText },
});
