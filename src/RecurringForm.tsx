import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, put, uid, type Task } from './db';
import { fa, label, parts, today } from './cal';
import { LEADS, faDigits, isTime, leadLabel } from './format';
import { ask } from './confirm';
import { Icon } from './Icon';
import { Choice } from './Choice';
import { DatePicker } from './DatePicker';
import { removeTask } from './Lists';
import { askNotifications, isNative } from './native';
import { getSettings, updateSettings } from './settings';

const BEFORE = [[1, '۱ روز قبل'], [2, '۲ روز قبل'], [3, '۳ روز قبل'], [7, 'یک هفته قبل']] as const;

/** Loads the task once; the form reads it only at mount, so a live update cannot overwrite typing. */
export function RecurringForm({ id, onClose }: { id: string | null; onClose: () => void }) {
  const loaded = useLiveQuery(async () => (id ? ((await db.tasks.get(id)) ?? null) : null), [id]); // undefined = loading
  if (loaded === undefined) return null;
  return <Form initial={loaded} onClose={onClose} />;
}

function Form({ initial, onClose }: { initial: Task | null; onClose: () => void }) {
  const [v, setV] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    time: isTime(initial?.time) ? initial.time : '',
    lead: initial ? (initial.remindLead ?? -1) : 10, // -1 = no reminder; a new task reminds 10 minutes ahead once it has a time
    active: initial?.active !== false,
    date: initial?.on ?? today(),
    before: initial?.before ?? ([] as number[]),
  });
  const [picking, setPicking] = useState(false);
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));
  const valid = v.title.trim() !== '' && v.date !== '';
  const changed = JSON.stringify(v) !== JSON.stringify({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    time: isTime(initial?.time) ? initial.time : '',
    lead: initial ? (initial.remindLead ?? -1) : 10,
    active: initial?.active !== false,
    date: initial?.on ?? today(),
    before: initial?.before ?? [],
  });

  const save = async () => {
    if (!valid) return;
    await put('tasks', {
      ...initial,
      id: initial?.id ?? uid(),
      title: v.title.trim(),
      description: v.description.trim() || undefined,
      mask: 0,
      on: v.date,
      before: v.before.length ? [...v.before].sort((a, b) => a - b) : undefined,
      start: v.date,
      time: v.time || undefined,
      remindLead: v.time && v.lead >= 0 ? v.lead : undefined, // a reminder needs a time to hang on
      active: v.active,
      updatedAt: Date.now(),
    });
    // a task that asks for a reminder is useless without notifications: ask for permission and switch reminders on
    if (isNative && v.time && v.lead >= 0 && !getSettings().remind && (await askNotifications())) updateSettings({ remind: true });
    onClose();
  };
  const cancel = async () => {
    if (changed && !(await ask({ title: 'تغییرات دور ریخته شود؟', message: 'آنچه در این صفحه عوض کرده‌اید ذخیره نمی‌شود.', confirm: 'دور بریز', cancel: 'ادامه', icon: 'undo' }))) return;
    onClose();
  };

  return (
    <>
      <header className="ne-head">
        <button className="text-btn big" onClick={cancel}>انصراف</button>
        <span>{initial ? 'ویرایش کار' : 'کار جدید'}</span>
        <button className="text-btn big strong" disabled={!valid} onClick={save}>{initial ? 'ذخیره' : 'ایجاد'}</button>
      </header>

      <div className="glass rf-card">
        <label>
          <span className="field-label">عنوان کار</span>
          <input className="rf-input" value={v.title} autoFocus={!initial} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label>
          <span className="field-label">توضیحات</span>
          <textarea className="rf-text" value={v.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
      </div>

      <div className="glass rf-card">
        <div className="rf-line"><b>تاریخ</b></div>
        <button className="rf-date" onClick={() => setPicking(true)}><Icon name="calendar" size={18} stroke={1.9} />{label(v.date, 'persian', 0, { weekday: 'long' })} {label(v.date, 'persian', 0, { day: 'numeric', month: 'long' })} {fa(parts(v.date, 'persian', 0).y)}</button>
        <div className="rf-line"><b>اعلان پیش از آن</b><span>{v.before.length ? `${fa(v.before.length)} اعلان` : 'بدون اعلان'}</span></div>
        <div className="presets">
          {BEFORE.map(([d, text]) => (
            <button key={d} className={`chip${v.before.includes(d) ? ' sel-chip' : ''}`} aria-pressed={v.before.includes(d)} onClick={() => setV((x) => ({ ...x, before: x.before.includes(d) ? x.before.filter((y) => y !== d) : [...x.before, d] }))}>{text}</button>
          ))}
        </div>
        <p className="rf-note"><Icon name="info" size={13} stroke={2} />اعلان‌های روزهای قبل ساعت {faDigits(v.time || '09:00')} می‌آید. ساعت را از «زمان یادآوری» پایین عوض کن.</p>
      </div>

      <div className="glass rf-list">
        <div className="rf-row">
          <span className="tile blue"><Icon name="bell" size={17} stroke={1.9} /></span>
          <span className="rf-name">زمان یادآوری</span>
          <span className="time-btn" aria-hidden={false}>
            {v.time ? faDigits(v.time) : 'تعیین نشده'}
            <input type="time" aria-label="زمان یادآوری" value={v.time} onChange={(e) => set({ time: e.target.value })} />
          </span>
          {v.time && <button className="icon-btn small" aria-label="حذف زمان" onClick={() => set({ time: '' })}><Icon name="close" size={16} stroke={2} /></button>}
        </div>
        <div className={`rf-row${v.time ? '' : ' off'}`}>
          <span className="tile purple"><Icon name="clock" size={17} stroke={1.9} /></span>
          <span className="rf-name">یادآوری پیش از موعد</span>
          <span className="rf-value">
            {v.lead < 0 ? 'بدون یادآوری' : leadLabel(v.lead)}
            <Icon name="chevronLeft" size={16} stroke={2} />
            <Choice className="pick-hit" label="یادآوری پیش از موعد" disabled={!v.time} value={v.lead} options={[[-1, 'بدون یادآوری'], ...LEADS.map((m): [number, string] => [m, leadLabel(m)])]} onChange={(m) => set({ lead: m })} />
          </span>
        </div>
        <div className="rf-row">
          <span className="tile green"><Icon name="repeat" size={17} stroke={1.9} /></span>
          <span className="rf-name">فعال</span>
          <button className="switch" role="switch" aria-checked={v.active} aria-label="فعال بودن کار" onClick={() => set({ active: !v.active })}><i /></button>
        </div>
      </div>

      {initial && <button className="danger-btn rf-del" onClick={async () => { if (await removeTask(initial.id)) onClose(); }}><Icon name="trash" size={17} stroke={2} />حذف این کار</button>}

      <div className="rf-foot">
        <button className="primary big-btn" disabled={!valid} onClick={save}><Icon name="check" size={19} stroke={2.4} />{initial ? 'ذخیره تغییرات' : 'ایجاد کار'}</button>
      </div>
      {picking && <DatePicker value={v.date} onPick={(d) => { set({ date: d }); setPicking(false); }} onClose={() => setPicking(false)} />}
    </>
  );
}
