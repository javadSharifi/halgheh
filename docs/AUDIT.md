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

- **Todos have a real screen (T1).** `Todos.tsx` replaces the interim `Lists.tsx` (deleted, with `RecurringForm.tsx`), with five filters and counts; `todoFilters.ts` holds the pure filter logic. The editor is a sheet (`TodoForm.tsx`), not a page, and adds «چه کسی خواسته», a dateless option and reminder snooze. The dateless case the spec flagged as open is handled: `taskOn` never matches a dateless task, so it never gets scheduled, and its time/reminder fields are cleared on save.
- **Relationships exist (R3).** Schema v9 adds `relationships` with a unique compound key so a symmetric link is stored once; `introduced` stays directional and is not walked by the BFS. `findPaths` (depth 3, cycle-safe, closeness/name tie-breaks, `maybe` marking) is in place for R4 but no screen calls it yet.
- **Ratings exist (R2).** Schema v8 adds `ratings` (append-only events, six fixed criteria). In `TABLES` and the Worker allowlist; the deployed Worker was checked to sync the table. The profile shows the six criteria separately and never merges them into one number.
- **Skills exist (R1).** Schema v7 adds `skills` and `personSkills`; both are in `TABLES` and the Worker allowlist, and the deployed Worker was checked to round-trip both tables. Staleness is a pure function with `STALE_MONTHS = 12`; a skill that was never verified counts as stale. Skills are not yet part of search or ranking — that is P5's index (add skills there) and R4's ordering.
- **Today is a dashboard (T3).** The home page shows today's and overdue todos, interaction follow-ups that have come due, birthdays within seven days, the newest people, and a search field, instead of the old calendar-style day picker.
- **Todos link to people (T2).** A todo carries `fromPersonId`; lists show who asked and the profile has a «کارهایی که گفته» section that can tick, edit and add. Dateless todos are filed under a sentinel done-date so ticking stays stable across days.
- **Section 6 ranking exists (R4).** `whoCanEngine.ts` implements the exact priority order (specialists → evidence → trustworthiness → recency) with no combined score; `WhoCan.tsx` shows specialists, a separate «از طریق معرفی» section with full BFS paths, and «بقیه». The general search screen still orders by kind — the ranked answer has its own screen, which is what the spec asks for.
- **Search is section 6's matching, and now its ranking too, on the WhoCan screen.** P5 rebuilt it: `src/domain/search/index.ts` is pure (no UI, no Dexie) and implements word-by-word AND across people, notes, interactions, todos, birthdays and tags, with phones folded so `+98` and `09` match. The old `normalize`/`findMatch`/recents in `search.ts` are kept and `searchAll` still exists for its tests. **Not done:** skill-first ranking, evidence/trust/recency ordering, the introducers section and referral paths — those need R1/R2/R3 and are listed in R4. Photos and skills are not searched because their tables do not exist yet (G1/R1).
- **People have list, profile, notes, interactions and tags.** P1 added `people`, `tags`, `personNotes`, `interactions` and `birthdays.personId`, plus the single `isSelf` row. P2 added quick add, name/newest sorting, archive/restore and confirmed delete. P3 added the single-page profile (`PersonPage.tsx`), the text editor sheet (`PersonEditor.tsx`), a shared three-calendar birthday form (`BirthdayFields.tsx`), the per-person note (`NoteBox.tsx`), the interaction timeline and editor (`InteractionForm.tsx`), and tags (`TagEditor.tsx`). Schema v6 adds `personTags`, which P1 named in the spec but never created, and the Worker allowlist now carries it. Skills, ratings, relationships, person todos and photos still do not exist (R1/R2/R3/T2/G2).
- **Photos exist locally (G1/G2).** Schema v10 adds `photos` (synced metadata) and `photoFiles` (device-local, never synced). The system photo picker needs no permission and the manifest declares no camera/storage permission; debug APK builds. Downscale to 1600 px / JPEG 0.8, stored in the app data directory, cap 300 with a warning at 250. **Not done:** uploading files to the server (B2b) and photos in the ZIP backup (B3).
- **Contacts import works (P4), with one manifest caveat.** `@capacitor-community/contacts@8.0.0` (peer `@capacitor/core >=8`, published 2026-07-21, official capacitor-community repo) is installed and registered in the Android build. The app must declare both `READ_CONTACTS` and `WRITE_CONTACTS`, because the plugin puts them under one permission alias and Capacitor treats an alias as granted only when all of its permissions are granted; the app never writes contacts. Debug APK builds and the merged manifest/APK both carry the two permissions. The import flow itself (real address book on a device) still needs a phone/emulator check.
- **Release pipeline is correct (X1).** A tag builds a signed APK and publishes it, but only after `apksigner` confirms the signature — an unsigned build fails the run instead of shipping. `versionCode` is derived from the semver tag on both CI and local builds. `scripts/jdk.mjs` finds a JDK 21 on any machine rather than hardcoding Homebrew; `pnpm android:release` was run end to end and produced a signed `release/halgheh.apk` (`CN=Halgheh`, versionCode 10000). Friend-facing install and privacy notes are in `docs/INSTALL.md`.
- **App lock verified in the renamed app (B5).** No code changes: PIN is salted PBKDF2 with a random per-install salt, never stored, logged, synced or backed up; five failures wait 30 s; the screen is covered on cold start and after 30 s away; `FLAG_SECURE` is set through the `Today` plugin and the back button cannot dismiss it. The Java package, `applicationId` and plugin registration all match the new app id. Biometric unlock and the real screenshot block still need a physical-phone check.
- **Server hardened where it mattered (B4).** Isolation verified by attack on the live Worker (cross-account rows and photo ids denied), no logging of personal data, and two real holes fixed: unbounded request bodies on the JSON routes, and a far-future `updatedAt` that could make a row permanently un-editable. CORS stays `*` on purpose — bearer-key auth with no cookies makes it a non-issue.
- **Backup is complete (B3).** Settings can export rows-only JSON or a full ZIP (`halgheh-backup.json` + `photos/<id>.jpg`), and the restore control reads both. The ZIP is written and read by a small store-only implementation in `zip.ts`, validated against the system `unzip` (structure and extraction) and by a write→read round-trip test. Photo file names are ids, so no non-ASCII name has to survive a third-party unzip tool.
- **Photo upload works, on D1 until R2 is enabled (B2b).** Routes for upload/download/list are authorized by the same key, keep per-account isolation, cap size/count and are rate limited. Storage is R2 when the binding exists, otherwise D1 chunks — because R2 can only be switched on from the Cloudflare dashboard. Verified live on the D1 path: byte-identical round-trip, no duplicate on re-upload, 900 kB in 25 chunks, correct `413`/`400` rejections. R2 stays the better home: D1 uploads of a large photo take a few seconds.
- **Sync policy is documented and unchanged (B2a).** `docs/SYNC.md` states last-write-wins on the client clock and that a wrong clock can let an old edit win; `src/sync.ts` has not been modified since the fork. Verified on the deployed Worker that a newer row survives an older push, and that all 13 tables round-trip.
- **Rate limiting is in place (B1).** Register 5/hour/IP, login 20/10 min/IP, sync 240/hour/IP+account; `429` with `retryAfter`, verified against the deployed Worker. Remaining hardening (scoped CORS, request-size caps, invites) is B4.
- **The 8-character password rule is client-side only and cannot be otherwise.** The server sees a PBKDF2-derived key of fixed length, never the password.
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
4. **App shell** now has the five Z1 destinations (Today, People, +, Gallery, More); People is functional after P2 and a row opens the P3 profile (a full-screen page, no tab bar, back returns to People), Gallery remains an empty state until G1, and settings/account/archive/about live under More. Every new page must be registered in `__appBack`.
5. **Keystore** is the single long-term signing identity. Losing it blocks updates to installed apps. Back up `~/.config/halgheh/` in two places.
6. **Device behavior** (biometric prompt, notification permission/delivery, share sheet) still needs a physical-phone check before release; the shell itself was smoke-tested on an API 34 emulator.
