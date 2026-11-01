import { useState } from 'react';
import { type Person, type Task, db, put, uid } from './db';
import { fa, label, parts, today, wdInitial } from './cal';
import { LEADS, MASK_ALL, MASK_SAT_TO_WED, MASK_WEEKEND, SAT_FIRST, daysText, faDigits, isTime, leadLabel, personLabel } from './format';
import { Choice } from './Choice';
import { DatePicker } from './DatePicker';
import { Icon } from './Icon';
import { FormField, FormPage, FormSection, InputField, Select } from './ui';
import { ShoppingSection } from './ShoppingSection';
import { TASK_KINDS, type TaskKind } from './taskKinds';
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
    // a new todo starts with today's date; the user can switch to repeating or to no date
    when: (initial ? (initial.on ? 'date' : initial.mask > 0 ? 'repeat' : 'none') : 'date') as 'none' | 'date' | 'repeat',
    mask: initial?.mask || MASK_ALL,
    date: initial?.on ?? today(),
    time: isTime(initial?.time) ? initial.time : '',
    lead: initial ? (initial.remindLead ?? -1) : 10,
    before: initial?.before ?? ([] as number[]),
    fromPersonId: initial?.fromPersonId ?? seedPersonId ?? '',
    kind: initial?.kind ?? ('' as TaskKind | ''),
  }));

  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));

  const valid = v.title.trim() !== '' && (v.when !== 'repeat' || v.mask > 0);
  const once = v.when === 'date';
  const repeat = v.when === 'repeat';

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr('');
    try {
      const now = Date.now();
      // the shopping section may have linked a comparison since this form opened, so build on the stored row, not the opened one
      const stored = initial ? await db.tasks.get(initial.id) : undefined;
      const row: Task = {
        ...(stored ?? initial),
        id: initial?.id ?? uid(),
        title: v.title.replace(/\s+/g, ' ').trim(),
        description: v.note.trim() || undefined,
        mask: repeat ? v.mask : 0,
        on: once ? v.date : undefined,
        start: once ? v.date : repeat ? (stored?.start ?? today()) : today(),
        before: once && v.before.length ? [...v.before].sort((a, b) => a - b) : undefined,
        time: v.when !== 'none' && v.time ? v.time : undefined,
        remindLead: v.when !== 'none' && v.time && v.lead >= 0 ? v.lead : undefined,
        fromPersonId: v.fromPersonId || undefined,
        kind: v.kind || undefined,
        active: initial?.active !== false,
        updatedAt: now,
      };

      if (!row.kind) delete row.kind;
      if (!once) delete row.before;
      if (!repeat) delete row.end;
      if (v.when === 'none') {
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
      <FormPage
        title={initial ? tx('ویرایش کار') : tx('کار تازه')}
        icon={initial ? 'edit' : 'plus'}
        onClose={onClose}
        onSave={() => void save()}
        saveLabel={initial ? tx('ذخیره') : tx('ثبت')}
        saveDisabled={!valid}
        busy={busy}
        error={err && valid ? err : undefined}
        onDelete={initial ? async () => { if (await removeTask(initial.id)) onClose(); } : undefined}
        deleteLabel={tx('حذف این کار')}
      >
        <FormSection>
        {/* Scrollable Form Body */}
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

          <Select
            label={tx('نوع کار')}
            value={v.kind}
            onChange={(e) => set({ kind: e.target.value as TaskKind | '' })}
            options={[{ value: '', label: tx('کار معمولی') }, ...TASK_KINDS.map((k) => ({ value: k.key, label: tx(k.name) }))]}
          />

          {/* Segmented Control: Deadline Toggle */}
          <FormField label={tx('موعد انجام')}>
            <div className="modal-segmented" role="radiogroup" aria-label={tx('موعد انجام')}>
              <button
                type="button"
                role="radio"
                aria-checked={v.when === 'none'}
                className={`modal-seg-btn${v.when === 'none' ? ' on' : ''}`}
                onClick={() => set({ when: 'none' })}
              >
                <Icon name="close" size={15} stroke={2.2} />
                <span>{tx('بدون موعد')}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={once}
                className={`modal-seg-btn${once ? ' on' : ''}`}
                onClick={() => set({ when: 'date' })}
              >
                <Icon name="calendar" size={15} stroke={2.2} />
                <span>{tx('با موعد زمانی')}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={repeat}
                className={`modal-seg-btn${repeat ? ' on' : ''}`}
                onClick={() => set({ when: 'repeat' })}
              >
                <Icon name="repeat" size={15} stroke={2.2} />
                <span>{tx('تکرارشونده')}</span>
              </button>
            </div>
          </FormField>

          {/* When Dated: Date Picker, Time & Reminder Rows */}
          {v.when !== 'none' && (
            <div className="task-deadline-details">
              {repeat && (
                <div className="repeat-box">
                  <div className="wd-row" role="group" aria-label={tx('روزهای تکرار')}>
                    {SAT_FIRST.map((d) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={((v.mask >> d) & 1) === 1}
                        className={((v.mask >> d) & 1) === 1 ? 'on' : ''}
                        onClick={() => set({ mask: v.mask ^ (1 << d) })}
                      >{wdInitial(d)}</button>
                    ))}
                  </div>
                  <div className="wd-presets">
                    {([[tx('هر روز'), MASK_ALL], [tx('شنبه تا چهارشنبه'), MASK_SAT_TO_WED], [tx('آخر هفته'), MASK_WEEKEND]] as [string, number][]).map(([name, m]) => (
                      <button key={m} type="button" className={`mini-btn${v.mask === m ? ' on' : ''}`} onClick={() => set({ mask: m })}>{name}</button>
                    ))}
                  </div>
                  <p className="hint">{v.mask > 0 ? tx('تکرار: {a1}', { a1: daysText(v.mask) }) : tx('دست‌کم یک روز را انتخاب کن.')}</p>
                </div>
              )}

              {/* Date Button */}
              {once && <button
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
              </button>}

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
          <FormField label={tx('ارجاع دهنده / مسئول')}>
            <WhoAskedCard value={v.fromPersonId} onChange={(id) => set({ fromPersonId: id })} />
          </FormField>

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

        </FormSection>

        {v.kind === 'shopping' && (initial
          ? <ShoppingSection task={initial} />
          : <p className="hint">{tx('بعد از ثبت کار، قوانین خرید و مقایسهٔ محصولات همین‌جا باز می‌شود.')}</p>)}
      </FormPage>

      {/* Date Picker Modal */}
      {picking && (
        <DatePicker
          value={v.date}
          onPick={(d) => {
            set({ date: d, when: 'date' });
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

