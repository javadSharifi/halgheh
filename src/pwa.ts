import { useEffect, useState, useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { isNative } from './native';

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.0';

export type PwaCheckStatus = 'idle' | 'checking' | 'available' | 'upToDate' | 'offline' | 'unsupported' | 'error';

export type PwaState = {
  supported: boolean;
  needRefresh: boolean;
  dismissed: boolean;
  offlineReady: boolean;
  checking: boolean;
  updating: boolean;
  status: PwaCheckStatus;
  lastCheckedAt: number | null;
};

const AUTO_CHECK_THROTTLE_MS = 60_000;
const PERIODIC_CHECK_MS = 30 * 60_000;
const INSTALLING_WAIT_MS = 15_000;

const canUseSw = () => !isNative && typeof window !== 'undefined' && 'serviceWorker' in navigator;

let state: PwaState = {
  supported: canUseSw(),
  needRefresh: false,
  dismissed: false,
  offlineReady: false,
  checking: false,
  updating: false,
  status: canUseSw() ? 'idle' : 'unsupported',
  lastCheckedAt: null,
};

const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const setState = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch };
  emit();
};

export const getPwaState = () => state;
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const usePwaUpdate = () => useSyncExternalStore(subscribe, getPwaState);

let initialized = false;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let swRegistration: ServiceWorkerRegistration | undefined;
let swScriptUrl = '/sw.js';
let inflightCheck: Promise<boolean> | null = null;

function markAvailable() {
  setState({
    needRefresh: true,
    dismissed: false,
    checking: false,
    status: 'available',
  });
}

function watchInstalling(worker: ServiceWorker | null | undefined): Promise<void> {
  if (!worker) return Promise.resolve();
  if (worker.state === 'installed' || worker.state === 'redundant' || worker.state === 'activated') {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) markAvailable();
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => {
      worker.removeEventListener('statechange', onState);
      resolve();
    }, INSTALLING_WAIT_MS);
    const onState = () => {
      if (worker.state === 'installed' || worker.state === 'redundant' || worker.state === 'activated') {
        window.clearTimeout(timer);
        worker.removeEventListener('statechange', onState);
        if (worker.state === 'installed' && navigator.serviceWorker.controller) markAvailable();
        resolve();
      }
    };
    worker.addEventListener('statechange', onState);
  });
}

function attachRegistrationWatchers(reg: ServiceWorkerRegistration) {
  swRegistration = reg;
  if (reg.waiting) markAvailable();
  if (reg.installing) void watchInstalling(reg.installing);
  reg.addEventListener('updatefound', () => {
    void watchInstalling(reg.installing);
  });
}

async function resolveRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (swRegistration) return swRegistration;
  if (!canUseSw()) return undefined;
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) {
    attachRegistrationWatchers(existing);
    return existing;
  }
  const ready = await Promise.race([
    navigator.serviceWorker.ready.then((r) => r),
    new Promise<undefined>((resolve) => window.setTimeout(() => resolve(undefined), 3_000)),
  ]);
  if (ready) attachRegistrationWatchers(ready);
  return ready;
}

/** Checks the server for a newer service worker, bypassing HTTP cache on sw.js. */
export async function checkForUpdate(opts?: { silent?: boolean }): Promise<boolean> {
  if (!canUseSw()) {
    if (!opts?.silent) setState({ supported: false, checking: false, status: 'unsupported' });
    return false;
  }
  if (!navigator.onLine) {
    if (!opts?.silent) setState({ checking: false, status: 'offline' });
    return false;
  }
  if (inflightCheck) return inflightCheck;

  inflightCheck = (async () => {
    setState({ checking: true, ...(opts?.silent ? {} : { status: 'checking' as const }) });
    try {
      const reg = await resolveRegistration();
      if (!reg) {
        if (!opts?.silent) setState({ checking: false, status: 'error' });
        else setState({ checking: false });
        return false;
      }

      if (reg.waiting) {
        markAvailable();
        setState({ lastCheckedAt: Date.now() });
        return true;
      }

      // Bust HTTP caches on the service worker script before asking the browser to diff it.
      const res = await fetch(swScriptUrl, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
      });
      if (res.ok) await reg.update();

      if (reg.installing) await watchInstalling(reg.installing);

      const now = Date.now();
      if (reg.waiting || state.needRefresh) {
        setState({
          needRefresh: true,
          dismissed: false,
          checking: false,
          status: 'available',
          lastCheckedAt: now,
        });
        return true;
      }

      setState({
        checking: false,
        status: 'upToDate',
        lastCheckedAt: now,
      });
      return false;
    } catch {
      setState({
        checking: false,
        ...(opts?.silent ? {} : { status: navigator.onLine ? 'error' : 'offline' }),
      });
      return false;
    } finally {
      inflightCheck = null;
    }
  })();

  return inflightCheck;
}

/** Activates the waiting service worker and reloads into the updated build. */
export async function applyUpdate(): Promise<void> {
  if (!canUseSw() || state.updating) return;
  setState({ updating: true });

  let reloaded = false;
  const reloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', reloadOnce, { once: true });

  try {
    await updateSW?.(true);
    const reg = swRegistration ?? (await navigator.serviceWorker.getRegistration());
    if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  } catch {
    // Fall through to safety reload below.
  }

  window.setTimeout(reloadOnce, 1_500);
}

export function dismissUpdatePrompt() {
  setState({ dismissed: true });
}

export function dismissOfflineReady() {
  setState({ offlineReady: false });
}

/** Initializes service worker registration and update watchers once on web builds. */
export function initPwa() {
  if (initialized || !canUseSw()) return;
  initialized = true;

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      markAvailable();
    },
    onOfflineReady() {
      setState({ offlineReady: true });
    },
    onRegisteredSW(swUrl, reg) {
      if (swUrl) swScriptUrl = swUrl;
      if (reg) attachRegistrationWatchers(reg);
      void checkForUpdate({ silent: true });
    },
    onRegisterError() {
      setState({ status: 'error', checking: false });
    },
  });

  const maybeCheck = () => {
    const last = state.lastCheckedAt ?? 0;
    if (Date.now() - last >= AUTO_CHECK_THROTTLE_MS) void checkForUpdate({ silent: true });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') maybeCheck();
  });
  window.addEventListener('focus', maybeCheck);
  window.addEventListener('online', () => void checkForUpdate({ silent: true }));
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void checkForUpdate({ silent: true });
  }, PERIODIC_CHECK_MS);

  // If a lazy route chunk vanished on the server after a new deploy, check immediately and surface the update prompt.
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    if (state.needRefresh) {
      setState({ dismissed: false });
    } else {
      void checkForUpdate({ silent: true });
    }
  });
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** Tracks browser PWA installability and standalone status (web only). */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });
  const [isIOS] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
  });

  useEffect(() => {
    if (isNative) return;
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !isNative && !!deferredPrompt,
    isInstalled,
    isIOS: !isNative && isIOS,
    install,
  };
}
