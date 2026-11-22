import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type CompareSession, type RuleCategory, type Task, db, put } from './db';
import { fa, label, today } from './cal';
import { ask } from './confirm';
import { Icon } from './Icon';
import { Button, Card, InputField, PageHead, Select } from './ui';
import { STR } from './strings/rulebook';
import { addSession, deleteSession, ensureShoppingCategory, itemsOf, orderCategories, orderSessions } from './ruleData';
import { orderItems as orderByRules, statsFor } from './domain/compare';
import { doneDateFor, doneKey } from './todoFilters';
import { toggleTodo } from './Todos';
import { CategorySheet } from './CategorySheet';
import { CompareHome } from './CompareHome';
import { CompareSessionPage } from './CompareSessionPage';
import { CompareCheckMode } from './CompareCheck';
import { tn, tx } from './i18n';

type SessionFilter = 'all' | 'open' | 'decided';

export function ShoppingPage({
  openSearch,
  openTask,
  focusSessionId,
  onSessionFocused,
}: {
  openSearch: () => void;
  openTask: (id: string | null, seedKind?: Task['kind']) => void;
  focusSessionId?: string | null;
  onSessionFocused?: () => void;
}) {
  const categories = useLiveQuery(() => db.ruleCategories.toArray(), []) ?? [];
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? [];
  const sessions = useLiveQuery(() => db.compareSessions.toArray(), []) ?? [];
  const items = useLiveQuery(() => db.compareItems.toArray(), []) ?? [];
  const checks = useLiveQuery(() => db.compareChecks.toArray(), []) ?? [];
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const dones = useLiveQuery(() => db.done.toArray(), []) ?? [];

  const [newTitle, setNewTitle] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');
  const [filter, setFilter] = useState<SessionFilter>('all');
  const [busy, setBusy] = useState(false);

  const [compareHomeCat, setCompareHomeCat] = useState<RuleCategory | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCategoryId, setSessionCategoryId] = useState<string | null>(null);
  const [checking, setChecking] = useState<{ itemId: string; categoryId: string } | null>(null);
  const [managing, setManaging] = useState(false);

  const t = today();
  const orderedCats = useMemo(() => orderCategories(categories), [categories]);
  const compareCats = useMemo(() => orderedCats.filter((c) => c.compareEnabled), [orderedCats]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Default quick-create category to «خرید» if present, otherwise the first compare-enabled category.
  const activeCatId = useMemo(() => {
    if (selectedCatId && compareCats.some((c) => c.id === selectedCatId)) return selectedCatId;
    return compareCats.find((c) => c.name.trim() === 'خرید')?.id ?? compareCats[0]?.id ?? '';
  }, [selectedCatId, compareCats]);

  useEffect(() => {
    if (!focusSessionId) return;
    setSessionId(focusSessionId);
    onSessionFocused?.();
  }, [focusSessionId, onSessionFocused]);

  useEffect(() => {
    const closer = () => {
      if (checking) {
        setChecking(null);
        return true;
      }
      if (sessionId) {
        setSessionId(null);
        return true;
      }
      if (compareHomeCat) {
        setCompareHomeCat(null);
        return true;
      }
      return false;
    };
    (window as unknown as { __rulebookBack?: () => boolean }).__rulebookBack = closer;
    return () => {
      delete (window as unknown as { __rulebookBack?: () => boolean }).__rulebookBack;
    };
  }, [checking, sessionId, compareHomeCat]);

  const orderedSessions = useMemo(() => orderSessions(sessions), [sessions]);
  const shownSessions = useMemo(
    () => (filter === 'all' ? orderedSessions : orderedSessions.filter((s) => s.status === filter)),
    [orderedSessions, filter],
  );
  const openCount = useMemo(() => sessions.filter((s) => s.status === 'open').length, [sessions]);
  const decidedCount = useMemo(() => sessions.filter((s) => s.status === 'decided').length, [sessions]);

  const doneIds = useMemo(() => new Set(dones.map((d) => d.id)), [dones]);
  const shoppingTasks = useMemo(() => {
    const list = tasks
      .filter((task) => task.kind === 'shopping')
      .map((task) => ({
        task,
        done: doneIds.has(doneKey(task.id, doneDateFor(task, t))),
      }));
    return list.sort((a, b) => Number(a.done) - Number(b.done) || b.task.updatedAt - a.task.updatedAt);
  }, [tasks, doneIds, t]);

  const createComparison = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const targetCatId = activeCatId || (await ensureShoppingCategory()).id;
      const catName = catById.get(targetCatId)?.name ?? 'خرید';
      const clean = newTitle.trim() || tx('مقایسهٔ {a1}', { a1: tx(catName) });
      const created = await addSession(targetCatId, clean);
      setNewTitle('');
      setSessionId(created.id);
    } finally {
      setBusy(false);
    }
  };

  const openTaskComparison = async (task: Task) => {
    if (task.compareSessionId && sessions.some((s) => s.id === task.compareSessionId)) {
      setSessionId(task.compareSessionId);
      return;
    }
    const cat = await ensureShoppingCategory();
    const created = await addSession(cat.id, task.title);
    await put('tasks', { ...task, compareSessionId: created.id, updatedAt: Date.now() });
    setSessionId(created.id);
  };

  const removeSession = async (s: CompareSession) => {
    const ok = await ask({
      title: tx(STR.compare.deleteSessionTitle(s.title)),
      message: tx(STR.compare.deleteSessionBody),
      confirm: tx(STR.feature.delete),
      icon: 'trash',
    });
    if (ok) await deleteSession(s);
  };

  const catOptions = compareCats.map((c) => ({ value: c.id, label: tx(c.name) }));
  const overlay = !!sessionId || !!checking;

  return (
    <>
      <div className={overlay ? 'rulebook-under' : undefined} aria-hidden={overlay || undefined}>
        <PageHead
          title={tx('خرید و مقایسه')}
          tools={[
            { icon: 'search', label: tx('جستجو'), onClick: openSearch },
            { icon: 'alignLeft', label: tx('دسته‌های مقایسه'), onClick: () => setManaging(true) },
          ]}
        />

        <Card className="shop-quick-card">
          <div className="shop-quick-head">
            <span className="tile blue" aria-hidden="true"><Icon name="contrast" size={18} stroke={2} /></span>
            <div>
              <b>{tx('مقایسهٔ تازه بساز')}</b>
              <p className="hint">{tx('کالاها را کنار هم بگذار، با معیارهای خرید بسنج و بهترین انتخاب را پیدا کن.')}</p>
            </div>
          </div>

          <div className="shop-quick-fields">
            <InputField
              value={newTitle}
              maxLength={80}
              placeholder={tx(STR.compare.sessionTitlePlaceholder)}
              aria-label={tx('نام مقایسه')}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void createComparison(); } }}
              enterKeyHint="done"
            />
            {catOptions.length > 0 && (
              <Select
                label={tx('دستهٔ معیارها')}
                value={activeCatId}
                onChange={(e) => setSelectedCatId(e.target.value)}
                options={catOptions}
              />
            )}
            <Button variant="primary" block icon="plus" disabled={busy} onClick={() => void createComparison()}>
              {tx('شروع مقایسه')}
            </Button>
          </div>
        </Card>

        <section>
          <div className="section-head">
            <h2>{tx('مقایسه‌های من')}</h2>
            {orderedSessions.length > 0 && <span className="hint tabular-nums">{tn('{n} مورد', orderedSessions.length)}</span>}
          </div>

          {orderedSessions.length > 0 && (
            <div className="tabs rule-sort" role="tablist" aria-label={tx(STR.compare.sessions)}>
              <button role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
                {tx('همه')} · {fa(orderedSessions.length)}
              </button>
              <button role="tab" aria-selected={filter === 'open'} className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>
                {tx(STR.compare.openSession)} · {fa(openCount)}
              </button>
              <button role="tab" aria-selected={filter === 'decided'} className={filter === 'decided' ? 'on' : ''} onClick={() => setFilter('decided')}>
                {tx(STR.compare.decidedSession)} · {fa(decidedCount)}
              </button>
            </div>
          )}

          {shownSessions.length === 0 ? (
            <Card className="empty-state">
              <span className="tile purple" aria-hidden="true"><Icon name="contrast" size={24} stroke={1.7} /></span>
              <b>{orderedSessions.length === 0 ? tx('هنوز مقایسه‌ای نساخته‌ای') : tx('در این فیلتر مقایسه‌ای نیست')}</b>
              <p className="hint">
                {orderedSessions.length === 0
                  ? tx('نام خریدت را بالا بنویس (مثل گوشی تازه یا ماشین) و چند گزینه را با معیارهایت مقایسه کن.')
                  : tx('فیلتر بالا را روی «همه» بگذار یا یک مقایسهٔ تازه شروع کن.')}
              </p>
            </Card>
          ) : (
            <div className="shop-session-list">
              {shownSessions.map((s) => {
                const cat = catById.get(s.categoryId);
                const sItems = itemsOf(items, s.id);
                const catRules = rules.filter((r) => r.categoryId === s.categoryId && !r.archivedAt);
                const sChecks = checks.filter((c) => sItems.some((i) => i.id === c.itemId));
                const ranked = orderByRules(sItems, catRules, sChecks);
                const chosen = s.chosenItemId ? sItems.find((i) => i.id === s.chosenItemId) : undefined;
                const lead = ranked[0];
                const leadStats = lead ? statsFor(lead.id, catRules, sChecks) : null;
                const pct = (n: number, total: number) => (total ? `${(n / total) * 100}%` : '0%');
                const metaParts = [
                  cat ? tx(cat.name) : '',
                  tx('{a1} کالا', { a1: fa(sItems.length) }),
                  tx('{a1} معیار', { a1: fa(catRules.length) }),
                  label(new Date(s.updatedAt).toLocaleDateString('sv'), 'persian', 0, { day: 'numeric', month: 'long' }),
                ].filter(Boolean);

                return (
                  <article key={s.id} className={`shop-session-card${s.status === 'decided' ? ' decided' : ''}`}>
                    <div className="shop-session-row">
                      <button type="button" className="shop-session-open" onClick={() => setSessionId(s.id)}>
                        <span className={`tile ${s.status === 'decided' ? 'green' : 'blue'}`} aria-hidden="true">
                          <Icon name={s.status === 'decided' ? 'checkCircle' : 'contrast'} size={17} stroke={2} />
                        </span>
                        <span className="shop-session-body">
                          <span className="shop-session-head">
                            <b><bdi>{s.title}</bdi></b>
                            <span className={`shop-status-text${s.status === 'decided' ? ' ok' : ''}`}>
                              {s.status === 'decided' ? tx(STR.compare.decidedSession) : tx(STR.compare.openSession)}
                            </span>
                          </span>
                          <span className="shop-session-meta tabular-nums">{metaParts.join(' · ')}</span>
                          {s.status === 'decided' && chosen ? (
                            <span className="shop-session-winner">{tx('انتخاب‌شده: {a1}', { a1: chosen.name })}</span>
                          ) : lead && leadStats && leadStats.pass > 0 ? (
                            <span className="shop-session-lead tabular-nums">
                              {tx('پیشتاز: {a1} · {a2} از {a3}', { a1: lead.name, a2: fa(leadStats.pass), a3: fa(leadStats.total) })}
                            </span>
                          ) : null}
                        </span>
                        <Icon name="chevronLeft" size={16} stroke={2} />
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="danger"
                        icon="trash"
                        aria-label={`${tx(STR.feature.delete)} ${s.title}`}
                        onClick={() => void removeSession(s)}
                      />
                    </div>
                    {lead && leadStats && leadStats.total > 0 && (
                      <div className="cmp-bar" aria-hidden="true">
                        <i className="pass" style={{ width: pct(leadStats.pass, leadStats.total) }} />
                        <i className="fail" style={{ width: pct(leadStats.fail, leadStats.total) }} />
                        <i className="unknown" style={{ width: pct(leadStats.unknown, leadStats.total) }} />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="section-head">
            <h2>{tx('دسته‌ها و معیارهای خرید')}</h2>
            <button type="button" className="text-btn" onClick={() => setManaging(true)}>{tx('مدیریت دسته‌ها')}</button>
          </div>
          <Card variant="glass" className="set-list">
            {compareCats.length === 0 ? (
              <div className="empty-state">
                <p className="hint">{tx('هیچ دسته‌ای در حالت مقایسه نیست؛ از «مدیریت دسته‌ها» می‌توانی مقایسهٔ خرید را برای یک دسته روشن کنی.')}</p>
                <Button variant="secondary" icon="tag" onClick={() => setManaging(true)}>{tx('مدیریت دسته‌ها')}</Button>
              </div>
            ) : (
              compareCats.map((cat) => {
                const rCount = rules.filter((r) => r.categoryId === cat.id && !r.archivedAt).length;
                const sCount = sessions.filter((s) => s.categoryId === cat.id).length;
                return (
                  <button key={cat.id} className="set-row as-btn" onClick={() => setCompareHomeCat(cat)}>
                    <span className="tile purple" aria-hidden="true"><Icon name="listChecks" size={17} stroke={1.9} /></span>
                    <span className="set-name-col">
                      <span className="set-name"><bdi>{tx(cat.name)}</bdi></span>
                      <span className="set-sub tabular-nums">
                        {tx('{a1} معیار · {a2} مقایسه', { a1: fa(rCount), a2: fa(sCount) })}
                      </span>
                    </span>
                    <Icon name="chevronLeft" size={16} stroke={2} />
                  </button>
                );
              })
            )}
          </Card>
        </section>

        <section>
          <div className="section-head">
            <h2>{tx('کارهای خرید')}</h2>
            <button type="button" className="text-btn" onClick={() => openTask(null, 'shopping')}>
              <Icon name="plus" size={14} stroke={2.4} />
              {tx('کار خرید تازه')}
            </button>
          </div>
          <Card variant="glass" className="task-list">
            {shoppingTasks.length === 0 ? (
              <div className="empty-state">
                <p className="hint">{tx('کارهایی که نوعشان «خرید» باشد اینجا جمع می‌شوند تا سریع به مقایسه‌شان دسترسی داشته باشی.')}</p>
                <Button variant="secondary" icon="plus" onClick={() => openTask(null, 'shopping')}>{tx('کار خرید تازه')}</Button>
              </div>
            ) : (
              shoppingTasks.map(({ task, done }) => {
                const linkedCount = task.compareSessionId ? itemsOf(items, task.compareSessionId).length : 0;
                return (
                  <div key={task.id} className={`task-row${done ? ' done' : ''}`}>
                    <button
                      className="tick"
                      aria-pressed={done}
                      aria-label={done ? tx('{a1}، انجام شد', { a1: task.title }) : tx('{a1}، انجام نشده', { a1: task.title })}
                      onClick={() => void toggleTodo(task, done)}
                    >
                      <span className="circle">{done && <Icon name="check" size={13} stroke={3} />}</span>
                    </button>
                    <button className="t-body" onClick={() => openTask(task.id)} aria-label={tx('ویرایش {a1}', { a1: task.title })}>
                      <span className="t-title"><bdi>{task.title}</bdi></span>
                      <span className="t-sub tabular-nums">
                        {task.on ? label(task.on, 'persian', 0, { day: 'numeric', month: 'long' }) : tx('بدون موعد')}
                        {task.compareSessionId ? ` · ${tx('{a1} کالا', { a1: fa(linkedCount) })}` : ''}
                      </span>
                    </button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="contrast"
                      onClick={() => void openTaskComparison(task)}
                    >
                      {tx('مقایسه')}
                    </Button>
                  </div>
                );
              })
            )}
          </Card>
        </section>
      </div>

      {!overlay && managing && <CategorySheet categories={orderedCats} rules={rules} onClose={() => setManaging(false)} />}
      {compareHomeCat && (
        <CompareHome
          category={catById.get(compareHomeCat.id) ?? compareHomeCat}
          rules={rules}
          onOpen={(id) => { setCompareHomeCat(null); setSessionId(id); }}
          onClose={() => setCompareHomeCat(null)}
        />
      )}
      {sessionId && (
        <CompareSessionPage
          sessionId={sessionId}
          onCategory={(id) => setSessionCategoryId(id)}
          rules={rules}
          onBack={() => { setSessionId(null); setChecking(null); }}
          onOpenCheck={(itemId) => {
            const catId = sessions.find((s) => s.id === sessionId)?.categoryId ?? sessionCategoryId ?? '';
            setChecking({ itemId, categoryId: catId });
          }}
        />
      )}
      {checking && (
        <CompareCheckMode
          itemId={checking.itemId}
          rules={rules.filter((r) => !r.archivedAt && r.categoryId === checking.categoryId)}
          onClose={() => setChecking(null)}
        />
      )}
    </>
  );
}
