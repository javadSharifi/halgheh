import { useEffect } from 'react';
import type { Theme } from './settings';
import { setBars } from './native';

const query = () => window.matchMedia('(prefers-color-scheme: dark)');

/** 'auto' follows the system; light/dark are manual. */
export const resolveTheme = (theme: Theme, systemDark: boolean): 'light' | 'dark' => (theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme);

function apply(theme: Theme) {
  const t = resolveTheme(theme, query().matches);
  document.documentElement.dataset.theme = t;
  setBars(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), t === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0c0e16' : '#0f766e');
}

/** Keeps <html data-theme> in step with the setting, and with the system while the setting is 'auto'. */
export function useTheme(theme: Theme) {
  useEffect(() => {
    apply(theme);
    if (theme !== 'auto') return;
    const q = query();
    const on = () => apply('auto');
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, [theme]);
}
