import { useLiveQuery } from 'dexie-react-hooks';
import { ask } from './confirm';
import { type Person, db, del, put } from './db';
import { fa } from './cal';
import { Icon } from './Icon';
import { tn, tx } from './i18n';
import { personLabel } from './format';
import { Card, Button } from './ui';

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
      title: tx('«{a1}» برای همیشه حذف شود؟', { a1: p.displayName }),
      message: tx('این کار قابل بازگشت نیست.'),
      confirm: tx('حذف'),
      icon: 'trash',
    });
    if (ok) await del('people', p.id);
  };

  return (
    <>
      <div className="page-head">
        <h1>{tx('افراد بایگانی‌شده')}</h1>
        {rows.length > 0 && <span className="hint">{tn('{n} نفر', rows.length)}</span>}
      </div>
      {rows.length === 0 ? (
        <Card variant="glass" className="empty-state">
          <span className="tile green" aria-hidden="true"><Icon name="archive" size={24} stroke={1.7} /></span>
          <b>{tx('کسی بایگانی نشده')}</b>
          <p className="hint">{tx('افرادی که از فهرست اصلی کنار می‌گذارید، بدون پاک‌شدن داده‌ها اینجا می‌مانند.')}</p>
        </Card>
      ) : (
        <Card variant="glass" className="set-list people-list">
          {rows.map((p) => (
            <div className="person-row" key={p.id}>
              <span className={`avatar p${paletteOf(p.displayName)}`} aria-hidden="true">{p.displayName.trim().slice(0, 1)}</span>
              <span className="person-name"><bdi>{personLabel(p)}</bdi></span>
              <div className="person-actions">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={tx('بازگرداندن {a1}', { a1: p.displayName })}
                  onClick={() => restore(p)}
                  icon="undo"
                />
                <Button
                  size="icon-sm"
                  variant="danger"
                  aria-label={tx('حذف {a1}', { a1: p.displayName })}
                  onClick={() => remove(p)}
                  icon="trash"
                />
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
