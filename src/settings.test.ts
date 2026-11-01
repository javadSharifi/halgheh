import { expect, test } from 'vitest';
import { DEFAULTS, loadSettings, normalize } from './settings';

const fakeStore = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

test('garbage becomes defaults', () => {
  expect(normalize(null)).toEqual(DEFAULTS);
  expect(normalize({ weekStart: 3, theme: 'mars', remind: 'yes' })).toEqual(DEFAULTS);
});

test('valid values are kept', () => {
  expect(normalize({ weekStart: 1, theme: 'dark', remind: true })).toEqual({ weekStart: 1, theme: 'dark', remind: true, hideNames: false, lang: 'fa' });
});

test('a corrupt saved object falls back instead of throwing', () => {
  expect(loadSettings(fakeStore({ 'halgheh:settings': '{not json' }))).toEqual(DEFAULTS);
  expect(loadSettings(fakeStore())).toEqual(DEFAULTS);
});

test('theme resolution', async () => {
  const { resolveTheme } = await import('./theme');
  expect([resolveTheme('light', true), resolveTheme('dark', false), resolveTheme('auto', true), resolveTheme('auto', false)]).toEqual(['light', 'dark', 'dark', 'light']);
});
