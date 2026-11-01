import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Task } from './db';
import { TodoForm } from './TodoForm';
import { tx } from './i18n';

/**
 * Loads the task once and hands it to the form. The form reads its row only at mount, so a live update cannot overwrite
 * what is being typed; `key` on the parent makes a different task start from a clean state.
 */
export function TodoSheet({ id, seedPersonId, onClose }: { id: string | null; seedPersonId?: string; onClose: () => void }) {
  const loaded = useLiveQuery(async (): Promise<Task | null | undefined> => (id ? ((await db.tasks.get(id)) ?? null) : null), [id]);
  if (loaded === undefined) return null; // still loading
  if (id && loaded === null) {
    return (
      <>
        <div className="scrim dim" onClick={onClose} />
        <section className="sheet" role="dialog" aria-modal="true">
          <div className="bf-head"><span>{tx('کار پیدا نشد')}</span><button className="text-btn" onClick={onClose}>{tx('بستن')}</button></div>
          <p className="hint">{tx('این کار پاک شده است.')}</p>
        </section>
      </>
    );
  }
  return <TodoForm initial={loaded} seedPersonId={seedPersonId} onClose={onClose} />;
}
