import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { liveQuery } from 'dexie';
import { today } from './cal';
import { db, exportAll } from './db';
import { buildPlan } from './plan';
import { taskReminders } from './reminders';

export const isNative = Capacitor.isNativePlatform();

// Java plugin (android/.../TodayPlugin.java): system bars, biometric unlock and FLAG_SECURE.
const Today = registerPlugin<{
  setBars(o: { bg: string; dark: boolean }): Promise<void>;
  biometricAvailable(): Promise<{ ok: boolean }>;
  biometricAuth(): Promise<{ ok: boolean }>;
  setSecure(o: { on: boolean }): Promise<void>;
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
      const lines = p.items.filter((i) => !i.r); // tasks with their own reminder are announced at their own time instead
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

  await LocalNotifications.createChannel({ id: 'reminders', name: 'یادآوری', importance: 3 });
  await LocalNotifications.schedule({
    notifications: planned.map(({ at, ...n }) => ({
      ...n,
      channelId: 'reminders',
      schedule: { at, allowWhileIdle: true },
      isExactNotification: false, // exact alarms make Android open a settings page; a reminder can be a few minutes late
    })),
  });
}

/** Keeps reminders in step with the data. Returns the cleanup. */
export function watchNative(prefs: NativePrefs) {
  let timer: ReturnType<typeof setTimeout>;
  const run = () => {
    clearTimeout(timer);
    timer = setTimeout(() => push(prefs).catch(console.error), 800);
  };
  const sub = liveQuery(() =>
    Promise.all([db.tasks.toArray(), db.birthdays.toArray(), db.done.where('date').aboveOrEqual(today()).toArray()]),
  ).subscribe({ next: run });
  document.addEventListener('visibilitychange', run); // re-plan on resume so the 30-day window keeps moving
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
  await Share.share({ title: 'پشتیبان حلقه', url: uri });
}

/** Opens the system share sheet with a ready message (Android app); on the web falls back to the Web Share API or the clipboard. */
export async function shareText(text: string) {
  if (isNative) return void (await Share.share({ text }));
  if (navigator.share) return void (await navigator.share({ text }).catch(() => {})); // closing the sheet rejects: not an error
  await navigator.clipboard?.writeText(text).catch(() => {}); // refused when the page is not focused: nothing to do
}
