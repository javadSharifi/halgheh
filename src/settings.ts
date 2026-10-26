import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'auto';
export type WeekStart = 6 | 0 | 1; // JS weekday of the first column: Saturday, Sunday, Monday

export type Settings = {
  weekStart: WeekStart;
  theme: Theme;
  remind: boolean; // daily reminders (Android)
};

const KEY = 'halgheh:settings';

export const DEFAULTS: Settings = {
  weekStart: 6,
  theme: 'auto',
  remind: false,
};

/** Anything read from storage is untrusted: keep valid fields, fall back to defaults for the rest. */
export function normalize(x: unknown): Settings {
  const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  return {
    weekStart: r.weekStart === 0 || r.weekStart === 1 || r.weekStart === 6 ? r.weekStart : DEFAULTS.weekStart,
    theme: r.theme === 'light' || r.theme === 'dark' || r.theme === 'auto' ? r.theme : DEFAULTS.theme,
    remind: r.remind === true,
  };
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const parse = (raw: string | null) => {
  try {
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
};

export function loadSettings(store: Store): Settings {
  return normalize(parse(store.getItem(KEY)));
}

const storage = (): Store | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // storage blocked: settings just won't persist
  }
};

let state = (() => {
  const s = storage();
  try {
    return s ? loadSettings(s) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
})();
const subs = new Set<() => void>();

export const getSettings = () => state;

export function updateSettings(patch: Partial<Settings>) {
  state = normalize({ ...state, ...patch });
  try {
    storage()?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode: keep the in-memory value */
  }
  subs.forEach((f) => f());
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const useSettings = () => useSyncExternalStore(subscribe, getSettings);
