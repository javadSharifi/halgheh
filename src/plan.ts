import { db } from './db';
import { addDays, bdayOn, fa, label, parts, taskOn, today } from './cal';
import { byTime, faDigits, isTime } from './format';
import { dueCount } from './domain/rules/schedule';
import { dueExchanges } from './domain/ledger';

/** One line in the daily digest: a birthday (no id) or a task (id), with its done flag. */
export type PlanItem = {
  t: string;
  d: 0 | 1;
  id?: string;
  r?: 1; // the task has its own reminder at its time, so the daily digest leaves it out
  /** Set on the single summary line that counts the rules due for review; it links to the rulebook, not a task. */
  rules?: 1;
  /** Set on the ledger summary line; it counts exchanges whose due date has arrived, not a task. */
  ledger?: 1;
};

export type PlanDay = {
  title: string; // "چهارشنبه ۲۹ مهر"
  items: PlanItem[];
};

/** What each of the next `n` days looks like, for the daily digest and task reminders. */
export async function buildPlan(n = 30): Promise<Record<string, PlanDay>> {
  const start = today();
  const [tasks, bdays, done, rules, exchanges] = await Promise.all([
    db.tasks.toArray(),
    db.birthdays.toArray(),
    db.done.where('date').aboveOrEqual(start).toArray(),
    db.rules.toArray(),
    db.exchanges.toArray(),
  ]);
  // Part 3: the ledger's own line in the same 08:00 digest, on today's entry only (a due date is "now", not a schedule).
  const ledgerDue = dueExchanges(exchanges, start).length;
  // Phase 4: the daily 08:00 digest gets one line for the rulebook, only on days that actually have rules coming due.
  // No new alarm and no new channel: it rides the existing digest that already carries birthdays and todos.
  const dueOn = new Map<string, number>();
  for (const r of rules) {
    if (r.archivedAt) continue;
    dueOn.set(r.nextReviewOn, (dueOn.get(r.nextReviewOn) ?? 0) + 1);
  }
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
    // Rules overdue from earlier days are counted on today's line, so the line matches the Today card and never vanishes
    // just because its own day has passed; a day with nothing due and nothing pending gets no line at all.
    const dueCount_ = i === 0 ? dueCount(rules, date) : (dueOn.get(date) ?? 0);
    out[date] = {
      title: label(date, 'persian', 0, { weekday: 'long', day: 'numeric', month: 'long' }),
      items: [
        ...(dueCount_ > 0 ? [{ t: `${fa(dueCount_)} قانون برای مرور`, d: 0 as const, rules: 1 as const }] : []),
        ...(i === 0 && ledgerDue > 0 ? [{ t: `${fa(ledgerDue)} دادوستد سررسید`, d: 0 as const, ledger: 1 as const }] : []),
        ...bdays.filter((b) => bdayOn(b, date, 0)).map((b) => ({ t: `تولد ${b.name}`, d: 0 as const })),
        // open tasks by time first, then the done ones in the order they were ticked: the order the board shows
        ...todo.filter((x) => x.at === undefined).sort((a, b) => byTime(a.t, b.t)).map(task),
        ...todo.filter((x) => x.at !== undefined).sort((a, b) => (a.at ?? 0) - (b.at ?? 0)).map(task),
      ],
    };
  }
  return out;
}
