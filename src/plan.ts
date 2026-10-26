import { db } from './db';
import { addDays, bdayOn, fa, label, parts, taskOn, today } from './cal';
import { byTime, faDigits, isTime } from './format';

/** One line in the daily digest: a birthday (no id) or a task (id), with its done flag. */
export type PlanItem = {
  t: string;
  d: 0 | 1;
  id?: string;
  r?: 1; // the task has its own reminder at its time, so the daily digest leaves it out
};

export type PlanDay = {
  title: string; // "چهارشنبه ۲۹ مهر"
  items: PlanItem[];
};

/** What each of the next `n` days looks like, for the daily digest and task reminders. */
export async function buildPlan(n = 30): Promise<Record<string, PlanDay>> {
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
      ...(isTime(x.t.time) && x.t.remindLead !== undefined && { r: 1 as const }),
    });
    out[date] = {
      title: label(date, 'persian', 0, { weekday: 'long', day: 'numeric', month: 'long' }),
      items: [
        ...bdays.filter((b) => bdayOn(b, date, 0)).map((b) => ({ t: `تولد ${b.name}`, d: 0 as const })),
        // open tasks by time first, then the done ones in the order they were ticked: the order the board shows
        ...todo.filter((x) => x.at === undefined).sort((a, b) => byTime(a.t, b.t)).map(task),
        ...todo.filter((x) => x.at !== undefined).sort((a, b) => (a.at ?? 0) - (b.at ?? 0)).map(task),
      ],
    };
  }
  return out;
}
