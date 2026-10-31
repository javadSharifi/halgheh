import { useLiveQuery } from 'dexie-react-hooks';
import { ask } from './confirm';
import { type Person, db, del, put } from './db';
import { fa } from './cal';
import { Icon } from './Icon';

const paletteOf = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;

export function ArchivePage() {
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const rows = people
    .filter((p) => !p.isSelf && p.archivedAt)
    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));

  const restore = async (p: Person) => {
    const row: Person = { ...p, updatedAt: Date.now() };
    delete row.archivedAt;
    await put('people', row);
  };
  const remove = async (p: Person) => {
    const ok = await ask({
      title: `«${p.displayName}» برای همیشه حذف شود؟`,
      message: 'این کار قابل بازگشت نیست.',
      confirm: 'حذف',
      icon: 'trash',
    });
    if (ok) await del('people', p.id);
  };

  return (
    <>
      <div className="page-head">
        <h1>افراد بایگانی‌شده</h1>
        {rows.length > 0 && <span className="hint">{fa(rows.length)} نفر</span>}
      </div>
      {rows.length === 0 ? (
        <section className="glass empty-state">
          <span className="tile green" aria-hidden="true"><Icon name="archive" size={24} stroke={1.7} /></span>
          <b>کسی بایگانی نشده</b>
          <p className="hint">افرادی که از فهرست اصلی کنار می‌گذارید، بدون پاک‌شدن داده‌ها اینجا می‌مانند.</p>
        </section>
      ) : (
        <div className="glass set-list people-list">
          {rows.map((p) => (
            <div className="person-row" key={p.id}>
              <span className={`avatar p${paletteOf(p.displayName)}`} aria-hidden="true">{p.displayName.trim().slice(0, 1)}</span>
              <span className="person-name">{p.displayName}</span>
              <div className="person-actions">
                <button className="icon-btn small" aria-label={`بازگرداندن ${p.displayName}`} onClick={() => restore(p)}>
                  <Icon name="undo" size={18} stroke={2} />
                </button>
                <button className="icon-btn small danger" aria-label={`حذف ${p.displayName}`} onClick={() => remove(p)}>
                  <Icon name="trash" size={18} stroke={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
