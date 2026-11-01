import { lazy, Suspense, useEffect, useState } from 'react';
import { ConfirmHost } from './confirm';
import { AddMenu, type AddKind } from './AddMenu';
import { TodayTabs } from './TodayTabs';
import { TodoSheet } from './TodoSheet';
import { TodayPage } from './TodayPage';
import { Icon, type IconName } from './Icon';
import { Todos } from './Todos'; // also imported by TodayWidget (toggleTodo), so it cannot leave the first chunk
import { LockScreen } from './Lock';
import { AWAY_MS, getLock, useLock } from './lockStore';
import { PeoplePage } from './PeoplePage';
import { MorePage } from './MorePage';
import { RulebookPage } from './RulebookPage';
import { ReviewSession } from './ReviewSession'; // also imported by RulebookPage, so it cannot leave the first chunk
import { LedgerPage } from './LedgerPage';
import { ContactsImport } from './ContactsImport';
import { watchKeyboard } from './keyboard';
import { getWidgetAction, isNative, setSecure, watchNative } from './native';
import { isConnected, startSync } from './sync';
import { downloadMissingPhotos, uploadPendingPhotos } from './photoSync';
import { useSettings } from './settings';
import { applyLang, tx, tk } from './i18n';
import { useTheme } from './theme';

// Every screen that is not one of the five tabs loads on first visit, so start-up parses only the tab screens.
const BirthdaysPage = lazy(() => import('./BirthdaysPage').then((m) => ({ default: m.BirthdaysPage })));
const SettingsPage = lazy(() => import('./SettingsPage').then((m) => ({ default: m.SettingsPage })));
const SearchPage = lazy(() => import('./SearchPage').then((m) => ({ default: m.SearchPage })));
const SyncPage = lazy(() => import('./SyncPage').then((m) => ({ default: m.SyncPage })));
const PersonPage = lazy(() => import('./PersonPage').then((m) => ({ default: m.PersonPage })));
const GraphPage = lazy(() => import('./GraphPage').then((m) => ({ default: m.GraphPage })));
const WeeklyPage = lazy(() => import('./WeeklyPage').then((m) => ({ default: m.WeeklyPage })));
const TouchPage = lazy(() => import('./TouchPage').then((m) => ({ default: m.TouchPage })));
const WhoCan = lazy(() => import('./WhoCan').then((m) => ({ default: m.WhoCan })));
const Gallery = lazy(() => import('./Gallery').then((m) => ({ default: m.Gallery })));
const ArchivePage = lazy(() => import('./ArchivePage').then((m) => ({ default: m.ArchivePage })));
const ReadThrough = lazy(() => import('./ReadThrough').then((m) => ({ default: m.ReadThrough })));
const PersonCheckPage = lazy(() => import('./PersonCheck').then((m) => ({ default: m.PersonCheckPage })));
const BriefPage = lazy(() => import('./BriefPage').then((m) => ({ default: m.BriefPage })));
const AboutPage = lazy(() => import('./AboutPage').then((m) => ({ default: m.AboutPage })));
const PersonEditor = lazy(() => import('./PersonEditor').then((m) => ({ default: m.PersonEditor })));
const ExchangePage = lazy(() => import('./ExchangePage').then((m) => ({ default: m.ExchangePage })));

type Page =
  | 'today'
  | 'people'
  | 'personnew'
  | 'person'
  | 'whocan'
  | 'graph'
  | 'touch'
  | 'weekly'
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
  | 'exchange'
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
const MORE: Page[] = ['settings', 'sync', 'archive', 'about', 'gallery'];

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
  /** Set by the global + so the target screen opens its own add page as soon as it mounts. */
  const [startAdd, setStartAdd] = useState<'birthday' | 'rule' | null>(null);
  const [exchangeCtx, setExchangeCtx] = useState<{
    exchangeId?: string | null;
    seedPersonId?: string;
    from: Page;
  } | null>(null);
  const { remind, theme, hideNames } = useSettings();
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
  useEffect(() => (isNative ? watchNative({ remind, hideNames }) : undefined), [remind, hideNames]);
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
      if (click('.scrim.dim, .ui-sheet-backdrop')) return true; // an open sheet or confirm dialog closes first (the contact import sheet included)
      // the rulebook's overlays (comparison session, check mode, review) are inside the page, not page states
      if ((window as unknown as { __rulebookBack?: () => boolean }).__rulebookBack?.()) return true;
      // an open add/edit page (FormPage) closes before the page under it reacts; the innermost one is the last in the DOM
      const forms = document.querySelectorAll<HTMLElement>('.form-page .fp-back');
      if (forms.length) return forms[forms.length - 1].click(), true;
      if (page === 'review') return go(reviewNow ? 'today' : 'rulebook'), true;
      if (page === 'readthrough') return go('rulebook'), true;
      if (page === 'personcheck') return go(checkCtx?.from ?? 'person'), true;
      if (page === 'exchange') return backFromExchange(), true;
      if (page === 'brief') return go(briefFor?.from ?? 'person'), true;
      if (page === 'search') return go(searchCtx.from), true;
      if (page === 'person') return backFromPerson(), true;
      if (page === 'personnew') return go('people'), true;
      if (page === 'whocan' || page === 'graph' || page === 'touch') return go('people'), true;
      if (page === 'weekly') return go('today'), true;
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
  const openExchange = (seedPersonId?: string, exchangeId?: string | null, from?: Page) => {
    setExchangeCtx({
      seedPersonId,
      exchangeId: exchangeId ?? null,
      from: from ?? (page === 'exchange' ? (exchangeCtx?.from ?? 'ledger') : page),
    });
    go('exchange');
  };
  const backFromExchange = () => {
    const target = exchangeCtx?.from ?? 'ledger';
    setExchangeCtx(null);
    go(target);
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
  const addFromMenu = (k: AddKind) => {
    if (k === 'task') openTask(null);
    else if (k === 'person') go('personnew');
    else if (k === 'exchange') openExchange();
    else {
      setStartAdd(k);
      go(k === 'birthday' ? 'birthdays' : 'rulebook');
    }
  };
  const openSearch = (filter?: Filter) => {
    setSearchCtx({ from: page === 'search' ? 'today' : page, filter });
    setPage('search');
    window.scrollTo(0, 0);
  };
  const tabOf = (p: Page): Page => {
    if (p === 'person' || p === 'personnew' || p === 'whocan' || p === 'graph' || p === 'touch') return 'people';
    if (p === 'review' || p === 'readthrough') return 'rulebook';
    if (p === 'tasks' || p === 'birthdays' || p === 'weekly') return 'today';
    if (p === 'exchange') return tabOf(exchangeCtx?.from ?? 'ledger');
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
  const full =
    page === 'sync' ||
    page === 'search' ||
    page === 'person' ||
    page === 'personnew' ||
    page === 'whocan' ||
    page === 'graph' ||
    page === 'touch' ||
    page === 'weekly' ||
    page === 'exchange' ||
    page === 'brief' ||
    page === 'personcheck';
  return (
    <>
      <main inert={locked && !!lock}><Suspense fallback={null}>
        {(page === 'today' || page === 'tasks' || page === 'birthdays') && <TodayTabs current={page} go={go} />}
        {page === 'today' && (
          <TodayPage
            openSearch={() => openSearch()}
            openPerson={openPerson}
            openTask={openTask}
            openTodos={() => go('tasks')}
            openRulebook={() => go('rulebook')}
            openReview={() => openReview('today')}
            openLedger={() => go('ledger')}
            openTouch={() => go('touch')}
            openWeekly={() => go('weekly')}
          />
        )}
        {page === 'people' && (
          <PeoplePage
            openAddPerson={() => go('personnew')}
            openPerson={openPerson}
            openSearch={() => openSearch('people')}
            openWhoCan={() => go('whocan')}
            openGraph={() => go('graph')}
            openTouch={() => go('touch')}
          />
        )}
        {page === 'personnew' && (
          <PersonEditor
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
            openExchange={(seedPersonId, exchangeId) => openExchange(seedPersonId, exchangeId, 'person')}
          />
        )}
        {page === 'graph' && <GraphPage openPerson={openPerson} onClose={() => go('people')} />}
        {page === 'weekly' && <WeeklyPage openPerson={openPerson} onClose={() => go('today')} />}
        {page === 'touch' && <TouchPage openPerson={openPerson} onClose={() => go('people')} />}
        {page === 'whocan' && <WhoCan openPerson={openPerson} onClose={() => go('people')} />}
        {page === 'gallery' && <Gallery onBack={() => go('more')} />}
        {page === 'more' && (
          <MorePage
            openWeekly={() => go('weekly')}
            openSearch={() => openSearch()}
            openSettings={() => go('settings')}
            openSync={() => go('sync')}
            openArchive={() => go('archive')}
            openAbout={() => go('about')}
            openGallery={() => go('gallery')}
          />
        )}
        {page === 'tasks' && <Todos openForm={openTask} openPerson={openPerson} openSearch={() => openSearch('todos')} />}
        {page === 'rulebook' && (
          <RulebookPage
            startAdd={startAdd === 'rule'}
            onStarted={() => setStartAdd(null)}
            openSearch={() => openSearch('rules')}
            focusId={ruleFocus}
            onFocused={() => setRuleFocus(null)}
            openReview={() => openReview('rulebook')}
            openReadThrough={openReadThrough}
          />
        )}
        {page === 'readthrough' && <ReadThrough categoryId={readCtx.categoryId} categoryName={readCtx.name} onClose={() => go('rulebook')} />}
        {page === 'review' && <ReviewSession onClose={() => go(reviewNow ? 'today' : 'rulebook')} />}
        {page === 'personcheck' && checkCtx && <PersonCheckPage checkId={checkCtx.id} onBack={() => go(checkCtx.from)} />}
        {page === 'ledger' && (
          <LedgerPage
            openSearch={() => openSearch('exchanges')}
            openPerson={openPerson}
            openCheck={(id) => openCheck(id, 'ledger')}
            openExchange={(seedPersonId, exchangeId) => openExchange(seedPersonId, exchangeId, 'ledger')}
          />
        )}
        {page === 'exchange' && (
          <ExchangePage
            exchangeId={exchangeCtx?.exchangeId}
            seedPersonId={exchangeCtx?.seedPersonId}
            onBack={backFromExchange}
            openCheck={(id) => openCheck(id, 'exchange')}
          />
        )}
        {page === 'brief' && briefFor && (
          <BriefPage
            personId={briefFor.personId}
            onBack={() => go(briefFor.from)}
            openCheck={(id) => openCheck(id, 'brief')}
            openExchange={(seedPersonId, exchangeId) => openExchange(seedPersonId, exchangeId, 'brief')}
          />
        )}
        {page === 'birthdays' && <BirthdaysPage focusId={bdayFocus} onFocused={() => setBdayFocus(null)} startAdd={startAdd === 'birthday'} onStarted={() => setStartAdd(null)} openSearch={() => openSearch('birthdays')} />}
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
      </Suspense></main>
      <ConfirmHost />
      {locked && lock && <LockScreen onUnlock={() => setLocked(false)} />}
      {importingContacts && <ContactsImport onClose={() => setImportingContacts(false)} />}
      {taskCtx && <TodoSheet key={taskCtx.id ?? 'new'} id={taskCtx.id} onClose={() => setTaskCtx(null)} />}
      {!full && !locked && <AddMenu onPick={addFromMenu} />}
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
