import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Person, type Rule, type RuleCheck, type RuleCheckItem, type RuleCategory, db } from './db';
import { fa, label } from './cal';
import { ask } from './confirm';
import { Icon } from './Icon';
import { Toggle } from './Toggle';
import { STR, CHECK_ITEM_LABEL } from './strings/rulebook';
import { normalize } from './search';
import {
  checkCounts,
  chosenRules,
  groupByCategory,
  rulesInCategory,
  stateOf,
  strictBreaking,
  type CheckItemState,
} from './domain/rules/personCheck';
import {
  closePersonCheck,
  createPersonCheck,
  deletePersonCheck,
  reopenPersonCheck,
  setCheckItem,
} from './ruleData';
import { BreakSheet } from './BreakSheet';

/**
 * Part 2: going through my rules for one person before doing something with them. Every non-archived rule is listed under
 * its category, each with four tappable states and an optional note; the summary keeps the counts side by side, and the
 * strict rules marked as breaking get their own red list. There is no combined score anywhere.
 */
export function PersonCheckPage({ checkId, onBack }: { checkId: string; onBack: () => void }) {
  const check = useLiveQuery(() => db.ruleChecks.get(checkId), [checkId]);
  const person = useLiveQuery(() => (check ? db.people.get(check.personId) : undefined), [check?.personId]);
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.ruleCategories.toArray(), []) ?? [];
  const items = useLiveQuery(() => db.ruleCheckItems.where('checkId').equals(checkId).toArray(), [checkId]) ?? [];

  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [onlyChosen, setOnlyChosen] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [breakFor, setBreakFor] = useState<Rule | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState('');
  const [cardMode, setCardMode] = useState(false);

  const active = useMemo(() => rules.filter((r) => !r.archivedAt), [rules]);
  const words = useMemo(() => normalize(q).n.trim().split(/\s+/).filter(Boolean), [q]);
  const searched = useMemo(
    () => (words.length ? active.filter((r) => words.every((w) => normalize(`${r.title} ${r.why ?? ''}`).n.includes(w))) : active),
    [active, words],
  );
  const scoped = useMemo(() => rulesInCategory(searched, cat), [searched, cat]);
  const chosen = useMemo(() => chosenRules(scoped, items), [scoped, items]);
  const shown = onlyChosen ? chosen : scoped;
  const groups = useMemo(() => groupByCategory(shown, categories), [shown, categories]);
  const counts = checkCounts(scoped, items);
  const strict = strictBreaking(scoped, items);
  const closed = check?.status === 'closed';

  useEffect(() => {
    if (check && title === '') setTitle(check.title);
  }, [check, title]);

  if (check === undefined) return <p className="hint">…</p>;
  if (!check) {
    return (
      <>
        <header className="dd-head">
          <button className="icon-btn" aria-label={STR.feature.close} onClick={onBack}><Icon name="chevronRight" /></button>
          <span>{STR.personCheck.title}</span>
          <span className="head-spacer" />
        </header>
        <p className="hint">{STR.personCheck.empty}</p>
      </>
    );
  }

  const setState = (rule: Rule, state: CheckItemState) => void setCheckItem(check.id, rule.id, state, noteFor === rule.id ? note : undefined);

  const saveTitle = async () => {
    const { renamePersonCheck } = await import('./ruleData');
    await renamePersonCheck(check, title);
    setRenaming(false);
  };

  const removeCheck = async () => {
    if (!(await ask({ title: STR.personCheck.deleteTitle, message: STR.personCheck.deleteBody, confirm: STR.feature.delete, icon: 'trash' }))) return;
    await deletePersonCheck(check);
    onBack();
  };

  const head = (
    <header className="dd-head">
      <button className="icon-btn" aria-label={STR.feature.close} onClick={onBack}><Icon name="chevronRight" /></button>
      <span>{STR.personCheck.title}</span>
      <button className="icon-btn" aria-label={STR.personCheck.cardMode} onClick={() => setCardMode(true)}><Icon name="listChecks" size={19} stroke={1.9} /></button>
    </header>
  );

  if (active.length === 0) {
    return (
      <>
        {head}
        <section className="glass empty-state">
          <span className="tile purple" aria-hidden="true"><Icon name="listChecks" size={24} stroke={1.7} /></span>
          <b>{STR.personCheck.empty}</b>
          <p className="hint">{STR.personCheck.emptyBody}</p>
        </section>
      </>
    );
  }

  return (
    <>
      {head}

      <section className="glass check-head">
        {renaming ? (
          <form className="cat-rename check-rename" onSubmit={(e) => { e.preventDefault(); void saveTitle(); }}>
            <input autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} aria-label={STR.personCheck.titleLabel} placeholder={STR.personCheck.titlePlaceholder} />
            <button type="submit" className="icon-btn small" aria-label={STR.feature.save}><Icon name="check" size={17} stroke={2.4} /></button>
          </form>
        ) : (
          <button className="check-title" onClick={() => setRenaming(true)}>
            {check.title || STR.personCheck.titlePlaceholder}
            <small className="set-sub">
              {(person as Person | undefined)?.displayName ?? ''}
              {check.status === 'closed' ? ` · ${STR.personCheck.closed}` : ''}
              {check.closedAt ? ` · ${label(new Date(check.closedAt).toLocaleDateString('sv'), 'persian', 0, { day: 'numeric', month: 'long' })}` : ''}
            </small>
          </button>
        )}
        <div className="check-summary" role="group" aria-label={STR.personCheck.summary}>
          <div className="cs keeping"><b>{fa(counts.keeping)}</b><span>{STR.personCheck.keepingCount}</span></div>
          <div className="cs breaking"><b>{fa(counts.breaking)}</b><span>{STR.personCheck.breakingCount}</span></div>
          <div className="cs na"><b>{fa(counts.na)}</b><span>{STR.personCheck.na}</span></div>
          <div className="cs unknown"><b>{fa(counts.unknown)}</b><span>{STR.personCheck.unknownCount}</span></div>
        </div>
        <p className="hint check-no-score">{STR.personCheck.noScore} · {STR.personCheck.unknownNotBreaking}</p>

        {strict.length > 0 && (
          <div className="strict-list" role="group" aria-label={STR.personCheck.strictBreaks}>
            <b className="strict-title"><Icon name="target" size={14} stroke={2.2} />{STR.personCheck.strictBreaks}</b>
            {strict.map((r) => (
              <span key={r.id} className="strict-row">{r.title}</span>
            ))}
          </div>
        )}
      </section>

      <label className="search-field check-search">
        <Icon name="search" size={18} stroke={1.9} />
        <input type="search" value={q} placeholder={STR.personCheck.searchRules} aria-label={STR.personCheck.searchRules} onChange={(e) => setQ(e.target.value)} />
      </label>

      <div className="tabs rule-cats" role="tablist" aria-label={STR.feature.category}>
        <button role="tab" aria-selected={cat === null} className={cat === null ? 'on' : ''} onClick={() => setCat(null)}>{STR.feature.allCategories}</button>
        {categories.map((c) => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{c.name}</button>
        ))}
      </div>

      <div className="rf-row check-only-chosen">
        <span className="tile blue" aria-hidden="true"><Icon name="listChecks" size={17} stroke={1.9} /></span>
        <span className="rf-name">
          {STR.personCheck.onlyChosen}
          <small className="set-sub">{STR.personCheck.onlyChosenHint}</small>
        </span>
        <Toggle on={onlyChosen} label={STR.personCheck.onlyChosen} onChange={setOnlyChosen} />
      </div>

      {shown.length === 0 && <p className="hint empty">{onlyChosen ? STR.personCheck.selectHint : STR.personCheck.emptyBody}</p>}

      {groups.map((g) => (
        <section key={g.category?.id ?? 'none'}>
          <h2 className="sec-title">{g.category?.name ?? STR.feature.category}<small>{fa(g.rules.length)}</small></h2>
          <div className="glass check-rule-list">
            {g.rules.map((rule) => {
              const state = stateOf(items, rule.id);
              return (
                <div key={rule.id} className={`check-rule state-${state}`}>
                  <div className="cr-head">
                    <span className="cr-title">
                      {rule.title}
                      {rule.strict && <em className="rule-chip strict">{STR.feature.strict}</em>}
                    </span>
                    <button
                      className="icon-btn small"
                      aria-label={`${STR.personCheck.note}: ${rule.title}`}
                      onClick={() => { setNoteFor(rule.id); setNote(items.find((i) => i.ruleId === rule.id)?.note ?? ''); }}
                    >
                      <Icon name="note" size={15} stroke={1.9} />
                    </button>
                  </div>
                  {rule.why && <p className="cr-why">{rule.why}</p>}
                  <div className="cr-states" role="radiogroup" aria-label={rule.title}>
                    {(['keeping', 'breaking', 'na', 'unknown'] as const).map((s) => (
                      <button
                        key={s}
                        role="radio"
                        aria-checked={state === s}
                        className={`cr-state ${s}${state === s ? ' on' : ''}`}
                        onClick={() => setState(rule, s)}
                      >
                        <Icon name={s === 'keeping' ? 'check' : s === 'breaking' ? 'close' : s === 'na' ? 'undo' : 'info'} size={13} stroke={2.4} />
                        {CHECK_ITEM_LABEL[s]}
                      </button>
                    ))}
                  </div>
                  {state === 'breaking' && (
                    <button className="text-btn cr-record" onClick={() => setBreakFor(rule)}>
                      <Icon name="plus" size={13} stroke={2.4} />{STR.personCheck.recordBreak}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="rf-foot check-foot">
        <button className="big-btn" onClick={() => setCardMode(true)}>
          <Icon name="listChecks" size={17} stroke={1.9} />{STR.personCheck.cardMode}
        </button>
        {closed ? (
          <button className="primary big-btn" onClick={() => void reopenPersonCheck(check)}>
            <Icon name="undo" size={17} stroke={2.2} />{STR.personCheck.reopen}
          </button>
        ) : (
          <button className="primary big-btn" onClick={() => void closePersonCheck(check)}>
            <Icon name="check" size={18} stroke={2.4} />{STR.personCheck.close}
          </button>
        )}
      </div>
      <div className="set-actions">
        <button className="danger-btn" onClick={() => void removeCheck()}><Icon name="trash" size={16} stroke={2} />{STR.feature.delete}</button>
      </div>

      {noteFor && (
        <NoteSheet
          ruleTitle={shown.find((r) => r.id === noteFor)?.title ?? ''}
          note={note}
          onSave={async (text) => {
            const rule = rules.find((r) => r.id === noteFor);
            if (rule) {
              const current = stateOf(items, rule.id);
              // a note without a state would be unreachable, so the note keeps (or defaults to) the rule's current state
              await setCheckItem(check.id, rule.id, current === 'unknown' ? 'keeping' : current, text);
            }
            setNoteFor(null);
          }}
          onClose={() => setNoteFor(null)}
        />
      )}

      {breakFor && (
        <BreakSheet
          rule={breakFor}
          seedPersonId={check.personId}
          onClose={() => setBreakFor(null)}
        />
      )}

      {cardMode && (
        <CheckCardMode
          check={check}
          rules={shown}
          items={items}
          onClose={() => setCardMode(false)}
        />
      )}
    </>
  );
}

function NoteSheet({ ruleTitle, note, onSave, onClose }: { ruleTitle: string; note: string; onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState(note);
  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="check-note-title">
        <div className="bf-head">
          <span id="check-note-title">{STR.personCheck.note} · {ruleTitle}</span>
          <button className="text-btn" onClick={onClose}>{STR.feature.close}</button>
        </div>
        <label className="bf-name bf-name-top">
          <span>{STR.personCheck.note}</span>
          <textarea className="rf-text" autoFocus value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} />
        </label>
        <button className="primary" onClick={() => onSave(text)}><Icon name="check" size={18} stroke={2.4} />{STR.feature.save}</button>
      </section>
    </>
  );
}

/**
 * Part 2's one-hand card mode, modelled on the purchase quick check: one rule per card with the four states as big targets,
 * starting at the first rule that has no state yet so leaving and coming back resumes.
 */
function CheckCardMode({ check, rules, items, onClose }: { check: RuleCheck; rules: Rule[]; items: RuleCheckItem[]; onClose: () => void }) {
  const [index, setIndex] = useState(() => {
    const first = rules.findIndex((r) => !items.some((i) => i.ruleId === r.id && i.state !== 'unknown'));
    return first < 0 ? rules.length : first;
  });
  const [busy, setBusy] = useState(false);
  const current = rules[index];
  const answered = rules.filter((r) => items.some((i) => i.ruleId === r.id && i.state !== 'unknown')).length;

  const answer = async (state: CheckItemState) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await setCheckItem(check.id, current.id, state);
      setIndex((i) => i + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet check-card-sheet" role="dialog" aria-modal="true" aria-labelledby="check-card-title">
        <div className="bf-head">
          <span id="check-card-title">{STR.personCheck.cardModeTitle}</span>
          <button className="text-btn check-back" onClick={onClose}>{STR.feature.close}</button>
        </div>

        {!current ? (
          <section className="glass empty-state small">
            <b>{STR.personCheck.cardDone}</b>
            <p className="hint">{STR.personCheck.cardProgress(answered, rules.length)}</p>
          </section>
        ) : (
          <>
            <div className="review-progress">
              <span role="status">{STR.personCheck.cardProgress(index + 1, rules.length)}</span>
              <div className="review-bar" aria-hidden="true"><i style={{ width: `${(index / Math.max(rules.length, 1)) * 100}%` }} /></div>
            </div>
            <div className="review-card check-card">
              {current.strict && <span className="rule-chip strict">{STR.feature.strict}</span>}
              <h2>{current.title}</h2>
              {current.why && <p className="read-why">{current.why}</p>}
            </div>
            <div className="check-actions check-card-actions" role="group" aria-label={STR.personCheck.cardModeTitle}>
              <button className="check-btn pass" disabled={busy} onClick={() => void answer('keeping')}>
                <Icon name="check" size={26} stroke={2.6} /><span>{STR.personCheck.keeping}</span>
              </button>
              <button className="check-btn fail" disabled={busy} onClick={() => void answer('breaking')}>
                <Icon name="close" size={26} stroke={2.6} /><span>{STR.personCheck.breaking}</span>
              </button>
            </div>
            <div className="check-actions check-card-actions two" role="group" aria-label={STR.personCheck.cardModeTitle}>
              <button className="check-btn unknown" disabled={busy} onClick={() => void answer('na')}>
                <Icon name="undo" size={22} stroke={2.2} /><span>{STR.personCheck.na}</span>
              </button>
              <button className="check-btn unknown" disabled={busy} onClick={() => void answer('unknown')}>
                <Icon name="info" size={22} stroke={2.2} /><span>{STR.personCheck.unknown}</span>
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

/** Creating a check from the profile: the title is optional and can be added later, so this is one tap and a sheet. */
export function NewCheckSheet({ personId, onClose, onCreated }: { personId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const row = await createPersonCheck(personId, title);
      onCreated(row.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="new-check-title">
        <div className="bf-head">
          <span id="new-check-title">{STR.personCheck.newTitle}</span>
          <button className="text-btn" onClick={onClose}>{STR.feature.close}</button>
        </div>
        <p className="hint">{STR.personCheck.createAskBody}</p>
        <label className="bf-name">
          <span>{STR.personCheck.titleLabel}</span>
          <input autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={STR.personCheck.titlePlaceholder} enterKeyHint="done" />
        </label>
        <button className="primary" disabled={busy} onClick={() => void create()}>
          <Icon name="check" size={18} stroke={2.4} />{busy ? 'در حال ذخیره…' : STR.personCheck.start}
        </button>
      </section>
    </>
  );
}

/** The person's earlier checks, listed on the profile. */
export function PersonChecks({ personId, checks, onOpen }: { personId: string; checks: RuleCheck[]; onOpen: (id: string) => void }) {
  const items = useLiveQuery(() => db.ruleCheckItems.toArray(), []) ?? [];
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? [];
  if (checks.length === 0) return <p className="hint">{STR.personCheck.historyEmpty}</p>;
  return (
    <div className="glass set-list">
      {checks.map((c) => {
        const mine = items.filter((i) => i.checkId === c.id);
        const counts = checkCounts(rules.filter((r) => !r.archivedAt), mine);
        return (
          <button key={c.id} className="set-row as-btn" onClick={() => onOpen(c.id)}>
            <span className={`tile ${c.status === 'closed' ? 'green' : 'blue'}`} aria-hidden="true">
              <Icon name={c.status === 'closed' ? 'checkCircle' : 'listChecks'} size={16} stroke={1.9} />
            </span>
            <span className="set-name">
              {c.title || STR.personCheck.newTitle}
              <small className="set-sub">
                {c.status === 'closed' ? STR.personCheck.closed : STR.personCheck.cardMode} ·{' '}
                {fa(counts.keeping)} {STR.personCheck.keepingCount} · {fa(counts.breaking)} {STR.personCheck.breakingCount}
              </small>
            </span>
            <Icon name="chevronLeft" size={16} stroke={2} />
          </button>
        );
      })}
    </div>
  );
}
