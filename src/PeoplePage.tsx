import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ask } from './confirm';
import { type Person, db, del, put } from './db';
import { fa } from './cal';
import { ContactsImport } from './ContactsImport';
import { Icon } from './Icon';
import { isNative } from './native';

type Sort = 'name' | 'recent';
const SORT_KEY = 'halgheh:people-sort';
const initialSort = (): Sort => (localStorage.getItem(SORT_KEY) === 'recent' ? 'recent' : 'name');
const paletteOf = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;

export function PeoplePage({
  openAddPerson,
  openQuickAdd,
  openPerson,
  openSearch,
  openWhoCan,
}: {
  openAddPerson?: () => void;
  openQuickAdd?: () => void;
  openPerson: (id: string) => void;
  openSearch: () => void;
  openWhoCan: () => void;
}) {
  const onAdd = openAddPerson ?? openQuickAdd ?? (() => {});
  const [sort, setSort] = useState<Sort>(initialSort);
  const [menu, setMenu] = useState<Person | null>(null);
  const [importing, setImporting] = useState(false);
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const rows = people
    .filter((p) => !p.isSelf && !p.archivedAt)
    .sort(sort === 'name' ? (a, b) => a.displayName.localeCompare(b.displayName, 'fa') : (a, b) => b.createdAt - a.createdAt);
  const archivedCount = people.filter((p) => !p.isSelf && p.archivedAt).length;

  const pickSort = (s: Sort) => {
    setSort(s);
    localStorage.setItem(SORT_KEY, s);
  };
  const archive = async (p: Person) => {
    setMenu(null);
    const now = Date.now();
    await put('people', { ...p, archivedAt: now, updatedAt: now });
  };
  const remove = async (p: Person) => {
    setMenu(null);
    const ok = await ask({
      title: `«${p.displayName}» حذف شود؟`,
      message: 'این کار قابل بازگشت نیست. اگر فقط نمی‌خواهی در فهرست باشد، بایگانی کن.',
      confirm: 'حذف',
      icon: 'trash',
    });
    if (ok) await del('people', p.id);
  };

  return (
    <>
      <div className="page-head">
        <h1>افراد</h1>
        <div className="head-tools">
          <button className="icon-btn" aria-label="جستجو در افراد" onClick={openSearch}><Icon name="search" size={19} stroke={1.9} /></button>
          <button className="icon-btn" aria-label="چه کسی می‌تواند" onClick={openWhoCan}><Icon name="toolbox" size={19} stroke={1.9} /></button>
          {isNative && (
            <button className="icon-btn" aria-label="افزودن از مخاطبین" aria-haspopup="dialog" onClick={() => setImporting(true)}>
              <Icon name="smartphone" size={19} stroke={1.9} />
            </button>
          )}
          <button className="pill-btn" onClick={onAdd}><Icon name="plus" size={16} stroke={2.4} />افزودن فرد</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <section className="glass empty-state">
          <span className="tile blue" aria-hidden="true"><Icon name="users" size={24} stroke={1.7} /></span>
          <b>{archivedCount > 0 ? 'کسی در فهرست نیست' : 'هنوز کسی اضافه نشده'}</b>
          <p className="hint">
            {archivedCount > 0
              ? `${fa(archivedCount)} نفر بایگانی شده‌اند؛ از «افراد بایگانی‌شده» در بخش بیشتر بازشان کن.`
              : 'آدم‌هایی که می‌شناسی، مهارت‌ها و رابطه‌هایشان اینجا جمع می‌شود.'}
          </p>
          <button className="pill-btn" style={{ marginTop: '14px' }} onClick={onAdd}>
            <Icon name="plus" size={16} stroke={2.4} />افزودن فرد جدید
          </button>
        </section>
      ) : (
        <>
          <div className="tabs people-sort" aria-label="ترتیب افراد">
            <button aria-pressed={sort === 'name'} className={sort === 'name' ? 'on' : ''} onClick={() => pickSort('name')}>نام</button>
            <button aria-pressed={sort === 'recent'} className={sort === 'recent' ? 'on' : ''} onClick={() => pickSort('recent')}>تازه‌ترین</button>
          </div>
          <div className="glass set-list people-list">
            {rows.map((p) => (
              <div className="person-row" key={p.id}>
                <button className="person-open" onClick={() => openPerson(p.id)} aria-label={`باز کردن ${p.displayName}`}>
                  <span className={`avatar p${paletteOf(p.displayName)}`} aria-hidden="true">{p.displayName.trim().slice(0, 1)}</span>
                  <span className="person-name">{p.displayName}</span>
                </button>
                <button className="icon-btn small" aria-label={`گزینه‌های ${p.displayName}`} aria-haspopup="dialog" onClick={() => setMenu(p)}>
                  <Icon name="moreHorizontal" size={19} stroke={2} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {importing && <ContactsImport onClose={() => setImporting(false)} />}

      {menu && (
        <>
          <div className="scrim dim" onClick={() => setMenu(null)} />
          <section className="sheet person-menu" role="dialog" aria-modal="true" aria-labelledby="person-menu-title">
            <div className="bf-head">
              <span id="person-menu-title">{menu.displayName}</span>
              <button className="text-btn" onClick={() => setMenu(null)}>بستن</button>
            </div>
            <button className="set-row as-btn" onClick={() => archive(menu)}>
              <span className="tile green" aria-hidden="true"><Icon name="archive" size={17} stroke={1.9} /></span>
              <span className="set-name">بایگانی</span>
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
            <button className="set-row as-btn" onClick={() => remove(menu)}>
              <span className="tile peach" aria-hidden="true"><Icon name="trash" size={17} stroke={1.9} /></span>
              <span className="set-name">حذف</span>
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          </section>
        </>
      )}
    </>
  );
}
