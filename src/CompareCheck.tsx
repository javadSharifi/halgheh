import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Rule, db } from './db';
import { fa } from './cal';
import { Icon } from './Icon';
import { STR } from './strings/rulebook';
import { setCheck } from './ruleData';
import type { CheckState } from './domain/rules/constants';

/**
 * Phase 5, step 3: the quick check, one hand, in the shop. Every non-archived rule of the category is a card for one item
 * with three big buttons: رعایت / نقض / نامربوط. A note is optional. Leaving and coming back resumes at the first rule that has no
 * answer yet, so nothing is lost and nothing is asked twice.
 */
export function CompareCheckMode({ itemId, rules, onClose }: { itemId: string; rules: Rule[]; onClose: () => void }) {
  const item = useLiveQuery(() => db.compareItems.get(itemId), [itemId]);
  const checks = useLiveQuery(() => db.compareChecks.where('itemId').equals(itemId).toArray(), [itemId]);
  const [index, setIndex] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // resume at the first unanswered rule: `checks` arrives asynchronously, so this runs once when it lands
  useEffect(() => {
    if (checks === undefined || index !== null) return;
    const answered = new Map(checks.map((c) => [c.ruleId, c.state]));
    const first = rules.findIndex((r) => !answered.has(r.id));
    setIndex(first < 0 ? rules.length : first);
  }, [checks, index, rules]);

  const answeredCount = useMemo(() => {
    const ids = new Set(rules.map((r) => r.id));
    return (checks ?? []).filter((c) => ids.has(c.ruleId)).length;
  }, [checks, rules]);

  const current = index !== null ? rules[index] : undefined;

  const answer = async (state: CheckState) => {
    if (!current || busy) return;
    setBusy(true);
    setErr('');
    try {
      await setCheck(itemId, current.id, state, note);
      setNote('');
      setNoteOpen(false);
      setIndex((i) => (i === null ? i : i + 1));
    } catch {
      setErr(STR.feature.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  const head = (
    <header className="dd-head">
      <button className="icon-btn check-back" aria-label={STR.compare.backToSession} onClick={onClose}><Icon name="chevronRight" /></button>
      <span>{STR.compare.checkModeTitle}</span>
      <span className="head-spacer" />
    </header>
  );

  if (item === undefined || index === null) {
    return (
      <>
        {head}
        <p className="hint">…</p>
      </>
    );
  }
  if (!item) {
    return (
      <>
        {head}
        <p className="hint">{STR.compare.noItems}</p>
      </>
    );
  }
  if (rules.length === 0) {
    return (
      <>
        {head}
        <p className="hint">{STR.compare.noRules}</p>
      </>
    );
  }

  if (!current) {
    return (
      <>
        {head}
        <section className="glass empty-state">
          <span className="tile green" aria-hidden="true"><Icon name="checkCircle" size={24} stroke={1.7} /></span>
          <b>{STR.compare.checkDone}</b>
          <p className="hint">{item.name}</p>
        </section>
        <div className="rf-foot">
          <button className="primary big-btn" onClick={onClose}><Icon name="check" size={18} stroke={2.4} />{STR.feature.close}</button>
        </div>
      </>
    );
  }

  return (
    <>
      {head}

      <div className="review-progress">
        <span role="status">{STR.compare.checkProgress(answeredCount, rules.length)}</span>
        <div className="review-bar" aria-hidden="true"><i style={{ width: `${(index / rules.length) * 100}%` }} /></div>
      </div>

      <p className="check-for">{STR.compare.checkFor(item.name)}</p>

      <section className="glass review-card check-card" aria-live="polite">
        {current.strict && <span className="rule-chip strict">{STR.feature.strict}</span>}
        <h2>{current.title}</h2>
        {current.why && <p className="read-why">{current.why}</p>}
      </section>

      {noteOpen ? (
        <label className="bf-name bf-name-top review-note">
          <span>{STR.review.optionalNote}</span>
          <textarea className="rf-text" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </label>
      ) : (
        <button className="text-btn review-note-btn" onClick={() => setNoteOpen(true)}>
          <Icon name="plus" size={13} stroke={2.4} />{STR.review.optionalNote}
        </button>
      )}

      {err && <p className="form-error" role="alert">{err}</p>}

      <div className="check-actions" role="group" aria-label={STR.compare.checkModeTitle}>
        <button className="check-btn pass" disabled={busy} aria-label={STR.compare.pass} onClick={() => void answer('pass')}>
          <Icon name="check" size={30} stroke={2.6} />
          <span>{STR.compare.pass}</span>
        </button>
        <button className="check-btn fail" disabled={busy} aria-label={STR.compare.fail} onClick={() => void answer('fail')}>
          <Icon name="close" size={30} stroke={2.6} />
          <span>{STR.compare.fail}</span>
        </button>
        <button className="check-btn unknown" disabled={busy} aria-label={STR.compare.unknown} onClick={() => void answer('unknown')}>
          <Icon name="info" size={28} stroke={2.2} />
          <span>{STR.compare.unknown}</span>
        </button>
      </div>

      <p className="hint check-hint">{STR.compare.unknownNotZero}</p>
    </>
  );
}
