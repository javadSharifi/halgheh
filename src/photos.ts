import type { Photo } from './db';
import { today } from './cal';

/**
 * G1 pure logic: the limits and the compression target. No UI, no Dexie, no Capacitor import, so the numbers live in one
 * place and can be tested later.
 */
export const MAX_PHOTOS = 300; // hard cap (G1)
export const WARN_PHOTOS = 250; // start warning here, so the cap never arrives as a surprise
export const MAX_LONG_SIDE = 1600; // px, longest side after compression
export const JPEG_QUALITY = 0.8;

/** The size a picked image is scaled to, never upscaling a smaller one. */
export function targetSize(width: number, height: number, max = MAX_LONG_SIDE) {
  const longest = Math.max(width, height);
  if (!Number.isFinite(longest) || longest <= 0) return { width, height };
  if (longest <= max) return { width, height };
  const k = max / longest;
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

/** How full the gallery is, and what the UI should say about it. */
export function capacity(count: number) {
  return {
    count,
    max: MAX_PHOTOS,
    full: count >= MAX_PHOTOS,
    warning: count >= WARN_PHOTOS && count < MAX_PHOTOS,
    remaining: Math.max(0, MAX_PHOTOS - count),
  };
}

/** A stable file name inside the app data directory. Uses the photo id, so a rename cannot collide. */
export const fileNameFor = (photoId: string) => `photos/${photoId}.jpg`;

/** Today, as the default "taken on" date for a newly added photo. */
export const defaultTakenAt = () => today();

/** Newest first for the grid: by the day it was taken, then by when it was added. */
export const orderPhotos = (photos: Photo[]) =>
  [...photos].sort((a, b) => b.takenAt.localeCompare(a.takenAt) || b.updatedAt - a.updatedAt);

/** Photos whose file is missing on this device (a restored phone before B2b downloads them). */
export function missingFiles(photos: Photo[], files: { photoId: string; path: string }[]) {
  const have = new Set(files.map((f) => f.photoId));
  return photos.filter((p) => !have.has(p.id));
}

/** Search fields a photo contributes (G2 adds these to the index). */
export const photoSearchText = (p: Photo) => [p.title, p.note].filter(Boolean).join(' ');

/** A friendly default title when the user does not type one. */
export const titleFromName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 80);
