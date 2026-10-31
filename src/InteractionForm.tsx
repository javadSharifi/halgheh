import { useState } from 'react';
import { type Interaction, del, put, uid } from './db';
import { ask } from './confirm';
import { fullDate, label, today } from './cal';
import { Icon } from './Icon';
import { DatePicker } from './DatePicker';
import { Choice } from './Choice';

const TYPES: [Interaction['type'], string][] = [
  ['meeting', 'دیدار'],
  ['call', 'تماس'],
  ['message', 'پیام'],
  ['other', 'دیگر'],
];
export const TYPE_NAME = Object.fromEntries(TYPES) as Record<Interaction['type'], string>;

const todayIso = () => today();

/** Add or edit one interaction with a person. A planned meeting is allowed: the date can be in the future. */
export function InteractionForm({ personId, initial, onClose }: { personId: string; initial?: Interaction; onClose: () => void }) {
  const [v, setV] = useState(() => ({
    type: initial?.type ?? ('meeting' as Interaction['type']),
    occurredAt: initial?.occurredAt ?? todayIso(),
    summary: initial?.summary ?? '',
    outcome: initial?.outcome ?? '',
    followUpDate: initial?.followUpDate ?? '',
  }));
  const [picking, setPicking] = useState<'when' | 'follow' | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));
  const valid = v.summary.trim() !== '' && v.occurredAt !== '';
  const future = v.occurredAt > todayIso();

  const remove = async () => {
    if (!initial || busy) return;
    if (!(await ask({ title: 'این تعامل حذف شود؟', message: 'فقط همین یک ردیف از سابقه پاک می‌شود.', confirm: 'حذف' }))) return;
    setBusy(true);
    try {
      await del('interactions', initial.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const row: Interaction = {
        ...initial,
        id: initial?.id ?? uid(),
        personId,
        type: v.type,
        occurredAt: v.occurredAt,
        summary: v.summary.replace(/\s+/g, ' ').trim(),
        updatedAt: Date.now(),
      };
      if (v.outcome.trim()) row.outcome = v.outcome.trim();
      else delete row.outcome;
      if (v.followUpDate) row.followUpDate = v.followUpDate;
      else delete row.followUpDate;
      await put('interactions', row);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="interaction-title">
        <div className="bf-head">
          <span id="interaction-title">{initial ? 'ویرایش تعامل' : 'تعامل تازه'}</span>
          <button className="text-btn" onClick={onClose}>بستن</button>
        </div>

        <div className="pe-scroll">
          <div className="radios" role="radiogroup" aria-label="نوع تعامل">
            {TYPES.map(([k, n]) => (
              <button key={k} role="radio" aria-checked={v.type === k} className={v.type === k ? 'on' : ''} aria-pressed={v.type === k} onClick={() => set({ type: k })}>{n}</button>
            ))}
          </div>

          <button className="rf-date" onClick={() => setPicking('when')}>
            <Icon name="calendar" size={18} stroke={1.9} />
            {label(v.occurredAt, 'persian', 0, { weekday: 'long' })} · {fullDate(v.occurredAt, 'persian')}
          </button>

          <label className="bf-name bf-name-top">
            <span>چه شد</span>
            <textarea className="rf-text" value={v.summary} onChange={(e) => set({ summary: e.target.value })} placeholder="مثلاً دربارهٔ بازسازی خانه حرف زدیم" />
          </label>
          <label className="bf-name bf-name-top">
            <span>نتیجه (اختیاری)</span>
            <textarea className="rf-text" value={v.outcome} onChange={(e) => set({ outcome: e.target.value })} placeholder="مثلاً قرار شد نمونه‌کار بفرستد" />
          </label>

          <div className="rf-row">
            <span className="tile purple" aria-hidden="true"><Icon name="bell" size={17} stroke={1.9} /></span>
            <span className="rf-name">پیگیری</span>
            <span className="rf-value">
              {v.followUpDate ? label(v.followUpDate, 'persian', 0, { day: 'numeric', month: 'long' }) : 'ندارد'}
              <Icon name="chevronLeft" size={16} stroke={2} />
            </span>
            <button className="icon-btn small" aria-label="انتخاب تاریخ پیگیری" onClick={() => setPicking('follow')}><Icon name="calendar" size={16} stroke={2} /></button>
            {v.followUpDate && <button className="icon-btn small" aria-label="حذف پیگیری" onClick={() => set({ followUpDate: '' })}><Icon name="close" size={16} stroke={2} /></button>}
          </div>
          {v.followUpDate && <p className="rf-note"><Icon name="info" size={13} stroke={2} />پیگیری در «امروز» فهرست می‌شود (T3).</p>}
          {future && <p className="rf-note"><Icon name="info" size={13} stroke={2} />این تاریخ در آینده است؛ به‌عنوان قرار ثبت می‌شود.</p>}
          {!valid && v.summary.trim() === '' && <p className="hint pe-hint">یک خط بنویس که چه شد؛ همین برای یادآوری کافی است.</p>}
        </div>

        <button className="primary" disabled={!valid || busy} onClick={save}>
          <Icon name="check" size={18} stroke={2.4} />
          {busy ? 'در حال ذخیره…' : initial ? 'ذخیره' : 'ثبت تعامل'}
        </button>
        {initial && (
          <button className="danger-btn" disabled={busy} onClick={remove}>
            <Icon name="trash" size={16} stroke={2} />
            حذف این تعامل
          </button>
        )}
      </section>
      {picking && (
        <DatePicker
          value={picking === 'when' ? v.occurredAt : v.followUpDate || todayIso()}
          onPick={(d) => { set(picking === 'when' ? { occurredAt: d } : { followUpDate: d }); setPicking(null); }}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  );
}
