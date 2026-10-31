import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Rule, db } from './db';
import { fa, today } from './cal';
import { Icon } from './Icon';
import { Toggle } from './Toggle';
import { STR } from './strings/rulebook';
import { orderRules, recordReview } from './ruleData';

/**
 * Phase 4: the on-demand read-through of one category or the whole rulebook. It walks **every** active rule in order,
 * regardless of due dates, and changes nothing unless «ثبت به‌عنوان مرور» is switched on for this run — in that case each
 * rule the user reads is recorded as `remembered`, which is what "this counted as a review" means.
 */
export function ReadThrough({ categoryId, categoryName, onClose }: { categoryId?: string; categoryName?: string; onClose: () => void }) {
  const rules = useLiveQuery(() => db.rules.toArray());
  const [list, setList] = useState<Rule[] | null>(null);
  const [index, setIndex] = useState(0);
  const [countAsReview, setCountAsReview] = useState(false);
  const [recorded, setRecorded] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (rules && list === null) setList(orderRules(rules.filter((r) => !r.archivedAt && (!categoryId || r.categoryId === categoryId))));
  }, [rules, list, categoryId]);

  const current = list?.[index];
  const title = useMemo(() => categoryName ?? STR.review.readThroughTitle, [categoryName]);

  const go = async (delta: 1 | -1) => {
    if (!current) return;
    if (countAsReview && delta === 1) {
      setBusy(true);
      try {
        await recordReview(current, 'remembered');
        setRecorded((n) => n + 1);
      } finally {
        setBusy(false);
      }
    }
    setIndex((i) => i + delta);
  };

  const head = (
    <header className="dd-head">
      <button className="icon-btn" aria-label={STR.feature.close} onClick={onClose}><Icon name="chevronRight" /></button>
      <span>{title}</span>
      <span className="head-spacer" />
    </header>
  );

  if (list === null) {
    return (
      <>
        {head}
        <p className="hint">…</p>
      </>
    );
  }
  if (list.length === 0) {
    return (
      <>
        {head}
        <section className="glass empty-state small">
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
          <b>{STR.review.readThroughDone}</b>
          <p className="hint">{countAsReview ? `${fa(recorded)} ${STR.feature.reviewCount} ${STR.review.recordAsReview}` : STR.review.readThroughNoChange}</p>
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
        <span role="status">{STR.review.progress(index + 1, list.length)}</span>
        <div className="review-bar" aria-hidden="true"><i style={{ width: `${(index / list.length) * 100}%` }} /></div>
      </div>

      <section className="glass review-card read" aria-live="polite">
        <h2>{current.title}</h2>
        {current.why ? <p className="read-why">{current.why}</p> : <p className="hint">{STR.feature.whyPlaceholder}</p>}
        <span className="review-box">{fa(current.box + 1)} · {STR.feature.box}</span>
      </section>

      <div className="rf-row read-toggle">
        <span className="tile blue" aria-hidden="true"><Icon name="checkCircle" size={17} stroke={1.9} /></span>
        <span className="rf-name">
          {STR.review.recordAsReview}
          <small className="set-sub">{STR.review.recordAsReviewHint}</small>
        </span>
        <Toggle on={countAsReview} label={STR.review.recordAsReview} onChange={setCountAsReview} />
      </div>

      <div className="read-actions">
        <button className="big-btn" disabled={index === 0 || busy} onClick={() => void go(-1)}>
          <Icon name="chevronRight" size={18} stroke={2.2} />{STR.review.readThroughPrev}
        </button>
        <button className="primary big-btn" disabled={busy} onClick={() => void go(1)}>
          {index === list.length - 1 ? STR.review.readThroughDone : STR.review.readThroughNext}
          <Icon name="chevronLeft" size={18} stroke={2.2} />
        </button>
      </div>
    </>
  );
}
