import { fa, label } from '../cal';
import type { Interaction, Task } from '../db';
import { faDigits, isTime } from '../format';
import { Icon } from '../Icon';
import { Button } from '../ui';
import { TYPE_NAME } from '../InteractionForm';
import { isOverdue } from '../todoFilters';
import { toggleTodo } from '../Todos';
import { join, tx } from '../i18n';

/** Tab 2: the todos this person asked for, and the interaction timeline. */
export function ActivityTab({ askedTasks, askedDone, interactions, onTodo, onInteraction }: {
  askedTasks: Task[];
  askedDone: Set<string>;
  interactions: Interaction[];
  onTodo: (id: string | 'new') => void;
  onInteraction: (x: Interaction | 'new') => void;
}) {
  const askedDoneCount = askedTasks.filter((x) => askedDone.has(x.id)).length;

  return (
    <div className="tab-pane">
      <section>
        <div className="section-head">
          <h2>{tx('کارهایی که گفته')}</h2>
          <Button variant="ghost" size="sm" icon="plus" onClick={() => onTodo('new')}>{tx('افزودن')}</Button>
        </div>
        {askedTasks.length === 0 ? (
          <div className="glass empty-state small">
            <b>{tx('کاری از او ثبت نشده')}</b>
            <p className="hint">{tx('هر کاری که این آدم از تو خواسته، با زدن «افزودن» ثبت می‌شود و در تب «کارها» هم دیده می‌شود.')}</p>
          </div>
        ) : (
          <>
            {askedDoneCount > 0 && (
              <p className="hint asked-sum">{tx('{a1} از {a2} کار انجام شده.', { a1: fa(askedDoneCount), a2: fa(askedTasks.length) })}</p>
            )}
            <div className="glass task-list">
              {askedTasks.map((task) => {
                const done = askedDone.has(task.id);
                return (
                  <div key={task.id} className={`task-row${done ? ' done' : ''}`}>
                    <button className="tick" aria-pressed={done} aria-label={done ? tx('{a1}، انجام شد', { a1: task.title }) : tx('{a1}، انجام نشده', { a1: task.title })} onClick={() => void toggleTodo(task, done)}>
                      <span className="circle">{done && <Icon name="check" size={13} stroke={3} />}</span>
                    </button>
                    <button className="t-body" onClick={() => onTodo(task.id)} aria-label={tx('ویرایش {a1}', { a1: task.title })}>
                      <span className="t-title"><bdi>{task.title}</bdi></span>
                      <span className="t-sub">
                        {isOverdue(task, done) && <em className="late-chip">{tx('عقب‌افتاده')}</em>}
                        {join([
                          task.on ? label(task.on, 'persian', 0, { day: 'numeric', month: 'long' }) : tx('بدون موعد'),
                          isTime(task.time) && faDigits(task.time),
                          done && tx('انجام شد'),
                        ])}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>{tx('تعامل‌ها')}</h2>
          <Button variant="ghost" size="sm" icon="plus" onClick={() => onInteraction('new')}>{tx('افزودن')}</Button>
        </div>
        {interactions.length === 0 ? (
          <div className="glass empty-state small">
            <b>{tx('هنوز تعاملی ثبت نشده')}</b>
            <p className="hint">{tx('هر دیدار، تماس یا پیام را بنویس تا سابقهٔ آشنایی ساخته شود.')}</p>
          </div>
        ) : (
          <div className="glass timeline">
            {interactions.map((x) => (
              <button key={x.id} className="tl-row" onClick={() => onInteraction(x)}>
                <span className="tl-dot" aria-hidden="true"><Icon name={x.type === 'call' ? 'phone' : x.type === 'message' ? 'note' : x.type === 'meeting' ? 'users' : 'history'} size={14} stroke={2} /></span>
                <span className="tl-body">
                  <b><bdi>{x.summary}</bdi></b>
                  <span className="tl-meta">{tx(TYPE_NAME[x.type])} · {label(x.occurredAt, 'persian', 0, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  {x.outcome && <span className="tl-out">{tx('نتیجه: {a1}', { a1: x.outcome })}</span>}
                  {x.followUpDate && <span className="tl-follow"><Icon name="bell" size={12} stroke={2} />{tx('پیگیری {a1}', { a1: label(x.followUpDate, 'persian', 0, { day: 'numeric', month: 'long' }) })}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
