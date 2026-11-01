import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { JPEG_QUALITY, MAX_LONG_SIDE, THUMB_LONG_SIDE, THUMB_QUALITY, fileNameFor, targetSize, thumbPathFor } from './photos';
import { isNative } from './native';

/**
 * G1 file pipeline. The picker is the Android system photo picker (no permission needed; the OS shows the sheet), then
 * the image is downscaled and re-encoded on the device before it is written into the app's data directory.
 * Nothing here touches the network: uploading is B2b.
 */

export type Picked = { name: string; width: number; height: number; webPath: string };

/** Opens the system photo picker. Rejects when the user cancels or the platform has no picker. */
export async function pickImages(limit = 0): Promise<Picked[]> {
  const { files } = await FilePicker.pickImages({ limit, readData: false, skipTranscoding: true });
  return files
    .filter((f) => (f.mimeType || '').startsWith('image/'))
    .map((f) => ({ name: f.name, width: f.width ?? 0, height: f.height ?? 0, webPath: f.webPath ?? '' }));
}

/** Reads a picked image as an <img>-ready source: a webPath/object URL on device and web alike. */
async function loadImage(webPath: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = webPath;
  });
}

/**
 * Downscales to `MAX_LONG_SIDE` on the long side and re-encodes as JPEG, plus the `THUMB_LONG_SIDE` grid thumbnail from the
 * same decode: decoding the picked image twice would double peak memory, which is exactly what a phone cannot spare.
 * Returns base64 (without the data: prefix) so it can go straight to the Filesystem plugin, whose Base64 write needs no
 * extra conversion.
 */
export async function compress(webPath: string): Promise<{ data: string; width: number; height: number; thumb: string }> {
  const img = await loadImage(webPath);
  const full = draw(img, MAX_LONG_SIDE, JPEG_QUALITY);
  const thumb = draw(img, THUMB_LONG_SIDE, THUMB_QUALITY);
  return { ...full, thumb: thumb.data };
}

/** Scales the loaded image into a fresh canvas and returns the JPEG bytes as base64. */
function draw(img: HTMLImageElement, max: number, quality: number) {
  const { width, height } = targetSize(img.naturalWidth, img.naturalHeight, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(img, 0, 0, width, height);
  const url = canvas.toDataURL('image/jpeg', quality);
  const comma = url.indexOf(',');
  return { data: url.slice(comma + 1), width, height };
}

/** Writes the compressed image into the app data directory and returns the stored path. */
export async function saveFile(photoId: string, base64: string) {
  const path = fileNameFor(photoId);
  await Filesystem.writeFile({ path, data: base64, directory: Directory.Data, recursive: true });
  return path;
}

/** Writes the grid thumbnail next to the stored photo. */
export async function saveThumb(path: string, base64: string) {
  const thumbPath = thumbPathFor(path);
  await Filesystem.writeFile({ path: thumbPath, data: base64, directory: Directory.Data, recursive: true });
  return thumbPath;
}

/** A source that works in an <img src>: the stored file, converted to a URL the web view can render. */
export async function fileSrc(path: string) {
  if (!isNative) return path;
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });
  // the web view cannot load file:// URLs; Capacitor maps them to its own scheme
  return Capacitor.convertFileSrc(uri);
}

export async function removeFile(path: string) {
  await Filesystem.deleteFile({ path, directory: Directory.Data }).catch(() => {}); // already gone is fine
}

/** True when the file for this photo is actually on this device. */
export async function fileExists(path: string) {
  try {
    await Filesystem.stat({ path, directory: Directory.Data });
    return true;
  } catch {
    return false;
  }
}

/** Rough byte count of a base64 payload, without decoding it. */
export const base64Bytes = (b64: string) => Math.floor((b64.length * 3) / 4);
