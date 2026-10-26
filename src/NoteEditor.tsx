import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, del, put, uid } from './db';
import { fa, fullDate, label, today } from './cal';
import { faDigits } from './format';
import { askNotifications, isNative } from './native';
import { DatePicker } from './DatePicker';
import { ask } from './confirm';
import { Icon } from './Icon';
import { type Note, addTag, continueChecklist, cycleChecklist, removeTag, tagOptions } from './notes';
import { useSettings } from './settings';

type Props = { id: string | null; date: string; onClose: () => void };

/** Loads the note once, then hands it to the form, which only reads it at mount so live updates can't overwrite typing. */
export function NoteEditor({ id, date, onClose }: Props) {
  const loaded = useLiveQuery(async () => (id ? ((await db.notes.get(id)) ?? null) : null), [id]); // undefined = loading
  if (loaded === undefined) return null;
  return <Form initial={loaded} date={date} onClose={onClose} />;
}

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function Form({ initial: loaded, date, onClose }: { initial: Note | null; date: string; onClose: () => void }) {
  const [initial] = useState(loaded); // the note as it was when the editor opened; later live updates (our own autosaves) must not replace it
  const { cal, aux, hijriOffset: off } = useSettings();
  const [v, setV] = useState({ title: initial?.title ?? '', text: initial?.text ?? '', date: initial?.date ?? date, tags: initial?.tags ?? [], pinned: initial?.pinned ?? false, remindAt: initial?.remindAt as number | undefined });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>(initial ? 'saved' : 'idle');
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [reminding, setReminding] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const sel = useRef<[number, number] | null>(null);
  const [draft, setDraft] = useState('');
  const allNotes = useLiveQuery(() => db.notes.toArray(), []) ?? [];
  const options = tagOptions(allNotes, v.tags);
  const id = useRef(initial?.id ?? uid());
  const stored = useRef(initial !== null); // does the note exist in the database right now
  const latest = useRef(v);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touched = useRef(false);

  const persist = async () => {
    const s = latest.current;
    if (!s.title.trim() && !s.text.trim()) {
      if (stored.current) await del('notes', id.current); // emptied: remove, as on the day page
      stored.current = false;
      return;
    }
    stored.current = true;
    await put('notes', { ...initial, id: id.current, date: s.date, title: s.title, text: s.text, tags: s.tags, pinned: s.pinned, remindAt: s.remindAt, updatedAt: Date.now() });
  };

  const change = (patch: Partial<typeof v>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setV(next);
    touched.current = true;
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => persist().then(() => setStatus('saved')), 400);
  };

  // leaving by any route must not lose the last keystrokes
  useEffect(() => () => {
    clearTimeout(timer.current);
    if (touched.current) void persist();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // after a programmatic text change, put the caret where the helper said
  useLayoutEffect(() => {
    if (sel.current && bodyRef.current) {
      bodyRef.current.setSelectionRange(...sel.current);
      sel.current = null;
    }
  }, [v.text]);

  const checklist = () => {
    const el = bodyRef.current;
    const r = cycleChecklist(latest.current.text, el?.selectionStart ?? latest.current.text.length, el?.selectionEnd ?? latest.current.text.length);
    sel.current = [r.start, r.end];
    change({ text: r.text });
    el?.focus();
  };
  const onBodyKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const r = continueChecklist(latest.current.text, e.currentTarget.selectionStart);
    if (!r) return;
    e.preventDefault();
    sel.current = [r.caret, r.caret];
    change({ text: r.text });
  };
  const tagButton = () => {
    setAdding(true);
    tagsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const toggleTag = (t: string) => change({ tags: latest.current.tags.includes(t) ? removeTag(latest.current.tags, t) : addTag(latest.current.tags, t) });
  const commitTag = () => {
    if (draft.trim()) change({ tags: addTag(latest.current.tags, draft) });
    setDraft('');
    setAdding(false);
  };

  const save = async () => {
    clearTimeout(timer.current);
    touched.current = false; // the explicit save below replaces the unmount flush
    await persist();
    onClose();
  };

  const cancel = async () => {
    const changed = latest.current.title !== (initial?.title ?? '') || latest.current.text !== (initial?.text ?? '') || latest.current.date !== (initial?.date ?? date) || JSON.stringify(latest.current.tags) !== JSON.stringify(initial?.tags ?? []) || latest.current.pinned !== (initial?.pinned ?? false) || latest.current.remindAt !== initial?.remindAt;
    if (changed && !(await ask({ title: 'تغییرات دور ریخته شود؟', message: 'یادداشت به حالت قبل از ویرایش برمی‌گردد.', confirm: 'دور بریز', cancel: 'ادامه', icon: 'undo' }))) return;
    clearTimeout(timer.current);
    touched.current = false;
    if (initial) await put('notes', { ...initial, updatedAt: Date.now() }); // newer than any autosaved copy, so the original wins everywhere
    else if (stored.current) await del('notes', id.current);
    onClose();
  };

  return (
    <>
      <header className="ne-head">
        <button className="text-btn big" onClick={cancel}>انصراف</button>
        <span>{initial ? 'ویرایش یادداشت' : 'یادداشت جدید'}</span>
        <button className="primary save-btn" onClick={save}>ذخیره</button>
      </header>

      <div className="ne-status">
        <span role="status" className="autosave">
          <Icon name="cloudCheck" size={14} stroke={2} />
          ذخیرهٔ خودکار · {status === 'saving' ? 'در حال ذخیره…' : status === 'saved' ? 'ذخیره شد' : 'آماده'}
        </span>
      </div>

      <button className="glass date-btn" aria-label="انتخاب تاریخ یادداشت" onClick={() => setPicking(true)}>
        <span className="date-icon"><Icon name="calendar" size={18} /></span>
        <span className="date-text">
          <b>{label(v.date, cal, off, { weekday: 'long' })} {fullDate(v.date, cal, off)}</b>
          <small>{aux.map((c) => fullDate(v.date, c, off)).join(' · ')}</small>
        </span>
        <Icon name="chevronDown" size={18} stroke={2} />
      </button>

      <div className="ne-card">
        <label>
          <span className="field-label">عنوان</span>
          <input className="ne-title" value={v.title} autoFocus={!initial} onChange={(e) => change({ title: e.target.value })} />
        </label>
        <hr />
        <label>
          <span className="field-label">متن یادداشت</span>
          <textarea ref={bodyRef} className="ne-body" value={v.text} onChange={(e) => change({ text: e.target.value })} onKeyDown={onBodyKey} />
        </label>
      </div>

      <div className="tag-box" role="group" aria-label="برچسب‌ها" ref={tagsRef}>
        <span className="field-label">برچسب‌ها</span>
        <div className="tag-chips">
          {options.map((t) => {
            const on = v.tags.includes(t);
            return <button key={t} className={`tag-chip${on ? ` on c${v.tags.indexOf(t) % 3}` : ''}`} aria-pressed={on} onClick={() => toggleTag(t)}>{t}</button>;
          })}
          {adding ? (
            <input
              className="tag-input"
              autoFocus
              value={draft}
              maxLength={30}
              placeholder="نام برچسب"
              aria-label="نام برچسب جدید"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTag(); } if (e.key === 'Escape') { setDraft(''); setAdding(false); } }}
              onBlur={commitTag}
            />
          ) : (
            <button className="tag-add" onClick={() => setAdding(true)}><Icon name="plus" size={14} stroke={2.2} />برچسب جدید</button>
          )}
        </div>
      </div>

      <div className="note-toolbar" role="toolbar" aria-label="ابزارهای یادداشت">
        <button aria-label="چک‌لیست" onClick={checklist}><Icon name="listChecks" size={21} stroke={1.8} /></button>
        <button aria-label="افزودن یادآور" className={v.remindAt ? 'active' : ''} aria-pressed={!!v.remindAt} onClick={() => setReminding(true)}><Icon name="bell" size={21} stroke={1.8} /></button>
        <button aria-label="سنجاق کردن" className={v.pinned ? 'active' : ''} aria-pressed={v.pinned} onClick={() => change({ pinned: !v.pinned })}><Icon name="pin" size={21} stroke={1.8} /></button>
        <button aria-label="برچسب" onClick={tagButton}><Icon name="tag" size={21} stroke={1.8} /></button>
        <span className="word-count">{fa(words(v.title) + words(v.text))} کلمه</span>
      </div>

      {reminding && <ReminderSheet date={v.date} value={v.remindAt} onSave={(ms) => { change({ remindAt: ms }); setReminding(false); }} onClose={() => setReminding(false)} />}

      {picking && <DatePicker value={v.date} onPick={(d) => { change({ date: d }); setPicking(false); }} onClose={() => setPicking(false)} />}
    </>
  );
}


/** Pick the time of day to be reminded about the note, on the note's own date. */
function ReminderSheet({ date, value, onSave, onClose }: { date: string; value: number | undefined; onSave: (ms: number | undefined) => void; onClose: () => void }) {
  const { cal, hijriOffset: off } = useSettings();
  const pad = (n: number) => String(n).padStart(2, '0');
  const initial = value ? `${pad(new Date(value).getHours())}:${pad(new Date(value).getMinutes())}` : date === today() ? `${pad(Math.min(new Date().getHours() + 1, 23))}:00` : '09:00';
  const [time, setTime] = useState(initial);
  const [err, setErr] = useState('');
  const at = new Date(`${date}T${time}:00`).getTime();

  const save = async () => {
    if (!Number.isFinite(at) || at <= Date.now()) return setErr('این زمان گذشته است. تاریخ یا ساعت را عوض کنید.');
    if (isNative && !(await askNotifications())) return setErr('اجازه نمایش اعلان داده نشد. از تنظیمات اندروید فعالش کنید.');
    onSave(at);
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <div className="glass sheet" role="dialog" aria-label="یادآور یادداشت">
        <b className="sheet-title">یادآور یادداشت</b>
        <div className="set-row">
          <span className="tile blue" aria-hidden="true"><Icon name="calendar" size={17} stroke={1.9} /></span>
          <span className="set-name">{label(date, cal, off, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
        <div className="set-row">
          <span className="tile purple" aria-hidden="true"><Icon name="clock" size={17} stroke={1.9} /></span>
          <span className="set-name">ساعت</span>
          <span className="time-btn">{faDigits(time)}<input type="time" aria-label="ساعت یادآور" value={time} onChange={(e) => { setTime(e.target.value); setErr(''); }} /></span>
        </div>
        {!isNative && <p className="hint">اعلان فقط در برنامه‌ی اندروید نمایش داده می‌شود.</p>}
        {err && <p className="form-error" role="alert">{err}</p>}
        <div className="sheet-actions">
          {value && <button onClick={() => onSave(undefined)}>حذف یادآور</button>}
          <button onClick={onClose}>انصراف</button>
          <button className="primary" onClick={save}>تأیید</button>
        </div>
      </div>
    </>
  );
}
