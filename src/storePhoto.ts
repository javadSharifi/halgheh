import { type Photo, db, del, put, uid } from './db';
import { ask } from './confirm';
import { tx } from './i18n';
import { thumbPathFor } from './photos';
import { base64Bytes, compress, removeFile, saveFile, saveThumb, type Picked } from './photoStore';
import { queueForUpload } from './photoSync';

export type PhotoMeta = Pick<Photo, 'title' | 'takenAt' | 'tagIds'> & Partial<Pick<Photo, 'note' | 'personId'>>;

/** Compresses and stores one picked image together with everything the user typed about it. */
export async function storePhoto(file: Picked, meta: PhotoMeta) {
  const id = uid();
  const { data, width, height, thumb } = await compress(file.webPath);
  const path = await saveFile(id, data);
  // a phone out of space still keeps the photo; the grid then falls back to the full file
  await saveThumb(path, thumb).catch(() => {});
  await put('photos', { ...meta, id, width, height, bytes: base64Bytes(data), updatedAt: Date.now() });
  await db.photoFiles.put(queueForUpload(id, path));
}

/** Asks, then deletes the photo row and its files from this device. Returns false when the user said no. */
export async function removePhoto(p: Photo): Promise<boolean> {
  if (!(await ask({ title: tx('«{a1}» حذف شود؟', { a1: p.title }), message: tx('فایل عکس از این گوشی پاک می‌شود. این کار قابل بازگشت نیست.'), confirm: tx('حذف') }))) return false;
  await del('photos', p.id);
  const f = await db.photoFiles.get(p.id);
  if (f) {
    await removeFile(f.path);
    await removeFile(thumbPathFor(f.path));
    await db.photoFiles.delete(p.id);
  }
  return true;
}
