import { type Task, type Done } from './db';
import { addDays, taskOn, today } from './cal';
import { locale, tx, tk } from './i18n';

export type TodoFilter = 'today' | 'upcoming' | 'nodate' | 'done' | 'personal' | 'all';

export const FILTERS: [TodoFilter, string][] = [
  ['today', tk('امروز')],
  ['upcoming', tk('پیش‌رو')],
  ['nodate', tk('بدون موعد')],
  ['done', tk('انجام‌شده')],
  ['personal', tk('شخصی')],
  ['all', tk('همه')],
];

/** A recurring task has no single day: it runs on the weekdays in `mask` (see `taskOn`). */
export const isRecurring = (t: Task) => !t.on && t.mask > 0;

/** A todo with neither a day (`on`) nor a weekday mask is the "someday" case: it has no day to run on. */
export const isDateless = (t: Task) => !t.on && !t.mask;

/** The day a todo is next due: its own day, or for a recurring one today if it runs today, else its next run within two weeks. */
export function dueOf(t: Task, from = today()): string | undefined {
  if (t.on) return t.on;
  if (!isRecurring(t)) return undefined;
  for (let i = 0; i < 14; i++) {
    const d = addDays(from, i);
    if (taskOn(t, d)) return d;
  }
  return undefined;
}

/**
 * A dateless todo has no day to be done *on*, so it gets a stable sentinel date. Using today would make it impossible to
 * un-tick tomorrow (the key would have moved), and would make it look done on only one day.
 */
export const SOMEDAY = '0000-01-01';

/** Done keys are `taskId|date`; the date is the todo's own day, or SOMEDAY for a dateless one. */
export const doneKey = (taskId: string, date: string) => `${taskId}|${date}`;

/** The date a todo's `done` row is filed under. A recurring todo is ticked per occurrence, so it files under the day asked (default today). */
export const doneDateFor = (t: Task, date: string = today()) => t.on ?? (isRecurring(t) ? date : SOMEDAY);

/**
 * The only `done` rows `listTodos`/`overdue` can match for this set of tasks: one row per task, under the task's own day
 * (or SOMEDAY). Reading the whole history would grow forever; this stays as small as the task list.
 */
export const doneDatesFor = (tasks: Task[]) => [...new Set(tasks.map((t) => doneDateFor(t)))];

/**
 * The list for one filter, in the order the screen shows:
 * open before done, then by time (a todo with a time first), then by due date, then by title.
 */
export function listTodos(tasks: Task[], dones: Done[], filter: TodoFilter, t = today()): { task: Task; done: boolean; due?: string }[] {
  const doneIds = new Set(dones.map((d) => d.id));
  const rows = tasks.map((task) => {
    const due = dueOf(task, t);
    // the done row is filed under the todo's own day (the occurrence day for a recurring one), or SOMEDAY when it has none
    const done = doneIds.has(doneKey(task.id, doneDateFor(task, due ?? t)));
    return { task, done, due };
  });
  const open = rows.filter((r) => !r.done);
  const finished = rows.filter((r) => r.done);

  const bySort = (a: (typeof rows)[number], b: (typeof rows)[number]) => {
    const ta = a.task.time ?? '99:99';
    const tb = b.task.time ?? '99:99';
    if (ta !== tb) return ta.localeCompare(tb);
    const da = a.due ?? '9999-99-99'; // dateless last: it has no day to be due on
    const db_ = b.due ?? '9999-99-99';
    if (da !== db_) return da.localeCompare(db_);
    return a.task.title.localeCompare(b.task.title, locale());
  };

  switch (filter) {
    case 'today':
      return rows.filter((r) => r.due === t).sort((a, b) => Number(a.done) - Number(b.done) || bySort(a, b));
    case 'upcoming':
      // dated, not yet done, strictly after today; overdue rows are shown in their own band by the page
      return open.filter((r) => r.due && r.due > t).sort(bySort);
    case 'nodate':
      return open.filter((r) => isDateless(r.task)).sort(bySort);
    case 'done':
      return finished.sort((a, b) => (b.due ?? '').localeCompare(a.due ?? '') || bySort(a, b));
    case 'personal':
      // every task with a mode (shopping, errand, ...), open ones first
      return rows.filter((r) => r.task.kind).sort((a, b) => Number(a.done) - Number(b.done) || bySort(a, b));
    case 'all':
    default:
      return rows.sort((a, b) => Number(a.done) - Number(b.done) || bySort(a, b));
  }
}

/** Every dated todo that is still open and already past its day: what "پیش‌رو" shows above the future ones. */
export function overdue(tasks: Task[], dones: Done[], t = today()) {
  const doneToday = new Set(dones.map((d) => d.id));
  return tasks
    .filter((x) => x.on && x.on < t && !doneToday.has(doneKey(x.id, x.on)))
    .sort((a, b) => (a.on ?? '').localeCompare(b.on ?? ''));
}

/** Counts for the filter chips, so an empty tab says why instead of looking broken. */
export function counts(tasks: Task[], dones: Done[], t = today()) {
  return {
    today: listTodos(tasks, dones, 'today', t).length,
    upcoming: listTodos(tasks, dones, 'upcoming', t).length,
    nodate: listTodos(tasks, dones, 'nodate', t).length,
    done: listTodos(tasks, dones, 'done', t).length,
    personal: listTodos(tasks, dones, 'personal', t).length,
    all: tasks.length,
  } satisfies Record<TodoFilter, number>;
}

/** "فردا", "۳ روز دیگر", "دیروز" for a due date next to a todo. */
export function dueLabel(due: string | undefined, t = today()) {
  if (!due) return '';
  if (due === t) return tx('امروز');
  if (due === addDays(t, 1)) return tx('فردا');
  if (due === addDays(t, -1)) return tx('دیروز');
  return '';
}

/** True when a dated todo is past its day and still open. */
export const isOverdue = (task: Task, done: boolean, t = today()) => !!task.on && task.on < t && !done;
