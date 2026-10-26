import { useLiveQuery } from 'dexie-react-hooks';
import { ask } from './confirm';
import { db, del } from './db';
import { kindText, faDigits, isTime } from './format';
import { Icon } from './Icon';
import { label } from './cal';
import { useSettings } from './settings';

/** Asks first; true when the task and its done-history are gone. */
export async function removeTask(id: string) {
  if (!(await ask({ title: 'حذف این کار؟', message: 'کار و سابقهٔ انجام‌شدن‌هایش پاک می‌شود.', confirm: 'حذف' }))) return false;
  for (const d of await db.done.where('taskId').equals(id).toArray()) await del('done', d.id);
  await del('tasks', id);
  return true;
}

export function Tasks({ openForm }: { openForm: (id: string | null) => void }) {
  const { cal, hijriOffset: off } = useSettings();
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const remove = removeTask;
  return (
    <>
      <div className="page-head">
        <h1>کارها</h1>
        <button className="pill-btn" onClick={() => openForm(null)}><Icon name="plus" size={16} stroke={2.2} />افزودن</button>
      </div>
      {tasks.length === 0 && <p className="hint">هنوز کار تکراری‌ای نساخته‌اید.</p>}
      {/* interim list; the designed tasks screen (S11) replaces it */}
      {tasks.map((t) => (
        <div key={t.id} className="row">
          <span>{t.title}<small>{t.on ? label(t.on, cal, off, { day: 'numeric', month: 'long' }) : kindText(t)}{isTime(t.time) ? ` · ${faDigits(t.time)}` : ''}{t.active === false ? ' · متوقف' : ''}</small></span>
          <span className="inline">
            <button onClick={() => openForm(t.id)}>ویرایش</button>
            <button onClick={() => remove(t.id)}>حذف</button>
          </span>
        </div>
      ))}
    </>
  );
}
