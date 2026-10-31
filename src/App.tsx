import { useEffect, useState } from 'react';
import { ConfirmHost } from './confirm';
import { TodoSheet } from './TodoSheet';
import { TodayPage } from './TodayPage';
import { Icon, type IconName } from './Icon';
import { BirthdaysPage } from './BirthdaysPage';
import { Todos } from './Todos';
import { LockScreen } from './Lock';
import { AWAY_MS, getLock, useLock } from './lockStore';
import { SettingsPage } from './SettingsPage';
import { SearchPage } from './SearchPage';
import { SyncPage } from './SyncPage';
import { PeoplePage } from './PeoplePage';
import { PersonPage } from './PersonPage';
import { WhoCan } from './WhoCan';
import { Gallery } from './Gallery';
import { MorePage } from './MorePage';
import { ArchivePage } from './ArchivePage';
import { RulebookPage } from './RulebookPage';
import { ReviewSession } from './ReviewSession';
import { ReadThrough } from './ReadThrough';
import { PersonCheckPage } from './PersonCheck';
import { LedgerPage } from './LedgerPage';
import { BriefPage } from './BriefPage';
import { AboutPage } from './AboutPage';
import { PersonEditor } from './PersonEditor';
import { ContactsImport } from './ContactsImport';
import { watchKeyboard } from './keyboard';
import { getWidgetAction, isNative, setSecure, watchNative } from './native';
import { isConnected, startSync } from './sync';
import { downloadMissingPhotos, uploadPendingPhotos } from './photoSync';
import { useSettings } from './settings';
import { applyLang, tx, tk } from './i18n';
import { useTheme } from './theme';

type Page =
  | 'today'
  | 'people'
  | 'personnew'
  | 'person'
  | 'whocan'
  | 'gallery'
  | 'more'
  | 'tasks'
  | 'birthdays'
  | 'settings'
  | 'sync'
  | 'archive'
  | 'about'
  | 'rulebook'
  | 'review'
  | 'readthrough'
  | 'personcheck'
  | 'ledger'
  | 'brief'
  | 'search';
type Filter = 'all' | 'people' | 'notes' | 'todos' | 'photos' | 'birthdays' | 'rules' | 'exchanges';
type TaskCtx = { id: string | null; from: Page };

const TABS: { page: Page; label: string; icon: IconName }[] = [
  { page: 'today', label: tk('امروز'), icon: 'home' },
  { page: 'rulebook', label: tk('قوانین من'), icon: 'listChecks' },
  { page: 'people', label: tk('افراد'), icon: 'users' },
  { page: 'ledger', label: tk('دادوستد'), icon: 'repeat' },
  { page: 'more', label: tk('بیشتر'), icon: 'moreCircle' },
];
const MORE: Page[] = ['tasks', 'birthdays', 'settings', 'sync', 'archive', 'about', 'gallery'];

export function App() {
  const { lang } = useSettings();
  useEffect(() => applyLang(lang), [lang]);
  // a language change remounts every screen: each one reads tx() while rendering and none subscribes to it
  return <AppShell key={lang} />;
}

function AppShell() {
  const [page, setPage] = useState<Page>('today');
  const [importingContacts, setImportingContacts] = useState(false);
  const [personId, setPersonId] = useState<string | null>(null);
  // where the profile was opened from, so back returns there (a person opened from search must not drop the search)
  const [personFrom, setPersonFrom] = useState<{ page: Page; search?: { from: Page; filter?: Filter } }>({ page: 'people' });
  const [taskCtx, setTaskCtx] = useState<TaskCtx | null>(null);
  const [searchCtx, setSearchCtx] = useState<{ from: Page; filter?: Filter }>({ from: 'today' });
  const [bdayFocus, setBdayFocus] = useState<string | null>(null);
  const { remind, theme } = useSettings();
  useTheme(theme);
  useEffect(() => startSync(), []);
  // B2b: the photo file queue rides along with sync. Silent when no account is connected, and it never blocks the UI.
  useEffect(() => {
    if (!isConnected()) return;
    let alive = true;
    const run = async () => {
      if (!alive || !navigator.onLine) return;
      await uploadPendingPhotos().catch(() => {});
      // a restored phone has metadata but no files: ask the server what it has and fetch what is missing
      await downloadMissingPhotos().catch(() => {});
    };
    void run();
    const onOnline = () => void run();
    window.addEventListener('online', onOnline);
    return () => {
      alive = false;
      window.removeEventListener('online', onOnline);
    };
  }, []);
  useEffect(() => watchKeyboard(), []);
  useEffect(() => (isNative ? watchNative({ remind }) : undefined), [remind]);
  // Handle action when user taps "+ کار تازه" on Android Home Screen Widget
  useEffect(() => {
    const handleQuickTask = () => {
      setPage('today');
      setTaskCtx({ id: null, from: 'today' });
    };
    (window as unknown as { __onWidgetQuickTask?: () => void }).__onWidgetQuickTask = handleQuickTask;
    void getWidgetAction().then((res) => {
      if (res.quickTask) handleQuickTask();
    });
    return () => {
      delete (window as unknown as { __onWidgetQuickTask?: () => void }).__onWidgetQuickTask;
    };
  }, []);
  // the lock covers the app on a cold start and when coming back after being away; the page underneath stays mounted so no draft is lost
  const lock = useLock();
  const [reviewNow, setReviewNow] = useState(false);
  /** The rule a search result asked for; the rulebook opens its sheet as soon as it mounts. */
  const [ruleFocus, setRuleFocus] = useState<string | null>(null);
  /** Phase 4: which category (if any) the on-demand read-through was opened for. */
  const [readCtx, setReadCtx] = useState<{ categoryId?: string; name?: string }>({});
  /** Part 2: the rule check being read, and where it was opened from so back returns there. */
  const [checkCtx, setCheckCtx] = useState<{ id: string; from: Page } | null>(null);
  /** Part 4: the person whose pre-meeting brief is open, and where it was opened from. */
  const [briefFor, setBriefFor] = useState<{ personId: string; from: Page } | null>(null);
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
      if (click('.scrim.dim')) return true; // an open sheet or confirm dialog closes first (the contact import sheet included)
      // the rulebook's overlays (comparison session, check mode, review) are inside the page, not page states
      if ((window as unknown as { __rulebookBack?: () => boolean }).__rulebookBack?.()) return true;
      if (page === 'review') return go(reviewNow ? 'today' : 'rulebook'), true;
      if (page === 'readthrough') return go('rulebook'), true;
      if (page === 'personcheck') return go(checkCtx?.from ?? 'person'), true;
      if (page === 'brief') return go(briefFor?.from ?? 'person'), true;
      if (page === 'search') return go(searchCtx.from), true;
      if (page === 'person') return backFromPerson(), true;
      if (page === 'personnew') return go('people'), true;
      if (page === 'whocan') return go('people'), true;
      if (MORE.includes(page)) return go('more'), true;
      if (page !== 'today') return go('today'), true;
      return false;
    };
  });
  /** Part 2: opening a rule check records where it came from, so back returns to the profile or the ledger. */
  const openCheck = (id: string, from: Page) => {
    setCheckCtx({ id, from });
    go('personcheck');
  };
  /** Part 4: the pre-meeting brief, opened from a profile. */
  const openBrief = (personId: string) => {
    setBriefFor({ personId, from: page === 'brief' ? (briefFor?.from ?? 'person') : page });
    go('brief');
  };
  const openReadThrough = (categoryId?: string, name?: string) => {
    setReadCtx({ categoryId, name });
    go('readthrough');
  };
  const openReview = (from: 'today' | 'rulebook') => {
    setReviewNow(from === 'today');
    go('review');
  };
  const openPerson = (id: string) => {
    setPersonFrom(
      page === 'search'
        ? { page: 'search', search: searchCtx }
        : { page: page === 'person' ? personFrom.page : page === 'personnew' ? 'people' : page },
    );
    setPersonId(id);
    go('person');
  };
  const backFromPerson = () => {
    if (personFrom.page === 'search') setSearchCtx(personFrom.search ?? { from: 'today' });
    go(personFrom.page);
  };
  const openTask = (id: string | null) => {
    setTaskCtx({ id, from: page === 'search' ? 'search' : page });
  };
  const openSearch = (filter?: Filter) => {
    setSearchCtx({ from: page === 'search' ? 'today' : page, filter });
    setPage('search');
    window.scrollTo(0, 0);
  };
  const tabOf = (p: Page): Page => {
    if (p === 'person' || p === 'personnew' || p === 'whocan') return 'people';
    if (p === 'review' || p === 'readthrough') return 'rulebook';
    if (p === 'search') return tabOf(searchCtx.from);
    return MORE.includes(p) ? 'more' : p;
  };
  const tab = tabOf(page);
  const tabBtn = (n: (typeof TABS)[number]) => (
    <button key={n.page} aria-label={tx(n.label)} aria-current={tab === n.page ? 'page' : undefined} className={tab === n.page ? 'on' : ''} onClick={() => go(n.page)}>
      <Icon name={n.icon} size={22} />
      <span>{tx(n.label)}</span>
    </button>
  );
  const full = page === 'sync' || page === 'search' || page === 'person' || page === 'personnew' || page === 'whocan'; // full-screen pages: no tab bar
  return (
    <>
      <main inert={locked && !!lock}>
        {page === 'today' && (
          <TodayPage
            openSearch={() => openSearch()}
            openPerson={openPerson}
            openTask={openTask}
            openTodos={() => go('tasks')}
            openRulebook={() => go('rulebook')}
            openReview={() => openReview('today')}
            openLedger={() => go('ledger')}
          />
        )}
        {page === 'people' && (
          <PeoplePage
            openAddPerson={() => go('personnew')}
            openPerson={openPerson}
            openSearch={() => openSearch('people')}
            openWhoCan={() => go('whocan')}
          />
        )}
        {page === 'personnew' && (
          <PersonEditor
            asPage
            onClose={() => go('people')}
            onImportContacts={isNative ? () => setImportingContacts(true) : undefined}
            onSaved={(newPersonId) => openPerson(newPersonId)}
          />
        )}
        {page === 'person' && personId && (
          <PersonPage
            id={personId}
            onBack={backFromPerson}
            openCheck={(id) => openCheck(id, 'person')}
            openBrief={() => openBrief(personId)}
            openLedger={() => go('ledger')}
          />
        )}
        {page === 'whocan' && <WhoCan openPerson={openPerson} onClose={() => go('people')} />}
        {page === 'gallery' && <Gallery onBack={() => go('more')} />}
        {page === 'more' && (
          <MorePage
            openSettings={() => go('settings')}
            openSync={() => go('sync')}
            openArchive={() => go('archive')}
            openAbout={() => go('about')}
            openTasks={() => go('tasks')}
            openBirthdays={() => go('birthdays')}
            openGallery={() => go('gallery')}
          />
        )}
        {page === 'tasks' && <Todos openForm={openTask} openPerson={openPerson} />}
        {page === 'rulebook' && (
          <RulebookPage
            focusId={ruleFocus}
            onFocused={() => setRuleFocus(null)}
            openReview={() => openReview('rulebook')}
            openReadThrough={openReadThrough}
          />
        )}
        {page === 'readthrough' && <ReadThrough categoryId={readCtx.categoryId} categoryName={readCtx.name} onClose={() => go('rulebook')} />}
        {page === 'review' && <ReviewSession onClose={() => go(reviewNow ? 'today' : 'rulebook')} />}
        {page === 'personcheck' && checkCtx && <PersonCheckPage checkId={checkCtx.id} onBack={() => go(checkCtx.from)} />}
        {page === 'ledger' && <LedgerPage openPerson={openPerson} openCheck={(id) => openCheck(id, 'ledger')} />}
        {page === 'brief' && briefFor && (
          <BriefPage
            personId={briefFor.personId}
            onBack={() => go(briefFor.from)}
            openCheck={(id) => openCheck(id, 'brief')}
          />
        )}
        {page === 'birthdays' && <BirthdaysPage focusId={bdayFocus} onFocused={() => setBdayFocus(null)} openSearch={() => openSearch('birthdays')} />}
        {page === 'settings' && <SettingsPage openSync={() => go('sync')} />}
        {page === 'sync' && <SyncPage onBack={() => go('more')} />}
        {page === 'archive' && <ArchivePage />}
        {page === 'about' && <AboutPage />}
        {page === 'search' && (
          <SearchPage
            initialFilter={searchCtx.filter}
            onClose={() => go(searchCtx.from)}
            openPerson={openPerson}
            openTask={(id) => openTask(id)}
            openBirthday={(id) => { setBdayFocus(id); go('birthdays'); }}
            openRule={(id) => { setRuleFocus(id); go('rulebook'); }}
          />
        )}
      </main>
      <ConfirmHost />
      {locked && lock && <LockScreen onUnlock={() => setLocked(false)} />}
      {importingContacts && <ContactsImport onClose={() => setImportingContacts(false)} />}
      {taskCtx && <TodoSheet key={taskCtx.id ?? 'new'} id={taskCtx.id} onClose={() => setTaskCtx(null)} />}
      {!full && (
      <div className="dock" inert={locked && !!lock}>
        <div className="bar">
          <nav aria-label={tx('ناوبری اصلی')}>
            {TABS.map(tabBtn)}
          </nav>
        </div>
      </div>
      )}
    </>
  );
}
