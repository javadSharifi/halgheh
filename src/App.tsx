import { useEffect, useState, type CSSProperties } from 'react';
import { ConfirmHost } from './confirm';
import { RecurringForm } from './RecurringForm';
import { TodayPage } from './TodayPage';
import { Icon, type IconName } from './Icon';
import { BirthdaysPage } from './BirthdaysPage';
import { Tasks } from './Lists';
import { LockScreen } from './Lock';
import { AWAY_MS, getLock, useLock } from './lockStore';
import { SettingsPage } from './SettingsPage';
import { SearchPage } from './SearchPage';
import { SyncPage } from './SyncPage';
import { isNative, setSecure, watchNative } from './native';
import { startSync } from './sync';
import { useSettings } from './settings';
import { useTheme } from './theme';

type Page = 'today' | 'task' | 'tasks' | 'birthdays' | 'settings' | 'sync' | 'search';
type Filter = 'all' | 'tasks' | 'birthdays';
type TaskCtx = { id: string | null; from: Page };

const NAV: { page: Page; label: string; icon: IconName }[] = [
  { page: 'today', label: 'امروز', icon: 'home' },
  { page: 'tasks', label: 'کارها', icon: 'listChecks' },
  { page: 'birthdays', label: 'تولدها', icon: 'cakeCandles' },
  { page: 'settings', label: 'تنظیمات', icon: 'settings' },
];
export function App() {
  const [page, setPage] = useState<Page>('today');
  const [taskCtx, setTaskCtx] = useState<TaskCtx | null>(null);
  const [searchCtx, setSearchCtx] = useState<{ from: Page; filter?: Filter }>({ from: 'today' });
  const [bdayFocus, setBdayFocus] = useState<string | null>(null);
  const { remind, theme } = useSettings();
  useTheme(theme);
  useEffect(() => startSync(), []);
  useEffect(() => (isNative ? watchNative({ remind }) : undefined), [remind]);
  // the lock covers the app on a cold start and when coming back after being away; the page underneath stays mounted so no draft is lost
  const lock = useLock();
  const [locked, setLocked] = useState(() => !!getLock());
  useEffect(() => {
    if (!lock) setLocked(false);
    setSecure(!!lock);
  }, [lock]);
  useEffect(() => {
    let away = 0;
    const on = () => {
      if (document.hidden) away = Date.now();
      else if (getLock() && away && Date.now() - away > AWAY_MS) setLocked(true);
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  const go = (p: Page) => {
    setPage(p);
    window.scrollTo(0, 0);
  };
  // The Android back button asks the page first (MainActivity calls this): true = handled here, false = leave the app.
  useEffect(() => {
    (window as unknown as { __appBack: () => boolean }).__appBack = () => {
      const click = (sel: string) => {
        const el = document.querySelector<HTMLElement>(sel);
        el?.click();
        return !!el;
      };
      if (locked) return false; // nothing to go back to behind the lock
      if (click('.scrim.dim')) return true; // an open sheet or confirm dialog closes first
      if (page === 'task') return click('.ne-head > button:first-child'); // the editor's own cancel asks before discarding
      if (page === 'search') return go(searchCtx.from), true;
      if (page === 'sync') return go('settings'), true;
      if (page !== 'today') return go('today'), true;
      return false;
    };
  });
  const openTask = (id: string | null) => {
    setTaskCtx({ id, from: page === 'task' ? 'tasks' : page });
    setPage('task');
    window.scrollTo(0, 0);
  };
  const openSearch = (filter?: Filter) => {
    setSearchCtx({ from: page === 'search' ? 'today' : page, filter });
    setPage('search');
    window.scrollTo(0, 0);
  };
  const tabOf = (p: Page): Page => (p === 'sync' ? 'settings' : p);
  const tab = tabOf(page === 'task' ? (taskCtx?.from ?? 'tasks') : page === 'search' ? searchCtx.from : page);
  const activeIdx = Math.max(0, NAV.findIndex((n) => n.page === tab));
  const tabBtn = (n: (typeof NAV)[number]) => (
    <button key={n.page} aria-label={n.label} aria-current={tab === n.page ? 'page' : undefined} className={tab === n.page ? 'on' : ''} onClick={() => go(n.page)}>
      <Icon name={n.icon} size={22} />
      <span>{n.label}</span>
    </button>
  );
  const full = page === 'task' || page === 'sync' || page === 'search'; // editors and the sync screen cover the whole screen: no tab bar
  return (
    <>
      <main inert={locked && !!lock}>
        {page === 'today' && <TodayPage openSearch={() => openSearch()} />}
        {page === 'tasks' && <Tasks openForm={openTask} />}
        {page === 'task' && taskCtx && <RecurringForm key={taskCtx.id ?? 'new'} id={taskCtx.id} onClose={() => go(taskCtx.from)} />}
        {page === 'birthdays' && <BirthdaysPage focusId={bdayFocus} onFocused={() => setBdayFocus(null)} openSearch={() => openSearch('birthdays')} />}
        {page === 'settings' && <SettingsPage openSync={() => go('sync')} />}
        {page === 'sync' && <SyncPage onBack={() => go('settings')} />}
        {page === 'search' && (
          <SearchPage
            initialFilter={searchCtx.filter}
            onClose={() => go(searchCtx.from)}
            openTask={(id) => openTask(id)}
            openBirthday={(id) => { setBdayFocus(id); go('birthdays'); }}
          />
        )}
      </main>
      <ConfirmHost />
      {locked && lock && <LockScreen onUnlock={() => setLocked(false)} />}
      {!full && (
      <div className="dock" inert={locked && !!lock}>
        <div className="bar" style={{ '--x': `${((activeIdx + 0.5) / NAV.length) * 100}%` } as CSSProperties}>
          <nav aria-label="ناوبری اصلی">
            {NAV.map(tabBtn)}
          </nav>
          <span className="puck" key={tab} aria-hidden="true"><Icon name={NAV[activeIdx].icon} size={26} /></span>
        </div>
      </div>
      )}
    </>
  );
}
