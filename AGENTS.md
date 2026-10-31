# halgheh — offline-first Persian Android app

React 19 + Capacitor + Dexie. All data lives on the device; cloud sync (Cloudflare Worker + D1) is optional and only for backup.

## Map

- `src/db/` — `types.ts` = every row type (`Task`, `Person`, ...) plus `RATING_CRITERIA`/`REL_TYPES`; `index.ts` = Dexie schema (one `db.version(n).stores(...)` per change), `put`/`del`/`uid`, seeds, backup import/export. Never edit an existing version; append a new one. Queries stay in the screen that needs them (`useLiveQuery`), not here.
- `src/domain/*` — pure logic, no React: `ledger/`, `search/`, `compare/`, `rules/`, `brief/`. Tested in `*.test.ts`.
- `src/*.tsx` — screens. `src/App.tsx` is the whole router: a `page` state machine, no react-router. Add a screen = add a `page` value + branch there.
- `src/cal.ts` — three calendars (Jalali/Gregorian/Hijri). `src/format.ts` — display helpers. `src/skills.ts`, `src/search.ts`, `src/relationships.ts` — per-feature logic.
- `src/native.ts`, `src/photoStore.ts`, `src/contacts.ts`, `src/reminders.ts` — Capacitor bridges, each guarded so the web build still runs.
- `src/sync.ts`, `src/online.ts`, `src/photoSync.ts` — sync client. `worker/index.ts` — sync backend (D1), `migrations/` — SQL.

## Conventions

- Strict TypeScript. Persian UI strings are written inline in components; code comments in English.
- Every synced table must be listed in `TABLES` in `worker/index.ts`. Device-local tables (`photoFiles`) must never be added there.
- Rows are append-only on the wire: client-generated UUID `id` + `updatedAt` (epoch ms) on every row; sync conflict resolution depends on both.
- Tests are colocated (`*.test.tsx` next to the component). New domain logic gets a test; pure layout changes do not.
- Photos/notifications/contacts must degrade to a no-op on web, not throw.

## Commands

```bash
pnpm dev        # vite dev server
pnpm verify     # tsc --noEmit + vitest run — use this while iterating (sub-second typecheck)
pnpm build      # tsc + vite build + PWA — only when the dist output matters
```

- Do not run `pnpm android:apk` / `pnpm android:release` in an edit/test loop: gradle is slow. Only on an explicit request, once, at the end.
- `pnpm exec wrangler deploy` publishes the Worker; it needs the D1 database from `wrangler.jsonc`.
- `TASKS.md` is large (50KB+). Grep it, do not read it whole.
