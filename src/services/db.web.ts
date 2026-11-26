export interface MacheRow {
  id?: number;
  fixtureId?: number;
  homeTeam: string;
  homeLogo?: string;
  awayTeam: string;
  awayLogo?: string;
  league?: string;
  date?: string;
  score?: string;
  odd?: number;
  betOption?: string;
  oddV1?: number;
  oddNul?: number;
  oddV2?: number;
  sport?: 'football' | 'fifa' | 'mortal-kombat' | 'poker';
  fifaDurationMs?: number;
  mortalKombatDurationMs?: number;
  pokerDurationMs?: number;
  [key: string]: any;
}

export interface CouponRow {
  id: string;
  type?: string;
  date?: string;
  eventCount?: number;
  totalOdds?: number;
  stake?: number;
  potentialGain?: number;
  status?: string;
  eventsJson?: string;
  sellAmount?: number;
  code?: string;
  gainCredited?: number;
  [key: string]: any;
}

export interface CompteRow {
  id: number;
  balance: number;
  randomSessionId: string;
  theme?: string;
}

type WebState = { matches: MacheRow[]; coupons: CouponRow[]; account: CompteRow; activated: boolean };
const KEY = 'onexbet:web-db:v1';
let cachedState: WebState | null = null;

const defaultState = (): WebState => ({
  matches: [],
  coupons: [],
  account: { id: 1, balance: 15000, randomSessionId: '', theme: 'blue' },
  activated: false,
});

const readState = (): WebState => {
  if (cachedState) return cachedState;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    cachedState = raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
    return cachedState as WebState;
  } catch (_) {
    cachedState = defaultState();
    return cachedState as WebState;
  }
};

const writeState = (state: WebState): boolean => {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(state));
    cachedState = state;
    return true;
  } catch (_) {
    return false;
  }
};

// Compatible no-op facade for screens that inspect the native database object.
export function getDb(): any {
  return {
    execSync: () => undefined,
    runSync: () => undefined,
    getFirstSync: () => undefined,
    getAllSync: () => [],
  };
}

export function initDatabase() { readState(); }

export function generateAndSaveSessionId(): { sessionId: string; balance: number } {
  const state = readState();
  const sessionId = `Session-${Math.floor(0x100000 + Math.random() * 0x900000).toString(16).toUpperCase()}`;
  state.account = { ...state.account, randomSessionId: sessionId };
  writeState(state);
  return { sessionId, balance: state.account.balance };
}

export function updateCompteBalance(balance: number): boolean {
  const current = readState();
  const state = { ...current, account: { ...current.account, balance } };
  return writeState(state);
}

export function updateCompteTheme(theme: string) {
  const state = readState();
  state.account.theme = theme;
  writeState(state);
}

export function getCompteInfo(): { balance: number; sessionId: string; theme: string } {
  const account = readState().account;
  return { balance: account.balance, sessionId: account.randomSessionId, theme: account.theme || 'blue' };
}

export function insertMache(mache: MacheRow) {
  const state = readState();
  const id = mache.id ?? (state.matches.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1);
  state.matches.push({ ...mache, id });
  writeState(state);
}

export function getAllMaches(): MacheRow[] { return readState().matches; }
export function clearMachesTable() { const state = readState(); state.matches = []; writeState(state); }

export function insertCoupon(coupon: CouponRow) {
  const state = readState();
  state.coupons = [...state.coupons.filter((item) => item.id !== coupon.id), coupon];
  writeState(state);
}

export function updateCouponSellAmount(id: string, sellAmount: number) {
  const state = readState();
  const row = state.coupons.find((item) => item.id === id);
  if (row) row.sellAmount = sellAmount;
  writeState(state);
}

export function getAllCoupons(): CouponRow[] { return readState().coupons; }
export function clearCouponsTable() { const state = readState(); state.coupons = []; writeState(state); }
export function deleteCouponById(id: string) { const state = readState(); state.coupons = state.coupons.filter((item) => item.id !== id); writeState(state); }
export function getCouponById(id: string): CouponRow | null { return readState().coupons.find((item) => item.id === id) || null; }
export function getCouponByCodeOrId(identifier: string): CouponRow | null {
  const normalized = String(identifier || '').trim();
  const upperCode = normalized.toUpperCase();
  return readState().coupons.find((item) => (
    item.id === normalized || String(item.code || '').trim().toUpperCase() === upperCode
  )) || null;
}

export function updateCouponEventsJson(id: string, updatedEventsJson: string) {
  const state = readState();
  const row = state.coupons.find((item) => item.id === id);
  if (row) row.eventsJson = updatedEventsJson;
  writeState(state);
}

export function updateCouponComplete(id: string, updates: Partial<CouponRow>) {
  const state = readState();
  const row = state.coupons.find((item) => item.id === id);
  if (row) Object.assign(row, updates);
  writeState(state);
}

export function updateCouponStatus(id: string, status: string) {
  const state = readState();
  const row = state.coupons.find((item) => item.id === id);
  if (row) row.status = status;
  writeState(state);
}

export function markCouponAsPaid(id: string, updatedEventsJson: string) {
  updateCouponComplete(id, { status: 'Payé', eventsJson: updatedEventsJson });
}

export function claimCouponGain(id: string): boolean {
  const state = readState();
  const row = state.coupons.find((item) => item.id === id);
  if (!row || row.gainCredited) return false;
  row.gainCredited = 1;
  state.account.balance += Number(row.potentialGain || 0);
  writeState(state);
  return true;
}

export function isAppActivated(): boolean { return readState().activated; }
export function activateApp(_code: string): void { const state = readState(); state.activated = true; writeState(state); }
