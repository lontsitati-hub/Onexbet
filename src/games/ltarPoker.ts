export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card { suit: Suit; rank: Rank; }
export interface EvaluatedHand { category: number; label: string; tiebreak: number[]; }
export interface PokerHand { id: number; cards: [Card, Card]; evaluation: EvaluatedHand; }
export interface PokerRound { community: Card[]; hands: PokerHand[]; winners: number[]; winningEvaluation: EvaluatedHand; }

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const LABELS = ['Carte haute', 'Une paire', 'Deux paires', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush'];
const RANK_LABELS: Record<number, string> = { 14: 'As', 13: 'Roi', 12: 'Dame', 11: 'Valet' };

export function cardLabel(card: Card): string {
  return `${RANK_LABELS[card.rank] ?? card.rank}${card.suit}`;
}

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({ suit, rank: (index + 2) as Rank })));
}

function shuffle(cards: Card[]): Card[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  return combinations(rest, size - 1).map((tail) => [first, ...tail]).concat(combinations(rest, size));
}

function straightHigh(ranks: number[]): number {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);
  for (let i = 0; i <= unique.length - 5; i += 1) {
    const window = unique.slice(i, i + 5);
    if (window[0] - window[4] === 4 && new Set(window).size === 5) return window[0];
  }
  return 0;
}

export function evaluateFive(cards: Card[]): EvaluatedHand {
  const ranks = cards.map((card) => card.rank).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  ranks.forEach((rank) => counts.set(rank, (counts.get(rank) ?? 0) + 1));
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const straight = straightHigh(ranks);
  if (flush && straight) return { category: 8, label: LABELS[8], tiebreak: [straight] };
  if (groups[0][1] === 4) return { category: 7, label: LABELS[7], tiebreak: [groups[0][0], groups[1][0]] };
  if (groups[0][1] === 3 && groups[1][1] === 2) return { category: 6, label: LABELS[6], tiebreak: [groups[0][0], groups[1][0]] };
  if (flush) return { category: 5, label: LABELS[5], tiebreak: ranks };
  if (straight) return { category: 4, label: LABELS[4], tiebreak: [straight] };
  if (groups[0][1] === 3) return { category: 3, label: LABELS[3], tiebreak: [groups[0][0], ...groups.slice(1).map(([rank]) => rank)] };
  if (groups[0][1] === 2 && groups[1][1] === 2) return { category: 2, label: LABELS[2], tiebreak: [groups[0][0], groups[1][0], groups[2][0]] };
  if (groups[0][1] === 2) return { category: 1, label: LABELS[1], tiebreak: [groups[0][0], ...groups.slice(1).map(([rank]) => rank)] };
  return { category: 0, label: LABELS[0], tiebreak: ranks };
}

export function compareEvaluations(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i += 1) {
    const delta = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function evaluateBest(cards: Card[]): EvaluatedHand {
  return combinations(cards, 5).reduce((best, current) => {
    const evaluation = evaluateFive(current);
    return compareEvaluations(evaluation, best) > 0 ? evaluation : best;
  }, evaluateFive(cards.slice(0, 5)));
}

export function dealRound(): PokerRound {
  const deck = shuffle(createDeck());
  const hands = Array.from({ length: 6 }, (_, index) => {
    const cards = [deck[index * 2], deck[index * 2 + 1]] as [Card, Card];
    return { id: index + 1, cards, evaluation: evaluateBest([...cards, ...deck.slice(12, 17)]) };
  });
  const community = deck.slice(12, 17);
  const winningEvaluation = hands.reduce((best, hand) => compareEvaluations(hand.evaluation, best) > 0 ? hand.evaluation : best, hands[0].evaluation);
  const winners = hands.filter((hand) => compareEvaluations(hand.evaluation, winningEvaluation) === 0).map((hand) => hand.id);
  return { community, hands, winners, winningEvaluation };
}
