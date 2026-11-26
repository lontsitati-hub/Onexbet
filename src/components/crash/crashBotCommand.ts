export type CrashBotTarget = {
  commandId: string;
  target: number;
};

const MIN_TARGET = 1;
const MAX_TARGET = 1000;
const MAX_AGE_MS = 10 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;

export type CrashBotCommandStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export function crashBotCommandStorageKey(uid: string): string {
  return `onexbet:crash-bot:last-command:v1:${uid}`;
}

export function loadLastCrashBotCommandId(storage: CrashBotCommandStorage, uid: string): Promise<string | null> {
  return storage.getItem(crashBotCommandStorageKey(uid));
}

export function persistCrashBotCommandId(storage: CrashBotCommandStorage, uid: string, commandId: string): Promise<void> {
  return storage.setItem(crashBotCommandStorageKey(uid), commandId);
}

type CrashBotDocument = {
  target?: unknown;
  commandId?: unknown;
  source?: unknown;
  updatedAt?: unknown;
};

export function parseCrashBotCommand(
  value: unknown,
  nowMs = Date.now(),
  lastCommandId: string | null = null,
): CrashBotTarget | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as CrashBotDocument;
  if (data.source !== 'botx-web') return null;
  if (typeof data.commandId !== 'string' || data.commandId.trim().length < 1 || data.commandId.length > 128) return null;
  if (data.commandId === lastCommandId) return null;
  if (typeof data.target !== 'number' || !Number.isFinite(data.target) || data.target < MIN_TARGET || data.target > MAX_TARGET) return null;

  const updatedAt = data.updatedAt as { toMillis?: () => number } | null | undefined;
  if (!updatedAt || typeof updatedAt.toMillis !== 'function') return null;
  let timestamp: number;
  try {
    timestamp = updatedAt.toMillis();
  } catch {
    return null;
  }
  if (!Number.isFinite(timestamp)) return null;
  const age = nowMs - timestamp;
  if (age < -MAX_FUTURE_SKEW_MS || age > MAX_AGE_MS) return null;

  return { commandId: data.commandId, target: data.target };
}
