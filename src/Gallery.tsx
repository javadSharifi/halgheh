import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Photo, db } from './db';
import { fa } from './cal';
import { Icon } from './Icon';
import { isNative } from './native';
import { orderPhotos } from './photos';
import { removePhoto } from './storePhoto';
import { usePhotoAdd } from './photoAdd';
import { PhotoViewer } from './PhotoViewer';
import { usePhotoUrls } from './usePhotoUrls';
import { PhotoEdit } from './PhotoEdit';
import { locale, tn, tx } from './i18n';
import { personLabel } from './format';
import { Card, Button, InputField } from './ui';

/** The gallery tab (G1): grid of stored photos, add from the system picker, full-screen viewer, cap at 300. */
export function Gallery({ onBack }: { onBack?: () => void } = {}) {
  const photos = useLiveQuery(() => db.photos.toArray(), []) ?? [];
  const files = useLiveQuery(() => db.photoFiles.toArray(), []) ?? [];
  const adder = usePhotoAdd();
  const { cap, err } = adder;
  const busy = adder.adding;
  const [viewing, setViewing] = useState<string | null>(null);
  const [editing, setEditing] = useState<Photo | 'new' | null>(null);

  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const tags = useLiveQuery(() => db.tags.toArray(), []) ?? [];
  const [q, setQ] = useState('');
  const [byPerson, setByPerson] = useState(false);

  const all = useMemo(() => orderPhotos(photos), [photos]);
  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, personLabel(p)])), [people]);
  const tagName = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);
  // search covers what the user typed about the photo plus the person's name and the tag names
  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('fa');
    if (!needle) return all;
    return all.filter((p) =>
      [p.title, p.note, p.personId && nameOf.get(p.personId), ...p.tagIds.map((t) => tagName.get(t))]
        .some((f) => f?.toLocaleLowerCase('fa').includes(needle)),
    );
  }, [all, q, nameOf, tagName]);
  const groups = useMemo(() => {
    if (!byPerson) return [{ key: 'all', title: '', items: shown }];
    const m = new Map<string, Photo[]>();
    for (const p of shown) m.set(p.personId ?? '', [...(m.get(p.personId ?? '') ?? []), p]);
    return [...m.entries()]
      .map(([key, items]) => ({ key, title: key ? (nameOf.get(key) ?? '…') : tx('بدون شخص'), items }))
      .sort((a, b) => (a.key === '' ? 1 : b.key === '' ? -1 : a.title.localeCompare(b.title, locale())));
  }, [shown, byPerson, nameOf]);
  // the viewer pages through photos in the order they are on screen
  const order = useMemo(() => groups.flatMap((x) => x.items), [groups]);
  const paths = useMemo(() => new Map(files.map((f) => [f.photoId, f.path])), [files]);
  const { full: urls, thumb } = usePhotoUrls(all, paths);

  const absent = photos.length - files.length;

  return (
    <>
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBack && (
            <Button
              size="icon-md"
              variant="ghost"
              aria-label={tx('بازگشت')}
              onClick={onBack}
              icon="chevronRight"
            />
          )}
          <h1>{tx('گالری')}</h1>
        </div>
        {isNative && (
          <Button
            variant="primary"
            size="sm"
            disabled={!!busy || cap.full}
            onClick={() => void adder.start()}
            icon="plus"
          >
            {tx('افزودن عکس')}
          </Button>
        )}
      </div>

      {!isNative && (
        <Card variant="glass" className="empty-state">
          <span className="tile purple" aria-hidden="true"><Icon name="image" size={24} stroke={1.7} /></span>
          <b>{tx('گالری روی گوشی کار می‌کند')}</b>
          <p className="hint">{tx('افزودن عکس از گالری گوشی تنها در نسخهٔ اندرویدی در دسترس است.')}</p>
        </Card>
      )}

      {err && <p className="form-error gallery-err" role="alert">{err}</p>}
      {cap.warning && !err && <p className="hint gallery-err">{tx('{a1} از {a2} عکس پر شده است.', { a1: fa(cap.count), a2: fa(cap.max) })}</p>}
      {absent > 0 && <p className="hint gallery-err">{tn('{n} عکس پرونده‌اش روی این گوشی نیست؛ با همگام‌سازی بعدی می‌آید.', absent)}</p>}

      {isNative && photos.length === 0 && !busy && (
        <Card variant="glass" className="empty-state">
          <span className="tile purple" aria-hidden="true"><Icon name="image" size={24} stroke={1.7} /></span>
          <b>{tx('عکسی نیست')}</b>
          <p className="hint">{tx('کارت ویزیت، مدارک و عکس‌هایی که به آدم‌ها مربوط‌اند اینجا نگه داشته می‌شوند.')}</p>
          <Button variant="primary" size="sm" onClick={() => void adder.start()} icon="plus">
            {tx('افزودن از گالری')}
          </Button>
        </Card>
      )}

      {photos.length > 0 && (
        <div className="gallery-tools">
          <InputField
            type="search"
            icon="search"
            aria-label={tx('جستجو در عکس‌ها')}
            placeholder={tx('جستجو در عنوان، یادداشت، شخص و برچسب')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="tabs today-tabs" role="tablist" aria-label={tx('نمایش عکس‌ها')}>
            <button role="tab" aria-selected={!byPerson} className={!byPerson ? 'on' : ''} onClick={() => setByPerson(false)}>{tx('همه')}</button>
            <button role="tab" aria-selected={byPerson} className={byPerson ? 'on' : ''} onClick={() => setByPerson(true)}>{tx('بر اساس شخص')}</button>
          </div>
        </div>
      )}

      {photos.length > 0 && shown.length === 0 && <p className="hint empty">{tx('عکسی با این مشخصات پیدا نشد.')}</p>}

      {groups.map((grp) => (
        <section key={grp.key}>
          {grp.title && <h2 className="sec-title">{grp.title}<small>{tn('{n} عکس', grp.items.length)}</small></h2>}
          <div className="photo-grid">
            {grp.items.map((p) => (
              <button key={p.id} className="photo-cell" onClick={() => setViewing(p.id)} aria-label={p.title}>
                {thumb[p.id] ? (
                  <img src={thumb[p.id]} alt="" loading="lazy" width={p.width} height={p.height} />
                ) : (
                  <span className="photo-missing" aria-hidden="true"><Icon name="image" size={18} stroke={1.8} /></span>
                )}
                {p.personId && <span className="photo-tag" aria-hidden="true"><Icon name="users" size={11} stroke={2} /></span>}
              </button>
            ))}
          </div>
        </section>
      ))}

      {viewing && (
        <PhotoViewer
          photoId={viewing}
          photos={order}
          urls={urls}
          title={(id) => order.find((p) => p.id === id)?.title ?? ''}
          onClose={() => setViewing(null)}
          onEdit={(p) => { setViewing(null); setEditing(p); }}
          onRemove={(p) => void removePhoto(p).then((gone) => gone && setViewing(null))}
          onNavigate={setViewing}
        />
      )}

      {adder.form}

      {editing && (
        <PhotoEdit
          key={editing === 'new' ? 'new' : editing.id}
          photo={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
