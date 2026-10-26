import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { type Cal, addDays, bdayOn, fa, fullDate, gridCells, label, month, parts, taskOn, today, wd } from './cal';
import { EventList } from './EventList';
import { eventsOn } from './events';
import { Icon } from './Icon';
import { useSettings } from './settings';

const WEEKDAYS = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']; // by JS weekday, 0 = Sunday
const FRIDAY = 5;

/** "سپتامبر – اکتبر ۲۰۲۶": the span of the shown month in another calendar. */
function rangeText(first: string, last: string, cal: Cal, off: number) {
  const m1 = label(first, cal, off, { month: 'long' });
  const m2 = label(last, cal, off, { month: 'long' });
  const y1 = fa(parts(first, cal, off).y);
  const y2 = fa(parts(last, cal, off).y);
  if (y1 !== y2) return `${m1} ${y1} – ${m2} ${y2}`;
  return m1 === m2 ? `${m1} ${y2}` : `${m1} – ${m2} ${y2}`;
}

type Props = { sel: string; setSel: (d: string) => void; anchor: string; setAnchor: (d: string) => void; openDay: () => void };

export function CalendarPage({ sel, setSel, anchor, setAnchor, openDay }: Props) {
  const { cal, aux, weekStart, hijriOffset: off } = useSettings();
  const days = month(anchor, cal, off);
  const [first, last] = [days[0], days[days.length - 1]];
  const cells = gridCells(days, weekStart);
  const [from, to] = [cells[0], cells[cells.length - 1]];

  const noted = new Set((useLiveQuery(() => db.notes.where('date').between(from, to, true, true).toArray(), [from, to]) ?? []).map((n) => n.date));
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const bdays = useLiveQuery(() => db.birthdays.toArray(), []) ?? [];
  const selNotes = useLiveQuery(() => db.notes.where('date').equals(sel).count(), [sel]) ?? 0;

  const selTasks = tasks.filter((t) => taskOn(t, sel)).length;
  const selBdays = bdays.filter((b) => bdayOn(b, sel, off)).length;
  const t = today();
  const small = aux[0];
  const goToday = () => {
    setAnchor(t);
    setSel(t);
  };
  const pick = (d: string) => {
    setSel(d);
    if (!days.includes(d)) setAnchor(d);
  };

  return (
    <>
      <div className="page-head">
        <h1>تقویم</h1>
        <button className="pill-btn" onClick={goToday}><Icon name="target" size={16} stroke={2} />امروز</button>
      </div>

      <section className="glass month" aria-label={label(anchor, cal, off, { month: 'long', year: 'numeric' })}>
        <div className="month-head">
          <button className="icon-btn" aria-label="ماه قبل" onClick={() => setAnchor(addDays(first, -1))}><Icon name="chevronRight" /></button>
          <div className="month-title">
            <b>{label(anchor, cal, off, { month: 'long', year: 'numeric' })}</b>
            {aux.length > 0 && <span>{aux.map((c) => rangeText(first, last, c, off)).join(' · ')}</span>}
          </div>
          <button className="icon-btn" aria-label="ماه بعد" onClick={() => setAnchor(addDays(last, 1))}><Icon name="chevronLeft" /></button>
        </div>

        <div className="week-head" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7).map((w) => (
            <span key={w} className={w === FRIDAY ? 'fri' : ''}>{WEEKDAYS[w]}</span>
          ))}
        </div>

        <div className="grid" role="grid">
          {cells.map((d) => {
            const out = !days.includes(d);
            const sub = small ? parts(d, small, off) : null;
            const hol = eventsOn(d)?.holiday;
            return (
              <button
                key={d}
                aria-label={label(d, cal, off, { weekday: 'long', day: 'numeric', month: 'long' })}
                aria-current={d === t ? 'date' : undefined}
                aria-pressed={d === sel}
                className={`cell${d === sel ? ' sel' : ''}${d === t ? ' today' : ''}${wd(d) === FRIDAY ? ' fri' : ''}${hol ? ' hol' : ''}${out ? ' out' : ''}`}
                onClick={() => pick(d)}
              >
                <b>{fa(parts(d, cal, off).d)}</b>
                {sub && <small>{sub.d === 1 ? `${fa(1)} ${label(d, small, off, { month: 'long' }).slice(0, 3)}` : fa(sub.d)}</small>}
                <i>
                  {noted.has(d) && <u className="n" />}
                  {tasks.some((x) => taskOn(x, d)) && <u className="t" />}
                  {bdays.some((b) => bdayOn(b, d, off)) && <u className="b" />}
                </i>
              </button>
            );
          })}
        </div>

        <div className="legend">
          <span><u className="n" />یادداشت</span>
          <span><u className="t" />کار</span>
          <span><u className="b" />تولد</span>
          <span className="fri-note">جمعه و تعطیلات</span>
        </div>
      </section>

      <section className="glass sel-card" aria-label="روز انتخاب‌شده">
        <div className="sel-head">
          <div>
            <b>{label(sel, cal, off, { weekday: 'long', day: 'numeric', month: 'long' })}</b>
            <span>{aux.map((c) => fullDate(sel, c, off)).join(' · ')}</span>
          </div>
          {sel === t && <em>امروز</em>}
        </div>
        <div className="counts">
          {selTasks > 0 && <span className="count t"><Icon name="listChecks" size={14} stroke={2} />{fa(selTasks)} کار</span>}
          {selNotes > 0 && <span className="count n"><Icon name="note" size={14} stroke={2} />{fa(selNotes)} یادداشت</span>}
          {selBdays > 0 && <span className="count b"><Icon name="cake" size={14} stroke={2} />{fa(selBdays)} تولد</span>}
          {selTasks + selNotes + selBdays === 0 && !eventsOn(sel) && <span className="hint">رویدادی برای این روز ثبت نشده است.</span>}
        </div>
        <EventList ev={eventsOn(sel)} max={3} />
        <button className="link-btn" onClick={openDay}>مشاهدهٔ جزئیات روز<Icon name="chevronLeft" size={16} stroke={2} /></button>
      </section>
    </>
  );
}
