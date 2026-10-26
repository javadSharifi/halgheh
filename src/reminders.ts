import { type Task } from './db';
import { addDays, taskOn } from './cal';
import { faDigits, isTime, reminderAt } from './format';

export type TaskReminder = { id: number; at: number; title: string; body: string };

/** A stable positive integer per task occurrence; notes use 1e8..9e8, the daily digest uses YYMMDD, this uses 9e8..1.9e9. */
export const taskNotifId = (taskId: string, date: string) =>
  900_000_000 + ([...`${taskId}|${date}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11) % 1_000_000_000);

/**
 * Reminders for the next `days` days: every occurrence of a task that has a time and a reminder lead, still in the future and not
 * ticked yet, soonest first. Android keeps a limited number of alarms per app, so only the nearest `cap` are returned; the rest are
 * scheduled when the app is next opened.
 */
export function taskReminders(tasks: Task[], done: Set<string>, from: string, days: number, nowMs: number, cap: number): TaskReminder[] {
  const out: TaskReminder[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    for (const t of tasks) {
      if (!taskOn(t, date) || done.has(`${t.id}|${date}`)) continue;
      const at = reminderAt(t, date);
      if (!at || at.getTime() <= nowMs) continue;
      out.push({ id: taskNotifId(t.id, date), at: at.getTime(), title: t.title, body: `ساعت ${faDigits(t.time!)}` });
    }
  }
  // one-off tasks also remind N days ahead; they are not tied to the daily loop above
  for (const t of tasks) {
    if (!t.on || t.active === false || done.has(`${t.id}|${t.on}`)) continue;
    for (const d of t.before ?? []) {
      const at = new Date(`${addDays(t.on, -d)}T${isTime(t.time) ? t.time : '09:00'}:00`).getTime();
      if (at <= nowMs || at > nowMs + days * 86_400_000) continue;
      out.push({ id: taskNotifId(t.id, `${t.on}-${d}`), at, title: t.title, body: d === 1 ? 'فردا' : `${faDigits(String(d))} روز دیگر` });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, cap);
}
