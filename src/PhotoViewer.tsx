import { useEffect, useRef, useState } from 'react';
import type { Photo } from './db';
import { fa, label } from './cal';
import { Icon } from './Icon';
import { tx } from './i18n';

/**
 * Full-screen viewer (G1) with pinch/double-tap zoom and pan. Switching photos with the arrow buttons keeps the zoom
 * reset, so a zoomed photo never leaves the next one off-centre.
 */
export function PhotoViewer({ photoId, photos, urls, title, onClose, onEdit, onRemove, onNavigate }: {
  photoId: string;
  photos: Photo[];
  urls: Record<string, string>;
  title: (id: string) => string;
  onClose: () => void;
  onEdit: (p: Photo) => void;
  onRemove: (p: Photo) => void;
  onNavigate: (id: string) => void;
}) {
  const index = photos.findIndex((p) => p.id === photoId);
  const photo = photos[index];
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // every photo starts unzoomed
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [photoId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!photo) return null;
  const src = urls[photo.id];

  const clampZoom = (z: number) => Math.min(5, Math.max(1, z));
  const setZoomAt = (z: number) => {
    const next = clampZoom(z);
    setZoom(next);
    if (next === 1) setPan({ x: 0, y: 0 });
  };
  const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const step = (dir: 1 | -1) => {
    const next = photos[index + dir];
    if (next) onNavigate(next.id);
  };

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={photo.title}>
      <div className="viewer-bar">
        <button className="icon-btn" aria-label={tx('بستن')} onClick={onClose}><Icon name="close" size={20} stroke={2.2} /></button>
        <span className="viewer-title">{photo.title}</span>
        <button className="icon-btn" aria-label={tx('ویرایش')} onClick={() => onEdit(photo)}><Icon name="settings" size={19} stroke={1.9} /></button>
      </div>

      <div
        className="viewer-stage"
        onDoubleClick={() => setZoomAt(zoom > 1 ? 1 : 2.5)}
        onTouchStart={(e) => {
          if (e.touches.length === 2) pinch.current = { dist: dist(e.touches), zoom };
          else if (e.touches.length === 1 && zoom > 1) drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: pan.x, py: pan.y };
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinch.current) {
            setZoomAt(pinch.current.zoom * (dist(e.touches) / pinch.current.dist));
          } else if (e.touches.length === 1 && drag.current && zoom > 1) {
            setPan({ x: drag.current.px + (e.touches[0].clientX - drag.current.x), y: drag.current.py + (e.touches[0].clientY - drag.current.y) });
          }
        }}
        onTouchEnd={() => { pinch.current = null; drag.current = null; }}
      >
        {src ? (
          <img
            src={src}
            alt={photo.title}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            draggable={false}
          />
        ) : (
          <p className="hint">{tx('فایل این عکس روی گوشی نیست.')}</p>
        )}
      </div>

      {photos.length > 1 && (
        <>
          <button className="viewer-nav prev" aria-label={tx('عکس بعدی')} onClick={() => step(1)} disabled={index >= photos.length - 1}><Icon name="chevronRight" size={22} stroke={2.2} /></button>
          <button className="viewer-nav next" aria-label={tx('عکس قبلی')} onClick={() => step(-1)} disabled={index <= 0}><Icon name="chevronLeft" size={22} stroke={2.2} /></button>
        </>
      )}

      <div className="viewer-foot">
        <span>{label(photo.takenAt, 'persian', 0, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        {photo.note && <span className="viewer-note">{photo.note}</span>}
        <span className="viewer-count">{tx('{a1} از {a2}', { a1: fa(index + 1), a2: fa(photos.length) })}</span>
        <button className="text-btn" onClick={() => onRemove(photo)}>{tx('حذف')}</button>
      </div>
    </div>
  );
}
