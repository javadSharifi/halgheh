import { useEffect, useState } from 'react';

/** App lock: a 4-digit PIN kept only on this phone (salted and stretched, never the PIN itself). Not synced, not in backups. */
export const PIN_LEN = 4;
export const AWAY_MS = 30_000; // coming back sooner than this does not ask again
const KEY = 'lock';
const EVENT = 'lockchange';

export type Lock = { salt: string; hash: string; bio: boolean };

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function derive(pin: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100_000 }, key, 256));
}

export function getLock(): Lock | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return v && typeof v.salt === 'string' && typeof v.hash === 'string' ? { salt: v.salt, hash: v.hash, bio: v.bio === true } : null;
  } catch {
    return null;
  }
}
const save = (l: Lock | null) => {
  if (l) localStorage.setItem(KEY, JSON.stringify(l));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
};

export async function setPin(pin: string, bio: boolean) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  save({ salt, hash: await derive(pin, salt), bio });
}
export async function checkPin(pin: string) {
  const l = getLock();
  return !!l && (await derive(pin, l.salt)) === l.hash;
}
export const setBio = (bio: boolean) => {
  const l = getLock();
  if (l) save({ ...l, bio });
};
export const clearLock = () => save(null);

export function useLock() {
  const [l, setL] = useState(getLock);
  useEffect(() => {
    const on = () => setL(getLock());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return l;
}
