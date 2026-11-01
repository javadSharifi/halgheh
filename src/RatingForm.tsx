import { useState } from 'react';
import { type Rating, del, put, uid } from './db';
import { fa, today } from './cal';
import { ask } from './confirm';
import { Icon } from './Icon';
import { Button, FormPage, FormSection, InputField } from './ui';
import { DatePicker } from './DatePicker';
import { CRITERION_HINT, CRITERION_LABEL, SCORES, currentOf, historyOf, newRating, scoreText } from './ratings';
import type { RatingCriterion } from './db';
import { tx } from './i18n';

/**
 * Rate one criterion for one person (R2). Saving appends a new event: it never edits the previous one, so the history
 * shows how the user's judgement changed. The previous value stays visible while scoring.
 */
export function RatingForm({ personId, criterion, ratings, onClose }: {
  personId: string;
  criterion: RatingCriterion;
  ratings: Rating[];
  onClose: () => void;
}) {
  const current = currentOf(ratings, criterion);
  const history = historyOf(ratings, criterion);
  const [score, setScore] = useState(current?.score ?? 0);
  const [note, setNote] = useState('');
  const [ratedAt, setRatedAt] = useState(today());
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (score < 1 || busy) return;
    setBusy(true);
    setErr('');
    try {
      await put('ratings', newRating({ personId, criterion, score, note, ratedAt }, uid()));
      onClose();
    } catch {
      setErr(tx('ذخیره نشد؛ دوباره تلاش کن.'));
      setBusy(false);
    }
  };

  const removeOne = async (row: Rating) => {
    if (!(await ask({ title: tx('این ثبت حذف شود؟'), message: tx('فقط همین یک مورد از تاریخچه پاک می‌شود؛ بقیه می‌مانند.'), confirm: tx('حذف') }))) return;
    await del('ratings', row.id);
  };

  return (
    <>
      <FormPage
        title={tx(CRITERION_LABEL[criterion])}
        icon="plus"
        onClose={onClose}
        onSave={() => void save()}
        saveLabel={current ? tx('ثبت امتیاز تازه') : tx('ثبت')}
        saveDisabled={score < 1}
        busy={busy}
        error={err}
      >
        <FormSection>
          <p className="hint pe-hint">{tx(CRITERION_HINT[criterion])}</p>

          <div className="score-row" role="radiogroup" aria-label={tx('امتیاز {a1}', { a1: tx(CRITERION_LABEL[criterion]) })}>
            {SCORES.map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={score === s}
                aria-label={`${scoreText(s)}`}
                className={`score-pick${score === s ? ' on' : ''}`}
                onClick={() => setScore(s)}
              >
                {fa(s)}
              </button>
            ))}
          </div>
          <p className="hint pe-hint">
            {current ? tx('امتیاز فعلی: {a1} — ثبت تازه امتیاز فعلی را عوض می‌کند، قبلی در تاریخچه می‌ماند.', { a1: scoreText(current.score) }) : tx('هنوز امتیازی برای این مورد ثبت نشده.')}
          </p>

          <InputField
            multiline
            rows={3}
            label={tx('یادداشت (اختیاری)')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={tx('چرا این امتیاز؟')}
            maxLength={500}
          />

          <div className="rf-row">
            <span className="tile blue" aria-hidden="true"><Icon name="calendar" size={17} stroke={1.9} /></span>
            <span className="rf-name">{tx('تاریخ')}</span>
            <button type="button" className="rf-value as-text" onClick={() => setPicking(true)}>
              {ratedAt}
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          </div>

          {history.length > 0 && (
            <>
              <p className="field-label">{tx('تاریخچهٔ این مورد')}</p>
              <div className="rate-history">
                {history.map((h) => (
                  <div key={h.id} className="rate-event">
                    <span className="rate-score">{fa(h.score)}</span>
                    <span className="rate-body">
                      <b>{h.ratedAt}</b>
                      {h.note && <span>{h.note}</span>}
                    </span>
                    <Button variant="ghost" size="icon-sm" aria-label={tx('حذف این ثبت')} onClick={() => void removeOne(h)} icon="close" />
                  </div>
                ))}
              </div>
            </>
          )}

        </FormSection>
      </FormPage>
      {picking && <DatePicker value={ratedAt} onPick={(d) => { setRatedAt(d); setPicking(false); }} onClose={() => setPicking(false)} />}
    </>
  );
}
