import { Contacts, type ContactPayload } from '@capacitor-community/contacts';
import { type Person, put } from './db';
import { normPhone } from './phone';
import { locale, tx } from './i18n';

/** One contact as the import screen shows it, already flattened out of the plugin's nested payload. */
export type Pick = {
  contactId: string;
  displayName: string;
  given?: string;
  family?: string;
  phones: string[];
  emails: string[];
  /** A person already in the notebook whose number belongs to this contact; set means the row is a duplicate. */
  existing?: Person;
};

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Numbers that can be dialled; anything else (blank, "—") is dropped so a contact is not "imported" with no phone. */
const usablePhones = (c: ContactPayload) =>
  [...new Set((c.phones ?? []).map((p) => normPhone(p.number ?? '')).filter((p) => /^\+?\d{5,15}$/.test(p)))];

const usableEmails = (c: ContactPayload) =>
  [...new Set((c.emails ?? []).map((e) => clean(e.address)).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];

const nameOf = (c: ContactPayload) => {
  const display = clean(c.name?.display);
  if (display) return display;
  const parts = [clean(c.name?.given), clean(c.name?.family)].filter(Boolean);
  return parts.join(' ');
};

/**
 * Turns the plugin's contacts into rows the picker can show. Contacts with no name and no number are dropped: there is
 * nothing to store and nothing to tell two of them apart.
 */
export function toPicks(contacts: ContactPayload[]): Pick[] {
  const out: Pick[] = [];
  for (const c of contacts) {
    const displayName = nameOf(c);
    const phones = usablePhones(c);
    if (!displayName && phones.length === 0) continue;
    out.push({
      contactId: c.contactId,
      displayName: displayName || phones[0] || 'بدون نام',
      given: clean(c.name?.given) || undefined,
      family: clean(c.name?.family) || undefined,
      phones,
      emails: usableEmails(c),
    });
  }
  // a stable, human order: Persian collation, then the number so two same-named contacts stay apart
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName, locale()) || (a.phones[0] ?? '').localeCompare(b.phones[0] ?? ''));
}

/** Which picks already exist in the notebook, matched by any shared normalized phone number. */
export function markDuplicates(picks: Pick[], people: Person[]): Pick[] {
  const byPhone = new Map<string, Person>();
  for (const p of people) {
    if (p.isSelf) continue;
    for (const raw of p.phones) byPhone.set(normPhone(raw), p);
  }
  return picks.map((pick) => {
    const hit = pick.phones.map((n) => byPhone.get(n)).find((p): p is Person => !!p);
    return hit ? { ...pick, existing: hit } : pick;
  });
}

/**
 * Writes the chosen contacts. A pick that matches an existing person is skipped (the notebook row wins), and two chosen
 * contacts sharing a number collapse into one person, because the second would be a duplicate the app just created.
 */
export async function importPicks(picks: Pick[], people: Person[]) {
  const byPhone = new Map<string, Person>();
  for (const p of people) {
    if (p.isSelf) continue;
    for (const raw of p.phones) byPhone.set(normPhone(raw), p);
  }
  let added = 0;
  let merged = 0;
  let skipped = 0;
  const now = Date.now();
  for (const pick of picks) {
    const hit = pick.phones.map((n) => byPhone.get(n)).find((p): p is Person => !!p);
    if (hit) {
      // fill in what the notebook is missing instead of making a second row for the same human
      const patch: Person = { ...hit, updatedAt: Date.now() };
      let changed = false;
      if (!patch.firstName && pick.given) { patch.firstName = pick.given; changed = true; }
      if (!patch.lastName && pick.family) { patch.lastName = pick.family; changed = true; }
      const extra = pick.phones.filter((n) => !hit.phones.map(normPhone).includes(n));
      if (extra.length) { patch.phones = [...hit.phones, ...extra]; changed = true; }
      const extraMail = pick.emails.filter((e) => !hit.emails.includes(e));
      if (extraMail.length) { patch.emails = [...hit.emails, ...extraMail]; changed = true; }
      if (changed) {
        await put('people', patch);
        merged++;
      } else skipped++;
      for (const n of pick.phones) byPhone.set(n, patch);
      continue;
    }
    const person: Person = {
      id: crypto.randomUUID(),
      displayName: pick.displayName,
      firstName: pick.given,
      lastName: pick.family,
      phones: pick.phones,
      emails: pick.emails,
      createdAt: now,
      updatedAt: now,
    };
    for (const k of ['firstName', 'lastName'] as const) if (person[k] === undefined) delete person[k];
    await put('people', person);
    for (const n of pick.phones) byPhone.set(n, person);
    added++;
  }
  return { added, merged, skipped };
}

/**
 * Opens the phone's own contact picker and returns the single contact the user tapped. No permission dialog: the picker
 * is an Android system screen that hands back only that one contact. null when the user backs out.
 */
export async function pickOne(): Promise<Pick | null> {
  const { contact } = await Contacts.pickContact({ projection: { name: true, phones: true, emails: true } });
  if (!contact?.contactId) return null;
  return toPicks([contact])[0] ?? null;
}

/** Why importing from contacts is unavailable, in one sentence, or null when it is fine. */
export const permissionText = (state: string) =>
  state === 'denied'
    ? tx('دسترسی به مخاطبین رد شد. با اجازه دادن از تنظیمات اندروید می‌توانی مخاطبین را بیاوری؛ افزودن دستی همچنان کار می‌کند.')
    : state === 'limited'
      ? tx('فقط بخشی از مخاطبین در دسترس است. می‌توانی از همین‌ها انتخاب کنی یا دستی اضافه کنی.')
      : '';
