export const WILD_WEST_ROWS = 6;
export type WildWestMode = 2 | 3;

/** Mark app-authored resets without changing BotX's source on command acknowledgements. */
export function wildWestAppChannelPatch(patch: Record<string, unknown>) {
  return patch.action === 'reset' ? { ...patch, source: 'onexbet-app' } : patch;
}

/** BotX and the app use the same row indices: 0 is bottom, 5 is top. */
export function wildWestRowForDisplayIndex(displayIndex: number): number {
  if (!Number.isInteger(displayIndex) || displayIndex < 0 || displayIndex >= WILD_WEST_ROWS) {
    throw new RangeError('Rangée Wild West Gold hors limites.');
  }
  return WILD_WEST_ROWS - 1 - displayIndex;
}

export function wildWestRowLabel(row: number): number {
  if (!Number.isInteger(row) || row < 0 || row >= WILD_WEST_ROWS) {
    throw new RangeError('Rangée Wild West Gold hors limites.');
  }
  return row + 1;
}

/** Full, rules-compliant channel document used only when a user starts before BotX has created the channel. */
/** The row 5 start marker satisfies Firestore; BotX resets active play to row 0 on this status. */
export function createInitialWildWestRound(mode: WildWestMode, commandId: string, updatedAt: unknown) {
  if (mode !== 2 && mode !== 3) throw new RangeError('Mode Wild West Gold invalide.');
  if (!commandId || commandId.length > 128) throw new RangeError('Identifiant de commande Wild West Gold invalide.');
  return {
    game: 'wild-west-gold',
    action: 'reveal',
    status: 'round-started',
    mode,
    row: 5,
    col: 0,
    commandId,
    source: 'onexbet-app',
    updatedAt,
  };
}
