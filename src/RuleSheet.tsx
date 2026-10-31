import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Rule, type RuleBreak, type RuleCategory, type RuleReview } from './db';
import { fa, label, today } from './cal';
import { ask } from './confirm';
import { Icon } from './Icon';
import { Toggle } from './Toggle';
import { Choice } from './Choice';
import { STR, REVIEW_RESULT_LABEL } from './strings/rulebook';
import { addRule, archiveRule, boxLabel, breaksOfRule, deleteRule, dueLabel, nextReviewText, restoreRule, reviewsOf, saveBreak, saveRule } from './ruleData';
import { replaySchedule } from './domain/rules/schedule';
import { BreakSheet, BreakTimeline } from './BreakSheet';
import { breaksOf } from './domain/rules/breaks';

/**
 * Phase 2: the rule editor. One sheet for every editable field — title, why, category, pin, strict — plus the rule's own
 * review history and its archive/restore/delete actions. The schedule fields are shown read-only: only a review moves them.
 */
/** Rebuilds the box and due date from the review rows alone and shows them, the same way `replaySchedule` does. */
function ReplayedHint({ reviews }: { reviews: RuleReview[] }) {
  const from = reviews[reviews.length - 1].reviewedOn;
  const replayed = replaySchedule(reviews, from);
  return (
    <p className="hint replay-hint">
      {STR.feature.historyReplay}: {boxLabel(replayed.box)} · {dueLabel(replayed.nextReviewOn)}
    </p>
  );
}

export function RuleSheet({ rule, categories, seedCategoryId, onClose }: { rule: Rule | null; categories: RuleCategory[]; seedCategoryId?: string; onClose: () => void }) {
  const [v, setV] = useState(() => ({
    title: rule?.title ?? '',
    why: rule?.why ?? '',
    categoryId: rule?.categoryId ?? seedCategoryId ?? categories[0]?.id ?? '',
    pinned: !!rule?.pinned,
    strict: !!rule?.strict,
  }));
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  /** Part 1: creating a break, or editing one that already exists. */
  const [breaking, setBreaking] = useState<'new' | RuleBreak | null>(null);
  const t = today();
  const breaks = useLiveQuery(() => (rule ? breaksOfRule(rule.id) : Promise.resolve([])), [rule?.id, breaking]) ?? [];
  const reviews = useLiveQuery(() => (showHistory && rule ? reviewsOf(rule.id) : Promise.resolve([])), [showHistory, rule?.id]) ?? [];
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));
  const valid = v.title.trim() !== '' && v.categoryId !== '';

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr('');
    try {
      if (rule) await saveRule(rule, { title: v.title, why: v.why, categoryId: v.categoryId, pinned: v.pinned, strict: v.strict });
      else {
        const created = await addRule(v.categoryId, v.title);
        if (v.why.trim() || v.pinned || v.strict) await saveRule(created, { why: v.why, pinned: v.pinned, strict: v.strict });
      }
      onClose();
    } catch {
      setErr(STR.feature.saveFailed);
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!rule) return;
    await archiveRule(rule);
    onClose();
  };
  const restore = async () => {
    if (!rule) return;
    await restoreRule(rule);
    onClose();
  };
  const remove = async () => {
    if (!rule) return;
    const ok = await ask({
      title: `«${rule.title}» حذف شود؟`,
      message: 'قانون، تاریخچهٔ مرورش و تیک‌هایش در مقایسه‌ها پاک می‌شوند. این کار قابل بازگشت نیست؛ اگر فقط نمی‌خواهی در فهرست باشد، بایگانی کن.',
      confirm: STR.feature.delete,
      icon: 'trash',
    });
    if (!ok) return;
    await deleteRule(rule);
    onClose();
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet rule-sheet" role="dialog" aria-modal="true" aria-labelledby="rule-sheet-title">
        <div className="bf-head">
          <span id="rule-sheet-title">{rule ? STR.feature.edit : STR.feature.addRule}</span>
          <button className="text-btn" onClick={onClose}>{STR.feature.close}</button>
        </div>

        <div className="pe-scroll">
          <label className={`bf-name${!valid && v.title !== '' ? ' bad' : ''}`}>
            <span>{STR.feature.ruleTitle}</span>
            <input autoFocus value={v.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} placeholder={STR.feature.quickAddPlaceholder} enterKeyHint="done" />
          </label>

          <label className="bf-name bf-name-top">
            <span>{STR.feature.why}</span>
            <textarea className="rf-text" value={v.why} onChange={(e) => set({ why: e.target.value })} placeholder={STR.feature.whyPlaceholder} maxLength={2000} />
          </label>

          <div className="rf-row">
            <span className="tile purple" aria-hidden="true"><Icon name="tag" size={17} stroke={1.9} /></span>
            <span className="rf-name">{STR.feature.category}</span>
            <span className="rf-value">
              {categories.find((c) => c.id === v.categoryId)?.name ?? '—'}
              <Choice
                className="pick-hit"
                label={STR.feature.category}
                value={v.categoryId}
                options={categories.map((c): [string, string] => [c.id, c.name])}
                onChange={(id) => set({ categoryId: id })}
              />
            </span>
          </div>

          <div className="rf-row">
            <span className="tile blue" aria-hidden="true"><Icon name="pin" size={17} stroke={1.9} /></span>
            <span className="rf-name">{STR.feature.pinned}</span>
            <Toggle on={v.pinned} label={STR.feature.pinned} onChange={(on) => set({ pinned: on })} />
          </div>

          <div className="rf-row">
            <span className="tile peach" aria-hidden="true"><Icon name="target" size={17} stroke={1.9} /></span>
            <span className="rf-name">
              {STR.feature.strict}
              <small className="set-sub">{STR.feature.strictHint}</small>
            </span>
            <Toggle on={v.strict} label={STR.feature.strict} onChange={(on) => set({ strict: on })} />
          </div>

          {rule && (
            <div className="rf-row">
              <span className="tile green" aria-hidden="true"><Icon name="history" size={17} stroke={1.9} /></span>
              <span className="rf-name">
                {STR.feature.nextReview}
                <small className="set-sub">
                  {boxLabel(rule.box)} · {nextReviewText(rule, t)} · {fa(rule.reviewCount)} {STR.feature.reviewCount}
                  {rule.brokenCount > 0 ? ` · ${fa(rule.brokenCount)} ${STR.feature.brokenCount}` : ''}
                </small>
              </span>
              <button type="button" className="text-btn" onClick={() => setShowHistory((x) => !x)}>{STR.feature.history}</button>
            </div>
          )}

          {rule && (
            <BreakTimeline rule={rule} breaks={breaks} todayIso={t} onEdit={(b) => setBreaking(b)} />
          )}

          {rule && showHistory && (
            <div className="rule-history">
              {reviews.length === 0 && <p className="hint">{STR.feature.historyEmpty}</p>}
              {/* the schedule is derived from the history, not the other way round: the line below is rebuilt by replaying
                  these very rows, so a mismatch would be visible here instead of silently trusted */}
              {reviews.length > 0 && <ReplayedHint reviews={reviews} />}
              {reviews.map((r) => (
                <div key={r.id} className="rate-event">
                  <span className={`rule-res rule-res-${r.result}`}>{REVIEW_RESULT_LABEL[r.result]}</span>
                  <span className="rate-body">
                    <b>{label(r.reviewedOn, 'persian', 0, { day: 'numeric', month: 'long', year: 'numeric' })}</b>
                    {r.note && <span>{r.note}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}

          {err && <p className="form-error" role="alert">{err}</p>}
        </div>

        <button className="primary" disabled={!valid || busy} onClick={() => void save()}>
          <Icon name="check" size={18} stroke={2.4} />
          {busy ? 'در حال ذخیره…' : rule ? STR.feature.save : STR.feature.addRule}
        </button>

        {rule && (
          <button className="big-btn break-cta" onClick={() => setBreaking('new')}>
            <Icon name="close" size={17} stroke={2.2} />{STR.breaks.record}
          </button>
        )}

        {rule && (
          <div className="set-actions rule-sheet-actions">
            {rule.archivedAt ? (
              <button onClick={() => void restore()}><Icon name="undo" size={17} stroke={1.9} />{STR.feature.restore}</button>
            ) : (
              <button onClick={() => void archive()}><Icon name="archive" size={17} stroke={1.9} />{STR.feature.archive}</button>
            )}
            <button className="danger-btn" onClick={() => void remove()}><Icon name="trash" size={16} stroke={2} />{STR.feature.delete}</button>
          </div>
        )}
      </section>

      {rule && breaking === 'new' && <BreakSheet rule={rule} onClose={() => setBreaking(null)} />}
      {rule && breaking && breaking !== 'new' && (
        <EditBreakSheet rule={rule} row={breaking} onClose={() => setBreaking(null)} />
      )}
    </>
  );
}

/** Editing an existing break row. It never creates a second one, so the count cannot double from an edit. */
function EditBreakSheet({ rule, row, onClose }: { rule: Rule; row: RuleBreak; onClose: () => void }) {
  const [v, setV] = useState({
    whatHappened: row.whatHappened ?? '',
    whyBroke: row.whyBroke ?? '',
    nextTimePlan: row.nextTimePlan ?? '',
    brokenOn: row.brokenOn,
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveBreak(row, v);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet break-sheet" role="dialog" aria-modal="true" aria-labelledby="edit-break-title">
        <div className="bf-head">
          <span id="edit-break-title">{STR.breaks.editTitle} · {rule.title}</span>
          <button className="text-btn" onClick={onClose}>{STR.feature.close}</button>
        </div>
        <div className="pe-scroll">
          <label className="bf-name bf-name-top">
            <span>{STR.breaks.whatHappened}</span>
            <textarea className="rf-text" value={v.whatHappened} maxLength={2000} onChange={(e) => set({ whatHappened: e.target.value })} />
          </label>
          <label className="bf-name bf-name-top">
            <span>{STR.breaks.whyBroke}</span>
            <textarea className="rf-text" value={v.whyBroke} maxLength={2000} onChange={(e) => set({ whyBroke: e.target.value })} />
          </label>
          <label className="bf-name bf-name-top">
            <span>{STR.breaks.nextTimePlan}</span>
            <textarea className="rf-text" value={v.nextTimePlan} maxLength={2000} onChange={(e) => set({ nextTimePlan: e.target.value })} />
          </label>
        </div>
        <button className="primary" disabled={busy} onClick={() => void save()}>
          <Icon name="check" size={18} stroke={2.4} />{busy ? 'در حال ذخیره…' : STR.feature.save}
        </button>
      </section>
    </>
  );
}
