# Glossary

Fixed English for recurring Persian terms. Use these words, not synonyms, so the app reads as one voice.
Check a new string against this list before adding it to `en.ts`.

## Names

| Persian | English | Note |
|---|---|---|
| حلقه | Halgheh | App name, never translated or lowercased. |
| حلقه خالی است | Halgheh is empty | |

## Money and exchanges

| Persian | English | Note |
|---|---|---|
| دادوستد | exchange | Always "exchange": the row can be money, an item or a favour, so "deal" and "transaction" read wrong. |
| طلب | credit | What others owe me. |
| بدهی | debt | What I owe others. |
| تسویه | settle / settled | Verb "settle", state "settled". |
| معادل | equivalent | |
| موعد | due date | |
| سررسید | due / overdue | Past due = "overdue". |
| مبلغ | amount | |
| تومان | toman | Lowercase, no "T". |
| باز | open | Opposite of settled. |

## Rules and review

| Persian | English | Note |
|---|---|---|
| قانون | rule | |
| دسته | category | |
| بررسی | review | The act; "checked"/"unchecked" for a single rule. |
| مرور | review | Daily review, review session. |
| رعایت | kept | |
| می‌شکنم | broken | |
| بررسی‌نشده | unchecked | |
| مقایسه | comparison | |
| بایگانی | archive / archived | |
| جعبه | box | Leitner box. |

## People

| Persian | English | Note |
|---|---|---|
| فرد / شخص | person | Both are "person". |
| مهارت | skill | |
| رابطه | relationship | |
| برچسب | tag | |
| امتیاز | score / rating | A number is "score"; the criterion set is "rating". |
| تعامل | interaction | |
| تولد | birthday | |
| یادآور | reminder | |
| پیگیری | follow-up | Always hyphenated. |
| از طریق | via | |

## Data and device

| Persian | English | Note |
|---|---|---|
| همگام‌سازی | sync | Never "synchronisation". |
| پشتیبان | backup | |
| دستگاه / گوشی | device / phone | "device" for the abstract device, "phone" when storage is meant. |
| پرونده | file | |
| عکس | photo | |

## Style

- Sentence case everywhere. "Add person", not "Add Person".
- Short Android tone: no "we", no "please" unless the Persian says لطفاً, no exclamation marks except the birthday greeting.
- No trailing full stop on buttons, chips, titles, labels or one-line hints. Full stops only in sentences.
- Curly quotes “ ” inside values, never straight quotes.
- Placeholders `{a1}`, `{a2}` and `{n}` are copied verbatim, never reordered away from the sentence.
- `{n}` only appears in plural keys, whose value is `singular | plural`.
- Numbers come from `num()`; never hardcode digits in a value.
- Persian letters must not appear in an English value (the checker rejects them).
