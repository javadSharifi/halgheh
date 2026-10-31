# i18n

Persian is the source language. The Persian text **is** the key: `tx('ذخیره')`. `fa` returns the key unchanged,
`en` looks it up in `en.ts` and falls back to the Persian text when a key is missing. A missing translation can
never show a raw key on screen.

```tsx
tx('ذخیره')                                       // plain
tx('«{a1}» حذف شود؟', { a1: p.displayName })      // placeholders, numbered a1, a2, ...
tn('{n} کار', n)                                  // plural: en.ts holds "{n} task | {n} task" style pairs
num(1500)                                         // ۱۵۰۰ in fa, 1500 in en
join([a, b && c])                                 // non-empty parts joined with " · "
```

## Add a new string

1. Write the Persian text inline: `tx('متن تازه')`. No key table, no registration.
2. Add the English line to `en.ts` in the same change:
   `"متن تازه": "New text",`
3. Run `pnpm i18n`. It fails when a used key is missing from `en.ts`, when the placeholders differ between the
   two languages, or when an English value still contains Persian letters.
4. If the string needs a count, use `tn` and give `en.ts` a `singular | plural` value.
5. Never call `tx()` at module level inside a label map — store the Persian key and call `tx()` where it renders,
   otherwise the text freezes in the language that was active at load.

## Rules the checker enforces

- every used key exists in `en.ts`
- the same `{a1}`/`{n}` placeholders on both sides
- no Persian letters in an English value
- no Arabic `ي ك ى` in a key, no leading/trailing/double spaces
- no `tx('a' + b)` and no template literal inside `tx` — use placeholders
- `tn` values must contain `' | '`
- unused keys in `en.ts` are a warning (the Persian copy was probably edited)

## Do not translate

Text that is stored in the database, not shown as UI: seeded category names (`src/domain/rules/constants.ts`), the
self row `'من'` (`src/db/index.ts`), the `'بدون نام'` contact fallback, and the Arabic→Persian letter table in
`src/search.ts`. Translating them would split the data by language.

## Add a language

1. Extend `Lang` in `src/settings.ts` and its `normalize`.
2. Add `src/i18n/xx.ts` exporting a `Record<string, string>` keyed by the Persian text.
3. Register it in `DICT` in `src/i18n/index.ts`, add a `LANGS` entry, and add it to `RTL` if it is right-to-left.
4. Copy the missing-key logic from `en.ts`; the checker only validates `en`.

Known gaps for a third language: plural forms are a single `singular | plural` pair, `num()` only knows Persian and
Latin digits, and `tomanWords()` falls back to digits outside Persian.

## Release checklist

- `pnpm i18n` is green (it also runs inside `pnpm build`).
- Open the app once in English and walk the main pages: Today, People, Person, Todos, Ledger, Rulebook, Compare,
  Search, Settings, Sync. Look for clipped buttons, overlong chips and numbers that stayed Persian.
