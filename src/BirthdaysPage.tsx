import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Birthday, db, del, put, uid } from './db';
import { CAL_NAMES, MONTHS, type Cal, fa, label, parts, today } from './cal';
import { nextOccurrence } from './format';
import { ask } from './confirm';
import { BirthdayFields, draftOf, emptyDraft, readDraft, rowOf } from './BirthdayFields';
import { Icon } from './Icon';
import { shareText } from './native';

// avatar colour (p0..p2 in the stylesheet), picked by name so a person keeps the same colour
const paletteOf = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;

const congrats = (name: string) => `تولدت مبارک ${name}`;
const smsHref = (phone: string, name: string) => `sms:${phone}?body=${encodeURIComponent(congrats(name))}`;

export function BirthdaysPage({ focusId, onFocused, openSearch }: { focusId?: string | null; onFocused?: () => void; openSearch: () => void }) {
  const mainCal: Cal = 'persian';
  const off = 0;
  const t = today();
  const bdays = useLiveQuery(() => db.birthdays.toArray(), []) ?? [];
  const [f, setF] = useState(() => emptyDraft(mainCal, parts(t, mainCal, off).m));
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

  const { valid } = readDraft(f);

  const reset = () => {
    setEditing(null);
    setF(emptyDraft(mainCal, parts(t, mainCal, off).m));
  };
  const save = async () => {
    if (!valid) return;
    await put('birthdays', { ...rowOf(f, editing), id: editing?.id ?? uid() });
    reset();
  };
  const edit = (b: Birthday) => {
    setEditing(b);
    setF(draftOf(b));
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
        <BirthdayFields d={f} set={(patch) => setF((x) => ({ ...x, ...patch }))} />
        {editing && <button className="danger-btn" onClick={remove}>حذف این تولد</button>}
      </section>
    </>
  );
}
