import { expect, test } from 'vitest';
import { DEFAULTS, loadSettings, normalize } from './settings';

const fakeStore = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

test('garbage becomes defaults', () => {
  expect(normalize(null)).toEqual(DEFAULTS);
  expect(normalize({ cal: 'mars', theme: 7, weekStart: 3, hijriOffset: 9, aux: 'x', name: 5 })).toEqual(DEFAULTS);
});

test('valid values are kept and the main calendar never repeats in aux', () => {
  const s = normalize({ cal: 'islamic', aux: ['islamic', 'gregory', 'gregory', 'bogus'], weekStart: 1, theme: 'dark', hijriOffset: -1, name: '  Nilu  ', remind: true });
  expect(s).toMatchObject({ cal: 'islamic', aux: ['gregory'], weekStart: 1, theme: 'dark', hijriOffset: -1, name: 'Nilu', remind: true, ongoing: false });
});

test('first run migrates the old loose keys once and removes them', () => {
  const st = fakeStore({ cal: '"gregory"', off: '1', ongoing: 'true', remind: 'false' });
  const s = loadSettings(st);
  expect(s).toMatchObject({ cal: 'gregory', hijriOffset: 1, ongoing: true, remind: false, aux: ['persian', 'islamic'] });
  expect(s.onboarded).toBe(true); // had settings before: no first-run questions
  expect([...st.m.keys()]).toEqual(['settings']);
  expect(loadSettings(st)).toEqual(s);
});

test('a corrupt saved object falls back instead of throwing', () => {
  expect(loadSettings(fakeStore({ settings: '{not json' }))).toEqual(normalize(undefined));
});

test('theme resolution', async () => {
  const { resolveTheme } = await import('./theme');
  expect([resolveTheme('light', true), resolveTheme('dark', false), resolveTheme('auto', true), resolveTheme('auto', false)]).toEqual(['light', 'dark', 'dark', 'light']);
});

test('first-run questions: asked on a fresh install, never on an existing one', () => {
  expect(loadSettings(fakeStore()).onboarded).toBe(false);
  const old = fakeStore({ settings: JSON.stringify({ cal: 'persian', theme: 'dark' }) }); // saved before the field existed
  expect(loadSettings(old).onboarded).toBe(true);
  expect(JSON.parse(old.m.get('settings')!).onboarded).toBe(true); // and remembered
  const done = fakeStore({ settings: JSON.stringify({ onboarded: false }) });
  expect(loadSettings(done).onboarded).toBe(false); // explicitly unanswered stays unanswered
});
