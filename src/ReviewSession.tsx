import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Rule, db } from './db';
import { fa, today } from './cal';
import { Icon } from './Icon';
import { STR, REVIEW_RESULT_LABEL } from './strings/rulebook';
import { dueCount, dueRules } from './domain/rules/schedule';
import { latestPlan } from './domain/rules/breaks';
import { recordReview } from './ruleData';
import { BreakSheet } from './BreakSheet';
import type { ReviewResult } from './domain/rules/constants';

/**
 * Phase 3: the scheduled review session. Active recall: the rule's title is shown first and the reason stays hidden until
 * the user asks for it. Each of the three answers writes a `ruleReviews` row and then updates the rule through `put`;
 * nothing is ever marked reviewed automatically, and the session only ever offers the rules that were due when it opened.
 */
export function ReviewSession({ categoryId, onClose }: { categoryId?: string; onClose: () => void }) {
  const t = today();
  const rules = useLiveQuery(() => db.rules.toArray());
  const [queue, setQueue] = useState<Rule[] | null>(null);
  const [index, setIndex] = useState(0);
  const [showWhy, setShowWhy] = useState(false);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  /** Part 1: the rule whose break sheet is open. The review row is already written when this opens. */
  const [breakFor, setBreakFor] = useState<Rule | null>(null);
  const breaks = useLiveQuery(() => db.ruleBreaks.toArray(), []) ?? [];

  // The queue is a snapshot taken once the rules have loaded: a rule that becomes due while the card is open must not
  // insert itself into the middle of the session (and must not be skipped either, so it shows up on the finish screen).
  useEffect(() => {
    if (rules && queue === null) setQueue(dueRules(rules.filter((r) => !categoryId || r.categoryId === categoryId), t));
  }, [rules, queue, categoryId, t]);

  const current = queue?.[index];
  const remaining = rules ? dueCount(rules, t) : 0;
  const plan = current ? latestPlan(breaks, current.id) : undefined;

  const answer = async (result: ReviewResult) => {
    if (!current || busy) return;
    setBusy(true);
    setErr('');
    const answered = current;
    try {
      await recordReview(answered, result, note);
      setNote('');
      setNoteOpen(false);
      setShowWhy(false);
      // A `broke` answer records the schedule change and then asks what happened. The sheet creates the `ruleBreaks` row
      // (even when skipped), so the break is never lost and the count never comes from the review itself.
      if (result === 'broke') setBreakFor(answered);
      else setIndex((i) => i + 1);
    } catch {
      setErr(STR.feature.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  const head = (
    <header className="dd-head">
      <button className="icon-btn" aria-label={STR.feature.close} onClick={onClose}><Icon name="chevronRight" /></button>
      <span>{STR.review.sessionTitle}</span>
      <span className="head-spacer" />
    </header>
  );

  if (queue === null) {
    return (
      <>
        {head}
        <p className="hint">…</p>
      </>
    );
  }

  if (queue.length === 0) {
    return (
      <>
        {head}
        <section className="glass empty-state">
          <span className="tile green" aria-hidden="true"><Icon name="checkCircle" size={24} stroke={1.7} /></span>
          <b>{STR.review.emptyTitle}</b>
          <p className="hint">{STR.review.emptyBody}</p>
        </section>
      </>
    );
  }

  if (!current) {
    return (
      <>
        {head}
        <section className="glass empty-state">
          <span className="tile green" aria-hidden="true"><Icon name="checkCircle" size={24} stroke={1.7} /></span>
          <b>{STR.review.finishedTitle}</b>
          <p className="hint">{remaining > 0 ? STR.review.stillDue(remaining) : STR.review.allDone}</p>
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
        <span role="status">{STR.review.progress(index + 1, queue.length)}</span>
        <div className="review-bar" aria-hidden="true"><i style={{ width: `${(index / queue.length) * 100}%` }} /></div>
      </div>

      <section className="glass review-card" aria-live="polite">
        <span className="review-box">{STR.feature.box} {fa(current.box + 1)}</span>
        <h2>{current.title}</h2>
        {showWhy && current.why && (
          <div className="review-why">
            <span className="field-label">{STR.feature.why}</span>
            <p>{current.why}</p>
          </div>
        )}
        {showWhy && !current.why && <p className="hint">{STR.feature.whyPlaceholder}</p>}
        {/* Part 1: the latest "next time" plan is only revealed together with the reason, never before the tap */}
        {showWhy && plan && (
          <div className="review-why review-plan">
            <span className="field-label">{STR.breaks.latestPlan}</span>
            <p>{plan}</p>
          </div>
        )}
        <button className="text-btn review-show" onClick={() => setShowWhy((x) => !x)} aria-expanded={showWhy}>
          <Icon name={showWhy ? 'close' : 'note'} size={15} stroke={1.9} />
          {showWhy ? STR.review.hideWhy : STR.review.showWhy}
        </button>
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

      <div className="review-actions">
        <button className="review-btn remembered" disabled={busy} onClick={() => void answer('remembered')}>
          <Icon name="checkCircle" size={20} stroke={2} />{REVIEW_RESULT_LABEL.remembered}
        </button>
        <button className="review-btn forgot" disabled={busy} onClick={() => void answer('forgot')}>
          <Icon name="refresh" size={19} stroke={2} />{REVIEW_RESULT_LABEL.forgot}
        </button>
        <button className="review-btn broke" disabled={busy} onClick={() => void answer('broke')}>
          <Icon name="close" size={19} stroke={2.2} />{REVIEW_RESULT_LABEL.broke}
        </button>
      </div>

      {breakFor && (
        <BreakSheet
          key={breakFor.id}
          rule={breakFor}
          onClose={() => {
            setBreakFor(null);
            // advance once the sheet is done, whether it was filled in or skipped
            setIndex((i) => i + 1);
          }}
        />
      )}
    </>
  );
}
