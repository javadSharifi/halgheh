import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Photo, db, del, put, uid } from './db';
import { fa } from './cal';
import { ask } from './confirm';
import { Icon } from './Icon';
import { isNative } from './native';
import { capacity, defaultTakenAt, orderPhotos, titleFromName } from './photos';
import { base64Bytes, compress, pickImages, removeFile, saveFile } from './photoStore';
import { queueForUpload } from './photoSync';
import { PhotoViewer } from './PhotoViewer';
import { usePhotoUrls } from './usePhotoUrls';
import { PhotoEdit } from './PhotoEdit';
import { tn, tx } from './i18n';

/** The gallery tab (G1): grid of stored photos, add from the system picker, full-screen viewer, cap at 300. */
export function Gallery({ onBack }: { onBack?: () => void } = {}) {
  const photos = useLiveQuery(() => db.photos.toArray(), []) ?? [];
  const files = useLiveQuery(() => db.photoFiles.toArray(), []) ?? [];
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState('');
  const [viewing, setViewing] = useState<string | null>(null);
  const [editing, setEditing] = useState<Photo | 'new' | null>(null);
  const mounted = useRef(true);

  const order = useMemo(() => orderPhotos(photos), [photos]);
  const fileOf = useMemo(() => new Map(files.map((f) => [f.photoId, f])), [files]);
  const paths = useMemo(() => new Map(files.map((f) => [f.photoId, f.path])), [files]);
  const urls = usePhotoUrls(order, paths);
  const cap = capacity(photos.length);

  useEffect(() => () => { mounted.current = false; }, []);

  const add = async () => {
    setErr('');
    if (cap.full) {
      setErr(tx('سقف {a1} عکس پر شده است. برای افزودن عکس تازه، یکی را حذف کن.', { a1: fa(cap.max) }));
      return;
    }
    try {
      const picked = await pickImages(0);
      if (!picked.length) return;
      // never write more rows than the cap allows, whatever the picker returned
      const room = Math.max(0, cap.remaining);
      const list = picked.slice(0, room);
      if (picked.length > room) setErr(tx('فقط {a1} عکس جا داشت؛ بقیه اضافه نشد.', { a1: fa(room) }));
      setBusy({ done: 0, total: list.length });
      const takenAt = defaultTakenAt();
      for (const [i, file] of list.entries()) {
        const id = uid();
        const { data, width, height } = await compress(file.webPath);
        const path = await saveFile(id, data);
        const row: Photo = {
          id,
          title: titleFromName(file.name) || tx('عکس'),
          takenAt,
          tagIds: [],
          width,
          height,
          bytes: base64Bytes(data),
          updatedAt: Date.now(),
        };
        await put('photos', row);
        await db.photoFiles.put(queueForUpload(id, path));
        if (mounted.current) setBusy({ done: i + 1, total: list.length });
      }
      setBusy(null);
    } catch {
      setBusy(null);
      setErr(tx('افزودن عکس ممکن نشد. اگر پنجرهٔ انتخاب عکس را بستی، دوباره تلاش کن.'));
    }
  };

  const remove = async (p: Photo) => {
    if (!(await ask({ title: tx('«{a1}» حذف شود؟', { a1: p.title }), message: tx('فایل عکس از این گوشی پاک می‌شود. این کار قابل بازگشت نیست.'), confirm: tx('حذف') }))) return;
    await del('photos', p.id);
    const f = fileOf.get(p.id);
    if (f) {
      await removeFile(f.path);
      await db.photoFiles.delete(p.id);
    }
    setViewing(null);
  };

  const absent = photos.length - files.length;

  return (
    <>
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBack && (
            <button className="icon-btn" style={{ margin: 0 }} aria-label={tx('بازگشت')} onClick={onBack}>
              <Icon name="chevronRight" size={20} stroke={2} />
            </button>
          )}
          <h1>{tx('گالری')}</h1>
        </div>
        {isNative && (
          <button className="pill-btn" disabled={!!busy || cap.full} onClick={() => void add()}>
            <Icon name="plus" size={16} stroke={2.4} />
            {busy ? `${fa(busy.done)}/${fa(busy.total)}` : tx('افزودن عکس')}
          </button>
        )}
      </div>

      {!isNative && (
        <section className="glass empty-state">
          <span className="tile purple" aria-hidden="true"><Icon name="image" size={24} stroke={1.7} /></span>
          <b>{tx('گالری روی گوشی کار می‌کند')}</b>
          <p className="hint">{tx('افزودن عکس از گالری گوشی تنها در نسخهٔ اندرویدی در دسترس است.')}</p>
        </section>
      )}

      {err && <p className="form-error gallery-err" role="alert">{err}</p>}
      {cap.warning && !err && <p className="hint gallery-err">{tx('{a1} از {a2} عکس پر شده است.', { a1: fa(cap.count), a2: fa(cap.max) })}</p>}
      {absent > 0 && <p className="hint gallery-err">{tn('{n} عکس پرونده‌اش روی این گوشی نیست؛ با همگام‌سازی بعدی می‌آید.', absent)}</p>}

      {isNative && photos.length === 0 && !busy && (
        <section className="glass empty-state">
          <span className="tile purple" aria-hidden="true"><Icon name="image" size={24} stroke={1.7} /></span>
          <b>{tx('عکسی نیست')}</b>
          <p className="hint">{tx('کارت ویزیت، مدارک و عکس‌هایی که به آدم‌ها مربوط‌اند اینجا نگه داشته می‌شوند.')}</p>
          <button className="mini-btn primary" onClick={() => void add()}><Icon name="plus" size={14} stroke={2.4} />{tx('افزودن از گالری')}</button>
        </section>
      )}

      {order.length > 0 && (
        <div className="photo-grid">
          {order.map((p) => (
            <button key={p.id} className="photo-cell" onClick={() => setViewing(p.id)} aria-label={p.title}>
              {urls[p.id] ? (
                <img src={urls[p.id]} alt="" loading="lazy" width={p.width} height={p.height} />
              ) : (
                <span className="photo-missing" aria-hidden="true"><Icon name="image" size={18} stroke={1.8} /></span>
              )}
              {p.personId && <span className="photo-tag" aria-hidden="true"><Icon name="users" size={11} stroke={2} /></span>}
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <PhotoViewer
          photoId={viewing}
          photos={order}
          urls={urls}
          title={(id) => order.find((p) => p.id === id)?.title ?? ''}
          onClose={() => setViewing(null)}
          onEdit={(p) => { setViewing(null); setEditing(p); }}
          onRemove={(p) => void remove(p)}
          onNavigate={setViewing}
        />
      )}

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
