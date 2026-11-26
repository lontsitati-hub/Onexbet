export type ScorePeriods = {
  period1: string;
  period2: string;
};

function parsePair(value: string | undefined): [number, number] | null {
  const match = String(value ?? '').trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

function randomSplit(total: number): [number, number] {
  const first = total === 0 ? 0 : Math.floor(Math.random() * (total + 1));
  return [first, total - first];
}

/**
 * Garantit que les deux groupes (première mi-temps,deuxième mi-temps)
 * correspondent au score final de chaque équipe.
 */
export function normalizeScorePeriods(finalScore: string | undefined, first?: string, second?: string): ScorePeriods {
  const final = parsePair(finalScore) ?? [0, 0];
  const p1 = parsePair(first);
  const p2 = parsePair(second);
  if (p1 && p2 && p1[0] + p2[0] === final[0] && p1[1] + p2[1] === final[1]) {
    return { period1: `${p1[0]} - ${p1[1]}`, period2: `${p2[0]} - ${p2[1]}` };
  }
  const home = randomSplit(final[0]);
  const away = randomSplit(final[1]);
  return { period1: `${home[0]} - ${away[0]}`, period2: `${home[1]} - ${away[1]}` };
}

export function scorePeriodsAreConsistent(finalScore: string | undefined, first?: string, second?: string): boolean {
  const final = parsePair(finalScore);
  const p1 = parsePair(first);
  const p2 = parsePair(second);
  return !!final && !!p1 && !!p2 && p1[0] + p2[0] === final[0] && p1[1] + p2[1] === final[1];
}
