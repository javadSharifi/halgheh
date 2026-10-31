import { Directory, Filesystem } from '@capacitor/filesystem';
import { db, type PhotoFile } from './db';
import { getCfg } from './sync';

/**
 * B2b client side of photo files: an upload queue with retry and no duplicates, and a download pass for a restored phone.
 * Everything here is a no-op when sync is not connected, so a local-only install never touches the network.
 */

const ENDPOINT = '/api/photo';

type Cfg = NonNullable<ReturnType<typeof getCfg>>;

/** Photos are only uploaded when an account exists; otherwise this returns null and callers skip quietly. */
function cfgOrNull(): Cfg | null {
  const cfg = getCfg();
  return cfg?.url && cfg.key ? cfg : null;
}

const urlFor = (cfg: Cfg, id?: string) => `${cfg.url.replace(/\/$/, '')}${ENDPOINT}${id ? `/${encodeURIComponent(id)}` : ''}`;

export type UploadResult = { uploaded: number; failed: number; skipped: string };

/**
 * Uploads every photo whose file is still `local` or `failed`. Files already `uploaded` are skipped, and an upload of an
 * existing id overwrites the same R2 key, so a retry can never create a duplicate.
 */
export async function uploadPendingPhotos(): Promise<UploadResult> {
  const cfg = cfgOrNull();
  if (!cfg) return { uploaded: 0, failed: 0, skipped: 'not connected' };

  const queue = await db.photoFiles.where('uploadState').anyOf(['local', 'failed']).toArray();
  let uploaded = 0;
  let failed = 0;
  for (const f of queue) {
    try {
      const file = await Filesystem.readFile({ path: f.path, directory: Directory.Data });
      const bin = typeof file.data === 'string' ? Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0)) : new Uint8Array(await (file.data as Blob).arrayBuffer());
      const res = await fetch(urlFor(cfg, f.photoId), {
        method: 'PUT',
        headers: { authorization: `Bearer ${cfg.key}`, 'content-type': 'image/jpeg' },
        body: bin,
      });
      if (!res.ok) {
        // 413 means the account is at its photo cap; retrying cannot help, so the file stays local and the caller tells the user
        if (res.status === 413) throw new Error('limit');
        throw new Error(String(res.status));
      }
      await db.photoFiles.put({ ...f, uploadState: 'uploaded', updatedAt: Date.now() });
      uploaded++;
    } catch {
      // keep the row as failed so the next run tries again; never delete the local file on a failure
      await db.photoFiles.put({ ...f, uploadState: 'failed', updatedAt: Date.now() });
      failed++;
      if (failed >= 3) break; // a dead network should not burn through the whole queue
    }
  }
  return { uploaded, failed, skipped: '' };
}

/** The row a newly added photo gets: `local` means "on this device, not uploaded yet". */
export const queueForUpload = (photoId: string, path: string): PhotoFile => ({ photoId, path, uploadState: 'local', updatedAt: Date.now() });

/**
 * Downloads the files a restored phone is missing. The server is asked which ids it has; only those are fetched, and only
 * when the local file is absent, so a second run does nothing.
 */
export async function downloadMissingPhotos(): Promise<{ downloaded: number; missing: number }> {
  const cfg = cfgOrNull();
  if (!cfg) return { downloaded: 0, missing: 0 };

  const remote = await fetch(urlFor(cfg), { headers: { authorization: `Bearer ${cfg.key}` } });
  if (!remote.ok) return { downloaded: 0, missing: 0 };
  const { photos } = (await remote.json()) as { photos: { id: string }[] };
  const localIds = new Set((await db.photoFiles.toArray()).map((f) => f.photoId));

  let downloaded = 0;
  let missing = 0;
  for (const { id } of photos) {
    if (localIds.has(id)) continue;
    try {
      const res = await fetch(urlFor(cfg, id), { headers: { authorization: `Bearer ${cfg.key}` } });
      if (!res.ok) {
        missing++;
        continue;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      // chunked so a 1.5 MB file does not blow the argument limit of String.fromCharCode
      let bin = '';
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const path = `photos/${id}.jpg`;
      await Filesystem.writeFile({ path, data: btoa(bin), directory: Directory.Data, recursive: true });
      await db.photoFiles.put({ photoId: id, path, uploadState: 'uploaded', updatedAt: Date.now() });
      downloaded++;
    } catch {
      missing++;
    }
  }
  return { downloaded, missing };
}

/** Counts for the sync screen: how many photos are waiting, how many are safely uploaded. */
export async function photoQueueStatus() {
  const files = await db.photoFiles.toArray();
  return {
    pending: files.filter((f) => f.uploadState !== 'uploaded').length,
    uploaded: files.filter((f) => f.uploadState === 'uploaded').length,
    total: files.length,
  };
}
