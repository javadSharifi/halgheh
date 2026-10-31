import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Task, db, del, put } from './db';
import { fa, label, today } from './cal';
import { faDigits, isTime } from './format';
import { ask } from './confirm';
import { Icon } from './Icon';
import { counts, doneDateFor, doneKey, FILTERS, isOverdue, listTodos, overdue, type TodoFilter } from './todoFilters';
import { tn, tx } from './i18n';

/** Asks first; true when the task and its done-history are gone. */
export async function removeTask(id: string) {
  if (!(await ask({ title: tx('حذف این کار؟'), message: tx('کار و سابقهٔ انجام‌شدن‌هایش پاک می‌شود.'), confirm: tx('حذف') }))) return false;
  for (const d of await db.done.where('taskId').equals(id).toArray()) await del('done', d.id);
  await del('tasks', id);
  return true;
}

/**
 * Ticking writes a `done` row under the todo's own day; a dateless todo uses the SOMEDAY sentinel, so it can be ticked
 * and un-ticked on any day. `done` is the current state: true removes the row.
 */
export async function toggleTodo(task: Task, done: boolean) {
  const date = doneDateFor(task);
  if (done) return del('done', doneKey(task.id, date));
  await put('done', { id: doneKey(task.id, date), taskId: task.id, date, updatedAt: Date.now(), doneAt: Date.now() });
}

/** Snooze the reminder (not the due date) by a few hours or a day; stored on the row so re-planning keeps it. */
export async function snoozeTodo(task: Task, hours: number) {
  const until = Date.now() + hours * 3_600_000;
  await put('tasks', { ...task, snoozeUntil: until, updatedAt: Date.now() });
}

/** Drops a snooze so the normal reminder takes over again. */
export async function clearSnooze(task: Task) {
  const row = { ...task, updatedAt: Date.now() };
  delete row.snoozeUntil;
  await put('tasks', row);
}

const snoozedNow = (t: Task) => !!t.snoozeUntil && t.snoozeUntil > Date.now();

export function Todos({ openForm, openPerson }: { openForm: (id: string | null) => void; openPerson: (id: string) => void }) {
  const [filter, setFilter] = useState<TodoFilter>('today');
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const dones = useLiveQuery(() => db.done.toArray(), []) ?? [];
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const t = today();

  const n = useMemo(() => counts(tasks, dones, t), [tasks, dones, t]);
  const list = useMemo(() => listTodos(tasks, dones, filter, t), [tasks, dones, filter, t]);
  const late = useMemo(() => (filter === 'upcoming' ? overdue(tasks, dones, t) : []), [filter, tasks, dones, t]);
  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, p.displayName])), [people]);

  const sub = (task: Task, done: boolean) => {
    const bits: string[] = [];
    if (task.on && task.on !== t) bits.push(label(task.on, 'persian', 0, { day: 'numeric', month: 'long' }));
    if (isTime(task.time)) bits.push(faDigits(task.time));
    if (task.fromPersonId) bits.push(tx('از طرف {a1}', { a1: nameOf.get(task.fromPersonId) ?? tx('کسی') }));
    if (!task.on) bits.push(tx('بدون موعد'));
    if (done) bits.push(tx('انجام شد'));
    if (snoozedNow(task)) bits.push(tx('یادآوری به تعویق افتاده'));
    return bits.join(' · ');
  };

  const noDate = filter === 'nodate' && n.nodate === 0;
  const emptyText =
    filter === 'today' ? tx('کاری برای امروز نیست.')
      : filter === 'upcoming' ? tx('کار آینده‌ای نیست.')
        : filter === 'nodate' ? tx('کار بی‌موعدی نداری.')
          : filter === 'done' ? tx('هنوز کاری انجام نشده.')
            : tx('هنوز کاری نساخته‌ای.');

  const Row = ({ task, done }: { task: Task; done: boolean }) => (
    <div className={`task-row${done ? ' done' : ''}`}>
      <button className="tick" aria-pressed={done} aria-label={done ? tx('{a1}، انجام شد', { a1: task.title }) : tx('{a1}، انجام نشده', { a1: task.title })} onClick={() => void toggleTodo(task, done)}>
        <span className="circle">{done && <Icon name="check" size={13} stroke={3} />}</span>
      </button>
      <button className="t-body" onClick={() => openForm(task.id)} aria-label={tx('ویرایش {a1}', { a1: task.title })}>
        <span className="t-title"><bdi>{task.title}</bdi></span>
        <span className="t-sub">
          {isOverdue(task, done, t) && <em className="late-chip">{tx('عقب‌افتاده')}</em>}
          {sub(task, done)}
        </span>
      </button>
      {task.fromPersonId && (
        <button className="icon-btn small" aria-label={tx('پروفایل {a1}', { a1: nameOf.get(task.fromPersonId) ?? '' })} onClick={() => openPerson(task.fromPersonId!)}>
          <Icon name="users" size={17} stroke={1.9} />
        </button>
      )}
      {!done && (
        snoozedNow(task) ? (
          <button className="icon-btn small on" aria-label={tx('لغو یادآوری بعدی {a1}', { a1: task.title })} onClick={() => void clearSnooze(task)}>
            <Icon name="bell" size={17} stroke={1.9} />
          </button>
        ) : (
          <button className="icon-btn small" aria-label={tx('یادآوری {a1} را یک ساعت بعد بیاور', { a1: task.title })} onClick={() => void snoozeTodo(task, 1)}>
            <Icon name="clock" size={17} stroke={1.9} />
          </button>
        )
      )}
    </div>
  );

  return (
    <>
      <div className="page-head">
        <h1>{tx('کارها')}</h1>
        <button className="pill-btn" onClick={() => openForm(null)}><Icon name="plus" size={16} stroke={2.4} />{tx('افزودن')}</button>
      </div>

      <div className="tabs" role="tablist" aria-label={tx('فیلتر کارها')}>
        {FILTERS.map(([k, labelText]) => (
          <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
            {tx(labelText)}{n[k] > 0 ? ` · ${fa(n[k])}` : ''}
          </button>
        ))}
      </div>

      {late.length > 0 && (
        <section>
          <h2 className="sec-title">{tx('عقب‌افتاده')}<small>{tn('{n} کار', late.length)}</small></h2>
          <div className="glass task-list">
            {late.map((task) => (
              <div key={task.id} className="task-row">
                <button className="tick" aria-pressed={false} aria-label={tx('{a1}، انجام نشده', { a1: task.title })} onClick={() => void toggleTodo(task, false)}>
                  <span className="circle" />
                </button>
                <button className="t-body" onClick={() => openForm(task.id)} aria-label={tx('ویرایش {a1}', { a1: task.title })}>
                  <span className="t-title"><bdi>{task.title}</bdi></span>
                  <span className="t-sub"><em className="late-chip">{tx('عقب‌افتاده')}</em>{label(task.on!, 'persian', 0, { day: 'numeric', month: 'long' })}{isTime(task.time) ? ` · ${faDigits(task.time)}` : ''}</span>
                </button>
                <button className="icon-btn small" aria-label={tx('یادآوری {a1} را یک ساعت بعد بیاور', { a1: task.title })} onClick={() => void snoozeTodo(task, 1)}><Icon name="clock" size={17} stroke={1.9} /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="glass task-list">
          {list.length === 0 && (
            <p className="hint empty">
              {noDate ? tx('{a1} کارِ بی‌موعد را از «افزودن» و با انتخاب «بدون موعد» بساز.', { a1: emptyText }) : emptyText}
            </p>
          )}
          {list.map(({ task, done }) => <Row key={task.id} task={task} done={done} />)}
        </div>
      </section>

      {filter === 'all' && n.all === 0 && (
        <p className="hint todos-hint">{tx('هر کاری که کسی از تو می‌خواهد یا خودت باید انجام بدهی، اینجا نگه دار.')}</p>
      )}
    </>
  );
}
