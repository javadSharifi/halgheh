import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { CALS, CAL_NAMES, type Cal, addDays, bdayOn, fa, label, month, parts, taskOn, today, wd } from './cal';
import { CalendarPage } from './CalendarPage';
import { ConfirmHost } from './confirm';
import { DayPage } from './DayPage';
import { NoteEditor } from './NoteEditor';
import { Onboarding } from './Onboarding';
import { RecurringForm } from './RecurringForm';
import { TodayPage } from './TodayPage';
import { Icon, type IconName } from './Icon';
import { BirthdaysPage } from './BirthdaysPage';
import { Tasks } from './Lists';
import { ToolsPage } from './Tools';
import { LockScreen } from './Lock';
import { AWAY_MS, getLock, useLock } from './lockStore';
import { SettingsPage } from './SettingsPage';
import { SearchPage } from './SearchPage';
import { SyncPage } from './SyncPage';
import { isNative, setSecure, watchNative } from './native';
import { startSync } from './sync';
import { useSettings } from './settings';
import { useTheme } from './theme';

type Page = 'today' | 'calendar' | 'day' | 'note' | 'task' | 'tasks' | 'birthdays' | 'settings' | 'sync' | 'search' | 'tools';
type NoteCtx = { id: string | null; date: string; from: Page };
type TaskCtx = { id: string | null; from: Page };

const NAV: { page: Page; label: string; icon: IconName }[] = [
  { page: 'today', label: 'امروز', icon: 'home' },
  { page: 'calendar', label: 'تقویم', icon: 'calendarDays' },
  { page: 'tools', label: 'ابزار', icon: 'toolbox' },
  { page: 'tasks', label: 'کارها', icon: 'listChecks' },
  { page: 'birthdays', label: 'تولدها', icon: 'cakeCandles' },
  { page: 'settings', label: 'تنظیمات', icon: 'settings' },
];
export function App() {
  const [page, setPage] = useState<Page>('today');
  const [sel, setSel] = useState(today());
  const [anchor, setAnchor] = useState(today());
  const [noteCtx, setNoteCtx] = useState<NoteCtx | null>(null);
  const [taskCtx, setTaskCtx] = useState<TaskCtx | null>(null);
  const [searchCtx, setSearchCtx] = useState<{ from: Page; filter?: 'all' | 'notes' | 'tasks' | 'birthdays' }>({ from: 'today' });
  const [bdayFocus, setBdayFocus] = useState<string | null>(null);
  const { cal, aux, hijriOffset: off, ongoing, remind, theme, onboarded } = useSettings();
  useTheme(theme);
  useEffect(() => startSync(), []);
  useEffect(() => (isNative ? watchNative({ cal, aux, off, ongoing, remind }) : undefined), [cal, aux, off, ongoing, remind]);
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
      if (page === 'note' || page === 'task') return click('.ne-head > button:first-child'); // the editor's own cancel asks before discarding
      if (page === 'tools' && click('button[aria-label="بازگشت به جعبه ابزار"]')) return true;
      if (page === 'search') return go(searchCtx.from), true;
      if (page === 'day') return go('calendar'), true;
      if (page === 'sync') return go('settings'), true;
      if (page !== 'today') return go('today'), true;
      return false;
    };
  });
  const openNote = (id: string | null, date: string) => {
    setNoteCtx({ id, date, from: page === 'note' ? 'today' : page });
    setPage('note');
    window.scrollTo(0, 0);
  };
  const openTask = (id: string | null) => {
    setTaskCtx({ id, from: page === 'task' ? 'tasks' : page });
    setPage('task');
    window.scrollTo(0, 0);
  };
  const openSearch = (filter?: 'all' | 'notes' | 'tasks' | 'birthdays') => {
    setSearchCtx({ from: page === 'search' ? 'today' : page, filter });
    setPage('search');
    window.scrollTo(0, 0);
  };
  const tabOf = (p: Page): Page => (p === 'sync' ? 'settings' : p === 'day' ? 'calendar' : p);
  const tab = tabOf(page === 'note' ? (noteCtx?.from ?? 'today') : page === 'task' ? (taskCtx?.from ?? 'tasks') : page === 'search' ? searchCtx.from : page);
  const activeIdx = Math.max(0, NAV.findIndex((n) => n.page === tab));
  const tabBtn = (n: (typeof NAV)[number]) => (
    <button key={n.page} aria-label={n.label} aria-current={tab === n.page ? 'page' : undefined} className={tab === n.page ? 'on' : ''} onClick={() => go(n.page)}>
      <Icon name={n.icon} size={22} />
      <span>{n.label}</span>
    </button>
  );
  const full = page === 'note' || page === 'task' || page === 'sync' || page === 'search'; // editors and the sync screen cover the whole screen: no tab bar
  if (!onboarded) return <Onboarding />; // first run: the questions come before everything else
  return (
    <>
      <main inert={locked && !!lock}>
        {page === 'today' && <TodayPage openDay={(d) => { setSel(d); go('day'); }} openNote={openNote} openSearch={() => openSearch()} />}
        {page === 'calendar' && <CalendarPage sel={sel} setSel={setSel} anchor={anchor} setAnchor={setAnchor} openDay={() => go('day')} />}
        {page === 'day' && <DayPage date={sel} setDate={(d) => { setSel(d); setAnchor(d); }} onBack={() => go('calendar')} onAddTask={() => openTask(null)} openNote={(id) => openNote(id, sel)} />}
        {page === 'note' && noteCtx && <NoteEditor key={`${noteCtx.id}|${noteCtx.date}`} id={noteCtx.id} date={noteCtx.date} onClose={() => go(noteCtx.from)} />}
        {page === 'tasks' && <Tasks openForm={openTask} />}
        {page === 'task' && taskCtx && <RecurringForm key={taskCtx.id ?? 'new'} id={taskCtx.id} onClose={() => go(taskCtx.from)} />}
        {page === 'birthdays' && <BirthdaysPage focusId={bdayFocus} onFocused={() => setBdayFocus(null)} openSearch={() => openSearch('birthdays')} />}
        {page === 'settings' && <SettingsPage openSync={() => go('sync')} />}
        {page === 'tools' && <ToolsPage onBack={() => go('today')} />}
        {page === 'sync' && <SyncPage onBack={() => go('settings')} />}
        {page === 'search' && (
          <SearchPage
            initialFilter={searchCtx.filter}
            onClose={() => go(searchCtx.from)}
            openNote={(n) => openNote(n.id, n.date)}
            openTask={(id) => openTask(id)}
            openBirthday={(id) => { setBdayFocus(id); go('birthdays'); }}
          />
        )}
      </main>
      <ConfirmHost />
      {locked && lock && <LockScreen onUnlock={() => setLocked(false)} />}
      {!full && (
      <div className="dock" inert={locked && !!lock}>
        <div className="bar" style={{ '--x': `${((activeIdx + 0.5) / NAV.length) * 100}%` } as React.CSSProperties}>
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
