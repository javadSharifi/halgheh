import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ask } from './confirm';
import { type Person, db, del, put } from './db';
import { fa } from './cal';
import { Icon } from './Icon';
import { locale, tx } from './i18n';
import { personLabel } from './format';
import { CIRCLES, type Circle } from './circles';
import { Button, PageHead } from './ui';

const paletteOf = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;

export function PeoplePage({
  openAddPerson,
  openQuickAdd,
  openPerson,
  openSearch,
  openWhoCan,
  openGraph,
  openTouch,
}: {
  openAddPerson?: () => void;
  openQuickAdd?: () => void;
  openPerson: (id: string) => void;
  openSearch: () => void;
  openWhoCan: () => void;
  openGraph: () => void;
  openTouch: () => void;
}) {
  const onAdd = openAddPerson ?? openQuickAdd ?? (() => {});
  const [menu, setMenu] = useState<Person | null>(null);
  const [circle, setCircle] = useState<Circle | 'none' | ''>('');
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  // sorting with localeCompare is the slow part of this screen, so it runs only when the list changes
  const rows = useMemo(
    () =>
      people
        .filter((p) => !p.isSelf && !p.archivedAt)
        .filter((p) => !circle || (circle === 'none' ? !p.circle : p.circle === circle))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, locale())),
    [people, circle],
  );
  const archivedCount = useMemo(() => people.filter((p) => !p.isSelf && p.archivedAt).length, [people]);

  const archive = async (p: Person) => {
    setMenu(null);
    const now = Date.now();
    await put('people', { ...p, archivedAt: now, updatedAt: now });
  };
  const remove = async (p: Person) => {
    setMenu(null);
    const ok = await ask({
      title: tx('«{a1}» حذف شود؟', { a1: p.displayName }),
      message: tx('این کار قابل بازگشت نیست. اگر فقط نمی‌خواهی در فهرست باشد، بایگانی کن.'),
      confirm: tx('حذف'),
      icon: 'trash',
    });
    if (ok) await del('people', p.id);
  };

  return (
    <>
      <PageHead
        title={tx('افراد')}
        tools={[
          { icon: 'search', label: tx('جستجو در افراد'), onClick: openSearch },
          { icon: 'toolbox', label: tx('چه کسی می‌تواند'), onClick: openWhoCan },
          { icon: 'plus', label: tx('افزودن فرد'), onClick: onAdd, primary: true },
        ]}
      />

      <div className="inline-actions">
        <Button size="sm" icon="repeat" onClick={openTouch}>{tx('حفظ ارتباط')}</Button>
        <Button size="sm" icon="users" onClick={openGraph}>{tx('گراف رابطه‌ها')}</Button>
      </div>
      <div className="tabs people-circles" role="tablist" aria-label={tx('دسته‌بندی صمیمیت')}>
        {([['', tx('همه')], ...CIRCLES.map((c): [string, string] => [c.key, tx(c.name)]), ['none', tx('دسته‌بندی نشده')]] as [Circle | 'none' | '', string][]).map(([k, name]) => (
          <button key={k} role="tab" aria-selected={circle === k} className={circle === k ? 'on' : ''} onClick={() => setCircle(k)}>{name}</button>
        ))}
      </div>

      {rows.length === 0 && circle ? (
        <p className="hint empty">{tx('کسی در این دسته نیست.')}</p>
      ) : rows.length === 0 ? (
        <section className="glass empty-state">
          <span className="tile blue" aria-hidden="true"><Icon name="users" size={24} stroke={1.7} /></span>
          <b>{archivedCount > 0 ? tx('کسی در فهرست نیست') : tx('هنوز کسی اضافه نشده')}</b>
          <p className="hint">
            {archivedCount > 0
              ? tx('{a1} نفر بایگانی شده‌اند؛ از «افراد بایگانی‌شده» در بخش بیشتر بازشان کن.', { a1: fa(archivedCount) })
              : tx('آدم‌هایی که می‌شناسی، مهارت‌ها و رابطه‌هایشان اینجا جمع می‌شود.')}
          </p>
          <button className="pill-btn" style={{ marginTop: '14px' }} onClick={onAdd}>
            <Icon name="plus" size={16} stroke={2.4} />{tx('افزودن فرد جدید')}</button>
        </section>
      ) : (
        <>
          <div className="glass set-list people-list">
            {rows.map((p) => (
              <div className="person-row" key={p.id}>
                <button className="person-open" onClick={() => openPerson(p.id)} aria-label={tx('باز کردن {a1}', { a1: p.displayName })}>
                  <span className={`avatar p${paletteOf(p.displayName)}`} aria-hidden="true">{p.displayName.trim().slice(0, 1)}</span>
                  <span className="person-name"><bdi>{personLabel(p)}</bdi></span>
                </button>
                <button className="icon-btn small" aria-label={tx('گزینه‌های {a1}', { a1: p.displayName })} aria-haspopup="dialog" onClick={() => setMenu(p)}>
                  <Icon name="moreHorizontal" size={19} stroke={2} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {menu && (
        <>
          <div className="scrim dim" onClick={() => setMenu(null)} />
          <section className="sheet person-menu" role="dialog" aria-modal="true" aria-labelledby="person-menu-title">
            <div className="bf-head">
              <span id="person-menu-title">{personLabel(menu)}</span>
              <button className="text-btn" onClick={() => setMenu(null)}>{tx('بستن')}</button>
            </div>
            <button className="set-row as-btn" onClick={() => archive(menu)}>
              <span className="tile green" aria-hidden="true"><Icon name="archive" size={17} stroke={1.9} /></span>
              <span className="set-name">{tx('بایگانی')}</span>
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
            <button className="set-row as-btn" onClick={() => remove(menu)}>
              <span className="tile peach" aria-hidden="true"><Icon name="trash" size={17} stroke={1.9} /></span>
              <span className="set-name">{tx('حذف')}</span>
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          </section>
        </>
      )}
    </>
  );
}
