/**
 * Matchs populaires (mock) affichés dans l'onglet Populaire.
 * Logos officiels des clubs via le CDN media.api-sports.io (même source que l'API API-Football).
 */

export interface PopularMatch {
  fixtureId: number;
  league: string;
  dateLabel: string;
  live?: boolean;
  homeTeam: string;
  homeLogo: string;
  awayTeam: string;
  awayLogo: string;
  odd1: number;
  oddX: number;
  odd2: number;
}

const TEAM_LOGO = (id: number) => `https://media.api-sports.io/football/teams/${id}.png`;

export const POPULAR_MATCHES: PopularMatch[] = [
  { fixtureId: 1001, league: "Ligue 1", dateLabel: "Aujourd'hui 17:00", homeTeam: "Paris Saint-Germain", homeLogo: TEAM_LOGO(85), awayTeam: "Olympique de Marseille", awayLogo: TEAM_LOGO(81), odd1: 1.65, oddX: 4.20, odd2: 4.50 },
  { fixtureId: 1002, league: "Liga", dateLabel: "Aujourd'hui 19:45", homeTeam: "Real Madrid", homeLogo: TEAM_LOGO(541), awayTeam: "FC Barcelone", awayLogo: TEAM_LOGO(529), odd1: 2.10, oddX: 3.40, odd2: 3.20 },
  { fixtureId: 1003, league: "Premier League", dateLabel: "Aujourd'hui 21:00", live: true, homeTeam: "Manchester City", homeLogo: TEAM_LOGO(50), awayTeam: "Liverpool FC", awayLogo: TEAM_LOGO(40), odd1: 1.95, oddX: 3.60, odd2: 3.50 },
  { fixtureId: 1004, league: "Serie A", dateLabel: "Demain 15:00", homeTeam: "Juventus FC", homeLogo: TEAM_LOGO(496), awayTeam: "AC Milan", awayLogo: TEAM_LOGO(489), odd1: 2.25, oddX: 3.10, odd2: 3.40 },
  { fixtureId: 1005, league: "Bundesliga", dateLabel: "Demain 18:00", homeTeam: "Bayern Munich", homeLogo: TEAM_LOGO(157), awayTeam: "Borussia Dortmund", awayLogo: TEAM_LOGO(165), odd1: 1.70, oddX: 4.00, odd2: 4.20 },
  { fixtureId: 1006, league: "Serie A", dateLabel: "Demain 20:45", homeTeam: "Flamengo", homeLogo: TEAM_LOGO(127), awayTeam: "Palmeiras", awayLogo: TEAM_LOGO(126), odd1: 2.00, oddX: 3.20, odd2: 3.60 },
  { fixtureId: 1007, league: "Ligue 1", dateLabel: "Aujourd'hui 14:30", homeTeam: "TP Mazembe", homeLogo: TEAM_LOGO(1446), awayTeam: "AS Vita Club", awayLogo: TEAM_LOGO(1448), odd1: 2.30, oddX: 2.90, odd2: 3.10 },
  { fixtureId: 1008, league: "Ligue 1", dateLabel: "Aujourd'hui 16:15", homeTeam: "ASEC Mimosas", homeLogo: TEAM_LOGO(1153), awayTeam: "Africa Sports", awayLogo: TEAM_LOGO(1154), odd1: 2.15, oddX: 3.00, odd2: 3.30 },
  { fixtureId: 1009, league: "Ligue 1", dateLabel: "Demain 13:00", homeTeam: "Génération Foot", homeLogo: TEAM_LOGO(1168), awayTeam: "Jaraaf de Dakar", awayLogo: TEAM_LOGO(1158), odd1: 1.80, oddX: 3.10, odd2: 4.30 },
  { fixtureId: 1010, league: "Ligue 1", dateLabel: "Aujourd'hui 20:00", live: true, homeTeam: "CR Belouizdad", homeLogo: TEAM_LOGO(1362), awayTeam: "MC Alger", awayLogo: TEAM_LOGO(1363), odd1: 2.05, oddX: 2.95, odd2: 3.55 },
  { fixtureId: 1011, league: "Botola Pro", dateLabel: "Demain 21:00", homeTeam: "Wydad AC", homeLogo: TEAM_LOGO(1352), awayTeam: "Raja Casablanca", awayLogo: TEAM_LOGO(1353), odd1: 2.20, oddX: 3.00, odd2: 3.25 },
  { fixtureId: 1012, league: "Elite One", dateLabel: "Aujourd'hui 15:30", homeTeam: "Coton Sport", homeLogo: TEAM_LOGO(1425), awayTeam: "Canon de Yaoundé", awayLogo: TEAM_LOGO(1427), odd1: 1.90, oddX: 3.15, odd2: 3.80 },
  { fixtureId: 1013, league: "Championnat", dateLabel: "Demain 16:00", homeTeam: "Hafia FC", homeLogo: TEAM_LOGO(1152), awayTeam: "AS Kaloum Star", awayLogo: TEAM_LOGO(1156), odd1: 2.40, oddX: 2.85, odd2: 2.90 },
  { fixtureId: 1014, league: "Championnat", dateLabel: "Demain 19:00", homeTeam: "AS OTR", homeLogo: TEAM_LOGO(1463), awayTeam: "Kara FC", awayLogo: TEAM_LOGO(1465), odd1: 2.10, oddX: 2.95, odd2: 3.40 },
  { fixtureId: 1015, league: "Premier League", dateLabel: "Aujourd'hui 18:30", homeTeam: "AS Cotonou", homeLogo: TEAM_LOGO(1452), awayTeam: "Dragons FC", awayLogo: TEAM_LOGO(1456), odd1: 1.95, oddX: 3.10, odd2: 3.75 },
  { fixtureId: 1016, league: "Liga Portugal", dateLabel: "Demain 17:30", homeTeam: "FC Porto", homeLogo: TEAM_LOGO(212), awayTeam: "SL Benfica", awayLogo: TEAM_LOGO(211), odd1: 2.35, oddX: 3.30, odd2: 2.95 },
  { fixtureId: 1017, league: "Eredivisie", dateLabel: "Aujourd'hui 19:00", homeTeam: "Ajax Amsterdam", homeLogo: TEAM_LOGO(194), awayTeam: "PSV Eindhoven", awayLogo: TEAM_LOGO(196), odd1: 2.50, oddX: 3.40, odd2: 2.70 },
  { fixtureId: 1018, league: "Jupiler Pro", dateLabel: "Demain 14:00", homeTeam: "Club Brugge", homeLogo: TEAM_LOGO(569), awayTeam: "RSC Anderlecht", awayLogo: TEAM_LOGO(571), odd1: 2.05, oddX: 3.35, odd2: 3.45 },
  { fixtureId: 1019, league: "Liga Profesional", dateLabel: "Demain 20:00", homeTeam: "Boca Juniors", homeLogo: TEAM_LOGO(451), awayTeam: "River Plate", awayLogo: TEAM_LOGO(435), odd1: 2.45, oddX: 3.05, odd2: 2.95 },
  { fixtureId: 1020, league: "Süper Lig", dateLabel: "Aujourd'hui 21:30", homeTeam: "Galatasaray", homeLogo: TEAM_LOGO(610), awayTeam: "Fenerbahçe", awayLogo: TEAM_LOGO(611), odd1: 2.15, oddX: 3.30, odd2: 3.30 },
];
