import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Birthday, type Occasion, db, del, put, uid } from './db';
import { CALS, CAL_NAMES, MONTHS, type Cal, fa, label, monthName, parts, today } from './cal';
import { maxDay, nextOccurrence, toLatinDigits } from './format';
import { ask } from './confirm';
import { BirthdayFields, draftOf, emptyDraft, readDraft, rowOf } from './BirthdayFields';
import { Choice } from './Choice';
import { Icon } from './Icon';
import { WishSheet } from './WishSheet';
import { tn, tx } from './i18n';
import { Card, Button } from './ui';

// avatar colour (p0..p2 in the stylesheet), picked by name so a person keeps the same colour
const paletteOf = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;

/** The occasion form as typed: a group date, no year and no person. */
type ODraft = { title: string; cal: Cal; month: number; day: string; remindLead: string; tagId: string };
const emptyOccasion = (cal: Cal): ODraft => ({ title: '', cal, month: parts(today(), cal, 0).m, day: '', remindLead: '0', tagId: '' });
const occasionDraft = (o: Occasion): ODraft => ({ title: o.title, cal: o.cal, month: o.month, day: fa(o.day), remindLead: String(o.remindLead ?? 0), tagId: o.tagId ?? '' });

export function BirthdaysPage({ focusId, onFocused, openSearch }: { focusId?: string | null; onFocused?: () => void; openSearch: () => void }) {
  const mainCal: Cal = 'persian';
  const off = 0;
  const t = today();
  const bdays = useLiveQuery(() => db.birthdays.toArray(), []) ?? [];
  const [f, setF] = useState(() => emptyDraft(mainCal, parts(t, mainCal, off).m));
  const [editing, setEditing] = useState<Birthday | null>(null);
  const [wish, setWish] = useState<Birthday | null>(null);
  const formRef = useRef<HTMLElement>(null);
  const occs = useLiveQuery(() => db.occasions.toArray(), []) ?? [];
  const tags = useLiveQuery(() => db.tags.toArray(), []) ?? [];
  const [of, setOF] = useState<ODraft>(() => emptyOccasion(mainCal));
  const [editingOcc, setEditingOcc] = useState<Occasion | null>(null);
  const occFormRef = useRef<HTMLElement>(null);
  const occDated = useMemo(
    () => occs.map((o) => ({ o, next: nextOccurrence(o, t, off) })).sort((x, y) => (x.next?.inDays ?? 1e6) - (y.next?.inDays ?? 1e6)),
    [occs, t, off],
  );
  const tagName = (id?: string) => (id ? tags.find((x) => x.id === id)?.name : undefined);
  const occDay = Number(toLatinDigits(of.day));
  const occValid = of.title.trim() !== '' && Number.isInteger(occDay) && occDay >= 1 && occDay <= maxDay(of.cal, of.month);
  const resetOcc = () => {
    setEditingOcc(null);
    setOF(emptyOccasion(mainCal));
  };
  const saveOcc = async () => {
    if (!occValid) return;
    const lead = Number(of.remindLead);
    await put('occasions', {
      id: editingOcc?.id ?? uid(),
      title: of.title.trim(),
      cal: of.cal,
      month: of.month,
      day: occDay,
      ...(lead > 0 && { remindLead: lead }),
      ...(of.tagId && { tagId: of.tagId }),
      updatedAt: Date.now(),
    });
    resetOcc();
  };
  const editOcc = (o: Occasion) => {
    setEditingOcc(o);
    setOF(occasionDraft(o));
    occFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const removeOcc = async () => {
    if (editingOcc && (await ask({ title: tx('حذف مناسبت {a1}؟', { a1: editingOcc.title }), message: tx('این کار قابل بازگشت نیست.'), confirm: tx('حذف') }))) {
      await del('occasions', editingOcc.id);
      resetOcc();
    }
  };

  // remindLead presets: the digest line appears this many days before the occasion (0 = only on the day)
  const LEADS: [number, string][] = [
    [0, tx('همان روز')],
    [1, tx('{a1} روز قبل', { a1: fa(1) })],
    [3, tx('{a1} روز قبل', { a1: fa(3) })],
    [7, tx('{a1} روز قبل', { a1: fa(7) })],
  ];
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
    else acc.push({ key, title: x.next ? `${label(x.next.date, mainCal, off, { month: 'long' })} ${fa(p!.y)}` : tx('بدون تاریخ'), items: [x] });
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
    if (editing && (await ask({ title: tx('حذف تولد {a1}؟', { a1: editing.name }), message: tx('این کار قابل بازگشت نیست.'), confirm: tx('حذف') }))) {
      await del('birthdays', editing.id);
      reset();
    }
  };

  const age = (b: Birthday, date: string) => (b.year ? fa(parts(date, b.cal, off).y - b.year) : '');
  // "born 12 Aban 1380 · turns 25": the age is the one reached on the coming birthday
  const born = (b: Birthday, date: string) =>
    b.year
      ? tx('متولد {a1} {a2} {a3} · {a4} ساله می‌شود', {
          a1: fa(b.day),
          a2: monthName(b.cal, b.month),
          a3: fa(b.year).replace(/٬/g, ''),
          a4: fa(parts(date, b.cal, off).y - b.year),
        })
      : '';
  const phoneBtns = (b: Birthday) => (
    <>
      {b.phone && <a className="icon-btn small" href={`tel:${b.phone}`} aria-label={tx('تماس با {a1}', { a1: b.name })}><Icon name="phone" size={17} stroke={1.9} /></a>}
      <button className="icon-btn small" aria-label={tx('ارسال تبریک به {a1}', { a1: b.name })} onClick={() => setWish(b)}><Icon name="gift" size={17} stroke={1.9} /></button>
    </>
  );
  // the date as the person's own calendar writes it; for another calendar than the main one, the main date follows in brackets
  const when = (b: { cal: Cal }, date: string) => {
    const own = label(date, b.cal, off, { day: 'numeric', month: 'long' });
    return b.cal === mainCal
      ? `${label(date, mainCal, off, { weekday: 'long' })} ${own} · ${tx(CAL_NAMES[b.cal])}`
      : `${own} · ${tx(CAL_NAMES[b.cal])} (${label(date, mainCal, off, { day: 'numeric', month: 'long' })})`;
  };

  return (
    <>
      <div className="page-head">
        <h1>{tx('تولدها')}</h1>
        <Button
          size="icon-md"
          variant="ghost"
          aria-label={tx('جستجو در تولدها')}
          onClick={openSearch}
          icon="search"
        />
      </div>

      {todays.map(({ b }) => (
        <section key={b.id} className="bday-today" aria-label={tx('تولد امروز')}>
          <span className="avatar xl" aria-hidden="true">{b.name.slice(0, 1)}</span>
          <div>
            <em>{tx('امروز')}</em>
            <b><bdi>{b.year ? tx('{a1} · {a2} ساله', { a1: b.name, a2: age(b, t) }) : b.name}</bdi></b>
            <span>{tx('{a1} · تقویم {a2}', { a1: label(t, b.cal, off, { day: 'numeric', month: 'long' }), a2: tx(CAL_NAMES[b.cal]) })}</span>
          </div>
          {b.phone && <a className="icon-btn small" href={`tel:${b.phone}`} aria-label={tx('تماس با {a1}', { a1: b.name })}><Icon name="phone" size={17} stroke={1.9} /></a>}
          <button className="icon-btn" aria-label={tx('ارسال تبریک')} onClick={() => setWish(b)}><Icon name="gift" size={19} stroke={1.9} /></button>
        </section>
      ))}

      {groups.length === 0 && (
        <section>
          <h2 className="sec-title">{tx('به‌زودی')}</h2>
          <Card variant="glass" className="bday-list">
            <p className="hint empty">{bdays.length ? tx('تولد دیگری در پیش نیست.') : tx('هنوز تولدی ثبت نکرده‌اید.')}</p>
          </Card>
        </section>
      )}
      {groups.map((g) => (
        <section key={g.key}>
          <h2 className="sec-title">{g.title}<small>{tn('{n} تولد', g.items.length)}</small></h2>
          <Card variant="glass" className="bday-list">
            {g.items.map(({ b, next }) => (
              <div key={b.id} className="bday-item">
                <button className="bday-row" onClick={() => edit(b)} aria-label={tx('ویرایش {a1}', { a1: b.name })}>
                  <span className={`avatar p${paletteOf(b.name)}`} aria-hidden="true">{b.name.slice(0, 1)}</span>
                  <div>
                    <b><bdi>b.name</bdi></b>
                    <span>{next ? when(b, next.date) : tx(CAL_NAMES[b.cal])}</span>
                    {next && b.year && <span>{born(b, next.date)}</span>}
                  </div>
                  {next && <span className={`days-chip${next.inDays <= 7 ? ' near' : ''}`}>{tn('{n} روز', next.inDays)}</span>}
                </button>
                {phoneBtns(b)}
              </div>
            ))}
          </Card>
        </section>
      ))}

      <section>
        <h2 className="sec-title">{tx('مناسبت‌ها')}<small>{tn('{n} مورد', occDated.length)}</small></h2>
        <Card variant="glass" className="bday-list">
          {occDated.length === 0 && <p className="hint empty">{tx('هنوز مناسبتی ثبت نشده است.')}</p>}
          {occDated.map(({ o, next }) => (
            <div key={o.id} className="bday-item">
              <button className="bday-row" onClick={() => editOcc(o)} aria-label={tx('ویرایش {a1}', { a1: o.title })}>
                <span className={`avatar p${paletteOf(o.title)}`} aria-hidden="true">{o.title.slice(0, 1)}</span>
                <div>
                  <b><bdi>{o.title}</bdi></b>
                  <span>{next ? when(o, next.date) : tx(CAL_NAMES[o.cal])}</span>
                  {tagName(o.tagId) && <span>{tagName(o.tagId)}</span>}
                </div>
                {next && <span className={`days-chip${next.inDays <= 7 ? ' near' : ''}`}>{tn('{n} روز', next.inDays)}</span>}
              </button>
            </div>
          ))}
        </Card>
      </section>

      <section ref={occFormRef} className="glass bday-form" aria-label={editingOcc ? tx('ویرایش مناسبت') : tx('افزودن مناسبت')}>
        <div className="bf-head">
          <span>{editingOcc ? tx('ویرایش مناسبت') : tx('افزودن مناسبت')}</span>
          <span className="inline-actions">
            {editingOcc && <Button variant="ghost" size="sm" onClick={resetOcc}>{tx('انصراف')}</Button>}
            <Button variant="primary" size="sm" disabled={!occValid} onClick={saveOcc}>{tx('ذخیره')}</Button>
          </span>
        </div>
        <div className="birthday-fields-group">
          <label className="bf-name">
            <span>{tx('نام مناسبت')}</span>
            <input value={of.title} onChange={(e) => setOF({ ...of, title: e.target.value })} />
          </label>
          <div className="radios bf-cal-radios" role="radiogroup" aria-label={tx('نوع تقویم')}>
            {CALS.map((c) => (
              <button key={c} role="radio" aria-checked={of.cal === c} className={of.cal === c ? 'on' : ''} onClick={() => setOF({ ...of, cal: c })}>{tx(CAL_NAMES[c])}</button>
            ))}
          </div>
          <div className="bf-grid">
            <label className={`bf-tile${of.day && !(occDay >= 1 && occDay <= maxDay(of.cal, of.month)) ? ' bad' : ''}`}>
              <span>{tx('روز')}</span>
              <input inputMode="numeric" value={of.day} onChange={(e) => setOF({ ...of, day: e.target.value })} />
            </label>
            <div className="bf-tile">
              <span>{tx('ماه')}</span>
              <Choice className="pick-text" label={tx('ماه')} value={of.month} options={MONTHS[of.cal].map((_, i): [number, string] => [i + 1, monthName(of.cal, i + 1)])} onChange={(m) => setOF({ ...of, month: m })} />
            </div>
          </div>
          <div className="bf-grid">
            <div className="bf-tile">
              <span>{tx('یادآوری')}</span>
              <Choice className="pick-text" label={tx('یادآوری')} value={Number(of.remindLead)} options={LEADS} onChange={(v) => setOF({ ...of, remindLead: String(v) })} />
            </div>
            <div className="bf-tile">
              <span>{tx('برچسب')}</span>
              <Choice className="pick-text" label={tx('برچسب')} value={of.tagId} options={[['', tx('همه')], ...tags.map((tg): [string, string] => [tg.id, tg.name])]} onChange={(v) => setOF({ ...of, tagId: v })} />
            </div>
          </div>
        </div>
        {editingOcc && <Button variant="danger" block onClick={removeOcc} icon="trash">{tx('حذف این مناسبت')}</Button>}
      </section>

      <section ref={formRef} className="glass bday-form" aria-label={editing ? tx('ویرایش تولد') : tx('افزودن تولد')}>
        <div className="bf-head">
          <span>{editing ? tx('ویرایش تولد') : tx('افزودن تولد')}</span>
          <span className="inline-actions">
            {editing && <Button variant="ghost" size="sm" onClick={reset}>{tx('انصراف')}</Button>}
            <Button variant="primary" size="sm" disabled={!valid} onClick={save}>{tx('ذخیره')}</Button>
          </span>
        </div>
        <BirthdayFields d={f} set={(patch) => setF((x) => ({ ...x, ...patch }))} />
        {editing && <Button variant="danger" block onClick={remove} icon="trash">{tx('حذف این تولد')}</Button>}
      </section>

      {wish && <WishSheet name={wish.name} phone={wish.phone} personId={wish.personId} onClose={() => setWish(null)} />}
    </>
  );
}
