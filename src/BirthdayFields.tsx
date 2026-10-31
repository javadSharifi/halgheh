import { CALS, CAL_NAMES, MONTHS, type Cal, fa, parts, today } from './cal';
import type { Birthday } from './db';
import { YEAR_RANGE, maxDay, toLatinDigits } from './format';
import { Choice } from './Choice';

/** The birthday form's fields as typed. Day and year stay strings while the user edits them. */
export type BirthdayDraft = { name: string; cal: Cal; month: number; day: string; year: string; phone: string };

const thisMonth = (cal: Cal) => parts(today(), cal, 0).m;

export const emptyDraft = (cal: Cal = 'persian', month = thisMonth(cal)): BirthdayDraft => ({ name: '', cal, month, day: '', year: '', phone: '' });

/** An existing row -> editable fields. */
export const draftOf = (b: Birthday): BirthdayDraft => ({
  name: b.name,
  cal: b.cal,
  month: b.month,
  day: fa(b.day),
  year: b.year ? fa(b.year).replace(/٬/g, '') : '',
  phone: b.phone ?? '',
});

const cleanPhone = (s: string) => toLatinDigits(s).replace(/[\s\-()]/g, '');

/**
 * Parses and checks the draft once. Every caller shows the same errors and saves the same values, so the profile and
 * the birthdays page can never disagree about what a valid birthday is.
 */
export function readDraft(d: BirthdayDraft) {
  const day = Number(toLatinDigits(d.day));
  const year = d.year.trim() === '' ? undefined : Number(toLatinDigits(d.year));
  const dayOk = Number.isInteger(day) && day >= 1 && day <= maxDay(d.cal, d.month);
  const yearOk = year === undefined || (Number.isInteger(year) && year >= YEAR_RANGE[d.cal][0] && year <= YEAR_RANGE[d.cal][1]);
  const phone = cleanPhone(d.phone);
  const phoneOk = phone === '' || /^\+?\d{5,15}$/.test(phone);
  const nameOk = d.name.trim() !== '';
  return { day, year, dayOk, yearOk, phone, phoneOk, nameOk, valid: nameOk && dayOk && yearOk && phoneOk };
}

/** The stored columns for a draft; `base` keeps the row id and any field this form does not own. */
export const rowOf = (d: BirthdayDraft, base?: Birthday | null) => {
  const r = readDraft(d);
  return { ...base, name: d.name.trim(), cal: d.cal, month: d.month, day: r.day, year: r.year, phone: r.phone || undefined, updatedAt: Date.now() };
};

/**
 * The three-calendar birthday fields. Used by the birthdays page and by the person profile; whoever renders it owns
 * the save button and the sheet/scroll wrapper.
 */
export function BirthdayFields({
  d,
  set,
  lockName,
  hidePhone = lockName,
}: {
  d: BirthdayDraft;
  set: (patch: Partial<BirthdayDraft>) => void;
  lockName?: boolean;
  hidePhone?: boolean;
}) {
  const r = readDraft(d);
  return (
    <div className="birthday-fields-group">
      {!lockName && (
        <label className="bf-name">
          <span>نام</span>
          <input value={d.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
      )}
      <div className="radios bf-cal-radios" role="radiogroup" aria-label="نوع تقویم">
        {CALS.map((c) => (
          <button key={c} role="radio" aria-checked={d.cal === c} className={d.cal === c ? 'on' : ''} onClick={() => set({ cal: c })}>{CAL_NAMES[c]}</button>
        ))}
      </div>
      <div className="bf-grid">
        <label className={`bf-tile${d.day && !r.dayOk ? ' bad' : ''}`}>
          <span>روز</span>
          <input inputMode="numeric" value={d.day} aria-invalid={d.day !== '' && !r.dayOk} onChange={(e) => set({ day: e.target.value })} />
        </label>
        <div className="bf-tile">
          <span>ماه</span>
          <Choice className="pick-text" label="ماه" value={d.month} options={MONTHS[d.cal].map((m, i): [number, string] => [i + 1, m])} onChange={(m) => set({ month: m })} />
        </div>
        <label className={`bf-tile${!r.yearOk ? ' bad' : ''}`}>
          <span>سال (اختیاری)</span>
          <input inputMode="numeric" value={d.year} aria-invalid={!r.yearOk} onChange={(e) => set({ year: e.target.value })} />
        </label>
      </div>
      {!hidePhone && (
        <label className={`bf-name${!r.phoneOk ? ' bad' : ''}`}>
          <span>شماره تلفن (اختیاری)</span>
          <input type="tel" inputMode="tel" dir="ltr" value={d.phone} aria-invalid={!r.phoneOk} placeholder="0912…" onChange={(e) => set({ phone: e.target.value })} />
        </label>
      )}
      {!r.phoneOk && !hidePhone && <p className="form-error">شماره باید فقط رقم باشد (۵ تا ۱۵ رقم، می‌تواند با + شروع شود).</p>}
      {!r.dayOk && d.day !== '' && <p className="form-error">روز این ماه باید بین ۱ و {fa(maxDay(d.cal, d.month))} باشد.</p>}
      {!r.yearOk && <p className="form-error">سال باید بین {fa(YEAR_RANGE[d.cal][0])} و {fa(YEAR_RANGE[d.cal][1])} باشد.</p>}
    </div>
  );
}
