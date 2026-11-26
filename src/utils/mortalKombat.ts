import { BetEvent } from '@/types/bet';

const normalize = (value: string | undefined) =>
  String(value || '').trim().toLowerCase().replace(/[’']/g, "'");

export const isMortalKombatEvent = (event: Pick<BetEvent, 'sport' | 'tournament'>): boolean => {
  const sport = normalize(event.sport);
  const tournament = normalize(event.tournament);
  return sport.includes('mortal kombat')
    || sport.includes('mortal combat')
    || tournament.includes('mortal kombat')
    || tournament.includes('mortal combat');
};
