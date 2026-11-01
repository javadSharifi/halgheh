import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { fa } from './cal';
import { capacity } from './photos';
import { pickImages, type Picked } from './photoStore';
import { PhotoEdit } from './PhotoEdit';
import { tx } from './i18n';

/**
 * Add photos from the system picker: each picked image opens the full photo form (title, note, date, person, tags)
 * before it is stored. Used by the gallery and by a person's profile (`seedPersonId` pre-selects that person).
 */
export function usePhotoAdd(seedPersonId?: string) {
  const [queue, setQueue] = useState<Picked[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState('');
  const count = useLiveQuery(() => db.photos.count(), []) ?? 0;
  const cap = capacity(count);

  const start = async () => {
    setErr('');
    if (cap.full) return setErr(tx('سقف {a1} عکس پر شده است. برای افزودن عکس تازه، یکی را حذف کن.', { a1: fa(cap.max) }));
    try {
      const picked = await pickImages(0);
      if (!picked.length) return;
      const list = picked.slice(0, cap.remaining);
      if (picked.length > list.length) setErr(tx('فقط {a1} عکس جا داشت؛ بقیه اضافه نشد.', { a1: fa(list.length) }));
      setTotal(list.length);
      setQueue(list);
    } catch {
      setErr(tx('افزودن عکس ممکن نشد. اگر پنجرهٔ انتخاب عکس را بستی، دوباره تلاش کن.'));
    }
  };

  const form = queue[0] ? (
    <PhotoEdit
      key={queue[0].webPath}
      pending={queue[0]}
      step={total > 1 ? { n: total - queue.length + 1, of: total } : undefined}
      seedPersonId={seedPersonId}
      onClose={() => setQueue([])}
      onSaved={() => setQueue((q) => q.slice(1))}
    />
  ) : null;

  return { start, form, err, cap, adding: queue.length > 0 };
}
