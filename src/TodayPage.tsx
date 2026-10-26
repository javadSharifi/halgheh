import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Task, db, del, put } from './db';
import { CAL_NAMES, addDays, bdayOn, fa, fullDate, label, parts, taskOn, today, wd } from './cal';
import { EventList } from './EventList';
import { eventsOn } from './events';
import { byTime, kindText, faDigits, greeting, isTime, nextBirthday } from './format';
import { Icon } from './Icon';
import { useOnline } from './online';
import { sortNotes } from './notes';
import { useSettings } from './settings';
import { getCfg } from './sync';

const WEEKDAYS = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']; // by JS weekday, 0 = Sunday

/** Connection chip: only meaningful when sync is on, otherwise the app is simply local and says nothing. */
function StatusChip() {
  const online = useOnline();
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  if (!getCfg()) return null;
  if (!online) return <span className="status"><Icon name="wifiOff" size={14} stroke={2} />آفلاین</span>;
  return pending ? <span className="status"><Icon name="refresh" size={14} stroke={2} />در حال همگام‌سازی</span> : <span className="status"><Icon name="cloudCheck" size={14} stroke={2} />همگام شد</span>;
}

export function TodayPage({ openDay, openNote, openSearch }: { openDay: (date: string) => void; openNote: (id: string | null, date: string) => void; openSearch: () => void }) {
  const { name, cal, aux, weekStart, hijriOffset: off } = useSettings();
  const t = today();
  const [d, setD] = useState(t);
  const isToday = d === t;
  const ev = eventsOn(d);

  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const bdays = useLiveQuery(() => db.birthdays.toArray(), []) ?? [];
  const doneIds = new Set((useLiveQuery(() => db.done.where('date').equals(d).toArray(), [d]) ?? []).map((x) => x.taskId));
  const notes = sortNotes(useLiveQuery(() => db.notes.where('date').equals(d).toArray(), [d]) ?? []);
  const note = notes[0];

  const weekFrom = addDays(d, -((wd(d) - weekStart + 7) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i));
  const weekNotes = new Set((useLiveQuery(() => db.notes.where('date').between(week[0], week[6], true, true).toArray(), [week[0]]) ?? []).map((n) => n.date));

  const list = tasks.filter((x) => taskOn(x, d)).sort((a, b) => Number(doneIds.has(a.id)) - Number(doneIds.has(b.id)) || byTime(a, b));
  const doneCount = list.filter((x) => doneIds.has(x.id)).length;
  const todays = bdays.filter((b) => bdayOn(b, d, off));
  const next = nextBirthday(bdays, d, off);
  const toggle = (x: Task) =>
    doneIds.has(x.id) ? del('done', `${x.id}|${d}`) : put('done', { id: `${x.id}|${d}`, taskId: x.id, date: d, updatedAt: Date.now(), doneAt: Date.now() });

    const hour = new Date().getHours();

  return (
    <>
      <header className="today-head">
        <div>
          <span>{greeting(hour)}{name ? `، ${name}` : ''}</span>
          <b>روزنگار</b>
        </div>
        <div className="head-tools">
          <StatusChip />
          <button className="icon-btn" aria-label="جستجو" onClick={openSearch}><Icon name="search" size={20} stroke={1.8} /></button>
        </div>
      </header>

      <section className="glass date-card" aria-label={isToday ? 'تاریخ امروز' : 'تاریخ'}>
        <div className="dc-top">
          <div>
            <span className="dc-weekday">{label(d, cal, off, { weekday: 'long' })}{ev?.holiday && <em className="hol-tag">تعطیل</em>}</span>
            <div className="dc-big"><b>{label(d, cal, off, { day: 'numeric', month: 'long' })}</b><span>{fa(parts(d, cal, off).y)}</span></div>
          </div>
          <div className="dc-chips">
            {aux.map((c) => (
              <div key={c}><em className={`tag ${c}`}>{CAL_NAMES[c]}</em><span>{fullDate(d, c, off)}</span></div>
            ))}
          </div>
        </div>
        <hr />
        <div className="week-strip" role="group" aria-label="هفتهٔ جاری">
          {week.map((x) => {
            const has = tasks.some((k) => taskOn(k, x)) || bdays.some((b) => bdayOn(b, x, off)) || weekNotes.has(x);
            return (
              <button
                key={x}
                aria-label={label(x, cal, off, { weekday: 'long', day: 'numeric', month: 'long' }) + (x === t ? '، امروز' : '')}
                aria-pressed={x === d}
                className={`wday${x === d ? ' sel' : ''}${wd(x) === 5 || eventsOn(x)?.holiday ? ' fri' : ''}`}
                onClick={() => setD(x)}
              >
                <span>{WEEKDAYS[wd(x)]}</span>
                <b>{fa(parts(x, cal, off).d)}</b>
                <i className={has ? 'has' : ''} />
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>{isToday ? 'کارهای امروز' : `کارهای ${label(d, cal, off, { day: 'numeric', month: 'long' })}`}</h2>
          {list.length > 0 && <span className="progress-pill">{fa(doneCount)} از {fa(list.length)} انجام شد</span>}
        </div>
        <div className="glass task-list">
          {list.length === 0 && <p className="hint empty">کاری برای این روز نیست.</p>}
          {list.map((x) => {
            const done = doneIds.has(x.id);
            return (
              <div key={x.id} className={`task-row${done ? ' done' : ''}`}>
                <button className="tick" aria-pressed={done} aria-label={done ? `${x.title}، انجام شد` : x.title} onClick={() => toggle(x)}>
                  <span className="circle">{done && <Icon name="check" size={13} stroke={3} />}</span>
                </button>
                <div>
                  <span className="t-title">{x.title}</span>
                  {done ? (
                    <span className="t-sub">{[isTime(x.time) ? faDigits(x.time) : '', kindText(x)].filter(Boolean).join(' · ')}</span>
                  ) : x.remindLead !== undefined && isTime(x.time) ? (
                    <span className="t-sub"><Icon name="bell" size={12} stroke={2} />یادآور فعال</span>
                  ) : (
                    <span className="t-sub"><Icon name="repeat" size={12} stroke={2} />{kindText(x)}</span>
                  )}
                </div>
                {!done && isTime(x.time) && <span className="time-pill">{faDigits(x.time)}</span>}
              </div>
            );
          })}
        </div>
      </section>

      {ev && (
        <section className="glass events-card" aria-label="مناسبت‌ها">
          <div className="mc-head"><span><Icon name="calendarDays" size={14} stroke={1.9} />{isToday ? 'مناسبت امروز' : 'مناسبت‌های این روز'}</span></div>
          <EventList ev={ev} max={4} />
        </section>
      )}

      <div className="grid2">
        <button className="glass mini-card" onClick={() => openDay(d)}>
          <div className="mc-head">
            <span><Icon name="cake" size={14} stroke={1.9} />{isToday ? 'تولد امروز' : 'تولد این روز'}</span>
            {todays[0] && <em className={`tag ${todays[0].cal}`}>{CAL_NAMES[todays[0].cal]}</em>}
          </div>
          {todays[0] ? (
            <div className="person">
              <span className="avatar" aria-hidden="true">{todays[0].name.slice(0, 1)}</span>
              <div>
                <b>{todays[0].name}{todays.length > 1 ? ` و ${fa(todays.length - 1)} نفر دیگر` : ''}</b>
                {todays[0].year && <span>{fa(parts(d, todays[0].cal, off).y - todays[0].year)} سالگی</span>}
              </div>
            </div>
          ) : (
            <span className="hint">تولدی نیست.</span>
          )}
          {next && <div className="mc-foot">بعدی: {next.b.name} · {label(next.date, cal, off, { day: 'numeric', month: 'long' })}</div>}
        </button>

        <button className="glass mini-card" onClick={() => openNote(note?.id ?? null, d)}>
          <div className="mc-head"><span><Icon name="note" size={14} stroke={1.9} />{isToday ? 'یادداشت امروز' : 'یادداشت'}</span></div>
          {note ? (
            <>
              <b className="n-title">{note.title || 'بدون عنوان'}</b>
              {note.text.trim() && <span className="n-body">{note.text.replace(/\s+/g, ' ').trim()}</span>}
              <span className="saved"><Icon name="check" size={12} stroke={2.4} />{notes.length > 1 ? `ذخیره شد · ${fa(notes.length - 1)} یادداشت دیگر` : 'ذخیره شد'}</span>
            </>
          ) : (
            <span className="hint">یادداشتی ثبت نشده است.</span>
          )}
        </button>
      </div>
    </>
  );
}
