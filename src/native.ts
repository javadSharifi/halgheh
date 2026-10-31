import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { liveQuery } from 'dexie';
import { fa, label, today } from './cal';
import { db, exportAll } from './db';
import { buildPlan } from './plan';
import { taskReminders } from './reminders';
import { listTodos } from './todoFilters';
import { importAll } from './db';
import { base64ToBytes, bytesToBase64, makeZip, readZip } from './zip';
import { tx } from './i18n';

export const isNative = Capacitor.isNativePlatform();

// Java plugin (android/.../TodayPlugin.java): system bars, biometric unlock, FLAG_SECURE, and home screen widget.
const Today = registerPlugin<{
  setBars(o: { bg: string; dark: boolean }): Promise<void>;
  biometricAvailable(): Promise<{ ok: boolean }>;
  biometricAuth(): Promise<{ ok: boolean }>;
  setSecure(o: { on: boolean }): Promise<void>;
  syncWidgetData(o: {
    date: string;
    summary: string;
    openCount: number;
    totalCount: number;
    tasks: string[];
  }): Promise<void>;
  getWidgetAction(): Promise<{ quickTask: boolean }>;
}>('Today');

/** Colours the system bars' area like the page, and picks light or dark icons for it. */
export const setBars = (bg: string, dark: boolean) => (isNative ? Today.setBars({ bg, dark }).catch(() => {}) : undefined);

/** Fingerprint / face unlock; both are false on the web and on phones without one enrolled. */
export const biometric = {
  available: () => (isNative ? Today.biometricAvailable().then((r) => r.ok, () => false) : Promise.resolve(false)),
  auth: () => (isNative ? Today.biometricAuth().then((r) => r.ok, () => false) : Promise.resolve(false)),
};
export const setSecure = (on: boolean) => (isNative ? Today.setSecure({ on }).catch(() => {}) : undefined);

export type NativePrefs = { remind: boolean };

export async function askNotifications() {
  return (await LocalNotifications.requestPermissions()).display === 'granted';
}

// shortcut: reminders are fixed at 08:00 and only cover the next 30 days from the last app open; make the hour a setting if it matters
const REMIND_HOUR = 8;
const MAX_TASK_ALARMS = 150; // Android limits alarms per app; the rest are scheduled when the app is opened again

async function push({ remind }: NativePrefs) {
  const plan = await buildPlan();

  const { notifications } = await LocalNotifications.getPending();
  if (notifications.length) await LocalNotifications.cancel({ notifications });
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;

  const now = Date.now();
  const planned = [];
  if (remind) {
    for (const [date, p] of Object.entries(plan)) {
      const at = new Date(`${date}T${String(REMIND_HOUR).padStart(2, '0')}:00:00`);
      // tasks with their own reminder are announced at their own time instead; the rulebook line (from Phase 4) has no
      // reminder of its own and belongs in the digest
      const lines = p.items.filter((i) => !i.r);
      if (!lines.length || at.getTime() <= now) continue;
      planned.push({
        id: Number(date.replaceAll('-', '').slice(2)), // 261021: stable and unique per day
        title: p.title,
        body: lines.map((i) => i.t).join(' · '),
        largeBody: lines.map((i) => i.t).join('\n'),
        at,
      });
    }
    const doneIds = new Set((await db.done.where('date').aboveOrEqual(today()).toArray()).map((d) => d.id));
    for (const r of taskReminders(await db.tasks.toArray(), doneIds, today(), 30, now, MAX_TASK_ALARMS)) {
      planned.push({ id: r.id, title: r.title, body: r.body, largeBody: r.body, at: new Date(r.at) });
    }
  }
  if (!planned.length) return;

  await LocalNotifications.createChannel({ id: 'reminders', name: tx('یادآوری'), importance: 3 });
  await LocalNotifications.schedule({
    notifications: planned.map(({ at, ...n }) => ({
      ...n,
      channelId: 'reminders',
      schedule: { at, allowWhileIdle: true },
      isExactNotification: false, // exact alarms make Android open a settings page; a reminder can be a few minutes late
    })),
  });
}

/** Synchronize current tasks and Persian date to the Android Home Screen Widget */
export async function syncWidget() {
  if (!isNative) return;
  try {
    const t = today();
    const tasks = await db.tasks.toArray();
    const dones = await db.done.toArray();
    const todays = listTodos(tasks, dones, 'today', t);
    const openTasks = todays.filter((r) => !r.done);

    const weekday = label(t, 'persian', 0, { weekday: 'long' });
    const dayMonth = label(t, 'persian', 0, { day: 'numeric', month: 'long' });
    const fullDate = tx('{a1}، {a2}', { a1: weekday, a2: dayMonth });

    let summary = tx('کارهای امروز');
    if (todays.length > 0) {
      if (openTasks.length === 0) {
        summary = tx('همهٔ کارهای امروز انجام شدند!');
      } else {
        summary = tx('{a1} کار باقی‌مانده از {a2} کار', { a1: fa(openTasks.length), a2: fa(todays.length) });
      }
    }

    await Today.syncWidgetData({
      date: fullDate,
      summary,
      openCount: openTasks.length,
      totalCount: todays.length,
      tasks: openTasks.slice(0, 3).map((r) => r.task.title),
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to sync widget:', err);
  }
}

export const getWidgetAction = () =>
  isNative ? Today.getWidgetAction().catch(() => ({ quickTask: false })) : Promise.resolve({ quickTask: false });

/** Keeps reminders and home screen widget in step with the data. Returns the cleanup. */
export function watchNative(prefs: NativePrefs) {
  let timer: ReturnType<typeof setTimeout>;
  const run = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      push(prefs).catch(console.error);
      syncWidget().catch(console.error);
    }, 800);
  };
  const sub = liveQuery(() =>
    Promise.all([db.tasks.toArray(), db.birthdays.toArray(), db.done.where('date').aboveOrEqual(today()).toArray()]),
  ).subscribe({ next: run });
  document.addEventListener('visibilitychange', run); // re-plan on resume so the 30-day window keeps moving
  // Trigger initial widget sync right away
  void syncWidget();
  return () => {
    clearTimeout(timer);
    sub.unsubscribe();
    document.removeEventListener('visibilitychange', run);
  };
}

/** The WebView cannot download blobs, so the backup goes to the share sheet. */
export async function shareBackup() {
  const { uri } = await Filesystem.writeFile({
    path: `halgheh-backup-${today()}.json`,
    data: await exportAll(),
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: tx('پشتیبان حلقه'), url: uri });
}

/**
 * B3: the full backup — rows as JSON plus every photo file — as one ZIP shared through the Android share sheet.
 * Files are named by photo id, not title, so two photos with the same title cannot collide and no non-ASCII name has to
 * survive an unzip tool on the receiving side. A photo whose file is missing on this device is listed in `missing` and
 * reported to the caller instead of failing the whole archive.
 */
export async function shareBackupZip(): Promise<{ photos: number; missing: number; bytes: number }> {
  const [json, photos, files] = await Promise.all([exportAll(), db.photos.toArray(), db.photoFiles.toArray()]);
  const byId = new Map(files.map((f) => [f.photoId, f]));
  const enc = new TextEncoder();
  const entries: { name: string; data: Uint8Array }[] = [{ name: 'halgheh-backup.json', data: enc.encode(json) }];
  let missing = 0;
  for (const p of photos) {
    const f = byId.get(p.id);
    if (!f) {
      missing++;
      continue;
    }
    try {
      const file = await Filesystem.readFile({ path: f.path, directory: Directory.Data });
      const data = typeof file.data === 'string' ? base64ToBytes(file.data) : new Uint8Array(await (file.data as Blob).arrayBuffer());
      entries.push({ name: `photos/${p.id}.jpg`, data });
    } catch {
      missing++;
    }
  }
  const blob = makeZip(entries);
  const bytes = blob.size;
  // base64 is what the Filesystem plugin writes on Android; on the web the same string goes into a download link
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  const base64 = btoa(bin);

  const name = `halgheh-backup-${today()}.zip`;
  if (isNative) {
    const { uri } = await Filesystem.writeFile({ path: name, data: base64, directory: Directory.Cache });
    await Share.share({ title: tx('پشتیبان حلقه'), url: uri });
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return { photos: entries.length - 1, missing, bytes };
}

/** Opens the system share sheet with a ready message (Android app); on the web falls back to the Web Share API or the clipboard. */
/**
 * B3: restores a ZIP backup — the JSON rows plus every photo file. Photo files are written back into the app data
 * directory and their `photoFiles` rows rebuilt, so a restored phone shows thumbnails again without the server.
 * Rows are merged (never replaced) by the existing `importAll`.
 */
export async function restoreBackupZip(file: File): Promise<{ rows: boolean; photos: number }> {
  const zip = readZip(new Uint8Array(await file.arrayBuffer()));
  const json = zip.find((e) => e.name === 'halgheh-backup.json');
  if (!json) throw new Error('no backup json in archive');
  await importAll(new TextDecoder().decode(json.data));

  let photos = 0;
  for (const e of zip) {
    if (!e.name.startsWith('photos/')) continue;
    const id = e.name.slice('photos/'.length).replace(/\.jpg$/, '');
    if (!id) continue;
    const path = `photos/${id}.jpg`;
    await Filesystem.writeFile({ path, data: bytesToBase64(e.data), directory: Directory.Data, recursive: true });
    await db.photoFiles.put({ photoId: id, path, uploadState: 'local', updatedAt: Date.now() });
    photos++;
  }
  return { rows: true, photos };
}

export async function shareText(text: string) {
  if (isNative) return void (await Share.share({ text }));
  if (navigator.share) return void (await navigator.share({ text }).catch(() => {})); // closing the sheet rejects: not an error
  await navigator.clipboard?.writeText(text).catch(() => {}); // refused when the page is not focused: nothing to do
}
