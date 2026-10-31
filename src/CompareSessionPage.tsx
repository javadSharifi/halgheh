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

/** Formats a price in Toman with Persian digits; a missing price is "ثبت نشده"-style silence, never a zero. */
export const priceText = (price: number | undefined) => (price === undefined ? '' : `${fa(price)} ${STR.compare.priceUnit}`);

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
          <button className="icon-btn" aria-label={STR.feature.close} onClick={onBack}><Icon name="chevronRight" /></button>
          <span>{STR.compare.title}</span>
          <span className="head-spacer" />
        </header>
        <p className="hint">{STR.compare.noSessions}</p>
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
    const ok = await ask({ title: STR.compare.deleteItemTitle(item.name), message: STR.compare.deleteItemBody, confirm: STR.feature.delete, icon: 'trash' });
    if (ok) await deleteItem(item);
  };

  return (
    <>
      <header className="dd-head">
        <button className="icon-btn" aria-label={STR.feature.close} onClick={onBack}><Icon name="chevronRight" /></button>
        <span>{session.title}</span>
        <button className="icon-btn" aria-label={STR.compare.matrix} onClick={() => setMatrix(true)}><Icon name="toolbox" size={19} stroke={1.9} /></button>
      </header>

      {session.status === 'decided' && chosen && (
        <section className="glass decided-card">
          <span className="tile green" aria-hidden="true"><Icon name="checkCircle" size={20} stroke={1.9} /></span>
          <div>
            <b>{chosen.name}</b>
            <span className="set-sub">{STR.compare.chosen}{session.decisionNote ? ` · ${session.decisionNote}` : ''}</span>
          </div>
          <button className="text-btn" onClick={async () => { const { reopen } = await import('./ruleData'); await reopen(session); }}>{STR.compare.reopen}</button>
        </section>
      )}

      <section className="glass rule-quick">
        <label className="rule-quick-field">
          <Icon name="plus" size={16} stroke={2.2} />
          <input
            value={quickName}
            maxLength={120}
            placeholder={STR.compare.itemNamePlaceholder}
            aria-label={STR.compare.addItem}
            onChange={(e) => setQuickName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addQuick(); }}
            enterKeyHint="done"
          />
        </label>
        <button className="mini-btn" disabled={!quickName.trim()} onClick={() => void addQuick()}>{STR.compare.addItem}</button>
      </section>

      {ordered.length === 0 && <p className="hint empty">{STR.compare.noItems}</p>}

      <div className="glass compare-list">
        {ordered.map((item) => {
          const st = statsFor(item.id, rulesOf, myChecks);
          const strict = strictFailures(item.id, rulesOf, myChecks);
          return (
            <div key={item.id} className={`compare-item${strict.length ? ' flagged' : ''}`}>
              <button className="ci-open" onClick={() => setEditing(item)}>
                <span className="ci-name">{item.name}</span>
                <span className="ci-meta">
                  {[item.shopName, priceText(item.price), item.seenOn !== today() ? label(item.seenOn, 'persian', 0, { day: 'numeric', month: 'long' }) : ''].filter(Boolean).join(' · ')}
                </span>
                <span className="ci-counts">
                  <em className="ci-pass"><Icon name="check" size={12} stroke={3} />{STR.compare.checkedOf(st.pass, st.total)}</em>
                  {st.fail > 0 && <em className="ci-fail"><Icon name="close" size={12} stroke={3} />{STR.compare.failedCount(st.fail)}</em>}
                  {st.unknown > 0 && <em className="ci-unknown"><Icon name="info" size={12} stroke={2.2} />{STR.compare.unknownCount(st.unknown)}</em>}
                </span>
                {strict.length > 0 && (
                  <span className="ci-strict"><Icon name="target" size={12} stroke={2.2} />{STR.compare.strictFail}</span>
                )}
              </button>
              <div className="ci-actions">
                <button className="icon-btn small" aria-label={`${STR.compare.checkMode}: ${item.name}`} onClick={() => onOpenCheck(item.id)}>
                  <Icon name="listChecks" size={17} stroke={1.9} />
                </button>
                <button className="icon-btn small" aria-label={`${STR.compare.decide}: ${item.name}`} onClick={() => setDecideFor(item)}>
                  <Icon name="target" size={17} stroke={1.9} />
                </button>
                <button className="icon-btn small danger" aria-label={`${STR.feature.delete} ${item.name}`} onClick={() => void removeItem(item)}>
                  <Icon name="trash" size={16} stroke={2} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="set-actions compare-actions">
        <button disabled={mine.length < 2} onClick={() => setTwo(true)}><Icon name="contrast" size={17} stroke={1.9} />{STR.compare.compareTwo}</button>
        <button className="danger-btn" onClick={async () => {
          const ok = await ask({ title: STR.compare.deleteSessionTitle(session.title), message: STR.compare.deleteSessionBody, confirm: STR.feature.delete, icon: 'trash' });
          if (ok) { await deleteSession(session); onBack(); }
        }}><Icon name="trash" size={16} stroke={2} />{STR.feature.delete}</button>
      </div>

      {changesHint(rulesOf.length)}

      {editing && (
        <ItemSheet
          key={editing === 'new' ? 'new' : editing.id}
          item={editing === 'new' ? null : editing}
          session={session}
          rules={rulesOf}
          checks={myChecks}
          onCheck={(id) => { setEditing(null); onOpenCheck(id); }}
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
  return <p className="hint">{STR.compare.noRules}</p>;
}

/** Item details: name, shop, price, seen-on date and note. The quick-check entry lives here too. */
function ItemSheet({ item, session, rules, checks, onCheck, onClose }: {
  item: CompareItem | null;
  session: CompareSession;
  rules: Rule[];
  checks: CompareCheck[];
  onCheck: (id: string) => void;
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
      setErr(STR.feature.saveFailed);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet item-sheet" role="dialog" aria-modal="true" aria-labelledby="item-sheet-title">
        <div className="bf-head">
          <span id="item-sheet-title">{item ? STR.compare.itemDetails : STR.compare.addItem}</span>
          <button className="text-btn" onClick={onClose}>{STR.feature.close}</button>
        </div>

        <label className={`bf-name${!valid && v.name !== '' ? ' bad' : ''}`}>
          <span>{STR.feature.ruleTitle}</span>
          <input autoFocus value={v.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} placeholder={STR.compare.itemNamePlaceholder} enterKeyHint="done" />
        </label>

        <label className="bf-name">
          <span>{STR.compare.shop} ({STR.compare.optional})</span>
          <input value={v.shopName} maxLength={80} onChange={(e) => set({ shopName: e.target.value })} />
        </label>

        <div className="rf-row">
          <span className="tile peach" aria-hidden="true"><Icon name="tag" size={17} stroke={1.9} /></span>
          <span className="rf-name">{STR.compare.price}</span>
          <span className="rf-value">
            <input className="price-input" dir="ltr" inputMode="numeric" value={v.price} onChange={(e) => set({ price: e.target.value })} aria-label={STR.compare.price} placeholder="0" />
            <em className="price-unit">{STR.compare.priceUnit}</em>
          </span>
        </div>

        <div className="rf-row">
          <span className="tile blue" aria-hidden="true"><Icon name="calendar" size={17} stroke={1.9} /></span>
          <span className="rf-name">{STR.compare.seenOn}</span>
          <button type="button" className="rf-value as-text" onClick={() => setPicking(true)}>
            {label(v.seenOn, 'persian', 0, { day: 'numeric', month: 'long' })}
            <Icon name="chevronLeft" size={16} stroke={2} />
          </button>
        </div>

        <label className="bf-name bf-name-top">
          <span>{STR.compare.note} ({STR.compare.optional})</span>
          <textarea className="rf-text" value={v.note} maxLength={1000} onChange={(e) => set({ note: e.target.value })} />
        </label>

        {err && <p className="form-error" role="alert">{err}</p>}

        <button className="primary" disabled={!valid || busy} onClick={() => void save()}>
          <Icon name="check" size={18} stroke={2.4} />{busy ? 'در حال ذخیره…' : STR.feature.save}
        </button>

        {item && (
          <button className="text-btn item-check-link" onClick={() => onCheck(item.id)}>
            <Icon name="listChecks" size={15} stroke={1.9} />
            {STR.compare.checkMode} · {STR.compare.checkProgress(rules.length - uncheckedCount(item.id, rules, checks), rules.length)}
          </button>
        )}
      </section>
      {picking && <DatePicker value={v.seenOn} onPick={(d) => { set({ seenOn: d }); setPicking(false); }} onClose={() => setPicking(false)} />}
    </>
  );
}

const stateIcon = (s: CheckState) => (s === 'pass' ? 'check' : s === 'fail' ? 'close' : 'info');
const stateClass = (s: CheckState) => (s === 'pass' ? 'pass' : s === 'fail' ? 'fail' : 'unknown');
const stateLabel = (s: CheckState) => (s === 'pass' ? STR.compare.pass : s === 'fail' ? STR.compare.fail : STR.compare.unknown);
/** The matrix's tap order. `unknown` is a real state, so it is reachable in the cycle instead of being skipped. */
const nextState = (s: CheckState): CheckState => (s === 'pass' ? 'fail' : s === 'fail' ? 'unknown' : 'pass');

/** The matrix: rules as rows, items as columns, horizontal scroll inside its own container, sticky rule column. */
function MatrixSheet({ session, items, rules, checks, onClose }: {
  session: CompareSession;
  items: CompareItem[];
  rules: Rule[];
  checks: CompareCheck[];
  onClose: () => void;
}) {
  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet matrix-sheet" role="dialog" aria-modal="true" aria-labelledby="matrix-title">
        <div className="bf-head">
          <span id="matrix-title">{STR.compare.matrixTitle}</span>
          <button className="text-btn" onClick={onClose}>{STR.feature.close}</button>
        </div>

        <div className="matrix-wrap" role="group" aria-label={STR.compare.matrixTitle} tabIndex={0}>
          <table className="matrix">
            <thead>
              <tr>
                <th className="mx-rule-col" scope="col">{STR.feature.ruleTitle}</th>
                {items.map((it) => <th key={it.id} scope="col" title={it.name}>{it.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <th scope="row" className="mx-rule-col">
                    {rule.title}
                    {rule.strict && <em className="rule-chip strict">{STR.feature.strict}</em>}
                  </th>
                  {items.map((it) => {
                    const c = checks.find((x) => x.itemId === it.id && x.ruleId === rule.id);
                    const s: CheckState = c?.state ?? 'unknown';
                    // A single check can be changed from the matrix: tapping cycles pass -> fail -> unknown -> pass, so
                    // one hand can correct a wrong tap without leaving the overview.
                    return (
                      <td key={it.id}>
                        <button
                          className={`mx-state ${stateClass(s)}`}
                          aria-label={`${it.name}، ${rule.title}: ${stateLabel(s)}`}
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
                <th scope="row" className="mx-rule-col">{STR.compare.matrixSummary}</th>
                {items.map((it) => {
                  const st = statsFor(it.id, rules, checks);
                  return (
                    <td key={it.id} className="mx-sum">
                      <b>{fa(st.pass)}</b>
                      <span>{STR.compare.failedCount(st.fail)}</span>
                      <span>{STR.compare.unknownCount(st.unknown)}</span>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="hint matrix-hint">{STR.compare.unknownNotZero}</p>
        <p className="hint matrix-hint">{STR.compare.archivedHidden}</p>
      </section>
    </>
  );
}

/** Two items side by side, with the «فقط تفاوت‌ها» switch. */
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

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet two-sheet" role="dialog" aria-modal="true" aria-labelledby="two-title">
        <div className="bf-head">
          <span id="two-title">{STR.compare.compareTwoTitle}</span>
          <button className="text-btn" onClick={onClose}>{STR.feature.close}</button>
        </div>

        <div className="two-pickers">
          {[{ label: STR.compare.columnA, value: aId, set: setAId }, { label: STR.compare.columnB, value: bId, set: setBId }].map(({ label, value, set }) => (
            <label key={label} className="two-pick">
              <span>{label}</span>
              <select value={value} onChange={(e) => set(e.target.value)} aria-label={label}>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
          ))}
        </div>

        <div className="rf-row">
          <span className="tile blue" aria-hidden="true"><Icon name="contrast" size={17} stroke={1.9} /></span>
          <span className="rf-name">{STR.compare.onlyDiff}</span>
          <Toggle on={onlyDiff} label={STR.compare.onlyDiff} onChange={setOnlyDiff} />
        </div>

        {stA && stB && (
          <div className="two-heads">
            <div className="two-head">
              <b>{a?.name}</b>
              <span>{STR.compare.checkedOf(stA.pass, stA.total)} · {STR.compare.failedCount(stA.fail)} · {STR.compare.unknownCount(stA.unknown)}</span>
              {a?.price !== undefined && <span>{priceText(a.price)}</span>}
            </div>
            <div className="two-head">
              <b>{b?.name}</b>
              <span>{STR.compare.checkedOf(stB.pass, stB.total)} · {STR.compare.failedCount(stB.fail)} · {STR.compare.unknownCount(stB.unknown)}</span>
              {b?.price !== undefined && <span>{priceText(b.price)}</span>}
            </div>
          </div>
        )}

        {diffs.length === 0 ? (
          <p className="hint">{STR.compare.noDiff}</p>
        ) : (
          <div className="two-list">
            {diffs.map(({ rule, a: sa, b: sb }) => (
              <div key={rule.id} className="two-row">
                <span className="two-rule">{rule.title}{rule.strict && <em className="rule-chip strict">{STR.feature.strict}</em>}</span>
                <span className={`mx-state ${stateClass(sa)}`} aria-label={`${a?.name}: ${STR.compare[sa === 'pass' ? 'pass' : sa === 'fail' ? 'fail' : 'unknown']}`}>
                  <Icon name={stateIcon(sa)} size={15} stroke={2.4} />
                </span>
                <span className={`mx-state ${stateClass(sb)}`} aria-label={`${b?.name}: ${STR.compare[sb === 'pass' ? 'pass' : sb === 'fail' ? 'fail' : 'unknown']}`}>
                  <Icon name={stateIcon(sb)} size={15} stroke={2.4} />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
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
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="decide-title">
        <div className="bf-head">
          <span id="decide-title">{STR.compare.decide}</span>
          <button className="text-btn" onClick={onClose}>{STR.feature.close}</button>
        </div>
        <p className="hint">{item.name}</p>
        <label className="bf-name bf-name-top">
          <span>{STR.compare.decisionNote}</span>
          <textarea className="rf-text" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder={STR.compare.decisionNotePlaceholder} />
        </label>
        <button className="primary" disabled={busy} onClick={() => void save()}>
          <Icon name="check" size={18} stroke={2.4} />{STR.compare.decide}
        </button>
      </section>
    </>
  );
}
