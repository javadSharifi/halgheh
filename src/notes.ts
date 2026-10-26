export type Note = {
  id: string;
  date: string; // 'YYYY-MM-DD' the note belongs to; several notes may share a day
  title: string;
  text: string;
  tags: string[];
  pinned: boolean;
  updatedAt: number;
  remindAt?: number; // when to notify about this note (ms); missing = no reminder
};

import { normalize } from './search';

const DATE = /^\d{4}-\d\d-\d\d$/;

/**
 * Turns a stored or received row into a Note, or null if it cannot be one.
 * Old rows were `{ id: <the day>, text, updatedAt }`: the day becomes `date` and the first line becomes the title.
 */
export function normalizeNote(raw: unknown): Note | null {
  const r = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string' || typeof r.updatedAt !== 'number') return null;
  const date = typeof r.date === 'string' && DATE.test(r.date) ? r.date : DATE.test(r.id) ? r.id : null;
  if (!date) return null;
  let title = typeof r.title === 'string' ? r.title : undefined;
  let text = typeof r.text === 'string' ? r.text : '';
  if (title === undefined) {
    const [first, ...rest] = text.split('\n');
    title = first.trim().slice(0, 100);
    text = rest.join('\n').trim();
  }
  const tags = Array.isArray(r.tags) ? [...new Set(r.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '').map((t) => t.trim().slice(0, 30)))].slice(0, 10) : [];
  const remindAt = typeof r.remindAt === 'number' && r.remindAt > 0 ? r.remindAt : undefined;
  return { id: r.id, date, title, text, tags, pinned: r.pinned === true, updatedAt: r.updatedAt, ...(remindAt && { remindAt }) };
}

/** Pinned first, then the most recently edited. */
export const sortNotes = (notes: Note[]) => [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);

export const MAX_TAGS = 10; // per note, as normalizeNote keeps
export const DEFAULT_TAGS = ['سفر', 'خانواده', 'شخصی'];

/** A tag as typed: trimmed, inner spaces collapsed, at most 30 characters; null when empty. */
export const cleanTag = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 30) || null;

const same = (a: string, b: string) => normalize(a).n === normalize(b).n; // ی/ي, half-spaces etc. do not make a new tag

/** Adds a typed tag unless it is empty, already there (in any spelling) or the note is full. */
export function addTag(tags: string[], typed: string) {
  const t = cleanTag(typed);
  if (!t || tags.length >= MAX_TAGS) return tags;
  const known = tags.find((x) => same(x, t));
  return known ? tags : [...tags, t];
}

export const removeTag = (tags: string[], tag: string) => tags.filter((t) => t !== tag);

/** Tags to offer: those in use (most used first), then the defaults, then this note's own, without repeats. */
export function tagOptions(notes: Note[], current: string[]) {
  const use = new Map<string, number>();
  for (const n of notes) for (const t of n.tags) use.set(t, (use.get(t) ?? 0) + 1);
  const ranked = [...use.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fa')).map(([t]) => t);
  return [...ranked, ...DEFAULT_TAGS, ...current].reduce<string[]>((out, t) => (out.some((x) => same(x, t)) ? out : [...out, t]), []);
}

// ---- checklist lines: "☐ item" / "☑ item" in the note text ----
const OPEN = '☐ ';
const DONE = '☑ ';
const isItem = (l: string) => l.startsWith(OPEN) || l.startsWith(DONE);

/**
 * The checklist button. Looks at the first selected line: plain -> every selected line gets "☐ ",
 * "☐" -> they become "☑", "☑" -> the markers are removed. Returns the new text and the selection: the changed lines when there are several
 * (so pressing again cycles the same lines), otherwise a caret at the end of the line.
 */
export function cycleChecklist(text: string, start: number, end: number) {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = text.indexOf('\n', end);
  if (lineEnd < 0) lineEnd = text.length;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const mode = lines[0].startsWith(OPEN) ? 'done' : lines[0].startsWith(DONE) ? 'strip' : 'open';
  const block = lines
    .map((l) => (mode === 'open' ? (isItem(l) ? l : OPEN + l) : mode === 'done' ? (l.startsWith(OPEN) ? DONE + l.slice(2) : l) : isItem(l) ? l.slice(2) : l))
    .join('\n');
  const blockEnd = lineStart + block.length;
  return { text: text.slice(0, lineStart) + block + text.slice(lineEnd), start: lines.length > 1 ? lineStart : blockEnd, end: blockEnd };
}

/** Enter inside a checklist line starts the next item; Enter on an empty item ends the list. Null when not on a checklist line. */
export function continueChecklist(text: string, pos: number) {
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  const line = text.slice(lineStart, pos);
  if (!isItem(line)) return null;
  if (line.length === OPEN.length) return { text: text.slice(0, lineStart) + text.slice(pos), caret: lineStart };
  return { text: `${text.slice(0, pos)}\n${OPEN}${text.slice(pos)}`, caret: pos + 1 + OPEN.length };
}

/** A stable positive integer for the system notification of a note (the daily reminders use YYMMDD ids, far below this range). */
export const noteNotifId = (id: string) => 100_000_000 + ([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 800_000_000);
