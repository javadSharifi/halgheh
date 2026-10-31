import { useState, type FormEvent } from 'react';
import { type Person, type Task, db, put, uid } from './db';
import { fa, label, parts, today } from './cal';
import { LEADS, faDigits, isTime, leadLabel, personLabel } from './format';
import { Choice } from './Choice';
import { DatePicker } from './DatePicker';
import { Icon } from './Icon';
import { InputField } from './ui';
import { askNotifications, isNative } from './native';
import { getSettings, updateSettings } from './settings';
import { removeTask } from './Todos';
import { locale, tx } from './i18n';

/**
 * Redesigned Task Bottom Sheet Modal:
 * Elegant iOS/Apple style bottom sheet with unified InputField,
 * segmented deadline control, touch-friendly assignee selector, and primary action bar.
 */
export function TodoForm({ initial, seedPersonId, onClose }: { initial: Task | null; seedPersonId?: string; onClose: () => void }) {
  const [v, setV] = useState(() => ({
    title: initial?.title ?? '',
    note: initial?.description ?? '',
    dated: !!initial?.on || !initial, // a new todo starts with today's date; user can toggle off
    date: initial?.on ?? today(),
    time: isTime(initial?.time) ? initial.time : '',
    lead: initial ? (initial.remindLead ?? -1) : 10,
    before: initial?.before ?? ([] as number[]),
    fromPersonId: initial?.fromPersonId ?? seedPersonId ?? '',
  }));

  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));

  const valid = v.title.trim() !== '';

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr('');
    try {
      const now = Date.now();
      const row: Task = {
        ...initial,
        id: initial?.id ?? uid(),
        title: v.title.replace(/\s+/g, ' ').trim(),
        description: v.note.trim() || undefined,
        mask: 0,
        on: v.dated ? v.date : undefined,
        start: v.dated ? v.date : today(),
        before: v.dated && v.before.length ? [...v.before].sort((a, b) => a - b) : undefined,
        time: v.dated && v.time ? v.time : undefined,
        remindLead: v.dated && v.time && v.lead >= 0 ? v.lead : undefined,
        fromPersonId: v.fromPersonId || undefined,
        active: initial?.active !== false,
        updatedAt: now,
      };

      if (!row.on) {
        delete row.before;
        delete row.time;
        delete row.remindLead;
      }

      await put('tasks', row);
      if (isNative && row.remindLead !== undefined && !getSettings().remind && (await askNotifications())) {
        updateSettings({ remind: true });
      }
      onClose();
    } catch {
      setErr(tx('ذخیره نشد؛ لطفاً دوباره تلاش کنید.'));
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="task-sheet-modal" role="dialog" aria-modal="true" aria-labelledby="todo-sheet-title">
        {/* Top Handle Puller & Header */}
        <div className="task-sheet-header">
          <div aria-hidden="true" className="sheet-pull-handle" />
          <div className="sheet-header-row">
            <div className="sheet-title-group">
              <div className="sheet-icon-box">
                <Icon name={initial ? 'edit' : 'plus'} size={20} stroke={2.4} />
              </div>
              <div className="sheet-titles-text">
                <h2 id="todo-sheet-title">{initial ? tx('ویرایش کار') : tx('کار تازه')}</h2>
                <span>{initial ? tx('ویرایش جزئیات و زمان‌بندی کار') : tx('افزودن فعالیت و وظیفه به روز جاری')}</span>
              </div>
            </div>

            <button
              type="button"
              className="sheet-close-btn"
              onClick={onClose}
              aria-label={tx('بستن فرم')}
            >
              <span>{tx('بستن')}</span>
              <Icon name="close" size={13} stroke={2.5} />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form
          className="task-sheet-body"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void save();
          }}
        >
          {/* Input: Task Title with unified InputField */}
          <InputField
            label={tx('عنوان کار')}
            required
            hint={tx('واضح و مشخص بنویسید')}
            icon="edit"
            autoFocus
            value={v.title}
            maxLength={200}
            placeholder={tx('مثلاً: هماهنگی و زنگ زدن به رضا...')}
            onChange={(e) => set({ title: e.target.value })}
            error={err && !valid ? tx('عنوان کار نمی‌تواند خالی باشد') : undefined}
          />

          {/* Segmented Control: Deadline Toggle */}
          <div className="input-field-group">
            <div className="input-label-row">
              <span className="input-label-text">{tx('موعد انجام')}</span>
            </div>
            <div className="modal-segmented" role="radiogroup" aria-label={tx('موعد انجام')}>
              <button
                type="button"
                role="radio"
                aria-checked={!v.dated}
                className={`modal-seg-btn${!v.dated ? ' on' : ''}`}
                onClick={() => set({ dated: false })}
              >
                <Icon name="close" size={15} stroke={2.2} />
                <span>{tx('بدون موعد')}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={v.dated}
                className={`modal-seg-btn${v.dated ? ' on' : ''}`}
                onClick={() => set({ dated: true })}
              >
                <Icon name="calendar" size={15} stroke={2.2} />
                <span>{tx('با موعد زمانی')}</span>
              </button>
            </div>
          </div>

          {/* When Dated: Date Picker, Time & Reminder Rows */}
          {v.dated && (
            <div className="task-deadline-details">
              {/* Date Button */}
              <button
                type="button"
                className="deadline-row-btn"
                onClick={() => setPicking(true)}
              >
                <div className="drb-left">
                  <div className="drb-icon tile purple">
                    <Icon name="calendar" size={16} stroke={2} />
                  </div>
                  <span>
                    {label(v.date, 'persian', 0, { weekday: 'long' })}{' '}
                    {label(v.date, 'persian', 0, { day: 'numeric', month: 'long' })}{' '}
                    {fa(parts(v.date, 'persian', 0).y)}
                  </span>
                </div>
                <Icon name="chevronLeft" size={16} stroke={2} />
              </button>

              {/* Time Row */}
              <div className="deadline-row-btn" style={{ cursor: 'default' }}>
                <div className="drb-left">
                  <div className="drb-icon tile blue">
                    <Icon name="clock" size={16} stroke={2} />
                  </div>
                  <span>{tx('ساعت مشخص')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="time-btn" style={{ height: 34, fontSize: 13, borderRadius: 10 }}>
                    {v.time ? faDigits(v.time) : tx('تعیین نشده')}
                    <input
                      type="time"
                      aria-label={tx('ساعت')}
                      value={v.time}
                      onChange={(e) => set({ time: e.target.value })}
                    />
                  </span>
                  {v.time && (
                    <button
                      type="button"
                      className="icon-btn small"
                      aria-label={tx('حذف ساعت')}
                      onClick={() => set({ time: '' })}
                    >
                      <Icon name="close" size={14} stroke={2} />
                    </button>
                  )}
                </div>
              </div>

              {/* Reminder Lead (when time is set) */}
              {v.time && (
                <div className="deadline-row-btn" style={{ position: 'relative' }}>
                  <div className="drb-left">
                    <div className="drb-icon tile green">
                      <Icon name="bell" size={16} stroke={2} />
                    </div>
                    <span>{tx('یادآوری قبل از موعد')}</span>
                  </div>
                  <span className="rf-value" style={{ fontSize: 13 }}>
                    {v.lead < 0 ? tx('بدون یادآوری') : leadLabel(v.lead)}
                    <Icon name="chevronLeft" size={15} stroke={2} />
                    <Choice
                      className="pick-hit"
                      label={tx('یادآوری')}
                      value={v.lead}
                      options={[[-1, tx('بدون یادآوری')], ...LEADS.map((m): [number, string] => [m, leadLabel(m)])]}
                      onChange={(m) => set({ lead: m })}
                    />
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Assignee / Responsible Person Selector Card */}
          <div className="input-field-group">
            <div className="input-label-row">
              <span className="input-label-text">{tx('ارجاع دهنده / مسئول')}</span>
            </div>
            <WhoAskedCard value={v.fromPersonId} onChange={(id) => set({ fromPersonId: id })} />
          </div>

          {/* Input: Note (Textarea) with unified InputField */}
          <InputField
            multiline
            rows={3}
            label={tx('یادداشت و جزئیات')}
            hint={tx('اختیاری')}
            value={v.note}
            maxLength={1000}
            placeholder={tx('توضیحات تکمیلی، شماره تماس، لینک یا نکات مهم را اینجا بنویسید...')}
            onChange={(e) => set({ note: e.target.value })}
          />

          {err && <p className="form-error" role="alert">{err}</p>}
        </form>

        {/* Fixed Bottom Action Bar */}
        <div className="task-sheet-footer">
          <button
            type="button"
            className="sheet-big-submit-btn"
            disabled={!valid || busy}
            onClick={() => void save()}
          >
            <Icon name="check" size={19} stroke={2.5} />
            <span>{busy ? tx('در حال ذخیره…') : initial ? tx('ذخیره تغییرات') : tx('ثبت کار')}</span>
          </button>

          {initial && (
            <button
              type="button"
              className="sheet-delete-action-btn"
              onClick={async () => {
                if (await removeTask(initial.id)) onClose();
              }}
            >
              <Icon name="trash" size={15} stroke={2} />
              <span>{tx('حذف این کار')}</span>
            </button>
          )}
        </div>
      </section>

      {/* Date Picker Modal */}
      {picking && (
        <DatePicker
          value={v.date}
          onPick={(d) => {
            set({ date: d, dated: true });
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

/**
 * Touch-friendly "Who Asked" selector card matching user's design blueprint:
 * Shows avatar icon in emerald box, descriptive texts, and selection badge with chevron.
 */
function WhoAskedCard({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const rows = (await db.people.toArray()).filter((p) => !p.archivedAt && !p.isSelf);
    rows.sort((a, b) => a.displayName.localeCompare(b.displayName, locale()));
    setPeople(rows);
    setOpen(true);
  };

  const name = people?.find((p) => p.id === value)?.displayName;

  return (
    <>
      <button
        type="button"
        className="assignee-card-btn group"
        onClick={() => void load()}
        aria-label={tx('انتخاب چه کسی خواسته')}
      >
        <div className="acb-right">
          <div className="acb-icon-tile">
            <Icon name="users" size={20} stroke={2} />
          </div>
          <div className="acb-texts">
            <span className="acb-title">{tx('چه کسی خواسته؟')}</span>
            <span className="acb-sub">{tx('شخص یا تیم را مشخص کنید')}</span>
          </div>
        </div>

        <div className="acb-left">
          <span className={`acb-badge${value ? ' selected' : ''}`}>
            {name ?? (value ? '…' : tx('کسی مشخص نشده'))}
          </span>
          <Icon name="chevronLeft" size={15} stroke={2} />
        </div>
      </button>

      {open && people && (
        <>
          <div className="scrim dim" onClick={() => setOpen(false)} />
          <div className="glass sheet" role="dialog" aria-modal="true" aria-label={tx('چه کسی خواسته')}>
            <b className="sheet-title">{tx('چه کسی خواسته')}</b>
            <div className="pick-list" role="radiogroup" aria-label={tx('چه کسی خواسته')}>
              <button
                type="button"
                role="radio"
                aria-checked={value === ''}
                className={`pick-opt${value === '' ? ' on' : ''}`}
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >{tx('کسی مشخص نشده')}{value === '' && <Icon name="check" size={18} stroke={2.4} />}
              </button>
              {people.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  role="radio"
                  aria-checked={value === p.id}
                  className={`pick-opt${value === p.id ? ' on' : ''}`}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  {personLabel(p)}
                  {value === p.id && <Icon name="check" size={18} stroke={2.4} />}
                </button>
              ))}
              {people.length === 0 && <p className="hint">{tx('هنوز کسی در دفترچه نیست.')}</p>}
            </div>
            <div className="sheet-actions">
              <button type="button" onClick={() => setOpen(false)}>{tx('بستن')}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

