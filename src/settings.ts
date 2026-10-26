import { useSyncExternalStore } from 'react';
import { CALS, type Cal } from './cal';

export type Theme = 'light' | 'dark' | 'auto';
export type WeekStart = 6 | 0 | 1; // JS weekday of the first column: Saturday, Sunday, Monday

export type Settings = {
  name: string;
  cal: Cal; // main calendar
  aux: Cal[]; // auxiliary calendars shown small next to it
  weekStart: WeekStart;
  theme: Theme;
  hijriOffset: number; // -2..2 days
  remind: boolean; // daily reminders (Android)
  ongoing: boolean; // ongoing summary notification (Android)
  onboarded: boolean; // false until the first-run questions have been answered
};

const KEY = 'settings';
const LEGACY = ['cal', 'off', 'ongoing', 'remind']; // loose keys used before the settings object

export const DEFAULTS: Settings = {
  name: '',
  cal: 'persian',
  aux: ['gregory', 'islamic'],
  weekStart: 6,
  theme: 'auto',
  hijriOffset: 0,
  remind: false,
  ongoing: false,
  onboarded: false,
};

const isCal = (x: unknown): x is Cal => CALS.includes(x as Cal);

/** Anything read from storage is untrusted: keep valid fields, fall back to defaults for the rest. */
export function normalize(x: unknown): Settings {
  const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const cal = isCal(r.cal) ? r.cal : DEFAULTS.cal;
  const aux = Array.isArray(r.aux) ? [...new Set(r.aux.filter(isCal))].filter((c) => c !== cal) : CALS.filter((c) => c !== cal);
  const off = Number(r.hijriOffset);
  return {
    name: typeof r.name === 'string' ? r.name.trim().slice(0, 40) : '',
    cal,
    aux,
    weekStart: r.weekStart === 0 || r.weekStart === 1 || r.weekStart === 6 ? r.weekStart : DEFAULTS.weekStart,
    theme: r.theme === 'light' || r.theme === 'dark' || r.theme === 'auto' ? r.theme : DEFAULTS.theme,
    hijriOffset: Number.isInteger(off) && Math.abs(off) <= 2 ? off : 0,
    remind: r.remind === true,
    ongoing: r.ongoing === true,
    onboarded: r.onboarded === true,
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

/** Reads the settings; on first run it migrates the old loose keys and removes them. */
export function loadSettings(store: Store): Settings {
  const saved = parse(store.getItem(KEY));
  if (saved !== undefined) {
    const s = normalize(saved);
    if (saved && typeof saved === 'object' && !('onboarded' in saved)) {
      s.onboarded = true; // an install from before the first-run questions existed: it has already been set up
      store.setItem(KEY, JSON.stringify(s));
    }
    return s;
  }
  const legacy = LEGACY.map((k) => parse(store.getItem(k)));
  const [cal, off, ongoing, remind] = legacy;
  const migrated = normalize({ cal, hijriOffset: off, ongoing, remind, onboarded: legacy.some((v) => v !== undefined) });
  store.setItem(KEY, JSON.stringify(migrated));
  LEGACY.forEach((k) => store.removeItem(k));
  return migrated;
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

/** Changing the main calendar swaps it with the old one in the auxiliary list, unless `aux` is given. */
export function updateSettings(patch: Partial<Settings>) {
  const aux = patch.aux ?? (patch.cal && patch.cal !== state.cal ? [...state.aux, state.cal] : state.aux);
  state = normalize({ ...state, ...patch, aux });
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
