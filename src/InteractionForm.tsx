import { useState } from 'react';
import { type Interaction, del, put, uid } from './db';
import { ask } from './confirm';
import { fullDate, label, today } from './cal';
import { Icon } from './Icon';
import { Button, InputField } from './ui';
import { DatePicker } from './DatePicker';
import { Choice } from './Choice';
import { tx, tk } from './i18n';

const TYPES: [Interaction['type'], string][] = [
  ['meeting', tk('دیدار')],
  ['call', tk('تماس')],
  ['message', tk('پیام')],
  ['other', tk('دیگر')],
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
    if (!(await ask({ title: tx('این تعامل حذف شود؟'), message: tx('فقط همین یک ردیف از سابقه پاک می‌شود.'), confirm: tx('حذف') }))) return;
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
          <span id="interaction-title">{initial ? tx('ویرایش تعامل') : tx('تعامل تازه')}</span>
          <Button variant="ghost" size="sm" onClick={onClose}>{tx('بستن')}</Button>
        </div>

        <div className="pe-scroll">
          <div className="radios" role="radiogroup" aria-label={tx('نوع تعامل')}>
            {TYPES.map(([k, n]) => (
              <button key={k} role="radio" aria-checked={v.type === k} className={v.type === k ? 'on' : ''} aria-pressed={v.type === k} onClick={() => set({ type: k })}>{tx(n)}</button>
            ))}
          </div>

          <button className="rf-date" onClick={() => setPicking('when')}>
            <Icon name="calendar" size={18} stroke={1.9} />
            {label(v.occurredAt, 'persian', 0, { weekday: 'long' })} · {fullDate(v.occurredAt, 'persian')}
          </button>

          <InputField
            multiline
            rows={3}
            label={tx('چه شد')}
            value={v.summary}
            onChange={(e) => set({ summary: e.target.value })}
            placeholder={tx('مثلاً دربارهٔ بازسازی خانه حرف زدیم')}
          />
          <InputField
            multiline
            rows={3}
            label={tx('نتیجه (اختیاری)')}
            value={v.outcome}
            onChange={(e) => set({ outcome: e.target.value })}
            placeholder={tx('مثلاً قرار شد نمونه‌کار بفرستد')}
          />

          <div className="rf-row">
            <span className="tile purple" aria-hidden="true"><Icon name="bell" size={17} stroke={1.9} /></span>
            <span className="rf-name">{tx('پیگیری')}</span>
            <span className="rf-value">
              {v.followUpDate ? label(v.followUpDate, 'persian', 0, { day: 'numeric', month: 'long' }) : tx('ندارد')}
              <Icon name="chevronLeft" size={16} stroke={2} />
            </span>
            <Button variant="ghost" size="icon-sm" aria-label={tx('انتخاب تاریخ پیگیری')} onClick={() => setPicking('follow')} icon="calendar" />
            {v.followUpDate && <Button variant="ghost" size="icon-sm" aria-label={tx('حذف پیگیری')} onClick={() => set({ followUpDate: '' })} icon="close" />}
          </div>
          {v.followUpDate && <p className="rf-note"><Icon name="info" size={13} stroke={2} />{tx('پیگیری در «امروز» فهرست می‌شود (T3).')}</p>}
          {future && <p className="rf-note"><Icon name="info" size={13} stroke={2} />{tx('این تاریخ در آینده است؛ به‌عنوان قرار ثبت می‌شود.')}</p>}
          {!valid && v.summary.trim() === '' && <p className="hint pe-hint">{tx('یک خط بنویس که چه شد؛ همین برای یادآوری کافی است.')}</p>}
        </div>

        <Button variant="primary" block disabled={!valid || busy} onClick={save} icon="check">
          {busy ? tx('در حال ذخیره…') : initial ? tx('ذخیره') : tx('ثبت تعامل')}
        </Button>
        {initial && (
          <Button variant="danger" block disabled={busy} onClick={remove} icon="trash">
            {tx('حذف این تعامل')}
          </Button>
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
