import type { BetEvent } from '@/types/bet';
import { generateFallbackMarketOdd, isUsableOdd, resolve1X2Odds } from '@/utils/oddsGenerator';

export type FootballMarketColumn = { label: string; odd: string; generated?: boolean };
export type FootballMarket = { title: string; columns: FootballMarketColumn[] };

type MarketInput = Pick<BetEvent, 'id' | 'team1' | 'team2' | 'marketOdds' | 'marketLines' | 'additionalOdds' | 'providerMarkets'>;
type Template = { title: string; labels: string[]; min?: number; max?: number };

const totalPoints = [0.5, 1.5, 2.5, 3.5, 4.5];
const teamPoints = [0.5, 1.5, 2.5];
const scoreOptions = ['0 : 0', '1 : 0', '0 : 1', '1 : 1', '2 : 0', '0 : 2', '2 : 1', '1 : 2', '2 : 2', '3 : 0', '0 : 3', '3 : 1', '1 : 3', '3 : 2', '2 : 3', '3 : 3'];
const templates: Template[] = [
  { title: 'Score exact', labels: scoreOptions, min: 3, max: 24 },
  { title: '1X2', labels: ['V1', 'X', 'V2'], min: 1.5, max: 3 },
  { title: 'Double chance', labels: ['1X', '12', 'X2'], min: 1.15, max: 3.5 },
  { title: 'Deux équipes vont marquer', labels: ['Oui', 'Non'], min: 1.35, max: 3.8 },
  { title: 'Total', labels: totalPoints.flatMap((point) => [`Plus de buts (${point})`, `Exactement ${point} but(s)`, `Moins de buts (${point})`]), min: 1.25, max: 5.5 },
  { title: 'Handicap', labels: ['Équipe 1 (-2.5)', 'Équipe 1 (-1.5)', 'Équipe 1 (-0.5)', 'Équipe 2 (+0.5)', 'Équipe 2 (+1.5)', 'Équipe 2 (+2.5)'], min: 1.25, max: 6 },
  { title: 'Total 1', labels: teamPoints.flatMap((point) => [`Équipe 1 — plus de (${point})`, `Équipe 1 — moins de (${point})`]), min: 1.2, max: 5 },
  { title: 'Total 2', labels: teamPoints.flatMap((point) => [`Équipe 2 — plus de (${point})`, `Équipe 2 — moins de (${point})`]), min: 1.2, max: 5 },
  { title: 'Prochain but', labels: ['Équipe 1', 'Aucun autre but', 'Équipe 2'], min: 1.3, max: 6 },
  { title: 'Total asiatique', labels: [2, 2.25, 2.5, 2.75, 3, 3.25].flatMap((point) => [`Plus de buts (${point})`, `Moins de buts (${point})`]), min: 1.25, max: 5.5 },
  { title: 'Handicap asiatique', labels: ['Équipe 1 (-2.0)', 'Équipe 1 (-1.5)', 'Équipe 1 (-1.0)', 'Équipe 1 (-0.5)', 'Équipe 2 (+0.5)', 'Équipe 2 (+1.0)', 'Équipe 2 (+1.5)', 'Équipe 2 (+2.0)'], min: 1.25, max: 6 },
  { title: 'Équipe asiatique Total 1', labels: [0.5, 1, 1.5, 2, 2.5].flatMap((point) => [`Équipe 1 — plus de (${point})`, `Équipe 1 — moins de (${point})`]), min: 1.2, max: 5.5 },
  { title: 'Total pair', labels: ['Pair', 'Impair'], min: 1.7, max: 2.25 },
  { title: 'Nul 0:0', labels: ['Oui', 'Non'], min: 1.5, max: 8 },
  { title: 'Handicap européen', labels: ['Équipe 1 (-1)', 'Nul (-1)', 'Équipe 2 (+1)', 'Équipe 1 (-2)', 'Nul (-2)', 'Équipe 2 (+2)'], min: 1.25, max: 9 },
  { title: 'Équipe 1 gagne au moins une mi-temps', labels: ['Oui', 'Non'], min: 1.25, max: 4 },
  { title: 'Total 3 issues', labels: [2.5, 3.5].flatMap((point) => [`Plus de (${point})`, `Exact (${point})`, `Moins de (${point})`]), min: 1.25, max: 6 },
  { title: 'Total individuel 1 — 3 issues', labels: ['Équipe 1 — plus de (1.5)', 'Équipe 1 — exactement (1.5)', 'Équipe 1 — moins de (1.5)'], min: 1.25, max: 6 },
  { title: 'Individuel Total 1 Pair', labels: ['Oui', 'Non'], min: 1.55, max: 2.5 },
  { title: 'Individuel Total 2 Pair', labels: ['Oui', 'Non'], min: 1.55, max: 2.5 },
  { title: 'Équipe marquant le dernier but', labels: ['Équipe 1', 'Aucun but', 'Équipe 2'], min: 1.3, max: 6 },
  { title: 'Une des deux équipes va gagner par…', labels: ['Équipe 1 par 1 but', 'Équipe 1 par 2 buts ou plus', 'Équipe 2 par 1 but', 'Équipe 2 par 2 buts ou plus', 'Match nul'], min: 1.4, max: 12 },
  { title: 'Total à telle minute', labels: ['But entre 0–15 min', 'But entre 16–30 min', 'But entre 31–45 min', 'But entre 46–60 min', 'But entre 61–75 min', 'But entre 76–90 min'], min: 1.3, max: 8 },
  { title: 'Total de la mi-temps au score le plus élevé', labels: ['1ère mi-temps', '2ème mi-temps', 'Égalité'], min: 1.5, max: 4.5 },
  { title: 'Une équipe va gagner sans prendre de buts', labels: ['Équipe 1', 'Équipe 2', 'Aucune'], min: 1.4, max: 7 },
  { title: 'Deux équipes vont marquer + total', labels: ['Oui + plus de 1.5', 'Oui + plus de 2.5', 'Non + moins de 2.5', 'Non + moins de 3.5'], min: 1.4, max: 8 },
  { title: 'Corners', labels: [6.5, 7.5, 8.5, 9.5, 10.5].flatMap((point) => [`Plus de corners (${point})`, `Moins de corners (${point})`]), min: 1.25, max: 5 },
  { title: 'Cartons', labels: [2.5, 3.5, 4.5, 5.5].flatMap((point) => [`Plus de cartons (${point})`, `Moins de cartons (${point})`]), min: 1.25, max: 5 },
];

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function categoryForProviderMarket(name: string): string | undefined {
  const value = normalize(name);
  if (/correct score|final score|score exact/.test(value)) return 'Score exact';
  if (/double chance/.test(value)) return 'Double chance';
  if (/both teams to score|btts/.test(value)) return 'Deux équipes vont marquer';
  if (/1x2|match winner|match result|full time result|fulltime result/.test(value)) return '1X2';
  if (/asian handicap/.test(value)) return 'Handicap asiatique';
  if (/european handicap/.test(value)) return 'Handicap européen';
  if (/handicap|spread/.test(value)) return 'Handicap';
  if (/home team goals|home team total|team 1 goals|team 1 total/.test(value)) return 'Total 1';
  if (/away team goals|away team total|team 2 goals|team 2 total/.test(value)) return 'Total 2';
  if (/corner/.test(value)) return 'Corners';
  if (/card|booking/.test(value)) return 'Cartons';
  if (/odd even|even odd|total odd|total even/.test(value)) return 'Total pair';
  if (/next goal|score the \d+.*goal|which team.*score/.test(value)) return 'Prochain but';
  if (/last goal|team.*score.*last/.test(value)) return 'Équipe marquant le dernier but';
  if (/asian.*total|total.*asian/.test(value)) return 'Total asiatique';
  if (/over under|total goals|goals over|goals under|total goal/.test(value)) return 'Total';
  return undefined;
}

function formatProviderLabel(category: string, value: string, handicap: string | number | null | undefined, team1: string, team2: string): string {
  const normalized = normalize(value);
  if (category === '1X2') {
    if (['1', 'home', 'home win', 'team 1'].includes(normalized) || normalized === normalize(team1)) return 'V1';
    if (['x', 'draw', 'tie', 'the draw'].includes(normalized)) return 'X';
    if (['2', 'away', 'away win', 'team 2'].includes(normalized) || normalized === normalize(team2)) return 'V2';
  }
  if (category === 'Double chance') {
    if (/home.*draw|1x/.test(normalized)) return '1X';
    if (/home.*away|1 2/.test(normalized)) return '12';
    if (/draw.*away|x2/.test(normalized)) return 'X2';
  }
  const line = handicap === undefined || handicap === null || handicap === '' ? '' : ` (${String(handicap)})`;
  if (/^(over|more|plus)$/.test(normalized)) {
    if (category === 'Total' || category === 'Total asiatique') return `Plus de buts${line}`;
    if (category === 'Corners') return `Plus de corners${line}`;
    if (category === 'Cartons') return `Plus de cartons${line}`;
    if (category === 'Total 1' || category === 'Équipe asiatique Total 1') return `${team1} — plus de${line}`;
    if (category === 'Total 2') return `${team2} — plus de${line}`;
    return `Plus de${line}`;
  }
  if (/^(under|less|moins)$/.test(normalized)) {
    if (category === 'Total' || category === 'Total asiatique') return `Moins de buts${line}`;
    if (category === 'Corners') return `Moins de corners${line}`;
    if (category === 'Cartons') return `Moins de cartons${line}`;
    if (category === 'Total 1' || category === 'Équipe asiatique Total 1') return `${team1} — moins de${line}`;
    if (category === 'Total 2') return `${team2} — moins de${line}`;
    return `Moins de${line}`;
  }
  if (/^(exactly|exact)$/.test(normalized)) return `Exactement${line}`;
  if (['home', '1', 'team 1'].includes(normalized)) return category.includes('Total 1') ? `${team1}${line}` : `${team1}${line}`;
  if (['away', '2', 'team 2'].includes(normalized)) return category.includes('Total 2') ? `${team2}${line}` : `${team2}${line}`;
  if (normalized === 'no goal') return 'Aucun but';
  if (normalized === 'yes') return 'Oui';
  if (normalized === 'no') return 'Non';
  if (/^\d+\s*[-:]\s*\d+$/.test(value)) return value.replace(/\s*[-:]\s*/g, ' : ');
  return `${value}${line}`;
}

function providerColumns(input: MarketInput, title: string): FootballMarketColumn[] {
  const markets = (input.providerMarkets || []).filter((market) => (categoryForProviderMarket(market.name) || market.name) === title);
  const deduped = new Map<string, { label: string; odd?: number; main?: boolean | null }>();
  markets.forEach((market) => market.values.forEach((value) => {
    const label = formatProviderLabel(title, value.value, value.handicap, input.team1, input.team2);
    const key = normalize(label);
    const odd = !value.suspended && isUsableOdd(value.odd) ? Number(value.odd) : undefined;
    const prior = deduped.get(key);
    if (!prior || (value.main === true && prior.main !== true) || (value.main === prior.main && odd && odd > (prior.odd || 0))) {
      deduped.set(key, { label, odd, main: value.main });
    }
  }));
  if (title === '1X2') {
    return Array.from(deduped.values())
      .filter((item) => isUsableOdd(item.odd))
      .map((item) => ({ label: item.label, odd: Number(item.odd).toFixed(2), generated: false }));
  }
  return Array.from(deduped.values()).map((item) => ({
    label: item.label,
    odd: (item.odd || generateFallbackMarketOdd(input.id, title, item.label, 1.25, 12)).toFixed(2),
    generated: !item.odd,
  }));
}

function fallbackColumn(input: MarketInput, title: string, label: string, actual?: number, min = 1.25, max = 8): FootballMarketColumn {
  const real = isUsableOdd(actual) ? Number(actual) : undefined;
  return {
    label,
    odd: (real || generateFallbackMarketOdd(input.id, title, label, min, max)).toFixed(2),
    generated: !real,
  };
}

function fallbackColumns(input: MarketInput, template: Template): FootballMarketColumn[] {
  const { title, labels, min = 1.25, max = 8 } = template;
  if (title === '1X2') {
    const resolved = resolve1X2Odds(input.id, input.marketOdds);
    return [
      { label: 'V1', odd: resolved.v1.toFixed(2), generated: !isUsableOdd(input.marketOdds?.v1) },
      { label: 'X', odd: resolved.draw.toFixed(2), generated: !isUsableOdd(input.marketOdds?.draw) },
      { label: 'V2', odd: resolved.v2.toFixed(2), generated: !isUsableOdd(input.marketOdds?.v2) },
    ];
  }
  if (title === 'Double chance') {
    return labels.map((label) => {
      const actual = label === '1X' ? input.additionalOdds?.doubleChance?.oneX : label === '12' ? input.additionalOdds?.doubleChance?.oneTwo : input.additionalOdds?.doubleChance?.xTwo;
      return fallbackColumn(input, title, label, actual, min, max);
    });
  }
  if (title === 'Deux équipes vont marquer') {
    return labels.map((label) => fallbackColumn(input, title, label, label === 'Oui' ? input.additionalOdds?.btts?.yes : input.additionalOdds?.btts?.no, min, max));
  }
  if (title === 'Total') {
    return totalPoints.flatMap((point) => {
      const line = input.marketLines?.totals?.find((item) => item.point === point);
      return [
        fallbackColumn(input, title, `Plus de buts (${point})`, line?.over, min, max),
        fallbackColumn(input, title, `Exactement ${point} but(s)`, undefined, 3.5, 12),
        fallbackColumn(input, title, `Moins de buts (${point})`, line?.under, min, max),
      ];
    });
  }
  if (title === 'Total asiatique') {
    const points = [2, 2.25, 2.5, 2.75, 3, 3.25];
    return points.flatMap((point) => {
      const line = input.marketLines?.totals?.find((item) => item.point === point);
      return [
        fallbackColumn(input, title, `Plus de buts (${point})`, line?.over, min, max),
        fallbackColumn(input, title, `Moins de buts (${point})`, line?.under, min, max),
      ];
    });
  }
  if (title === 'Corners' || title === 'Cartons') {
    const points = title === 'Corners' ? [4.5, 6.5, 7.5, 8.5, 9.5, 10.5] : [1.5, 2.5, 3.5, 4.5, 5.5];
    const label = title === 'Corners' ? 'corners' : 'cartons';
    return points.flatMap((point) => [
      fallbackColumn(input, title, `Plus de ${label} (${point})`, undefined, min, max),
      fallbackColumn(input, title, `Moins de ${label} (${point})`, undefined, min, max),
    ]);
  }
  if (title === 'Handicap') {
    const choices = [{ side: 'home' as const, point: -2.5 }, { side: 'home' as const, point: -1.5 }, { side: 'home' as const, point: -0.5 }, { side: 'away' as const, point: 0.5 }, { side: 'away' as const, point: 1.5 }, { side: 'away' as const, point: 2.5 }];
    return choices.map(({ side, point }) => {
      const team = side === 'home' ? input.team1 : input.team2;
      const line = input.marketLines?.spreads?.find((item) => item.point === point);
      return fallbackColumn(input, title, `${team} (${point > 0 ? '+' : ''}${point})`, line?.[side], min, max);
    });
  }
  if (title === 'Total 1' || title === 'Total 2' || title === 'Équipe asiatique Total 1') {
    const side = title === 'Total 2' ? 'away' : 'home';
    const team = side === 'home' ? input.team1 : input.team2;
    const points = title === 'Équipe asiatique Total 1' ? [0.5, 1, 1.5, 2, 2.5] : teamPoints;
    const lines = side === 'home' ? input.marketLines?.homeTeamTotals : input.marketLines?.awayTeamTotals;
    return points.flatMap((point) => {
      const line = lines?.find((item) => item.point === point);
      return [
        fallbackColumn(input, title, `${team} — plus de (${point})`, line?.over, min, max),
        fallbackColumn(input, title, `${team} — moins de (${point})`, line?.under, min, max),
      ];
    });
  }
  return labels.map((label) => fallbackColumn(input, title, label, undefined, min, max));
}

export function buildFootballMarkets(input: MarketInput): FootballMarket[] {
  return templates.map((template) => {
    const actualColumns = providerColumns(input, template.title);
    if (template.title === '1X2') {
      const quote = (label: string) => actualColumns.find((column) => normalize(column.label) === normalize(label));
      const v1 = quote('V1')?.odd;
      const draw = quote('X')?.odd;
      const v2 = quote('V2')?.odd;
      const resolved = resolve1X2Odds(input.id, {
        v1: isUsableOdd(v1) ? Number(v1) : input.marketOdds?.v1,
        draw: isUsableOdd(draw) ? Number(draw) : input.marketOdds?.draw,
        v2: isUsableOdd(v2) ? Number(v2) : input.marketOdds?.v2,
      });
      return {
        title: template.title,
        columns: [
          { label: 'V1', odd: resolved.v1.toFixed(2), generated: !isUsableOdd(v1) && !isUsableOdd(input.marketOdds?.v1) },
          { label: 'X', odd: resolved.draw.toFixed(2), generated: !isUsableOdd(draw) && !isUsableOdd(input.marketOdds?.draw) },
          { label: 'V2', odd: resolved.v2.toFixed(2), generated: !isUsableOdd(v2) && !isUsableOdd(input.marketOdds?.v2) },
        ],
      };
    }
    const columns = fallbackColumns(input, template);
    const positions = new Map(columns.map((column, index) => [normalize(column.label), index]));
    actualColumns.forEach((column) => {
      const key = normalize(column.label);
      const position = positions.get(key);
      if (position === undefined) {
        positions.set(key, columns.length);
        columns.push(column);
      } else {
        columns[position] = column;
      }
    });
    return { title: template.title, columns };
  });
}

export function marketsForPeriod(markets: FootballMarket[], period: string, matchId: string): FootballMarket[] {
  if (period === 'Temps réglementaire') return markets;
  if (period === 'Corners' || period === 'Cartons') return markets.filter((market) => market.title === period);

  const relevant = new Set(['Score exact', '1X2', 'Double chance', 'Deux équipes vont marquer', 'Total', 'Handicap', 'Total 1', 'Total 2', 'Prochain but']);
  return markets.filter((market) => relevant.has(market.title)).map((market) => {
    const title = `${period} · ${market.title}`;
    if (market.title === '1X2') {
      const generated = resolve1X2Odds(`${matchId}:${period}`);
      return {
        title,
        columns: [
          { label: 'V1', odd: generated.v1.toFixed(2), generated: true },
          { label: 'X', odd: generated.draw.toFixed(2), generated: true },
          { label: 'V2', odd: generated.v2.toFixed(2), generated: true },
        ],
      };
    }
    return {
      title,
      columns: market.columns.map((column) => ({
        label: column.label,
        odd: generateFallbackMarketOdd(matchId, title, column.label, 1.25, market.title === 'Score exact' ? 24 : 8).toFixed(2),
        generated: true,
      })),
    };
  });
}
