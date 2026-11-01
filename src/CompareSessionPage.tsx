import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type CompareCheck, type CompareItem, type CompareSession, type Rule, db } from './db';
import { fa, label, today } from './cal';
import { ask } from './confirm';
import { Icon } from './Icon';
import { DatePicker } from './DatePicker';
import { STR } from './strings/rulebook';
import { addItem, deleteItem, deleteSession, itemsOf, saveItem, setCheck } from './ruleData';
import { differences as differencesOf, orderItems as orderByRules, parsePrice, statsFor, strictFailures, uncheckedCount } from './domain/compare';
import { Toggle } from './Toggle';
import type { CheckState } from './domain/rules/constants';
import { tx } from './i18n';
import { InputField, Button, Select, FormPage, FormSection } from './ui';

/** Formats a price in Toman with Persian digits; a missing price is "ثبت نشده"-style silence, never a zero. */
export const priceText = (price: number | undefined) => (price === undefined ? '' : `${fa(price)} ${tx(STR.compare.priceUnit)}`);

/**
 * Phase 5: the comparison session. Items, their counts, the quick-check walk, the matrix, the two-item comparison and the
 * decision all live here; the pure counting and ordering are in `domain/compare`.
 */
export function CompareSessionPage({ sessionId, rules, onBack, onOpenCheck, onCategory }: {
  sessionId: string;
  rules: Rule[];
  onBack: () => void;
  onOpenCheck: (itemId: string) => void;
  /** Reports the session's category once it is known, so the quick check walks that category's rules. */
  onCategory: (categoryId: string) => void;
}) {
  const sessions = useLiveQuery(() => db.compareSessions.toArray(), []) ?? [];
  const items = useLiveQuery(() => db.compareItems.toArray(), []) ?? [];
  const checks = useLiveQuery(() => db.compareChecks.toArray(), []) ?? [];
  const session = sessions.find((s) => s.id === sessionId);
  const categoryRules = useMemo(() => rules.filter((r) => !r.archivedAt), [rules]);
  const rulesOf = useMemo(
    () => (session ? categoryRules.filter((r) => r.categoryId === session.categoryId) : []),
    [categoryRules, session],
  );
  const mine = useMemo(() => (session ? itemsOf(items, session.id) : []), [items, session]);
  const myChecks = useMemo(() => checks.filter((c) => mine.some((i) => i.id === c.itemId)), [checks, mine]);
  const ordered = useMemo(() => orderByRules(mine, rulesOf, myChecks), [mine, rulesOf, myChecks]);

  useEffect(() => {
    if (session) onCategory(session.categoryId);
  }, [session, onCategory]);

  const [quickName, setQuickName] = useState('');
  const [editing, setEditing] = useState<CompareItem | 'new' | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [matrix, setMatrix] = useState(false);
  const [two, setTwo] = useState(false);
  const [decideFor, setDecideFor] = useState<CompareItem | null>(null);

  if (!session) {
    return (
      <>
        <header className="dd-head">
          <button className="icon-btn" aria-label={tx(STR.feature.close)} onClick={onBack}><Icon name="chevronRight" /></button>
          <span>{tx(STR.compare.title)}</span>
          <span className="head-spacer" />
        </header>
        <p className="hint">{tx(STR.compare.noSessions)}</p>
      </>
    );
  }

  const chosen = mine.find((i) => i.id === session.chosenItemId);

  const addQuick = async () => {
    const name = quickName.trim();
    if (!name) return;
    setQuickName('');
    // Adding an item does not jump into the check mode: the user may be adding several items first. The card's own
    // button opens it, and the sheet's "quick check" link does too.
    await addItem(session, { name });
  };

  const removeItem = async (item: CompareItem) => {
    const ok = await ask({ title: tx(STR.compare.deleteItemTitle(item.name)), message: tx(STR.compare.deleteItemBody), confirm: tx(STR.feature.delete), icon: 'trash' });
    if (ok) await deleteItem(item);
    return ok;
  };

  const decided = session.status === 'decided';
  const stats = new Map(ordered.map((i) => [i.id, statsFor(i.id, rulesOf, myChecks)]));
  // the first card is the best only when it really passes something and breaks no red line
  const topId = ordered[0] && (stats.get(ordered[0].id)?.pass ?? 0) > 0 && strictFailures(ordered[0].id, rulesOf, myChecks).length === 0 ? ordered[0].id : null;

  return (
    <>
      <FormPage title={session.title} icon="contrast" onClose={onBack}>
        {decided && chosen && (
          <section className="cmp-decided">
            <span className="cmp-decided-icon" aria-hidden="true"><Icon name="checkCircle" size={24} stroke={1.9} /></span>
            <div>
              <b>{chosen.name}</b>
              <span>{tx(STR.compare.chosen)}{session.decisionNote ? ` · ${session.decisionNote}` : ''}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={async () => { const { reopen } = await import('./ruleData'); await reopen(session); }}>{tx(STR.compare.reopen)}</Button>
          </section>
        )}

        {rulesOf.length === 0 && <p className="cmp-warn"><Icon name="info" size={16} stroke={2} />{tx(STR.compare.noRules)}</p>}

        <FormSection title={tx(STR.compare.addItem)} icon="plus">
          <InputField
            value={quickName}
            maxLength={120}
            placeholder={tx(STR.compare.itemNamePlaceholder)}
            aria-label={tx(STR.compare.addItem)}
            onChange={(e) => setQuickName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addQuick(); }}
            enterKeyHint="done"
          />
          <Button variant="primary" block icon="plus" disabled={!quickName.trim()} onClick={() => void addQuick()}>{tx(STR.compare.addItem)}</Button>
        </FormSection>

        {ordered.length === 0 ? (
          <p className="hint empty">{tx(STR.compare.noItems)}</p>
        ) : (
          <>
            <div className="cmp-summary">
              <b>{tx('{a1} کالا', { a1: fa(ordered.length) })}</b>
              <span>{tx('{a1} قانون', { a1: fa(rulesOf.length) })}</span>
              <span className="cmp-legend"><i className="pass" />{tx(STR.compare.pass)}<i className="fail" />{tx(STR.compare.fail)}<i className="unknown" />{tx(STR.compare.unknown)}</span>
            </div>

            {ordered.map((item, idx) => {
              const st = stats.get(item.id)!;
              const strict = strictFailures(item.id, rulesOf, myChecks);
              const pct = (n: number) => (st.total ? `${(n / st.total) * 100}%` : '0%');
              const meta = [item.shopName, priceText(item.price), item.seenOn !== today() ? label(item.seenOn, 'persian', 0, { day: 'numeric', month: 'long' }) : ''].filter(Boolean).join(' · ');
              return (
                <article key={item.id} className={`cmp-card${strict.length ? ' flagged' : ''}${item.id === topId ? ' top' : ''}${decided && item.id === session.chosenItemId ? ' chosen' : ''}`}>
                  <button type="button" className="cmp-card-main" onClick={() => setEditing(item)} aria-label={`${tx(STR.compare.itemDetails)}: ${item.name}`}>
                    <span className="cmp-rank" aria-hidden="true">{fa(idx + 1)}</span>
                    <span className="cmp-card-text">
                      <span className="cmp-name">{item.name}</span>
                      {meta && <span className="cmp-meta">{meta}</span>}
                    </span>
                    {item.id === topId && <span className="cmp-best">{tx('بهترین فعلی')}</span>}
                    <Icon name="chevronLeft" size={16} stroke={2} />
                  </button>

                  <div className="cmp-bar" role="img" aria-label={tx(STR.compare.checkedOf(st.pass, st.total))}>
                    <i className="pass" style={{ width: pct(st.pass) }} />
                    <i className="fail" style={{ width: pct(st.fail) }} />
                    <i className="unknown" style={{ width: pct(st.unknown) }} />
                  </div>
                  <div className="cmp-counts">
                    <span className="pass"><Icon name="check" size={12} stroke={3} />{fa(st.pass)}</span>
                    <span className="fail"><Icon name="close" size={12} stroke={3} />{fa(st.fail)}</span>
                    <span className="unknown"><Icon name="info" size={12} stroke={2.4} />{fa(st.unknown)}</span>
                    {strict.length > 0 && <span className="cmp-strict"><Icon name="target" size={12} stroke={2.2} />{tx(STR.compare.strictFail)}</span>}
                  </div>

                  <div className="cmp-card-actions">
                    <Button size="sm" variant={st.unknown > 0 ? 'primary' : 'secondary'} icon="listChecks" onClick={() => onOpenCheck(item.id)}>
                      {st.unknown > 0 ? tx(STR.compare.checkMode) : tx('بازبینی')}
                    </Button>
                    <Button size="sm" variant="secondary" icon="target" onClick={() => setDecideFor(item)}>{tx(STR.compare.decide)}</Button>
                  </div>
                </article>
              );
            })}

            <FormSection title={tx('مقایسهٔ کامل')} icon="contrast">
              <Button block icon="toolbox" disabled={rulesOf.length === 0} onClick={() => setMatrix(true)}>{tx(STR.compare.matrixTitle)}</Button>
              <Button block icon="contrast" disabled={ordered.length < 2} onClick={() => setTwo(true)}>{tx(STR.compare.compareTwo)}</Button>
            </FormSection>
          </>
        )}

        <Button variant="danger" block icon="trash" onClick={async () => {
          const ok = await ask({ title: tx(STR.compare.deleteSessionTitle(session.title)), message: tx(STR.compare.deleteSessionBody), confirm: tx(STR.feature.delete), icon: 'trash' });
          if (ok) { await deleteSession(session); onBack(); }
        }}>{tx('حذف این مقایسه')}</Button>
      </FormPage>

      {editing && (
        <ItemSheet
          key={editing === 'new' ? 'new' : editing.id}
          item={editing === 'new' ? null : editing}
          session={session}
          rules={rulesOf}
          checks={myChecks}
          onCheck={(id) => { setEditing(null); onOpenCheck(id); }}
          onDelete={editing !== 'new' ? async () => { const gone = editing; if (await removeItem(gone)) setEditing(null); } : undefined}
          onClose={() => setEditing(null)}
        />
      )}
      {matrix && <MatrixSheet session={session} items={ordered} rules={rulesOf} checks={myChecks} onClose={() => setMatrix(false)} />}
      {two && <TwoSheet items={ordered} rules={rulesOf} checks={myChecks} onClose={() => setTwo(false)} />}
      {decideFor && <DecideSheet session={session} item={decideFor} onClose={() => setDecideFor(null)} />}
    </>
  );
}

function changesHint(ruleCount: number) {
  if (ruleCount > 0) return null;
  return <p className="hint">{tx(STR.compare.noRules)}</p>;
}

/** Item details: name, shop, price, seen-on date and note. The quick-check entry lives here too. */
function ItemSheet({ item, session, rules, checks, onCheck, onDelete, onClose }: {
  item: CompareItem | null;
  session: CompareSession;
  rules: Rule[];
  checks: CompareCheck[];
  onCheck: (id: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(() => ({
    name: item?.name ?? '',
    shopName: item?.shopName ?? '',
    price: item?.price !== undefined ? String(item.price) : '',
    seenOn: item?.seenOn ?? today(),
    note: item?.note ?? '',
  }));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));
  const valid = v.name.trim() !== '';

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr('');
    try {
      const patch = { name: v.name, shopName: v.shopName, price: parsePrice(v.price), seenOn: v.seenOn, note: v.note };
      if (item) await saveItem(item, patch);
      else await addItem(session, patch);
      onClose();
    } catch {
      setErr(tx(STR.feature.saveFailed));
      setBusy(false);
    }
  };

  return (
    <>
      <FormPage
        title={item ? tx(STR.compare.itemDetails) : tx(STR.compare.addItem)}
        icon={item ? 'edit' : 'plus'}
        onClose={onClose}
        onSave={() => void save()}
        saveLabel={item ? tx(STR.feature.save) : tx('ثبت')}
        saveDisabled={!valid}
        busy={busy}
        error={err}
        onDelete={onDelete}
        deleteLabel={tx('حذف این کالا')}
      >
        <FormSection>
          <InputField
            label={tx(STR.feature.ruleTitle)}
            autoFocus
            value={v.name}
            maxLength={120}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={tx(STR.compare.itemNamePlaceholder)}
            enterKeyHint="done"
          />

          <InputField
            label={`${tx(STR.compare.shop)} (${tx(STR.compare.optional)})`}
            value={v.shopName}
            maxLength={80}
            onChange={(e) => set({ shopName: e.target.value })}
          />

          <InputField
            label={tx(STR.compare.price)}
            hint={tx(STR.compare.priceUnit)}
            dir="ltr"
            inputMode="numeric"
            value={v.price}
            onChange={(e) => set({ price: e.target.value })}
            placeholder="0"
          />

          <div className="rf-row">
            <span className="tile blue" aria-hidden="true"><Icon name="calendar" size={17} stroke={1.9} /></span>
            <span className="rf-name">{tx(STR.compare.seenOn)}</span>
            <button type="button" className="rf-value as-text" onClick={() => setPicking(true)}>
              {label(v.seenOn, 'persian', 0, { day: 'numeric', month: 'long' })}
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          </div>

          <InputField
            label={`${tx(STR.compare.note)} (${tx(STR.compare.optional)})`}
            multiline
            rows={3}
            value={v.note}
            maxLength={1000}
            onChange={(e) => set({ note: e.target.value })}
          />
        </FormSection>

        {item && (
          <Button variant="ghost" block icon="listChecks" onClick={() => onCheck(item.id)}>
            {tx(STR.compare.checkMode)} · {tx(STR.compare.checkProgress(rules.length - uncheckedCount(item.id, rules, checks), rules.length))}
          </Button>
        )}
      </FormPage>
      {picking && <DatePicker value={v.seenOn} onPick={(d) => { set({ seenOn: d }); setPicking(false); }} onClose={() => setPicking(false)} />}
    </>
  );
}

const stateIcon = (s: CheckState) => (s === 'pass' ? 'check' : s === 'fail' ? 'close' : 'info');
const stateClass = (s: CheckState) => (s === 'pass' ? 'pass' : s === 'fail' ? 'fail' : 'unknown');
const stateLabel = (s: CheckState) => (s === 'pass' ? tx(STR.compare.pass) : s === 'fail' ? tx(STR.compare.fail) : tx(STR.compare.unknown));
/** The matrix's tap order. `unknown` is a real state, so it is reachable in the cycle instead of being skipped. */
const nextState = (s: CheckState): CheckState => (s === 'pass' ? 'fail' : s === 'fail' ? 'unknown' : 'pass');

/** The matrix: rules as rows, items as columns, horizontal scroll inside its own container, sticky rule column. */
function MatrixSheet({ items, rules, checks, onClose }: {
  session: CompareSession;
  items: CompareItem[];
  rules: Rule[];
  checks: CompareCheck[];
  onClose: () => void;
}) {
  return (
    <FormPage title={tx(STR.compare.matrixTitle)} icon="toolbox" onClose={onClose}>
      <p className="hint">{tx('روی هر خانه بزن تا وضعیتش عوض شود: رعایت، نقض، بررسی نشده.')}</p>
      <div className="matrix-wrap" role="group" aria-label={tx(STR.compare.matrixTitle)} tabIndex={0}>
        <table className="matrix">
          <thead>
            <tr>
              <th className="mx-rule-col" scope="col">{tx(STR.feature.ruleTitle)}</th>
              {items.map((it) => <th key={it.id} scope="col" title={it.name}>{it.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <th scope="row" className="mx-rule-col">
                  <bdi>{rule.title}</bdi>
                  {rule.strict && <em className="rule-chip strict">{tx(STR.feature.strict)}</em>}
                </th>
                {items.map((it) => {
                  const c = checks.find((x) => x.itemId === it.id && x.ruleId === rule.id);
                  const s: CheckState = c?.state ?? 'unknown';
                  return (
                    <td key={it.id}>
                      <button
                        className={`mx-state ${stateClass(s)}`}
                        aria-label={tx('{a1}، {a2}: {a3}', { a1: it.name, a2: rule.title, a3: stateLabel(s) })}
                        title={stateLabel(s)}
                        onClick={() => void setCheck(it.id, rule.id, nextState(s))}
                      >
                        <Icon name={stateIcon(s)} size={15} stroke={2.4} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="mx-rule-col">{tx(STR.compare.matrixSummary)}</th>
              {items.map((it) => {
                const st = statsFor(it.id, rules, checks);
                return (
                  <td key={it.id} className="mx-sum">
                    <b>{fa(st.pass)}</b>
                    <span>{tx(STR.compare.failedCount(st.fail))}</span>
                    <span>{tx(STR.compare.unknownCount(st.unknown))}</span>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="hint">{tx(STR.compare.unknownNotZero)}</p>
      <p className="hint">{tx(STR.compare.archivedHidden)}</p>
    </FormPage>
  );
}

/** Two items head to head: who wins on how many rules, then each differing rule as a small card. */
function TwoSheet({ items, rules, checks, onClose }: {
  items: CompareItem[];
  rules: Rule[];
  checks: CompareCheck[];
  onClose: () => void;
}) {
  const [aId, setAId] = useState(items[0]?.id ?? '');
  const [bId, setBId] = useState(items[1]?.id ?? '');
  const [onlyDiff, setOnlyDiff] = useState(true);
  const a = items.find((i) => i.id === aId);
  const b = items.find((i) => i.id === bId);
  const diffs = a && b ? differencesOf(a.id, b.id, rules, checks, onlyDiff) : [];
  const stA = a ? statsFor(a.id, rules, checks) : null;
  const stB = b ? statsFor(b.id, rules, checks) : null;
  const winsA = diffs.filter((d) => d.a === 'pass' && d.b !== 'pass').length;
  const winsB = diffs.filter((d) => d.b === 'pass' && d.a !== 'pass').length;
  const opts = items.map((i) => ({ value: i.id, label: i.name }));

  return (
    <FormPage title={tx(STR.compare.compareTwoTitle)} icon="contrast" onClose={onClose}>
      <FormSection>
        <Select label={tx(STR.compare.columnA)} value={aId} onChange={(e) => setAId(e.target.value)} options={opts} />
        <Select label={tx(STR.compare.columnB)} value={bId} onChange={(e) => setBId(e.target.value)} options={opts} />
      </FormSection>

      {a && b && stA && stB && (
        <section className="cmp-vs">
          {[{ it: a, st: stA, wins: winsA }, { it: b, st: stB, wins: winsB }].map(({ it, st, wins }, i) => (
            <div key={it.id + i} className={`cmp-vs-col${wins > (i === 0 ? winsB : winsA) ? ' lead' : ''}`}>
              <b>{it.name}</b>
              {it.price !== undefined && <span>{priceText(it.price)}</span>}
              <span className="cmp-vs-wins">{tx('{a1} برتری', { a1: fa(wins) })}</span>
              <span className="cmp-counts">
                <span className="pass"><Icon name="check" size={12} stroke={3} />{fa(st.pass)}</span>
                <span className="fail"><Icon name="close" size={12} stroke={3} />{fa(st.fail)}</span>
                <span className="unknown"><Icon name="info" size={12} stroke={2.4} />{fa(st.unknown)}</span>
              </span>
            </div>
          ))}
        </section>
      )}

      <div className="rf-row">
        <span className="rf-name">{tx(STR.compare.onlyDiff)}</span>
        <Toggle on={onlyDiff} label={tx(STR.compare.onlyDiff)} onChange={setOnlyDiff} />
      </div>

      {diffs.length === 0 ? (
        <p className="hint empty">{tx(STR.compare.noDiff)}</p>
      ) : (
        diffs.map(({ rule, a: sa, b: sb }) => (
          <article key={rule.id} className="cmp-diff">
            <span className="cmp-diff-rule"><bdi>{rule.title}</bdi>{rule.strict && <em className="rule-chip strict">{tx(STR.feature.strict)}</em>}</span>
            <div className="cmp-diff-cells">
              {[{ it: a, s: sa }, { it: b, s: sb }].map(({ it, s }, i) => (
                <span key={i} className={`cmp-cell ${stateClass(s)}`}>
                  <Icon name={stateIcon(s)} size={16} stroke={2.6} />
                  <small>{it?.name}</small>
                  <em>{stateLabel(s)}</em>
                </span>
              ))}
            </div>
          </article>
        ))
      )}
    </FormPage>
  );
}

/** Decide one item, with the optional "why I chose this" note. */
function DecideSheet({ session, item, onClose }: { session: CompareSession; item: CompareItem; onClose: () => void }) {
  const [note, setNote] = useState(session.decisionNote ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const { decide } = await import('./ruleData');
      await decide(session, item.id, note);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPage title={tx(STR.compare.decide)} icon="target" onClose={onClose} onSave={() => void save()} saveLabel={tx(STR.compare.decide)} busy={busy}>
      <section className="cmp-decided">
        <span className="cmp-decided-icon" aria-hidden="true"><Icon name="target" size={22} stroke={1.9} /></span>
        <div><b>{item.name}</b></div>
      </section>
      <FormSection>
        <InputField
          label={tx(STR.compare.decisionNote)}
          multiline
          rows={3}
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
          placeholder={tx(STR.compare.decisionNotePlaceholder)}
        />
      </FormSection>
    </FormPage>
  );
}
