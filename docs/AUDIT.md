# Z0 audit — Halgheh fork

Date: 2026-10-26
Source: `/Users/paliz/Desktop/ksh/untitled folder/rooznegar` (HEAD `7f12200`, remote `javadSharifi/rooznegar`)
Fork: `/Users/paliz/Desktop/ksh/untitled folder/halgheh`
Scope: audit and fork only. No people/network feature code was added.

## What this app is now

The fork is a working, buildable **Android-first Capacitor shell** for Halgheh. It currently keeps the small useful core of Rooznegar — one-off todos, completion, birthdays, optional sync, lock and local notifications — and removes the calendar-app surface that Halgheh does not need. The people/tags/skills/relationships model is intentionally **not** built yet; that starts at P1.

- App id: `com.javadsharifi.halgheh`
- App name / label: `حلقه`
- Dexie database: `halgheh`
- APK: `release/halgheh.apk`
- Worker: `https://halgheh.mohammadjavadsharifi98.workers.dev`
- D1: `halgheh`, id `bde97c8a-c256-4eb7-b83e-58a0e0784786`

## What actually works

| Area | State | Evidence |
|---|---|---|
| Web build | Works | `pnpm build` → 63 modules, PWA generated |
| Tests | Pass | `pnpm test` → 6 files / 36 tests |
| TypeScript | Clean | `pnpm exec tsc --noEmit` |
| Android debug APK | Builds | `./gradlew assembleDebug` → `app-debug.apk` |
| Android release APK | Builds and is signed | `./gradlew assembleRelease`; `apksigner verify` shows `CN=Halgheh`; `aapt2` shows package `com.javadsharifi.halgheh` |
| D1 migration | Applied | `0001_init.sql` on remote `halgheh` |
| Worker | Deployed | version `94bf468a-a283-45db-a670-a67f8486259e` |
| Sync smoke test | Passes | `node scripts/smoke-sync.mjs https://halgheh.mohammadjavadsharifi98.workers.dev` |
| One-off todos | Code + local DB | create/edit/delete, complete per date, before-reminders, time, pause |
| Birthdays | Code + local DB | 3-calendar entry, next birthday, call/SMS, search |
| Search | Code | Persian normalization, tasks + birthdays, recent searches |
| App lock | Code | 4-digit salted PBKDF2 PIN, fingerprint plugin, re-lock after 30 s, secure flag |
| Backup | Code | JSON export/import, Android share sheet, web download |
| Optional sync | Code + deployed server | register/login, merge, last-write-wins, tombstone, pull clock |
| Local notifications | Code | next 30 days, 08:00 digest, task reminders, non-exact |
| Android emulator | Smoke-tested | `Pixel_6_API_34`, release APK installed; Today/Settings/Birthdays/Tasks/task form/search render RTL; created, completed and persisted a one-off task; back from Tasks returned Today; no crash in logcat |
| RTL / theme / font | Code | Vazirmatn, theme tokens, system bars |

## What is only partly done or not covered

- **Search is not section 6 yet.** It is a single normalized substring match over task title/description and birthday name. Word-by-word AND, skill-first ranking, evidence/trust/recency ordering, introducers and referral paths are later tasks.
- **People model is data-only.** P1 added `people`, `tags`, `personNotes`, `interactions` and `birthdays.personId`, plus the single `isSelf` row. There is no people list, profile, note/interaction editor or linking UI yet (P2/P3). Skills, person-tags, ratings, relationships and photos still do not exist.
- **Photos are not covered.** No picker, storage, upload or backup. `photos` will be metadata-only in Dexie; files stay local/remote object storage later.
- **Sync is plaintext on the server.** The Worker stores row JSON as sent. The UI says so and says a forgotten password cannot be recovered. There is no password reset, email verification, invite check, login/register rate limit, or CORS restriction.
- **Clock trust.** Last-write-wins uses the client `updatedAt`; a wrong phone clock can win a conflict. Accepted for now.
- **Reminders only re-plan while the app is open/resumed.** The old boot receiver and widget/ongoing-notification path are gone. If the app is not opened for ~30 days, reminders beyond the scheduled window are not created. This is existing behavior, now documented.
- **Emulator-only smoke test; not tested on a physical phone.** The release APK was installed and exercised on `Pixel_6_API_34` (Today, Settings, Birthdays, Tasks, task form, search, add/complete task, back). Notification delivery, biometric prompt and the share sheet were not exercised.
- **CI is not exercised.** The GitHub Actions workflow is renamed and fails closed when signing secrets are missing, but it has not been run. Hardcoded macOS Java/SDK paths in `package.json` scripts are a Z0 carry-over; X1 must make the build portable/CI-ready.
- **Old Rooznegar data is not migrated** — the new Dexie name is deliberate. A user of the old app does not see old rows in Halgheh.

## Files reused

- `src/db.ts` — Dexie, `put`/`del`, outbox, JSON export/import, schema history.
- `src/sync.ts`, `src/SyncPage.tsx`, `src/online.ts` — optional server sync.
- `src/cal.ts`, `src/format.ts`, `src/DatePicker.tsx` — Jalali/Gregorian/Hijri conversion, one-off dates, Persian formatting.
- `src/search.ts` — normalization core.
- `src/reminders.ts`, notification scheduling in `src/native.ts` — tasks and daily digest.
- `src/lockStore.ts`, `src/Lock.tsx`, `TodayPlugin.java` — PIN/biometric/secure screen.
- `src/TodayPage.tsx`, `src/SettingsPage.tsx`, `src/BirthdaysPage.tsx`, `src/Lists.tsx`, `src/RecurringForm.tsx` — trimmed screens.
- `src/Icon.tsx`, `confirm.tsx`, `ErrorBoundary.tsx`, `theme.ts`, styles — app shell.
- Android Capacitor shell, FileProvider, FileSystem/Share/LocalNotifications plugins, Gradle build.

## Deleted from the new repo

- Pages/features: `CalendarPage`, `DayPage`, `Tools`, `EventList`, occasions (`events.ts`, `events.json`), date-span utility, onboarding, daily notes (`NoteEditor`, `notes.ts`, tests), auxiliary-calendar and Hijri-offset UI.
- Weekly-recurring task UI: the data model/tests remain, but the form creates one-off todos only.
- Android: `Today.java` widgets, `TodayWidget`/`TodaySmallWidget`/`TodayMiniWidget`, `TodayAction`, `TodayReceiver`, widget layouts/xml/drawables, boot/time/date receivers, widget metadata, ongoing notification, exact-alarm removal marker.
- The five-tap hidden-sync gesture; sync is a visible Settings row.
- Old Rooznegar README, screenshots, event data/crawler.

## Security and secrets check

- `git ls-files` contains **no** keystore, `.jks`, `.p12`, `keystore.properties`, `.env` or credential file.
- `android/keystore.properties` exists only locally and is ignored; it points at `~/.config/halgheh/release.keystore`.
- The new release keystore and passwords are outside the repo: `~/.config/halgheh/` (mode 600). See `docs/KEYSTORE.md`.
- The Worker stores only `SHA-256(Bearer key)`, never the password or PBKDF2 key.
- Server CORS is still `*`; there is no rate limit or invite gate. Do not treat the current server as hardened for public use (B4).

## Conflict and ruling

Section 2 says Jalali is primary while Gregorian and Hijri remain available; P3/T1 use three calendars, but section 2c says leave Hijri and auxiliary calendars behind. **Ruling:** keep the Hijri conversion code and the three-calendar tabs in birthday/todo forms, but fix the app's main calendar to Jalali and remove the Hijri-offset setting, auxiliary-calendar display and aux settings. This gives P3/T1 the conversion they need without carrying the old calendar UI. Cost if wrong: one small UI/date-code restoration later.

## Risks for the next tasks

1. **P1 migration** must add tables in a new Dexie version; never edit versions 1–4. Add each table to `TABLES` and the Worker allowlist.
2. **Photos** need a picker plugin and a separate file pipeline; do not assume `exportAll` covers them.
3. **Worker hardening** (B4) must add rate limiting, scoped CORS, request limits and possibly invites. Current smoke test proves behavior, not production safety.
4. **App shell** now has the five Z1 destinations (Today, People, +, Gallery, More); People and Gallery are empty states until P2/G1, and settings/account/archive/about live under More. Every new page must be registered in `__appBack`.
5. **Keystore** is the single long-term signing identity. Losing it blocks updates to installed apps. Back up `~/.config/halgheh/` in two places.
6. **Device behavior** (biometric prompt, notification permission/delivery, share sheet) still needs a physical-phone check before release; the shell itself was smoke-tested on an API 34 emulator.
