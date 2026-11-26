import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, StatusBar, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getThemeAccentColor } from '@/constants/themeBranding';
import { CircularFlag } from '@/components/CircularFlag';
import { TeamLogo } from '@/components/TeamLogo';
import { useBetStore } from '@/store/useBetStore';
import { isMortalKombatEvent } from '@/utils/mortalKombat';

export default function MatchDetailsTab() {
  const insets = useSafeAreaInsets();
  const betSlip = useBetStore((state) => state.currentBetSlip);
  const theme = useBetStore((state) => state.theme);
  const activeColor = getThemeAccentColor(theme);
  const setShowMatchDetails = useBetStore((state) => state.setShowMatchDetails);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Grab first event or fallback to static defaults matching the user's screenshot
  const activeEvent = (betSlip && betSlip.events && betSlip.events[0]) || {
    sport: 'Football',
    tournament: 'Islande. 1er Division',
    team1: 'HK Kopavogur',
    team2: 'Grindavik',
    team1CountryCode: 'is', // Iceland flag
    team2CountryCode: 'is',
    odd: 2,
    betType: 'Score exact',
    score: '2 : 2',
    scorePeriod1: '2-1',
    scorePeriod2: '0-1',
    date: '21 juin 2026 (20:15)',
  };
  const isMortalKombat = isMortalKombatEvent(activeEvent);
  const renderTeamBadge = (side: 'home' | 'away', size: number) => {
    const isFootballSport = String(activeEvent.sport || '').trim().toLowerCase() === 'football';
    const fromApi = isFootballSport && (
      activeEvent.provider === 'api-football' ||
      activeEvent.provider === 'thesportsdb' ||
      Boolean(activeEvent.providerEventId)
    );
    const logo = side === 'home' ? activeEvent.team1Logo : activeEvent.team2Logo;
    if (isFootballSport || fromApi) {
      return <TeamLogo uri={logo} size={size} accessibilityLabel={`Écusson ${side === 'home' ? activeEvent.team1 : activeEvent.team2}`} />;
    }
    const team = side === 'home' ? activeEvent.team1 : activeEvent.team2;
    const countryCode = side === 'home' ? activeEvent.team1CountryCode : activeEvent.team2CountryCode;
    return <CircularFlag countryCode={countryCode} size={size} teamName={team} />;
  };

  const parseScores = () => {
    let home1 = '0';
    let away1 = '0';
    let home2 = '0';
    let away2 = '0';
    let homeFinal = '0';
    let awayFinal = '0';

    if (activeEvent.scorePeriod1) {
      const parts = activeEvent.scorePeriod1.split(/[-:]/);
      if (parts.length >= 2) {
        home1 = parts[0].trim();
        away1 = parts[1].trim();
      }
    }
    if (activeEvent.scorePeriod2) {
      const parts = activeEvent.scorePeriod2.split(/[-:]/);
      if (parts.length >= 2) {
        home2 = parts[0].trim();
        away2 = parts[1].trim();
      }
    }
    if (activeEvent.score) {
      const parts = activeEvent.score.split(/[-:]/);
      if (parts.length >= 2) {
        homeFinal = parts[0].trim();
        awayFinal = parts[1].trim();
      }
    } else {
      homeFinal = String(Number(home1) + Number(home2));
      awayFinal = String(Number(away1) + Number(away2));
    }

    return { home1, away1, home2, away2, homeFinal, awayFinal };
  };

  const { home1, away1, home2, away2, homeFinal, awayFinal } = parseScores();

  const listItems = [
    { label: 'Événements du match', icon: 'document-text-outline' },
    { label: 'Matchs récents', icon: 'flag-outline' },
    { label: 'Tableau du tournoi', icon: 'grid-outline' },
    { label: 'Statistiques de l\'équipe', icon: 'people-outline' },
    { label: 'Statistiques du tournoi', icon: 'trophy-outline' },
    { label: 'Compositions', icon: 'flag-outline' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Le stade est réservé au football/FIFA. Mortal Kombat utilise seulement
          les portraits détourés sur le fond normal de l’écran. */}
      {isMortalKombat ? (
        <View style={styles.mortalBackground} pointerEvents="none">
          <Image
            source={require('../../../assets/images/mortal-kombat/fighters-cutout/scorpion.png')}
            style={styles.mortalFighterLeft}
            contentFit="contain"
          />
          <Image
            source={require('../../../assets/images/mortal-kombat/fighters-cutout/sub-zero.png')}
            style={styles.mortalFighterRight}
            contentFit="contain"
          />
        </View>
      ) : (
        <Image
          source={require('../../../assets/images/stadium_new.jpg')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      )}
      
      {/* Dark translucent overlay covering the entire screen background */}
      {!isMortalKombat && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12, 35, 51, 0.7)' }]} />}

      {/* Transparent absolute header sitting on top of the stadium image background */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => setShowMatchDetails(false)} style={styles.backButton}>
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Statistiques</Text>
          
          <TouchableOpacity style={styles.settingsButton} activeOpacity={0.8}>
            <Ionicons name="settings-sharp" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
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
        {/* Spacer to push content below the absolute header */}
        <View style={{ height: insets.top + 56 + 12 }} />

        {/* Stadium Card */}
        <View style={styles.stadiumCard}>
          <View style={styles.stadiumContent}>
            <Text style={styles.leagueText}>
              {activeEvent.sport} . {activeEvent.tournament}
            </Text>

            {/* Symmetrical Teams Row */}
            <View style={styles.teamsRow}>
              <View style={styles.teamContainerLeft}>
                <Text style={styles.teamNameLeft} numberOfLines={2}>
                  {activeEvent.team1}
                </Text>
                {renderTeamBadge('home', 36)}
              </View>

              <Text style={styles.scoreText}>
                {activeEvent.score ? activeEvent.score.replace(/\s*-\s*/g, ':').replace(/\s*:\s*/g, ':') : 'VS'}
              </Text>

              <View style={styles.teamContainerRight}>
                {renderTeamBadge('away', 36)}
                <Text style={styles.teamNameRight} numberOfLines={2}>
                  {activeEvent.team2}
                </Text>
              </View>
            </View>

            <Text style={styles.dateText}>{activeEvent.date}</Text>
          </View>
        </View>

        {/* Half-time details card */}
        <View style={styles.tableCard}>
          {/* Columns header */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colHeader, { flex: 2, textAlign: 'left' }]}>Mi-temps</Text>
            <Text style={[styles.colHeader, { width: 35 }]}>1</Text>
            <Text style={[styles.colHeader, { width: 35 }]}>2</Text>
            <Text style={[styles.colHeader, { width: 70, textAlign: 'right' }]}>Résultat</Text>
          </View>

          <View style={styles.tableDivider} />

          {/* Row 1: Home Team */}
          <View style={styles.tableRow}>
            <View style={styles.teamNameWrapper}>
              {renderTeamBadge('home', 22)}
              <Text style={styles.rowTeamName} numberOfLines={1}>
                {activeEvent.team1}
              </Text>
            </View>
            <Text style={[styles.rowScoreValue, { width: 35 }]}>{home1}</Text>
            <Text style={[styles.rowScoreValue, { width: 35 }]}>{home2}</Text>
            <Text style={[styles.rowScoreValueBold, { width: 70 }]}>{homeFinal}</Text>
          </View>

          {/* Row 2: Away Team */}
          <View style={styles.tableRow}>
            <View style={styles.teamNameWrapper}>
              {renderTeamBadge('away', 22)}
              <Text style={styles.rowTeamName} numberOfLines={1}>
                {activeEvent.team2}
              </Text>
            </View>
            <Text style={[styles.rowScoreValue, { width: 35 }]}>{away1}</Text>
            <Text style={[styles.rowScoreValue, { width: 35 }]}>{away2}</Text>
            <Text style={[styles.rowScoreValueBold, { width: 70 }]}>{awayFinal}</Text>
          </View>
        </View>

        {!isMortalKombat && (
          <>
            <Text style={styles.sectionHeader}>Informations supplémentaires</Text>
            <View style={styles.listCard}>
              {listItems.map((item, idx) => (
                <View key={idx}>
                  <TouchableOpacity style={styles.listItem} activeOpacity={0.7}>
                    <View style={styles.listItemLeft}>
                          <View style={[styles.iconCircle, { backgroundColor: theme === 'red_mega' ? '#FFF5F5' : theme === 'light_green' ? '#F2F9E6' : theme === 'green' ? '#E6F2EF' : theme === 'royal_blue' ? '#E8EAFA' : theme === 'gold' ? '#FEF8EC' : '#EBF3FC' }]}>
                        <Ionicons name={item.icon as any} size={18} color={activeColor} />
                      </View>
                      <Text style={styles.listItemText}>{item.label}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#A0ABB4" />
                  </TouchableOpacity>
                  {idx < listItems.length - 1 && <View style={styles.itemDivider} />}
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C2333',
  },
  mortalBackground: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  mortalFighterLeft: {
    width: '54%',
    height: '100%',
    opacity: 1,
  },
  mortalFighterRight: {
    width: '54%',
    height: '100%',
    marginLeft: '-8%',
    opacity: 1,
  },
  mortalBackgroundOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 25, 39, 0.58)',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  headerContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'System',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  stadiumCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(25, 45, 60, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  stadiumContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  leagueText: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    fontFamily: 'System',
    marginBottom: 16,
    textAlign: 'center',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 6,
  },
  teamContainerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  teamContainerRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  teamNameLeft: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'System',
    flex: 1,
    textAlign: 'right',
  },
  teamNameRight: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'System',
    flex: 1,
    textAlign: 'left',
  },
  scoreText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'System',
    marginHorizontal: 14,
    letterSpacing: 1,
  },
  dateText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    fontFamily: 'System',
    marginTop: 18,
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 0.5,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colHeader: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7C8B9E',
    fontFamily: 'System',
    textAlign: 'center',
  },
  tableDivider: {
    height: 0.5,
    backgroundColor: '#EBF2FC',
    marginVertical: 10,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  teamNameWrapper: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTeamName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3D5C',
    fontFamily: 'System',
    flex: 1,
  },
  rowScoreValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3D5C',
    fontFamily: 'System',
    textAlign: 'center',
  },
  rowScoreValueBold: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A3D5C',
    fontFamily: 'System',
    textAlign: 'right',
  },
  sectionHeader: {
    fontSize: 14.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: 'System',
    marginHorizontal: 18,
    marginTop: 20,
    marginBottom: 8,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 0.5,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EBF3FC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItemText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1A3D5C',
    fontFamily: 'System',
  },
  itemDivider: {
    height: 0.5,
    backgroundColor: '#F1F5F9',
  },
});
