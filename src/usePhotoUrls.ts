import { useEffect, useState } from 'react';
import type { Photo } from './db';
import { thumbPathFor } from './photos';
import { fileExists, fileSrc } from './photoStore';

/** `thumb` is the small grid cache, `full` the stored image the viewer zooms into. */
export type PhotoUrls = { full: Record<string, string>; thumb: Record<string, string> };

const blobs = (u: PhotoUrls) => Object.values({ ...u.full, ...u.thumb }).filter((x) => x.startsWith('blob:'));
const revoke = (u: PhotoUrls) => blobs(u).forEach((x) => URL.revokeObjectURL(x));

/**
 * Resolves stored photo files to URLs the web view can render. Shared by the gallery and the profile so both show real
 * thumbnails; object URLs are revoked when the set changes, so switching screens does not leak them.
 */
export function usePhotoUrls(photos: Photo[], paths: Map<string, string>): PhotoUrls {
  const [urls, setUrls] = useState<PhotoUrls>({ full: {}, thumb: {} });
  const key = photos.map((p) => p.id).join(',');

  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];
    (async () => {
      const next: PhotoUrls = { full: {}, thumb: {} };
      for (const p of photos) {
        const path = paths.get(p.id);
        if (!path) continue;
        try {
          const full = await fileSrc(path);
          next.full[p.id] = full;
          // a missing thumb is normal: a restored or synced phone only gets the full files back, so fall back to them
          const thumbPath = thumbPathFor(path);
          next.thumb[p.id] = (await fileExists(thumbPath)) ? await fileSrc(thumbPath) : full;
        } catch {
          /* a missing file simply has no thumbnail */
        }
        if (cancelled) {
          revoke(next);
          return;
        }
      }
      if (cancelled) return;
      setUrls(next);
      made.push(...blobs(next));
    })();
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, paths]);

  return urls;
}
