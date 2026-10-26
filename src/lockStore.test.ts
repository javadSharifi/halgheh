import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkPin, clearLock, getLock, setBio, setPin } from './lockStore';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
vi.stubGlobal('window', { dispatchEvent: () => true });

describe('app lock', () => {
  beforeEach(() => store.clear());
  it('accepts the PIN it was given and nothing else', async () => {
    await setPin('1234', true);
    expect(await checkPin('1234')).toBe(true);
    expect(await checkPin('1235')).toBe(false);
  });
  it('never stores the PIN', async () => {
    await setPin('4321', false);
    expect(localStorage.getItem('lock')).not.toContain('4321');
    expect(getLock()?.bio).toBe(false);
  });
  it('keeps the fingerprint choice, and clears everything', async () => {
    await setPin('1111', false);
    setBio(true);
    expect(getLock()?.bio).toBe(true);
    clearLock();
    expect(getLock()).toBeNull();
    expect(await checkPin('1111')).toBe(false);
  });
});
