import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { liveQuery } from 'dexie';
import { type Cal, today } from './cal';
import { db, del, exportAll, put } from './db';
import { noteNotifId } from './notes';
import { buildPlan } from './plan';
import { taskReminders } from './reminders';
import { snippet } from './search';

export const isNative = Capacitor.isNativePlatform();

// Java plugin (android/.../TodayPlugin.java): stores the plan, redraws the widget and the ongoing notification.
const Today = registerPlugin<{
  set(o: { days: string; ongoing: boolean }): Promise<void>;
  setBars(o: { bg: string; dark: boolean }): Promise<void>;
  biometricAvailable(): Promise<{ ok: boolean }>;
  biometricAuth(): Promise<{ ok: boolean }>;
  setSecure(o: { on: boolean }): Promise<void>;
  takeToggles(): Promise<{ toggles: { id: string; date: string; d: 0 | 1; at?: number }[] }>;
}>('Today');

/** Colours the system bars' area like the page, and picks light or dark icons for it. */
export const setBars = (bg: string, dark: boolean) => (isNative ? Today.setBars({ bg, dark }).catch(() => {}) : undefined);

/** Fingerprint / face unlock; both are false on the web and on phones without one enrolled. */
export const biometric = {
  available: () => (isNative ? Today.biometricAvailable().then((r) => r.ok, () => false) : Promise.resolve(false)),
  auth: () => (isNative ? Today.biometricAuth().then((r) => r.ok, () => false) : Promise.resolve(false)),
};
export const setSecure = (on: boolean) => (isNative ? Today.setSecure({ on }).catch(() => {}) : undefined);

/** Ticks made on the widget while the app was closed are queued natively; write them into the db. */
async function applyToggles() {
  const { toggles } = await Today.takeToggles();
  for (const { id, date, d, at } of toggles) {
    if (d) await put('done', { id: `${id}|${date}`, taskId: id, date, updatedAt: Date.now(), doneAt: at ?? Date.now() }); // `at` = the moment of the tap on the widget
    else await del('done', `${id}|${date}`);
  }
}

export type NativePrefs = { cal: Cal; aux: Cal[]; off: number; ongoing: boolean; remind: boolean };

export async function askNotifications() {
  return (await LocalNotifications.requestPermissions()).display === 'granted';
}

// shortcut: reminders are fixed at 08:00 and only cover the next 30 days from the last app open; make the hour a setting if it matters
const REMIND_HOUR = 8;
const MAX_TASK_ALARMS = 150; // Android limits alarms per app; the rest are scheduled when the app is opened again

async function push({ cal, aux, off, ongoing, remind }: NativePrefs) {
  await applyToggles(); // before set(): set() replaces the plan the queued ticks were applied to
  const plan = await buildPlan(cal, off, aux);
  await Today.set({ days: JSON.stringify(plan), ongoing });

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
  // a note's own reminder is exact in intent and independent of the daily-reminder switch
  for (const n of await db.notes.toArray()) {
    if (n.remindAt && n.remindAt > now) planned.push({ id: noteNotifId(n.id), title: n.title || 'یادداشت', body: snippet(n.text, '', 80) || 'یادآور یادداشت', largeBody: n.text, at: new Date(n.remindAt) });
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

/** Keeps the widget, notification and reminders in step with the data. Returns the cleanup. */
export function watchNative(prefs: NativePrefs) {
  let timer: ReturnType<typeof setTimeout>;
  const run = () => {
    clearTimeout(timer);
    timer = setTimeout(() => push(prefs).catch(console.error), 800);
  };
  const sub = liveQuery(() =>
    Promise.all([db.tasks.toArray(), db.birthdays.toArray(), db.done.where('date').aboveOrEqual(today()).toArray()]),
  ).subscribe({ next: run });
  let seen = '';
  const notesSub = liveQuery(async () => JSON.stringify((await db.notes.toArray()).filter((n) => n.remindAt).map((n) => [n.id, n.remindAt, n.title, n.text.slice(0, 80)]))).subscribe({
    next: (sig) => {
      if (sig !== seen) {
        seen = sig;
        run();
      }
    },
  });
  document.addEventListener('visibilitychange', run); // re-plan on resume so the 30-day window keeps moving
  return () => {
    clearTimeout(timer);
    sub.unsubscribe();
    notesSub.unsubscribe();
    document.removeEventListener('visibilitychange', run);
  };
}

/** The WebView cannot download blobs, so the backup goes to the share sheet. */
export async function shareBackup() {
  const { uri } = await Filesystem.writeFile({
    path: `date-backup-${today()}.json`,
    data: await exportAll(),
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: 'پشتیبان تقویم', url: uri });
}

/** Opens the system share sheet with a ready message (Android app); on the web falls back to the Web Share API or the clipboard. */
export async function shareText(text: string) {
  if (isNative) return void (await Share.share({ text }));
  if (navigator.share) return void (await navigator.share({ text }).catch(() => {})); // closing the sheet rejects: not an error
  await navigator.clipboard?.writeText(text).catch(() => {}); // refused when the page is not focused: nothing to do
}
