import { useEffect, useState } from 'react';
import type { Photo } from './db';
import { fileSrc } from './photoStore';

/**
 * Resolves stored photo files to URLs the web view can render. Shared by the gallery and the profile so both show real
 * thumbnails; object URLs are revoked when the set changes, so switching screens does not leak them.
 */
export function usePhotoUrls(photos: Photo[], paths: Map<string, string>) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = photos.map((p) => p.id).join(',');

  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const p of photos) {
        const path = paths.get(p.id);
        if (!path) continue;
        try {
          next[p.id] = await fileSrc(path);
        } catch {
          /* a missing file simply has no thumbnail */
        }
        if (cancelled) {
          Object.values(next).filter((u) => u.startsWith('blob:')).forEach((u) => URL.revokeObjectURL(u));
          return;
        }
      }
      if (cancelled) return;
      setUrls(next);
      made.push(...Object.values(next).filter((u) => u.startsWith('blob:')));
    })();
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, paths]);

  return urls;
}
