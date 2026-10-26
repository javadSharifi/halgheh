import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, del, put } from './db';
import { CAL_NAMES, bdayOn, fa, fullDate, label, parts, taskOn, today } from './cal';
import { byTime, clock, kindText, faDigits, isTime, leadText } from './format';
import { EventList } from './EventList';
import { eventsOn } from './events';
import { Icon } from './Icon';
import { shareText } from './native';
import { type Note, sortNotes } from './notes';
import { useSettings } from './settings';

/** A note as a card; tapping it opens the editor. */
function NotePreview({ note, onOpen }: { note: Note; onOpen: () => void }) {
  return (
    <button className="note-card preview" onClick={onOpen}>
      <b>{note.pinned && <Icon name="pin" size={13} stroke={2} />}{note.title || 'بدون عنوان'}{note.remindAt && <small className="remind-tag"><Icon name="bell" size={12} stroke={2} />{clock(note.remindAt)}</small>}</b>
      {note.text.trim() && <span>{note.text.replace(/\s+/g, ' ').trim()}</span>}
      {note.tags.length > 0 && <i className="mini-tags">{note.tags.map((t) => <em key={t}>{t}</em>)}</i>}
    </button>
  );
}

type Props = { date: string; setDate: (d: string) => void; onBack: () => void; onAddTask: () => void; openNote: (id: string | null) => void };

export function DayPage({ date, setDate, onBack, onAddTask, openNote }: Props) {
  const { cal, aux, hijriOffset: off } = useSettings();
  const [menu, setMenu] = useState(false);
  const isToday = date === today();

  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const bdays = useLiveQuery(() => db.birthdays.toArray(), []) ?? [];
  const doneRows = useLiveQuery(() => db.done.where('date').equals(date).toArray(), [date]) ?? [];
  const notes = useLiveQuery(() => db.notes.where('date').equals(date).toArray(), [date]);
  const doneAt = new Map(doneRows.map((d) => [d.taskId, d.doneAt]));

  const list = tasks.filter((t) => taskOn(t, date));
  const open = list.filter((t) => !doneAt.has(t.id)).sort(byTime);
  const done = list.filter((t) => doneAt.has(t.id)).sort((a, b) => (doneAt.get(a.id) ?? Infinity) - (doneAt.get(b.id) ?? Infinity));
  const pct = list.length ? Math.round((done.length / list.length) * 100) : 0;
  const todays = bdays.filter((b) => bdayOn(b, date, off));
  const lastSaved = notes?.length ? Math.max(...notes.map((n) => n.updatedAt)) : 0;

  const toggle = (id: string) =>
    doneAt.has(id) ? del('done', `${id}|${date}`) : put('done', { id: `${id}|${date}`, taskId: id, date, updatedAt: Date.now(), doneAt: Date.now() });
  const addNote = () => {
    setMenu(false);
    openNote(null);
  };

  const row = (t: (typeof list)[number], isDone: boolean) => (
    <div key={t.id} className={`task-row${isDone ? ' done' : ''}`}>
      <button className="tick" aria-pressed={isDone} aria-label={isDone ? `${t.title}، انجام شد` : t.title} onClick={() => toggle(t.id)}>
        <span className="circle">{isDone && <Icon name="check" size={13} stroke={3} />}</span>
      </button>
      <div>
        <span className="t-title">{t.title}</span>
        {isDone ? (
          <span className="t-sub">{doneAt.get(t.id) ? `انجام شد ساعت ${clock(doneAt.get(t.id)!)}` : 'انجام شد'}</span>
        ) : t.remindLead !== undefined && isTime(t.time) ? (
          <span className="t-sub">{leadText(t.remindLead)}</span>
        ) : (
          <span className="t-sub"><Icon name="repeat" size={12} stroke={2} />{t.on ? 'کار یک‌باره' : `کار تکراری · ${kindText(t)}`}</span>
        )}
      </div>
      {!isDone && isTime(t.time) && <span className="time-pill">{faDigits(t.time)}</span>}
    </div>
  );

  return (
    <>
      <header className="dd-head">
        <button className="icon-btn" aria-label="بازگشت به تقویم" onClick={onBack}><Icon name="chevronRight" /></button>
        <span>جزئیات روز</span>
        <button className="icon-btn" aria-label="گزینه‌های بیشتر" aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name="moreHorizontal" stroke={2.2} /></button>
      </header>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      {menu && (
        <div className="glass dd-menu" role="menu">
          <button role="menuitem" onClick={addNote}><Icon name="note" size={18} />یادداشت جدید</button>
          {!isToday && <button role="menuitem" onClick={() => { setDate(today()); setMenu(false); }}><Icon name="target" size={18} />رفتن به امروز</button>}
        </div>
      )}

      <section className="glass dd-card" aria-label="تاریخ">
        <div className="dd-title">
          <div>
            <b>{fullDate(date, cal, off)}</b>
            <span>{label(date, cal, off, { weekday: 'long' })}</span>
          </div>
          {isToday && <em>امروز</em>}
        </div>
        <div className="dd-chips">
          {aux.map((c) => (
            <span key={c} className="dd-chip"><em className={`tag ${c}`}>{CAL_NAMES[c]}</em>{fullDate(date, c, off)}</span>
          ))}
        </div>
        {list.length > 0 && (
          <div className="dd-progress">
            <div><span>{isToday ? 'پیشرفت امروز' : 'پیشرفت این روز'}</span><b>{fa(done.length)} از {fa(list.length)}</b></div>
            <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="پیشرفت"><i style={{ width: `${pct}%` }} /></div>
          </div>
        )}
      </section>

      {eventsOn(date) && (
        <section className="glass events-card" aria-label="مناسبت‌ها">
          <div className="mc-head"><span><Icon name="calendarDays" size={14} stroke={1.9} />مناسبت‌ها</span></div>
          <EventList ev={eventsOn(date)} />
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>کارها</h2>
          <button className="text-btn" onClick={onAddTask}><Icon name="plus" size={15} stroke={2.2} />افزودن</button>
        </div>
        <div className="glass task-list">
          {list.length === 0 && <p className="hint empty">کاری برای این روز نیست.</p>}
          {open.length > 0 && <span className="group-label">باقی‌مانده · {fa(open.length)}</span>}
          {open.map((t) => row(t, false))}
          {open.length > 0 && done.length > 0 && <hr className="group-sep" />}
          {done.length > 0 && <span className="group-label">انجام شده · {fa(done.length)}</span>}
          {done.map((t) => row(t, true))}
        </div>
      </section>

      {todays.map((b) => (
        <section key={b.id} className="glass bday-card" aria-label="تولد">
          <span className="avatar big" aria-hidden="true">{b.name.slice(0, 1)}</span>
          <div>
            <b>تولد {b.name}{b.year ? ` · ${fa(parts(date, b.cal, off).y - b.year)} سالگی` : ''}</b>
            <span>ثبت‌شده با تاریخ {CAL_NAMES[b.cal]} · {label(date, b.cal, off, { day: 'numeric', month: 'long' })}</span>
          </div>
          <button className="icon-btn" aria-label="ارسال تبریک" onClick={() => shareText(`تولدت مبارک ${b.name} 🎂`)}><Icon name="gift" size={19} stroke={1.9} /></button>
        </section>
      ))}

      <section>
        <div className="section-head">
          <h2>یادداشت روز</h2>
          {lastSaved > 0 && <span className="saved-status"><Icon name="check" size={12} stroke={2.4} />ذخیره شد · {clock(lastSaved)}</span>}
        </div>
        {notes && sortNotes(notes).map((n) => <NotePreview key={n.id} note={n} onOpen={() => openNote(n.id)} />)}
        {notes?.length === 0 && <p className="hint" style={{ margin: '0 6px 8px' }}>یادداشتی برای این روز نیست.</p>}
        <button className="text-btn" onClick={addNote}><Icon name="plus" size={15} stroke={2.2} />یادداشت جدید</button>
      </section>
    </>
  );
}
