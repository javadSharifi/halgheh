import { useState, useEffect, useMemo, type FormEvent, useRef } from 'react';
import { type Task, put, uid } from './db';
import { addDays, bdayOn, fa, label, parts, taskOn, today, wd } from './cal';
import { faDigits, greeting, isTime } from './format';
import { Icon } from './Icon';
import { isOverdue } from './todoFilters';
import { toggleTodo } from './Todos';

const WEEKDAYS = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']; // by JS weekday, 0 = Sunday

export type TodayWidgetProps = {
  tasks: Task[];
  dones: { taskId: string; date: string }[];
  todays: { task: Task; done: boolean }[];
  openTask: (id: string | null) => void;
  openSearch?: () => void;
  nameOf: Map<string, string>;
  bdays?: { cal: 'persian' | 'gregory' | 'islamic'; month: number; day: number }[];
  statusChip?: React.ReactNode;
};

/** Individual task item row inside the widget */
function WidgetTaskItem({
  task,
  done,
  t,
  nameOf,
  onToggle,
  onOpen,
}: {
  task: Task;
  done: boolean;
  t: string;
  nameOf: Map<string, string>;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const late = isOverdue(task, done, t);
  const fromPerson = task.fromPersonId ? nameOf.get(task.fromPersonId) : null;

  return (
    <div className={`widget-task-item${done ? ' done' : ''}`}>
      <button
        className="widget-task-tick"
        type="button"
        aria-pressed={done}
        aria-label={done ? `${task.title}، انجام شد` : `${task.title}، انجام نشده`}
        onClick={onToggle}
      >
        <span className="widget-tick-circle">
          {done && <Icon name="check" size={13} stroke={3} />}
        </span>
      </button>

      <button
        className="widget-task-body"
        type="button"
        onClick={onOpen}
        aria-label={`مشاهده یا ویرایش ${task.title}`}
      >
        <span className="widget-task-title">{task.title}</span>
        <div className="widget-task-meta">
          {late && <span className="ti-chip late">عقب‌افتاده</span>}
          {isTime(task.time) && (
            <span className="ti-chip time">
              <Icon name="clock" size={11} stroke={2} />
              {faDigits(task.time)}
            </span>
          )}
          {fromPerson && (
            <span className="ti-chip from">
              <Icon name="users" size={11} stroke={2} />
              {fromPerson}
            </span>
          )}
          {task.on && task.on !== t && (
            <span className="ti-chip">
              {label(task.on, 'persian', 0, { day: 'numeric', month: 'long' })}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

/**
 * TodayWidget:
 * A rich all-in-one widget featuring:
 * 1. Live Digital Clock with seconds & time-of-day greeting
 * 2. Persian Solar Calendar with weekday & interactive week ribbon
 * 3. Quick-Add section to immediately add a task for today
 * 4. Today's Tasks checklist with one-tap toggle and progress bar
 */
export function TodayWidget({
  tasks,
  todays,
  openTask,
  openSearch,
  nameOf,
  bdays = [],
  statusChip,
}: TodayWidgetProps) {
  const t = today();

  // 1. Live Clock State
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hoursStr = String(now.getHours()).padStart(2, '0');
  const minutesStr = String(now.getMinutes()).padStart(2, '0');
  const secondsStr = String(now.getSeconds()).padStart(2, '0');
  const clockText = `${hoursStr}:${minutesStr}`;
  const greet = greeting(now.getHours());

  // 2. Persian Calendar Date
  const weekdayName = label(t, 'persian', 0, { weekday: 'long' });
  const dayMonthText = label(t, 'persian', 0, { day: 'numeric', month: 'long' });
  const yearText = fa(parts(t, 'persian', 0).y);

  const weekFrom = addDays(t, -((wd(t) - 6 + 7) % 7)); // starts Saturday
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i)), [weekFrom]);
  const hasOn = (iso: string) =>
    tasks.some((k) => taskOn(k, iso)) || bdays.some((b) => bdayOn(b, iso, 0));

  // 3. Tasks Breakdown
  const openToday = useMemo(() => todays.filter((r) => !r.done), [todays]);
  const doneToday = useMemo(() => todays.filter((r) => r.done), [todays]);
  const doneCount = doneToday.length;
  const totalCount = todays.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const [showDone, setShowDone] = useState(false);

  // 4. Quick Add State
  const [quickTitle, setQuickTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleQuickAdd = async (e: FormEvent) => {
    e.preventDefault();
    const clean = quickTitle.trim();
    if (!clean || saving) return;

    setSaving(true);
    try {
      const timestamp = Date.now();
      const newTask: Task = {
        id: uid(),
        title: clean,
        mask: 0,
        on: t,
        start: t,
        active: true,
        updatedAt: timestamp,
      };
      await put('tasks', newTask);
      setQuickTitle('');
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to quick add task:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass today-widget" aria-label="ویجت کارهای امروز">
      {/* Top Header: Clock, Greeting & Status */}
      <div className="tw-header">
        <div className="tw-clock-block">
          <div className="tw-clock-display" aria-label={`ساعت فعلی: ${clockText}`}>
            <span className="tw-clock-time">{faDigits(clockText)}</span>
            <span className="tw-clock-seconds">:{faDigits(secondsStr)}</span>
          </div>
          <span className="tw-greeting-badge">{greet}</span>
        </div>

        <div className="tw-cal-block">
          <div className="tw-cal-date">
            <span className="tw-cal-weekday">{weekdayName}</span>
            <h1 className="tw-cal-full">{dayMonthText} {yearText}</h1>
          </div>
          {statusChip && <div className="tw-status-wrap">{statusChip}</div>}
        </div>
      </div>

      {/* Week Ribbon mini-calendar */}
      <div className="week-ribbon tw-week-ribbon" role="group" aria-label="روزهای هفته جاری">
        {week.map((x) => {
          const isCurrent = x === t;
          const isFriday = wd(x) === 5;
          return (
            <div
              key={x}
              className={`wr-day${isCurrent ? ' today' : ''}${isFriday ? ' fri' : ''}`}
              aria-current={isCurrent ? 'date' : undefined}
            >
              <span>{WEEKDAYS[wd(x)]}</span>
              <b>{fa(parts(x, 'persian', 0).d)}</b>
              <i className={hasOn(x) ? 'has' : ''} />
            </div>
          );
        })}
      </div>

      {/* Optional Search Trigger if provided */}
      {openSearch && (
        <button
          type="button"
          className="today-search-trigger tw-search-trigger"
          onClick={openSearch}
          aria-label="جستجو در حلقه"
        >
          <Icon name="search" size={16} stroke={2} />
          <span>جستجو در آدم‌ها، کارها، یادداشت‌ها...</span>
        </button>
      )}

      {/* Quick Add Section: Type and press Enter to immediately add to today */}
      <div className="tw-quick-section">
        <form className="tw-quick-form" onSubmit={handleQuickAdd}>
          <div className="tw-quick-input-box">
            <span className="tw-quick-icon" aria-hidden="true">
              <Icon name="plus" size={17} stroke={2.5} />
            </span>
            <input
              ref={inputRef}
              type="text"
              className="tw-quick-input"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="کاری که باید امروز انجام بدم..."
              maxLength={140}
              aria-label="عنوان کاری که باید امروز انجام دهید"
              enterKeyHint="done"
            />
            <button
              type="submit"
              className="tw-quick-submit"
              disabled={!quickTitle.trim() || saving}
              aria-label="افزودن به کارهای امروز"
            >
              <span>{saving ? '...' : 'افزودن'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Today's Tasks Checklist Section */}
      <div className="tw-tasks-section">
        <div className="tw-tasks-header">
          <div className="tw-tasks-title-wrap">
            <h2 className="tw-tasks-title">کارهای امروز</h2>
            {openToday.length > 0 && (
              <span className="tw-count-badge">{fa(openToday.length)} باقی‌مانده</span>
            )}
          </div>
          <button
            type="button"
            className="tw-full-add-btn"
            onClick={() => openTask(null)}
            aria-label="فرم کامل ثبت کار با جزییات"
          >
            <Icon name="plus" size={13} stroke={2.5} />
            <span>جزئیات بیشتر</span>
          </button>
        </div>

        {/* Progress Bar (when tasks exist) */}
        {totalCount > 0 && (
          <div className="today-progress-widget tw-progress">
            <div className="tpw-header">
              <span className="tpw-label">پیشرفت کارهای امروز</span>
              <span className="tpw-count">
                {doneCount === totalCount ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="checkCircle" size={13} stroke={2.4} />
                    <span>همه انجام شدند</span>
                  </span>
                ) : (
                  `${fa(doneCount)} از ${fa(totalCount)} کار`
                )}
              </span>
            </div>
            <div className="tpw-bar">
              <span
                className={`tpw-fill${doneCount === totalCount ? ' complete' : ''}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Task Rows or Empty State */}
        {totalCount === 0 ? (
          <div className="tw-empty-state">
            <p className="hint">کاری برای امروز ثبت نشده است. از کادر بالا سریع اضافه کنید!</p>
          </div>
        ) : (
          <div className="tw-task-list">
            {openToday.length === 0 && doneToday.length > 0 ? (
              <div className="tw-all-done">
                <span className="tile green" aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 8 }}>
                  <Icon name="check" size={16} stroke={2.5} />
                </span>
                <span>عالیه! همه کارهای امروز انجام شدند.</span>
              </div>
            ) : (
              openToday.map(({ task, done }) => (
                <WidgetTaskItem
                  key={task.id}
                  task={task}
                  done={done}
                  t={t}
                  nameOf={nameOf}
                  onToggle={() => void toggleTodo(task, done)}
                  onOpen={() => openTask(task.id)}
                />
              ))
            )}

            {/* Collapsible Done Tasks */}
            {doneToday.length > 0 && (
              <div className="tw-done-wrapper">
                <button
                  type="button"
                  className="completed-divider tw-done-divider"
                  onClick={() => setShowDone(!showDone)}
                  aria-expanded={showDone}
                >
                  <span>{fa(doneCount)} کار انجام‌شده</span>
                  <Icon name={showDone ? 'chevronDown' : 'chevronLeft'} size={15} stroke={2} />
                </button>

                {showDone && (
                  <div className="completed-list">
                    {doneToday.map(({ task, done }) => (
                      <WidgetTaskItem
                        key={task.id}
                        task={task}
                        done={done}
                        t={t}
                        nameOf={nameOf}
                        onToggle={() => void toggleTodo(task, done)}
                        onOpen={() => openTask(task.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
