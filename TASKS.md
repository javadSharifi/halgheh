# حلقه (Halgheh) — People Network app — MVP spec and task list

Working name: **حلقه** ("circle"). Suggested app id: `com.javadsharifi.halgheh`, APK file: `halgheh.apk`. Both are easy to change in Z0 before anything is published.

Android-only, offline-first, Persian/RTL personal network app. It lives in a **new repository**, started as a copy of the rooznegar codebase (Capacitor, React, Dexie, Cloudflare Worker + D1). The rooznegar repo itself is never modified.

How to use: copy this file into the new repo as `TASKS.md`, then send one message per task: "Read TASKS.md and do Z0". Order matters only where "Needs" is listed (suggested order is in section 9). After each task: `tsc`, build, and a manual check on the emulator or phone. Report what actually ran and what you saw. Do not claim something works if you did not run it.

---

## 1. Product in one paragraph

A private notebook of the people I know. For each person: who they are, what they can do, what evidence I have, how I personally rate them, who knows whom, and what happened when we dealt with each other. The app answers "who do I know who can do X?" and "who can introduce me to someone who can?". It also keeps a list of favours/tasks people asked of me so I do not forget them, and a photo gallery (business cards, "went to the doctor" papers, etc.). It does not use AI.

## 2. Locked decisions

- Android only, via Capacitor. Web later (keep UI code free of Android-only assumptions where it costs nothing).
- Persian UI only, RTL. All user-facing strings in one place so other languages can be added later. Jalali is the main calendar; Gregorian and Hijri stay available (reuse rooznegar's date code).
- Local data in IndexedDB (Dexie). The app is fully usable without internet and without an account.
- Every install starts empty. One user per install. No multi-account on a device.
- Login = email + password only. No email verification. **No password reset in the MVP** (a forgotten password means the cloud backup is unrecoverable; the app says so at registration). Purpose: cloud backup and restore on a new phone. Login is optional; the app works fully without it.
- No local encryption. Server stores data unencrypted. The login screen must say so in plain Persian.
- No automated tests for now. Keep pure logic (search normalization, ranking, referral paths) in separate files with no UI imports, so tests can be added later without refactoring.
- Distribution: APK via GitHub Releases to friends. Not on Google Play.
- No AI, no analytics, no third-party SDKs that see personal data.

## 2b. What the existing `src/` already does (read from the real code)

Source: `src.zip` of rooznegar (35 files, flat `src/`). The `android/` and `worker/` folders were **not** read; Z0 must read them and extend this section. Where the real code disagrees with the rest of this file, the real code wins and this file gets corrected.

- **Navigation:** no router. `App.tsx` switches a `page` state; six tabs in a `NAV` array. The Android back button calls `window.__appBack`, which finds DOM elements by CSS selector. Every new page must be added to that handler or back will exit the app.
- **Database (`db.ts`):** Dexie database named `date-app`. Tables: `notes`, `tasks`, `done`, `birthdays`, `outbox`. Every synced row has a string `id` and a numeric `updatedAt` (epoch ms). All user writes go through `put(table, row)` and `del(table, id)`, which also write the sync outbox. Delete is a **hard delete plus a tombstone in the outbox** (there is no `deletedAt` and no trash). New tables must be added to `TABLES` in `db.ts` and to the Worker's allowed table list.
- **Sync (`sync.ts`):** generic and small. Each row is sent as a JSON string; the server keeps a monotonic `clock` used as a pull cursor. Conflicts: the row with the larger **client** `updatedAt` wins (a wrong phone clock can make an old edit win; accepted as is). Login = email + password; the client derives a 32-byte key with PBKDF2 (200k iterations, salt `rooznegar|email`) and sends it as a Bearer token; the key is kept in `localStorage`. Consequences: password reset and password change are impossible by design; the same email+password gives the same key. On `connect`, local rows are merged with the cloud copy (not replaced). Sync runs only while the app is open. **Photos/files are not covered at all.**
- **Search (`search.ts`):** Persian normalization already exists (`ي→ی`, `ك→ک`, ZWNJ and diacritics dropped, digits to Latin, with an index map for highlighting). Matching is a single substring match per field, not word-by-word. Recent searches and last-search state live in `localStorage`.
- **Tasks and reminders:** `Task` is weekly-recurring (`mask` = weekdays) or **one-off** (`mask: 0`, `on` = date, optional `before` = days-ahead reminders), with `time`, `remindLead`, `active`. Completion is a `done` row (`taskId|date`). Notifications are scheduled for the next 30 days (max 150 alarms) every time the app opens or resumes, non-exact, plus a daily 08:00 digest that includes birthdays. So reminders silently stop if the app is not opened for about 30 days. Notification permission is asked only when the user turns on the reminder switch in Settings; saving a task with a reminder does not ask.
- **Birthdays:** standalone rows `{name, cal, month, day, year?, phone?}`, no link to any person. Call and SMS-congratulation buttons exist.
- **Notes:** several per day, with title, tags, pinned, optional `remindAt`, checklists.
- **App lock:** exists. 4-digit PIN (salted PBKDF2, in `localStorage`), fingerprint through the custom Java plugin `Today`, 30 s wait after five wrong PINs, secure-screen flag, re-lock after 30 s away.
- **Native layer:** one custom Java plugin `Today` (widget, ongoing notification, bars, biometrics, secure flag, widget ticks). Capacitor plugins in use: Filesystem, Local Notifications, Share. There is **no** contacts, camera or photo-picker plugin yet.
- **Backup:** `exportAll`/`importAll` (JSON `v: 1`, all tables in `TABLES`, merge on import). On Android it goes through the share sheet. Photo files are not included.
- **Tests:** existing Vitest files for dates, formatting, settings, lock store, reminders, occasions, date spans and the icon set. They must keep passing.
- **Other:** onboarding screen on first run; theme and settings in `localStorage`; Persian occasions in `events.json`; widget/notification lines use emoji on purpose (acceptable there).

## 2c. Carry over vs leave behind

Principle: rooznegar is a small calendar app. This app takes from it **only what a people-network app needs**. A feature existing there is not a reason to keep it, and a feature missing there is not a reason to add it beyond this file's tasks. Leaving something behind means **deleting it from the new repo** (rooznegar itself is untouched), not hiding it.

**Carry over:**
- Capacitor Android shell, signed-APK release workflow (with a new keystore), Vazirmatn font, theme tokens and styles, `Icon`, `confirm` dialog, `ErrorBoundary`.
- `db.ts` (Dexie, `put`/`del`/outbox, export/import), `sync.ts` and `SyncPage.tsx`, `online.ts`.
- Date code for **Jalali and Gregorian** only (`cal.ts`, `format.ts`, `DatePicker`).
- `search.ts` normalization, `birthdays` (linked to people), the one-off `Task` (as the todo), `reminders.ts` and the notification scheduling in `native.ts`, including the single daily 08:00 digest (it already carries birthdays and todos without their own reminder).
- App lock (`lockStore.ts`, `Lock.tsx`, and the biometric and secure-screen parts of the `Today` plugin).
- `TodayPage` and `SettingsPage`, trimmed to what this app uses.

**Leave behind (delete):** `CalendarPage`, `DayPage`, `Tools`, `events.json` and occasions (`events.ts`, `EventList`), Hijri and auxiliary calendars and the Hijri-offset setting, weekly-recurring task UI (`RecurringForm` keeps only what one-off todos need), daily notes by date (`NoteEditor` checklists, pinning, `notes.ts` date model; person notes are plain text), home-screen widgets, the ongoing notification, the 5-tap hidden-sync trick, the onboarding questions (calendar choice, name), and their tests when the code they test is gone.

## 3. Out of scope for the MVP

Interactive graph page, custom fields, configurable rating criteria and ranking weights, learning from outcomes, candidate/primary/alternate model for tasks, reports page, evidence attachments, encrypted backups, device-contact sync, push notifications, web/PWA version, multi-language, theme options beyond what rooznegar already has.

## 4. Rules for the coder

1. Read existing code before changing it. Reuse rooznegar's date utilities, Dexie setup, notification scheduling, search, sync, app lock, widget and CI. Do not rewrite working code.
2. Add only what a task asks for. Dexie: add new schema versions with upgrade functions. Never edit an old version.
3. IDs: `crypto.randomUUID()`. Every synced row has a string `id` and numeric `updatedAt` in epoch ms, and is written only through `put`/`del` from `db.ts` (never `db.table.put` directly, or sync will not see it). Deletion follows the existing convention: hard delete plus tombstone. People are "archived" with `archivedAt`; there is no trash in the MVP, deletes ask for confirmation, and the manual export (B3) is the safety net.
4. Date-only values (birthday, due date) are stored as `{year?, month, day}` or `YYYY-MM-DD` strings, never converted through timezones. Instants are ISO UTC.
5. Strict TypeScript, no `any`. Validate input at form level and on the Worker. Do not add libraries (router, form, validation, query) unless there is a concrete need; say why before adding.
6. Permissions are requested only at the moment the user taps the action that needs them, never at app start and never in bulk:
   - Contacts: only when the user taps "افزودن از مخاطبین".
   - Photos: only when the user taps the gallery/add-photo button. Use the Android system photo picker, which needs no storage permission on current Android versions; ask for a storage/media permission only if the plugin or the OS version truly requires it, and only at that tap.
   - Camera: **not used and never requested.** The user can take a photo with the phone's own camera app and then pick it from the gallery.
   - Notifications (and exact-alarm permission if needed for reminders): only when the user saves their first reminder or turns on a birthday reminder.
   - If a permission is denied, explain in one sentence what is lost and keep every other feature working. Never block the app or nag repeatedly.
7. Never log names, phones, notes, or photo paths. No `console.log` of personal data.
8. The Worker takes the user id from the session, never from the request body. Every query is scoped by it.
9. Ratings are the user's subjective notes. Never merge the six criteria into one number, never infer a rating from job, city, or skills.
10. Missing data is shown as "ثبت نشده" and is never treated as a zero.
11. Icons: the existing `Icon` component only. No emoji as UI icons (the emoji in widget and notification text lines are the one exception).
12. Existing Vitest tests must keep passing. Do not write new tests for now; if a change breaks an old test, fix the code, or update the test and say why.

## 5. Data model (Dexie tables, additive to rooznegar)

- `people`: id, isSelf, displayName, firstName?, lastName?, nickname?, phones[], emails[], city?, occupation?, workplace?, createdAt, updatedAt, archivedAt?. Birthdays are **not** stored here: the existing `birthdays` table gets an optional `personId`, and when set its `name` and `phone` mirror the person on save, so the widget, reminders, search and congratulation buttons keep working unchanged. A single `isSelf` row is created on first run (the "me" node for referral paths).
- `tags`, `personTags`: free tags and categories (کاری، خانوادگی، ...).
- `skills` (id, name, aliases[], parentId? one level only), `personSkills` (personId, skillId, level? 1–5, years?, evidence text, evidenceStatus: `claimed|seen|verified|unknown`, lastVerifiedAt?).
- `ratings`: append-only events. id, personId, criterion, score 1–5, note?, ratedAt. Current value = latest event per person+criterion. Criteria (constants in code): trustworthiness, punctuality, manner, responsibility, negotiation, responsiveness.
- `relationships`: id, aId, bId, type, closeness 1–5?, howMet?, introducedById?, confidence: `sure|maybe`, note?. Types (constants): family, friend, colleague, neighbor, classmate, acquaintance, introduced. Symmetric types are stored once with the two ids in sorted order and a unique index; `introduced` is directional. No self-links.
- `interactions`: id, personId, type (meeting|call|message|other), occurredAt, summary, outcome?, followUpDate?.
- `notes`: id, personId, text.
- Things someone asked me to do: **extend the existing one-off `Task`** (`mask: 0`, `on`, `time`, `remindLead`, `before`) with an optional `fromPersonId`, instead of a new table. Completion, widget, notifications, search and sync then work for free. The open question is todos with no date (the existing one-off needs `on`); T1 decides the smallest change after reading `cal.ts`, `Lists.tsx` and `RecurringForm.tsx`.
- `photos` (synced metadata only): id, title, note?, takenAt, personId?, tagIds[], width, height, bytes, updatedAt. `photoFiles` (**device-local, never synced**): photoId, local path, uploadState `local|uploaded|failed`. The image file lives in the app data directory (Capacitor Filesystem, `Directory.Data`), not in IndexedDB. A restored phone has metadata first and downloads files afterwards.

## 6. Search and "who can do X" rules (deterministic, no AI)

Normalization (pure function, used for both index and query): `ي→ی`, `ك→ک`, remove kashida and diacritics, ZWNJ → space, Persian/Arabic digits → Latin digits, lowercase Latin, collapse spaces. Phones: keep digits, map `+98`, `0098`, `98` prefix to leading `0`.

Searched fields: name, nickname, skills and aliases, tags, occupation, workplace, city, notes, interaction summaries, phone numbers, photo titles/notes.

Matching: split the query into words; every word must match some field (prefix match allowed). A word that matches a skill or alias is treated as a skill match.

Result order, in this priority:
1. People with a matching skill (direct specialists), then people matched only through other fields (notes, tags, ...).
2. Within a group: evidence status (`verified` > `seen` > `claimed` > none), then the user's trustworthiness rating (people with no rating are not penalized; they sort after rated people with the same evidence level), then most recent interaction.

No single numeric score in the MVP. Each result shows plain "why" chips: which field matched, evidence status, trust rating (or "ثبت نشده"), last contact. Different rating criteria are shown side by side, never summed.

Introducers are a separate section titled "از طریق معرفی", never mixed into the specialists list. Path search: BFS from the `isSelf` person over `relationships`, depth ≤ 3, cycle-safe, shortest path first, ties broken by closeness then name. Show the full path ("من ← رضا ← علی (مکانیک)") and mark `maybe` links as uncertain.

## 7. Tasks

### Z — Foundation

| ID | Task | Needs |
|----|------|-------|
| Z0 | Audit and fork. Create the new repo from a copy of the rooznegar code (do not touch rooznegar). Do not write any feature code in this task. Read the code and write `docs/AUDIT.md`: what exists and actually works (sync, auth, app lock, widget, notifications, backup), what is only partly done, files to reuse, risks. Check that keystore files and secrets are not committed. Rename app id, app name (حلقه), APK file name, the Java package of the `Today` plugin, the Dexie database name (`date-app` → `halgheh`), the `localStorage` keys, the PBKDF2 salt prefix (`rooznegar|` → `halgheh|`), the backup file name and share title; deploy a **separate** Worker and D1 database. Run the existing tests and report the result; generate a **new** release keystore and document where it is backed up. Delete what section 2c lists as "leave behind" (JS, Java, manifest entries, resources), keeping the app building after each deletion. Extend section 2b with what `android/` and `worker/` contain (Worker routes, table allowlist, how the key is stored, reminder behavior after reboot). | – |
| Z1 | App shell: replace the six-tab `NAV` with glass bottom navigation: امروز / افراد / (+ quick add) / گالری / بیشتر, keeping the page-state approach (no router unless needed) and registering every new page in `__appBack`. The first run goes straight to Today; no onboarding. "More" holds settings, account and backup, archived people, about. | Z0 |

### P — People

| ID | Task | Needs |
|----|------|-------|
| P1 | Dexie migration (new version, old versions untouched) for people, tags, personNotes, interactions, and `personId` on birthdays. Add every new table to `TABLES` and to the Worker's allowlist. Create the `isSelf` row on first run. | Z0 |
| P2 | Quick add (display name only, one field plus save) and people list (sort by name or recently added; archive and restore; confirmed delete). | P1, Z1 |
| P3 | Person profile as one scrollable page: basic info, phones with call and message buttons, birthday (edited through the existing `birthdays` table linked by `personId`, reuse its Jalali/Gregorian/Hijri form; it already appears in Today and the daily reminder), tags, notes, interaction timeline with add-interaction, edit, archive. Sections for skills, ratings, relationships, todos and photos appear later as empty placeholders only if cheap. | P2 |
| P4 | Import from phone contacts. A button inside "add person". Request the contacts permission only when it is pressed. Show a searchable multi-select list, a preview, and duplicate detection by normalized phone number (skip or merge). If permission is denied, explain and keep manual add working. Verify a maintained plugin compatible with the installed Capacitor version before installing; if none exists, report options and ask before writing native code. | P2 |
| P5 | Search page with Persian normalization (section 6, pure functions under `src/domain/search/`). Instant results, filter chips (all / people / notes / todos / photos), recent searches, useful empty state. Extend the existing `search.ts` (keep `normalize`, `findMatch`, `snippet`, recents) rather than replacing it; add word-by-word AND matching, people, skills, photos, and a `lastSearch` filter for them. | P3 |

### T — Things people asked me to do

| ID | Task | Needs |
|----|------|-------|
| T1 | Todos: quick add with title only; optional sheet for "who asked" (pick a person), due date (3 calendars), time, reminder, note. List with filters (امروز / پیش‌رو / بدون موعد / انجام‌شده). Mark done, snooze reminder, edit, delete. First read `cal.ts` (`taskOn`), `Lists.tsx`, `RecurringForm.tsx`. Reuse `put('tasks', ...)` and the scheduling in `native.ts`/`reminders.ts`; the notification permission is requested when the first reminder is saved (the existing code only asks from the Settings switch, so add that ask). Reminders must survive app restart and phone reboot (verify). | P2 |
| T2 | Todos on the person profile ("کارهایی که گفته") and "who asked" shown in lists. | T1, P3 |
| T3 | Extend the existing `TodayPage` as the home page: search bar on top, today's and overdue todos, follow-ups due, birthdays in the next 7 days, recently added people, quick add. | T1, P5 |

### R — Skills, evidence, ratings, relationships

| ID | Task | Needs |
|----|------|-------|
| R1 | Skills on a person: autocomplete from existing skills, create new, aliases, level, years, evidence text, evidence status (ادعا / دیدم / تأییدشده / نامشخص), last verified date. Mark stale if not verified for 12 months (constant, easy to change). | P3 |
| R2 | Ratings: six fixed criteria on the profile, 1–5 with optional note, history list per criterion. Never summed. | P3 |
| R3 | Relationships: add a link from a profile (other person, type, closeness, how met, introducer, confidence). Profile shows direct connections, including the link to "me". | P3 |
| R4 | "Who can do X" per section 6: specialists list with why-chips, plus the "از طریق معرفی" section with full paths. | R1, R2, R3, P5 |

### G — Photo gallery

| ID | Task | Needs |
|----|------|-------|
| G1 | Gallery tab: add photos only from the gallery via the system photo picker (multi-select if the picker supports it; no camera access, see rule 6), compress on device (max 1600 px long side, JPEG about 0.8), save the file in the app files directory, metadata in Dexie. Grid view, full-screen viewer with pinch zoom, title, note, date, tags, optional person link. Hard cap 300 photos with a warning at 250. Verify photo-picker plugin compatibility with the installed Capacitor version first, and confirm no camera permission is declared in the Android manifest. | Z1 |
| G2 | Photos on the person profile; photo titles, notes and tags included in search; confirmed delete. | G1, P5 |

### B — Account, backup, restore

| ID | Task | Needs |
|----|------|-------|
| B1 | Account: the sign-in/registration UI exists in `SyncPage.tsx` but is hidden behind five taps on the Settings title (`syncUnlocked`). Make it a visible Settings entry, with the new Worker URL in `VITE_SYNC_URL`. Minimum 8 characters, server-side rate limiting on login and register. No email verification. **No password reset in the MVP**: show a clear warning at registration that a forgotten password means the cloud backup cannot be recovered. Plain-language note on the screen that data on the server is not encrypted. | Z0 |
| B2a | Rows: reuse the existing sync as is (it is generic and reasonably built); only add the new tables (see P1). Conflict policy stays what it is, last-write-wins by `updatedAt`; describe it in two lines in `docs/SYNC.md`, including that a wrong phone clock can make an old edit win. Change nothing else in the sync. Restore on a new phone is the existing login-then-pull merge; no replace-all mode. Show last sync time and pending changes (the screen exists). | B1 |
| B2b | Photos: new Worker routes to upload and download a photo file (authorized by the same Bearer key, files in R2 under the user's own prefix), a client upload queue with retry and no duplicates, download of missing files after restore, skip when the account is not connected. Server limits per user: 300 photos, 1.5 MB each, request size caps. | B1, G1 |
| B3 | Manual export through the Android share sheet: the existing `shareBackup` for rows, plus photo files as a ZIP. | B2b |
| B4 | Server check (read `worker/` first): every existing and new route returns only the requesting user's rows; photo routes are authorized and have the size caps; no personal data in Worker logs. Fix only what is actually wrong and report the rest. No new auth features. | B2a |
| B5 | App lock already exists (PIN, fingerprint, brute-force wait, secure screen). Only verify it works in the renamed app; build nothing new. | Z1 |

### X — Release

| ID | Task | Needs |
|----|------|-------|
| X1 | GitHub Actions release workflow for the signed APK (reuse rooznegar's; its npm scripts hardcode macOS Homebrew paths, CI must not), version bump, short install guide for friends, privacy note. | B1–B5 |

## 8. After the MVP, in this order

1. Interactive network graph page (reuse the BFS from R4).
2. Task-to-candidate workflow: required skills, primary and alternate candidates, outcome, per-candidate evaluation.
3. Rating criteria and ranking weights as settings, proposed changes with explicit approval.
4. Custom fields, reports, saved filters.
5. Encrypted backups, optional.
6. Web version.

## 9. Suggested order

Z0 → Z1 → P1 → P2 → P3 → P4 → P5 → T1 → T2 → T3 → R1 → R2 → R3 → R4 → G1 → G2 → B1 → B2a → B2b → B3 → B4 → B5 → X1

You can start using the app yourself after T3. Do not give the APK to friends before B2a/B2b (backup) and B4 (server hardening) are done.

## 10. Prompt templates for the AI coder

First message in a new session:

> Read TASKS.md fully, especially sections 2, 4 and 6. Then do task Z0 only. Do not start any other task. At the end report: what you read, what you changed, commands you ran and their real output, anything you could not verify, and the next task.

Every later task:

> Do task P3 from TASKS.md. Read the existing code that touches this area first and reuse it. Follow the rules in section 4. Run `tsc` and the build, check the result on the emulator or phone if you can, and report honestly what worked, what did not, and what you could not check.

If something in the spec conflicts with the existing code, the AI must stop and explain the conflict and a proposed default instead of silently choosing.
