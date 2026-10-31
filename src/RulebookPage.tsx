import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Rule, db } from './db';
import { fa, today } from './cal';
import { Icon } from './Icon';
import { STR } from './strings/rulebook';
import { addRule, dueLabel, orderCategories, orderRules } from './ruleData';
import { orderByBreaks } from './domain/rules/breaks';
import { dueCount, isDue } from './domain/rules/schedule';
import { RuleSheet } from './RuleSheet';
import { CategorySheet } from './CategorySheet';
import { ReviewSession } from './ReviewSession';
import { CompareHome } from './CompareHome';
import { CompareSessionPage } from './CompareSessionPage';
import { CompareCheckMode } from './CompareCheck';
import { tx } from './i18n';

/**
 * Phase 2: the rulebook. Categories as chips, the rules of the selected category, title-only quick add, the edit sheet,
 * archive/restore, confirmed delete and category management. The empty state explains the feature in two sentences.
 */
export function RulebookPage({
  focusId,
  onFocused,
  openReview,
  openReadThrough,
}: {
  focusId?: string | null;
  onFocused?: () => void;
  openReview?: () => void;
  openReadThrough?: (categoryId?: string, name?: string) => void;
} = {}) {
  const categories = useLiveQuery(() => db.ruleCategories.toArray(), []) ?? [];
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? [];
  const [cat, setCat] = useState<string | 'all'>('all');
  const [quick, setQuick] = useState('');
  const [editing, setEditing] = useState<Rule | null | 'new'>(null);
  const [managing, setManaging] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  /** Phase 5: the category whose comparison entry is open, the session being read, and the item being checked. */
  const [compareHome, setCompareHome] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  /** The category of the open session, reported by the session page so the check mode knows which rules to walk. */
  const [sessionCategoryId, setSessionCategoryId] = useState<string | null>(null);
  const [checking, setChecking] = useState<{ itemId: string; categoryId: string } | null>(null);
  /** Part 1: "بیشترین شکست" ordering, and hiding rules that were never broken. */
  const [mostBroken, setMostBroken] = useState(false);
  const [onlyBroken, setOnlyBroken] = useState(false);
  const breaks = useLiveQuery(() => db.ruleBreaks.toArray(), []) ?? [];
  const t = today();

  const ordered = useMemo(() => orderCategories(categories), [categories]);
  // a category that was deleted while selected falls back to "all" instead of showing an empty screen
  const active = cat !== 'all' && categories.some((c) => c.id === cat) ? cat : 'all';
  const activeCategory = ordered.find((c) => c.id === active);
  const inScope = useMemo(() => rules.filter((r) => active === 'all' || r.categoryId === active), [rules, active]);
  const live = useMemo(() => {
    const active = inScope.filter((r) => !r.archivedAt);
    const shown = onlyBroken ? active.filter((r) => breaks.some((b) => b.ruleId === r.id)) : active;
    return mostBroken ? orderByBreaks(shown, breaks) : orderRules(shown);
  }, [inScope, mostBroken, onlyBroken, breaks]);
  const archived = useMemo(() => inScope.filter((r) => r.archivedAt).sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)), [inScope]);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';

  // a rule opened from search arrives as an id; open its sheet once, then clear the request so back does not reopen it
  useEffect(() => {
    if (!focusId) return;
    const rule = rules.find((r) => r.id === focusId);
    if (rule) setEditing(rule);
    onFocused?.();
  }, [focusId, rules, onFocused]);

  /**
   * Phase 5: the comparison screens are overlays inside this page, so the Android back button cannot see them through the
   * page state. They register a closer here and `App` asks it first; without this, back from a session left the rulebook.
   */
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
      if (compareHome) {
        setCompareHome(null);
        return true;
      }
      return false;
    };
    (window as unknown as { __rulebookBack?: () => boolean }).__rulebookBack = closer;
    return () => {
      delete (window as unknown as { __rulebookBack?: () => boolean }).__rulebookBack;
    };
  }, [checking, sessionId, compareHome]);
  const due = dueCount(rules, t);
  const dueHere = dueCount(active === 'all' ? rules : rules.filter((r) => r.categoryId === active), t);

  const addQuick = async () => {
    const title = quick.trim();
    const target = active !== 'all' ? active : ordered[0]?.id;
    if (!title || !target) return;
    setQuick('');
    await addRule(target, title);
  };

  const Row = ({ rule }: { rule: Rule }) => (
    <button className="rule-row" onClick={() => setEditing(rule)} aria-label={`${tx(STR.feature.edit)} ${rule.title}`}>
      <span className={`rule-dot${isDue(rule, t) ? ' due' : ''}`} aria-hidden="true">
        <Icon name={rule.archivedAt ? 'archive' : rule.strict ? 'target' : 'listChecks'} size={16} stroke={1.9} />
      </span>
      <span className="rule-body">
        <b>{rule.title}</b>
        <span className="rule-meta">
          {active === 'all' && <em className="rule-cat">{catName(rule.categoryId)}</em>}
          {rule.archivedAt ? tx(STR.feature.archivedRules) : dueLabel(rule.nextReviewOn, t)}
          {rule.pinned ? ` · ${tx(STR.feature.pinned)}` : ''}
        </span>
        {rule.why && <span className="rule-why">{rule.why}</span>}
      </span>
      {rule.brokenCount > 0 && <em className="rule-chip broke">{tx(STR.breaks.breakCountChip(rule.brokenCount))}</em>}
      {rule.strict && <em className="rule-chip strict">{tx(STR.feature.strict)}</em>}
      {rule.pinned && <em className="rule-chip pin" aria-hidden="true"><Icon name="pin" size={13} stroke={2} /></em>}
      <Icon name="chevronLeft" size={16} stroke={2} />
    </button>
  );

  // Phase 5: a session (and the check mode) is a full-screen page. The rulebook stays mounted underneath so returning is
  // instant, but its content is hidden while the overlay is open — otherwise two scrollable screens would be stacked.
  const overlay = !!sessionId || !!checking;

  return (
    <>
      <div className={overlay ? 'rulebook-under' : undefined} aria-hidden={overlay || undefined}>
      <div className="page-head">
        <h1>{tx(STR.feature.title)}</h1>
        <div className="head-tools">
          <button className="icon-btn" aria-label={tx(STR.categories.manageTitle)} onClick={() => setManaging(true)}>
            <Icon name="alignLeft" size={19} stroke={1.9} />
          </button>
          <button className="pill-btn" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} stroke={2.4} />{tx(STR.feature.addRule)}
          </button>
        </div>
      </div>

      <div className="read-invite">
        <button className="text-btn" onClick={() => openReadThrough?.(active === 'all' ? undefined : active, active === 'all' ? undefined : catName(active))}>
          <Icon name="note" size={14} stroke={1.9} />
          {active === 'all' ? tx(STR.review.readThrough) : tx(STR.review.startCategory)}
        </button>
      </div>

      <section className="glass review-invite">
        <span className="tile green" aria-hidden="true"><Icon name="repeat" size={18} stroke={1.9} /></span>
        <span className="review-invite-body">
          <b>{dueHere > 0 ? tx(STR.today.cardTitle(dueHere)) : tx(STR.review.emptyTitle)}</b>
          <span className="hint">{dueHere > 0 ? tx(STR.today.cardBody) : tx(STR.review.emptyBody)}</span>
        </span>
        <button className="pill-btn" disabled={dueHere === 0} onClick={() => (openReview ? openReview() : setReviewing(true))}>
          <Icon name="repeat" size={15} stroke={2.2} />{tx(STR.review.start)}
        </button>
      </section>

      {activeCategory?.compareEnabled && (
        <div className="compare-invite">
          <button className="text-btn" onClick={() => setCompareHome(activeCategory.id)}>
            <Icon name="contrast" size={14} stroke={1.9} />{tx(STR.compare.title)}
          </button>
        </div>
      )}

      {categories.length > 0 && (
        <div className="tabs rule-cats" role="tablist" aria-label={tx(STR.feature.category)}>
          <button role="tab" aria-selected={active === 'all'} className={active === 'all' ? 'on' : ''} onClick={() => setCat('all')}>
            {tx(STR.feature.allCategories)}{due > 0 ? ` · ${fa(due)}` : ''}
          </button>
          {ordered.map((c) => (
            <button key={c.id} role="tab" aria-selected={active === c.id} className={active === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {rules.length === 0 && categories.length > 0 ? (
        <section className="glass empty-state">
          <span className="tile purple" aria-hidden="true"><Icon name="listChecks" size={24} stroke={1.7} /></span>
          <b>{tx(STR.feature.emptyTitle)}</b>
          <p className="hint">{tx(STR.feature.emptyBody)}</p>
        </section>
      ) : null}

      {activeCategory && (
        <section className="glass rule-quick">
          <label className="rule-quick-field">
            <Icon name="plus" size={16} stroke={2.2} />
            <input
              value={quick}
              maxLength={200}
              placeholder={`${tx(STR.feature.quickAddPlaceholder)} (${activeCategory.name})`}
              aria-label={tx(STR.feature.addRule)}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void addQuick(); }}
              enterKeyHint="done"
            />
          </label>
          <button className="mini-btn" disabled={!quick.trim()} onClick={() => void addQuick()}>{tx(STR.feature.save)}</button>
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>{active === 'all' ? tx(STR.feature.title) : catName(active)}</h2>
          {live.length > 0 && <span className="progress-pill">{fa(live.length)} {tx(STR.feature.ruleTitle)}</span>}
        </div>
        <div className="tabs rule-sort" role="tablist" aria-label={tx(STR.breaks.counts)}>
          <button role="tab" aria-selected={!mostBroken} className={!mostBroken ? 'on' : ''} onClick={() => setMostBroken(false)}>
            {tx(STR.breaks.allRules)}
          </button>
          <button role="tab" aria-selected={mostBroken} className={mostBroken ? 'on' : ''} onClick={() => setMostBroken(true)}>
            {tx(STR.breaks.mostBroken)}
          </button>
          <button role="tab" aria-selected={onlyBroken} className={onlyBroken ? 'on' : ''} onClick={() => setOnlyBroken((x) => !x)}>
            {tx(STR.breaks.onlyWithBreaks)}
          </button>
        </div>
        <div className="glass set-list rule-list">
          {live.length === 0 && <p className="hint empty">{tx(STR.feature.noRulesInCategory)}</p>}
          {live.map((rule) => <Row key={rule.id} rule={rule} />)}
        </div>
      </section>

      {archived.length > 0 && (
        <section>
          <button className="text-btn archive-toggle" onClick={() => setShowArchived((x) => !x)} aria-expanded={showArchived}>
            <Icon name="archive" size={15} stroke={1.9} />
            {tx(STR.feature.archivedRules)} · {fa(archived.length)}
            <Icon name={showArchived ? 'chevronDown' : 'chevronLeft'} size={15} stroke={2} />
          </button>
          {showArchived && (
            <div className="glass set-list rule-list archived">
              {archived.map((rule) => <Row key={rule.id} rule={rule} />)}
            </div>
          )}
        </section>
      )}

      {managedHint(categories.length)}
      </div>

      {!overlay && editing && (
        <RuleSheet
          key={editing === 'new' ? 'new' : editing.id}
          rule={editing === 'new' ? null : editing}
          categories={ordered}
          seedCategoryId={active === 'all' ? undefined : active}
          onClose={() => setEditing(null)}
        />
      )}
      {!overlay && managing && <CategorySheet categories={ordered} rules={rules} onClose={() => setManaging(false)} />}
      {reviewing && <ReviewSession categoryId={active === 'all' ? undefined : active} onClose={() => setReviewing(false)} />}
      {compareHome && activeCategory && (
        <CompareHome
          category={activeCategory}
          rules={rules}
          onOpen={(id) => { setCompareHome(null); setSessionId(id); }}
          onClose={() => setCompareHome(null)}
        />
      )}
      {sessionId && (
        <CompareSessionPage
          sessionId={sessionId}
          onCategory={(id) => setSessionCategoryId(id)}
          rules={rules}
          onBack={() => { setSessionId(null); setChecking(null); }}
          onOpenCheck={(itemId) => setChecking({ itemId, categoryId: sessionCategoryId ?? '' })}
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

/** Nothing exists at all: say what the feature is and what to do first, instead of two empty panels. */
function managedHint(categoryCount: number) {
  if (categoryCount > 0) return null;
  return (
    <section className="glass empty-state">
      <span className="tile purple" aria-hidden="true"><Icon name="listChecks" size={24} stroke={1.7} /></span>
      <b>{tx(STR.feature.emptyTitle)}</b>
      <p className="hint">{tx(STR.feature.emptyBody)}</p>
    </section>
  );
}

