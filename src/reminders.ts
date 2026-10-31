import { type Task } from './db';
import { addDays, taskOn } from './cal';
import { faDigits, isTime, reminderAt } from './format';
import { tx } from './i18n';

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
  // A snoozed todo fires once at the snoozed time instead of its own reminder. It is stored on the row, so it survives the
  // cancel-and-re-plan that runs on every change, on resume and after a reboot.
  const snoozed = new Set(tasks.filter((t) => t.snoozeUntil && t.snoozeUntil > nowMs).map((t) => t.id));

  for (const t of tasks) {
    if (!t.snoozeUntil || t.snoozeUntil <= nowMs || t.active === false) continue;
    const date = new Date(t.snoozeUntil).toLocaleDateString('sv');
    if (done.has(`${t.id}|${date}`)) continue;
    out.push({ id: taskNotifId(t.id, `snooze-${date}`), at: t.snoozeUntil, title: t.title, body: isTime(t.time) ? tx('ساعت {a1}', { a1: faDigits(t.time) }) : tx('یادآوری') });
  }

  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    for (const t of tasks) {
      if (snoozed.has(t.id)) continue; // its reminder is the snoozed one, not the original
      if (!taskOn(t, date) || done.has(`${t.id}|${date}`)) continue;
      const at = reminderAt(t, date);
      if (!at || at.getTime() <= nowMs) continue;
      out.push({ id: taskNotifId(t.id, date), at: at.getTime(), title: t.title, body: tx('ساعت {a1}', { a1: faDigits(t.time!) }) });
    }
  }
  // one-off tasks also remind N days ahead; they are not tied to the daily loop above
  for (const t of tasks) {
    if (snoozed.has(t.id)) continue;
    if (!t.on || t.active === false || done.has(`${t.id}|${t.on}`)) continue;
    for (const d of t.before ?? []) {
      const at = new Date(`${addDays(t.on, -d)}T${isTime(t.time) ? t.time : '09:00'}:00`).getTime();
      if (at <= nowMs || at > nowMs + days * 86_400_000) continue;
      out.push({ id: taskNotifId(t.id, `${t.on}-${d}`), at, title: t.title, body: d === 1 ? tx('فردا') : tx('{a1} روز دیگر', { a1: faDigits(String(d)) }) });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, cap);
}
