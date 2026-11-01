import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Rule, db } from './db';
import { fa, today } from './cal';
import { Icon } from './Icon';
import { Button, Card } from './ui';
import { Toggle } from './Toggle';
import { STR } from './strings/rulebook';
import { orderRules, recordReview } from './ruleData';
import { tx } from './i18n';

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
  const title = useMemo(() => categoryName ?? tx(STR.review.readThroughTitle), [categoryName]);

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
      <Button variant="ghost" size="icon-md" aria-label={tx(STR.feature.close)} onClick={onClose} icon="chevronRight" />
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
        <Card className="empty-state small">
          <b>{tx(STR.review.emptyTitle)}</b>
          <p className="hint">{tx(STR.review.emptyBody)}</p>
        </Card>
      </>
    );
  }
  if (!current) {
    return (
      <>
        {head}
        <Card className="empty-state">
          <span className="tile green" aria-hidden="true"><Icon name="checkCircle" size={24} stroke={1.7} /></span>
          <b>{tx(STR.review.readThroughDone)}</b>
          <p className="hint">{countAsReview ? `${fa(recorded)} ${tx(STR.feature.reviewCount)} ${tx(STR.review.recordAsReview)}` : tx(STR.review.readThroughNoChange)}</p>
        </Card>
        <div className="rf-foot">
          <Button variant="primary" block size="lg" onClick={onClose} icon="check">
            {tx(STR.feature.close)}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {head}

      <div className="review-progress">
        <span role="status">{tx(STR.review.progress(index + 1, list.length))}</span>
        <div className="review-bar" aria-hidden="true"><i style={{ width: `${(index / list.length) * 100}%` }} /></div>
      </div>

      <Card className="review-card read" aria-live="polite">
        <h2>{current.title}</h2>
        {current.why ? <p className="read-why">{current.why}</p> : <p className="hint">{tx(STR.feature.whyPlaceholder)}</p>}
        <span className="review-box">{fa(current.box + 1)} · {tx(STR.feature.box)}</span>
      </Card>

      <div className="rf-row read-toggle">
        <span className="tile blue" aria-hidden="true"><Icon name="checkCircle" size={17} stroke={1.9} /></span>
        <span className="rf-name">
          {tx(STR.review.recordAsReview)}
          <small className="set-sub">{tx(STR.review.recordAsReviewHint)}</small>
        </span>
        <Toggle on={countAsReview} label={tx(STR.review.recordAsReview)} onChange={setCountAsReview} />
      </div>

      <div className="read-actions">
        <Button size="lg" disabled={index === 0 || busy} onClick={() => void go(-1)} icon="chevronRight">
          {tx(STR.review.readThroughPrev)}
        </Button>
        <Button variant="primary" size="lg" iconPosition="end" disabled={busy} onClick={() => void go(1)} icon="chevronLeft">
          {index === list.length - 1 ? tx(STR.review.readThroughDone) : tx(STR.review.readThroughNext)}
        </Button>
      </div>
    </>
  );
}
