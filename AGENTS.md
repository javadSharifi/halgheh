# halgheh — offline-first Persian Android app

React 19 + Capacitor + Dexie. All data lives on the device; cloud sync (Cloudflare Worker + D1) is optional and only for backup.

## Map

- `src/db/` — `types.ts` = every row type (`Task`, `Person`, ...) plus `RATING_CRITERIA`/`REL_TYPES`; `index.ts` = Dexie schema (one `db.version(n).stores(...)` per change), `put`/`del`/`uid`, seeds, backup import/export. Never edit an existing version; append a new one. Queries stay in the screen that needs them (`useLiveQuery`), not here.
- `src/domain/*` — pure logic, no React: `ledger/`, `search/`, `compare/`, `rules/`, `brief/`. Untested; changes here need a manual flow.
- `src/*.tsx` — screens. `src/App.tsx` is the whole router: a `page` state machine, no react-router. Add a screen = add a `page` value + branch there.
- `src/cal.ts` — three calendars (Jalali/Gregorian/Hijri). `src/format.ts` — display helpers. `src/skills.ts`, `src/search.ts`, `src/relationships.ts` — per-feature logic.
- `src/native.ts`, `src/photoStore.ts`, `src/contacts.ts`, `src/reminders.ts` — Capacitor bridges, each guarded so the web build still runs.
- `src/sync.ts`, `src/online.ts`, `src/photoSync.ts` — sync client. `worker/index.ts` — sync backend (D1), `migrations/` — SQL.
- `src/taskKinds.ts` personal-task modes (`Task.kind`); `src/ShoppingSection.tsx` = shopping task rules + product comparison, built on the rulebook compare feature (shared «خرید» category).
- `src/GraphPage.tsx` relationship graph (layout in `domain/graph`); `src/TouchPage.tsx` keep-in-touch overview; `src/circles.ts` closeness groups (`Person.circle`) and their suggested rhythm (`cadenceDays`).
- `src/WeeklyPage.tsx` weekly review (numbers in `domain/weekly`); recurring tasks = `Task.mask` weekday bits with no `on`, resolved by `dueOf`/`isRecurring` in `src/todoFilters.ts`, ticked per occurrence day.
- `src/AddMenu.tsx` global "+" (add task/person/exchange/birthday/rule); `src/TodayTabs.tsx` امروز|کارها|تولدها switch shown by App on those three pages.
- `src/ui/` — design system base components (`Button`, `InputField`, `Select`, `Card`, `Sheet`, `Chip`, `FormPage`, `PageHead`). Every add/edit screen is a `FormPage` (+ `FormSection`/`FormField`) built from `InputField`/`Select`; `Sheet` is only for pickers and menus.
- `src/i18n/` — `tx('متن فارسی')` everywhere in the UI; Persian text is the key, `en.ts` holds the English copy. `src/settings.ts` `lang` picks it and remounts the app.

## Landmarks

Add a line here only after a search actually cost time. Directory or file, never line numbers or symbols; delete a line the moment it goes stale. Keep it under ten.

- `src/strings/rulebook.ts` — `STR` plus label maps (`EXCHANGE_KIND_LABEL`, `CHECK_ITEM_LABEL`, ...) for rulebook, brief, ledger and checks; imported by ~10 screens. Every other screen keeps Persian inline.
- `src/ledger/shared.ts` — `money()` and `PALETTE()`; the balance/total math itself is in `src/domain/ledger/index.ts`.
- `src/App.tsx` — one `page` state machine, ~25 pages. Full-screen pages (sync, search, person, whocan, exchange, brief) hide the bottom tab bar via the `full` flag.
- `src/photoAdd.tsx` (`usePhotoAdd`: pick → full photo form → `storePhoto.ts`) is the only way a photo is added; gallery and person profile both use it.
- `src/photoStore.ts` + `photoFiles` table — device-local, never synced; `usePhotoUrls` turns stored paths into blob URLs.

## Conventions

- Strict TypeScript. UI text goes through `tx('...')` from `src/i18n`; a new Persian string is a new key, so add its English line to `src/i18n/en.ts` in the same change. Never call `tx()` at module level in a label map — store the Persian key and call `tx()` where it renders, or the text freezes at the old language. Code comments in English.
- Every synced table must be listed in `TABLES` in `worker/index.ts`. Device-local tables (`photoFiles`) must never be added there.
- Rows are append-only on the wire: client-generated UUID `id` + `updatedAt` (epoch ms) on every row; sync conflict resolution depends on both.
- Photos/notifications/contacts must degrade to a no-op on web, not throw.

## Commands

```bash
pnpm dev        # vite dev server
pnpm verify     # tsc --noEmit + vitest run — use this while iterating (sub-second typecheck)
pnpm build      # tsc + vite build + PWA — only when the dist output matters
pnpm i18n       # key check: used keys vs src/i18n/en.ts, placeholders, stray Persian in English; also runs inside pnpm build
pnpm android:live # debug APK on the emulator/phone + hot reload: every save reloads the device (Ctrl+C to stop)
```

- Do not run `pnpm android:apk` / `pnpm android:release` in an edit/test loop: gradle is slow. Only on an explicit request, once, at the end.
- `pnpm exec wrangler deploy` publishes the Worker; it needs the D1 database from `wrangler.jsonc`.

## Definition of done

The user tests the UI by hand; the agent does not. Speed comes first.

- Run `pnpm verify` once at the end of a change. A change that adds Persian UI text also needs `pnpm i18n` green (its English line in `src/i18n/en.ts`), see `src/i18n/README.md`. It is a compile/regression check, not approval: never add tests for new work, never open a browser or screenshots.
- Finish every change with a short manual test flow: numbered taps ("برو به بیشتر ← دادوستد ← ثبت دادوستد ...") and what must appear. Six lines maximum.
- Say which one thing is most likely broken if the change touched money, sync, or the Dexie schema.
- Keep this file current: when a file, folder, screen or command is added, renamed or deleted, update the matching Map/Commands line in the same change; if locating a file took more than two searches, add one `Landmarks` line. One line changed, not a rewrite.
