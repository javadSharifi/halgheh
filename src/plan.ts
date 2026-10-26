import { db } from './db';
import { type Cal, addDays, bdayOn, fa, fullDate, label, parts, taskOn, today } from './cal';
import { byTime, faDigits, isTime } from './format';
import { eventsOn } from './events';

/** One line on the widget / notification: a birthday (no id) or a task (id), with its done flag. */
export type PlanItem = {
  t: string;
  d: 0 | 1;
  id?: string;
  tm?: string; // time as shown, Persian digits
  r?: 1; // the task has its own reminder at its time, so the daily digest leaves it out
};

export type PlanDay = {
  title: string; // "چهارشنبه ۲۹ مهر"
  sub: string; // the other calendars: "۲۱ اکتبر ۲۰۲۶ · ۱۰ جمادی‌الاول ۱۴۴۸"
  wd: string; // "چهارشنبه"
  day: string; // "۲۹"
  my: string; // "مهر ۱۴۰۵"
  g: string; // first auxiliary calendar's date, for the small widget
  dm: string; // "۲۹ مهر"
  ev: string; // the day's occasions, joined: "روز صادرات · …"
  hol: 0 | 1; // an official holiday
  items: PlanItem[];
};

/** What each of the next `n` days looks like, for the Android widgets, the ongoing notification and the reminders. */
export async function buildPlan(cal: Cal, off: number, aux: Cal[], n = 30): Promise<Record<string, PlanDay>> {
  const start = today();
  const [tasks, bdays, done] = await Promise.all([db.tasks.toArray(), db.birthdays.toArray(), db.done.where('date').aboveOrEqual(start).toArray()]);
  const doneAt = new Map(done.map((d) => [d.id, d.doneAt ?? 0]));
  const out: Record<string, PlanDay> = {};
  for (let i = 0; i < n; i++) {
    const date = addDays(start, i);
    const todo = tasks.filter((t) => taskOn(t, date)).map((t) => ({ t, at: doneAt.get(`${t.id}|${date}`) }));
    const task = (x: (typeof todo)[number]): PlanItem => ({
      t: x.t.title,
      id: x.t.id,
      d: x.at === undefined ? 0 : 1,
      ...(isTime(x.t.time) && { tm: faDigits(x.t.time) }),
      ...(isTime(x.t.time) && x.t.remindLead !== undefined && { r: 1 as const }),
    });
    const occ = eventsOn(date);
    out[date] = {
      title: label(date, cal, off, { weekday: 'long', day: 'numeric', month: 'long' }),
      sub: aux.map((c) => fullDate(date, c, off)).join(' · '),
      wd: label(date, cal, off, { weekday: 'long' }),
      day: fa(parts(date, cal, off).d),
      my: `${label(date, cal, off, { month: 'long' })} ${fa(parts(date, cal, off).y)}`,
      g: aux[0] ? fullDate(date, aux[0], off) : '',
      dm: label(date, cal, off, { day: 'numeric', month: 'long' }),
      ev: occ?.list.map((e) => e.title).join(' · ') ?? '',
      hol: occ?.holiday ? 1 : 0,
      items: [
        // one line for all occasions, so a busy day does not push the tasks off the widget
        ...(occ ? [{ t: `${occ.holiday ? '🔴' : '📅'} ${occ.list.map((e) => e.title).join(' · ')}`, d: 0 as const }] : []),
        ...bdays.filter((b) => bdayOn(b, date, off)).map((b) => ({ t: `🎂 تولد ${b.name}`, d: 0 as const })),
        // open tasks by time first, then the done ones in the order they were ticked: the order the board shows
        ...todo.filter((x) => x.at === undefined).sort((a, b) => byTime(a.t, b.t)).map(task),
        ...todo.filter((x) => x.at !== undefined).sort((a, b) => (a.at ?? 0) - (b.at ?? 0)).map(task),
      ],
    };
  }
  return out;
}
