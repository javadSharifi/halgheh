import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Birthday, db, del, put, uid } from './db';
import { CALS, CAL_NAMES, MONTHS, type Cal, bdayOn, fa, label, parts, today } from './cal';
import { YEAR_RANGE, maxDay, nextOccurrence, toLatinDigits } from './format';
import { ask } from './confirm';
import { Icon } from './Icon';
import { Choice } from './Choice';
import { shareText } from './native';
import { useSettings } from './settings';

// avatar colour (p0..p2 in the stylesheet), picked by name so a person keeps the same colour
const paletteOf = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;

const empty = (cal: Cal, month: number) => ({ name: '', cal, month, day: '', year: '', phone: '' });
const cleanPhone = (s: string) => toLatinDigits(s).replace(/[\s\-()]/g, '');
const congrats = (name: string) => `تولدت مبارک ${name} 🎂`;
const smsHref = (phone: string, name: string) => `sms:${phone}?body=${encodeURIComponent(congrats(name))}`;

export function BirthdaysPage({ focusId, onFocused, openSearch }: { focusId?: string | null; onFocused?: () => void; openSearch: () => void }) {
  const { cal: mainCal, hijriOffset: off } = useSettings();
  const t = today();
  const bdays = useLiveQuery(() => db.birthdays.toArray(), []) ?? [];
  const [f, setF] = useState(() => empty(mainCal, parts(t, mainCal, off).m));
  const [editing, setEditing] = useState<Birthday | null>(null);
  const formRef = useRef<HTMLElement>(null);

  const dated = useMemo(
    () => bdays.map((b) => ({ b, next: nextOccurrence(b, t, off) })).sort((x, y) => (x.next?.inDays ?? 1e6) - (y.next?.inDays ?? 1e6)),
    [bdays, t, off],
  );
  const todays = dated.filter((x) => x.next?.inDays === 0);
  const soon = dated.filter((x) => x.next?.inDays !== 0);
  // consecutive birthdays in the same month (of the main calendar) form one group
  const groups = soon.reduce<{ key: string; title: string; items: typeof soon }[]>((acc, x) => {
    const p = x.next && parts(x.next.date, mainCal, off);
    const key = p ? `${p.y}-${p.m}` : 'none';
    const last = acc[acc.length - 1];
    if (last?.key === key) last.items.push(x);
    else acc.push({ key, title: x.next ? `${label(x.next.date, mainCal, off, { month: 'long' })} ${fa(p!.y)}` : 'بدون تاریخ', items: [x] });
    return acc;
  }, []);

  const day = Number(toLatinDigits(f.day));
  const year = f.year.trim() === '' ? undefined : Number(toLatinDigits(f.year));
  const dayOk = Number.isInteger(day) && day >= 1 && day <= maxDay(f.cal, f.month);
  const yearOk = year === undefined || (Number.isInteger(year) && year >= YEAR_RANGE[f.cal][0] && year <= YEAR_RANGE[f.cal][1]);
  const phone = cleanPhone(f.phone);
  const phoneOk = phone === '' || /^\+?\d{5,15}$/.test(phone);
  const valid = f.name.trim() !== '' && dayOk && yearOk && phoneOk;

  const reset = () => {
    setEditing(null);
    setF(empty(mainCal, parts(t, mainCal, off).m));
  };
  const save = async () => {
    if (!valid) return;
    await put('birthdays', { ...editing, id: editing?.id ?? uid(), name: f.name.trim(), cal: f.cal, month: f.month, day, year, phone: phone || undefined, updatedAt: Date.now() });
    reset();
  };
  const edit = (b: Birthday) => {
    setEditing(b);
    setF({ name: b.name, cal: b.cal, month: b.month, day: fa(b.day), year: b.year ? fa(b.year).replace(/٬/g, '') : '', phone: b.phone ?? '' });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  // arriving from a search result: open that person for editing once
  useEffect(() => {
    const b = focusId ? bdays.find((x) => x.id === focusId) : undefined;
    if (b) {
      edit(b);
      onFocused?.();
    }
  }, [focusId, bdays]); // eslint-disable-line react-hooks/exhaustive-deps
  const remove = async () => {
    if (editing && (await ask({ title: `حذف تولد ${editing.name}؟`, message: 'این کار قابل بازگشت نیست.', confirm: 'حذف' }))) {
      await del('birthdays', editing.id);
      reset();
    }
  };

  const age = (b: Birthday, date: string) => (b.year ? ` · ${fa(parts(date, b.cal, off).y - b.year)} سالگی` : '');
  // "born 12 Aban 1380 · turns 25": the age is the one reached on the coming birthday
  const born = (b: Birthday, date: string) => (b.year ? `متولد ${fa(b.day)} ${MONTHS[b.cal][b.month - 1]} ${fa(b.year).replace(/٬/g, '')} · ${fa(parts(date, b.cal, off).y - b.year)} ساله می‌شود` : '');
  const phoneBtns = (b: Birthday) => b.phone && (
    <>
      <a className="icon-btn small" href={`tel:${b.phone}`} aria-label={`تماس با ${b.name}`}><Icon name="phone" size={17} stroke={1.9} /></a>
      <a className="icon-btn small" href={smsHref(b.phone, b.name)} aria-label={`ارسال تبریک به ${b.name}`}><Icon name="gift" size={17} stroke={1.9} /></a>
    </>
  );
  // the date as the person's own calendar writes it; for another calendar than the main one, the main date follows in brackets
  const when = (b: Birthday, date: string) => {
    const own = label(date, b.cal, off, { day: 'numeric', month: 'long' });
    return b.cal === mainCal
      ? `${label(date, mainCal, off, { weekday: 'long' })} ${own} · ${CAL_NAMES[b.cal]}`
      : `${own} · ${CAL_NAMES[b.cal]} (${label(date, mainCal, off, { day: 'numeric', month: 'long' })})`;
  };

  return (
    <>
      <div className="page-head">
        <h1>تولدها</h1>
        <button className="icon-btn" aria-label="جستجو در تولدها" onClick={openSearch}><Icon name="search" size={20} stroke={1.8} /></button>
      </div>

      {todays.map(({ b }) => (
        <section key={b.id} className="bday-today" aria-label="تولد امروز">
          <span className="avatar xl" aria-hidden="true">{b.name.slice(0, 1)}</span>
          <div>
            <em>امروز</em>
            <b>{b.name}{age(b, t)}</b>
            <span>{label(t, b.cal, off, { day: 'numeric', month: 'long' })} · تقویم {CAL_NAMES[b.cal]}</span>
          </div>
          {b.phone
            ? <a className="icon-btn" href={smsHref(b.phone, b.name)} aria-label="ارسال تبریک"><Icon name="gift" size={19} stroke={1.9} /></a>
            : <button className="icon-btn" aria-label="ارسال تبریک" onClick={() => shareText(congrats(b.name))}><Icon name="gift" size={19} stroke={1.9} /></button>}
        </section>
      ))}

      {groups.length === 0 && (
        <section>
          <h2 className="sec-title">به‌زودی</h2>
          <div className="glass bday-list"><p className="hint empty">{bdays.length ? 'تولد دیگری در پیش نیست.' : 'هنوز تولدی ثبت نکرده‌اید.'}</p></div>
        </section>
      )}
      {groups.map((g) => (
        <section key={g.key}>
          <h2 className="sec-title">{g.title}<small>{fa(g.items.length)} تولد</small></h2>
          <div className="glass bday-list">
            {g.items.map(({ b, next }) => (
              <div key={b.id} className="bday-item">
                <button className="bday-row" onClick={() => edit(b)} aria-label={`ویرایش ${b.name}`}>
                  <span className={`avatar p${paletteOf(b.name)}`} aria-hidden="true">{b.name.slice(0, 1)}</span>
                  <div>
                    <b>{b.name}</b>
                    <span>{next ? when(b, next.date) : `${CAL_NAMES[b.cal]}`}</span>
                    {next && b.year && <span>{born(b, next.date)}</span>}
                  </div>
                  {next && <span className={`days-chip${next.inDays <= 7 ? ' near' : ''}`}>{fa(next.inDays)} روز</span>}
                </button>
                {phoneBtns(b)}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section ref={formRef} className="glass bday-form" aria-label={editing ? 'ویرایش تولد' : 'افزودن تولد'}>
        <div className="bf-head">
          <span>{editing ? 'ویرایش تولد' : 'افزودن تولد'}</span>
          <span className="inline-actions">
            {editing && <button className="mini-btn" onClick={reset}>انصراف</button>}
            <button className="mini-btn primary" disabled={!valid} onClick={save}>ذخیره</button>
          </span>
        </div>
        <label className="bf-name">
          <span>نام</span>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <div className="radios" role="radiogroup" aria-label="نوع تقویم">
          {CALS.map((c) => (
            <button key={c} role="radio" aria-checked={f.cal === c} className={f.cal === c ? 'on' : ''} onClick={() => setF({ ...f, cal: c })}>{CAL_NAMES[c]}</button>
          ))}
        </div>
        <div className="bf-grid">
          <label className={`bf-tile${f.day && !dayOk ? ' bad' : ''}`}>
            <span>روز</span>
            <input inputMode="numeric" value={f.day} aria-invalid={f.day !== '' && !dayOk} onChange={(e) => setF({ ...f, day: e.target.value })} />
          </label>
          <div className="bf-tile">
            <span>ماه</span>
            <Choice className="pick-text" label="ماه" value={f.month} options={MONTHS[f.cal].map((m, i): [number, string] => [i + 1, m])} onChange={(m) => setF({ ...f, month: m })} />
          </div>
          <label className={`bf-tile${!yearOk ? ' bad' : ''}`}>
            <span>سال (اختیاری)</span>
            <input inputMode="numeric" value={f.year} aria-invalid={!yearOk} onChange={(e) => setF({ ...f, year: e.target.value })} />
          </label>
        </div>
        <label className={`bf-name${!phoneOk ? ' bad' : ''}`}>
          <span>شماره تلفن (اختیاری)</span>
          <input type="tel" inputMode="tel" dir="ltr" value={f.phone} aria-invalid={!phoneOk} placeholder="0912…" onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </label>
        {!phoneOk && <p className="form-error">شماره باید فقط رقم باشد (۵ تا ۱۵ رقم، می‌تواند با + شروع شود).</p>}
        {(!dayOk && f.day !== '') && <p className="form-error">روز این ماه باید بین ۱ و {fa(maxDay(f.cal, f.month))} باشد.</p>}
        {!yearOk && <p className="form-error">سال باید بین {fa(YEAR_RANGE[f.cal][0])} و {fa(YEAR_RANGE[f.cal][1])} باشد.</p>}
        {editing && <button className="danger-btn" onClick={remove}>حذف این تولد</button>}
      </section>
    </>
  );
}
