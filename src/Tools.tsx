import { useState } from 'react';
import { CALS, CAL_NAMES, type Cal, addDays, fa, fullDate, label, parts, today } from './cal';
import { ask } from './confirm';
import { DatePicker } from './DatePicker';
import { nextOccurrence } from './format';
import { Icon, type IconName } from './Icon';
import { useSettings } from './settings';
import { span } from './dateSpan';
import { uid } from './db';

type Tool = 'convert' | 'diff' | 'countdown' | 'age';
const TOOLS: { id: Tool; title: string; sub: string; icon: IconName }[] = [
  { id: 'convert', title: 'تبدیل تاریخ', sub: 'شمسی، میلادی، قمری', icon: 'calendarDays' },
  { id: 'diff', title: 'فاصلهٔ دو تاریخ', sub: 'چند سال، ماه و روز', icon: 'history' },
  { id: 'countdown', title: 'شمارش معکوس', sub: 'رویدادهای پیش‌رو', icon: 'clock' },
  { id: 'age', title: 'محاسبهٔ سن', sub: 'سن و تولد بعدی', icon: 'cake' },
];

/** A button that shows a date and opens the three-calendar picker. */
function DateField({ label: name, value, onChange }: { label: string; value: string; onChange: (d: string) => void }) {
  const { cal, hijriOffset: off } = useSettings();
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="field-label">{name}</span>
      <button className="rf-date" onClick={() => setOpen(true)}>
        <Icon name="calendar" size={18} stroke={1.9} />
        {value ? `${label(value, cal, off, { weekday: 'long' })} ${fullDate(value, cal, off)}` : 'انتخاب تاریخ'}
      </button>
      {open && <DatePicker value={value || today()} onPick={(d) => { onChange(d); setOpen(false); }} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Which calendar the years/months of a result are counted in. */
function CalPick({ value, onChange }: { value: Cal; onChange: (c: Cal) => void }) {
  return (
    <div className="radios" role="radiogroup" aria-label="شمارش بر اساس تقویم">
      {CALS.map((c) => <button key={c} role="radio" aria-checked={value === c} className={value === c ? 'on' : ''} onClick={() => onChange(c)}>{CAL_NAMES[c]}</button>)}
    </div>
  );
}

const ymd = (s: { y: number; m: number; d: number }) =>
  [s.y && `${fa(s.y)} سال`, s.m && `${fa(s.m)} ماه`, s.d && `${fa(s.d)} روز`].filter(Boolean).join(' و ') || '۰ روز';

function Convert() {
  const { hijriOffset: off } = useSettings();
  const [d, setD] = useState(today());
  return (
    <div className="glass rf-card">
      <DateField label="تاریخ (در هر تقویمی انتخاب کن)" value={d} onChange={setD} />
      <div className="tool-result">
        {CALS.map((c) => (
          <div key={c} className="tool-line"><span>{CAL_NAMES[c]}</span><b>{label(d, c, off, { weekday: 'long' })} {fullDate(d, c, off)}</b></div>
        ))}
      </div>
    </div>
  );
}

function Diff() {
  const s = useSettings();
  const [a, setA] = useState(today());
  const [b, setB] = useState(addDays(today(), 30));
  const [cal, setCal] = useState<Cal>(s.cal);
  const [from, to] = a <= b ? [a, b] : [b, a];
  const r = span(from, to, cal, s.hijriOffset);
  return (
    <div className="glass rf-card">
      <DateField label="از تاریخ" value={a} onChange={setA} />
      <DateField label="تا تاریخ" value={b} onChange={setB} />
      <CalPick value={cal} onChange={setCal} />
      <div className="tool-result">
        <b className="big-num">{fa(r.days)} روز</b>
        <div className="tool-line"><span>به سال و ماه و روز</span><b>{ymd(r)}</b></div>
        <div className="tool-line"><span>به هفته</span><b>{fa(Math.floor(r.days / 7))} هفته و {fa(r.days % 7)} روز</b></div>
      </div>
    </div>
  );
}

type Event = { id: string; title: string; date: string };
const KEY = 'countdowns';
const load = (): Event[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((e) => e && typeof e.id === 'string' && typeof e.title === 'string' && /^\d{4}-\d\d-\d\d$/.test(e.date)) : [];
  } catch {
    return [];
  }
};

function Countdown() {
  const { cal, hijriOffset: off } = useSettings();
  const [events, setEvents] = useState(load);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(addDays(today(), 7));
  const t = today();
  const save = (list: Event[]) => {
    setEvents(list);
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked: the list still works until the app closes */ }
  };
  const days = (d: string) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${t}T00:00:00Z`)) / 864e5);
  const sorted = [...events].sort((x, y) => x.date.localeCompare(y.date));
  const upcoming = sorted.filter((e) => e.date >= t);
  const past = sorted.filter((e) => e.date < t).reverse();
  const row = (e: Event) => {
    const n = days(e.date);
    return (
      <div key={e.id} className="cd-row">
        <div>
          <b>{e.title}</b>
          <span>{label(e.date, cal, off, { weekday: 'long' })} {fullDate(e.date, cal, off)}</span>
        </div>
        <span className={`days-chip${n >= 0 && n <= 7 ? ' near' : ''}`}>{n === 0 ? 'امروز' : n > 0 ? `${fa(n)} روز مانده` : `${fa(-n)} روز پیش`}</span>
        <button className="icon-btn small" aria-label={`حذف ${e.title}`} onClick={async () => { if (await ask({ title: `حذف «${e.title}»؟`, message: 'این رویداد از شمارش معکوس برداشته می‌شود.', confirm: 'حذف' })) save(events.filter((x) => x.id !== e.id)); }}><Icon name="trash" size={16} stroke={2} /></button>
      </div>
    );
  };
  return (
    <>
      <div className="glass rf-card">
        <label>
          <span className="field-label">نام رویداد</span>
          <input className="rf-input" value={title} maxLength={60} placeholder="مثلاً امتحان ریاضی" onChange={(e) => setTitle(e.target.value)} />
        </label>
        <DateField label="تاریخ رویداد" value={date} onChange={setDate} />
        <button className="primary big-btn" disabled={!title.trim()} onClick={() => { save([...events, { id: uid(), title: title.trim(), date }]); setTitle(''); }}><Icon name="plus" size={18} stroke={2.2} />افزودن به شمارش معکوس</button>
      </div>
      {events.length === 0 && <p className="hint">هنوز رویدادی نیست.</p>}
      {upcoming.length > 0 && <div className="glass cd-list">{upcoming.map(row)}</div>}
      {past.length > 0 && (
        <>
          <h2 className="sec-title">گذشته</h2>
          <div className="glass cd-list">{past.map(row)}</div>
        </>
      )}
      <p className="rf-note"><Icon name="info" size={13} stroke={2} />این فهرست فقط روی همین گوشی می‌ماند و همگام نمی‌شود.</p>
    </>
  );
}

function Age() {
  const s = useSettings();
  const [birth, setBirth] = useState('');
  const [cal, setCal] = useState<Cal>(s.cal);
  const t = today();
  const bad = birth !== '' && birth > t;
  const r = birth && !bad ? span(birth, t, cal, s.hijriOffset) : null;
  const p = birth ? parts(birth, cal, s.hijriOffset) : null;
  const next = p && !bad ? nextOccurrence({ id: '', name: '', cal, month: p.m, day: p.d }, t, s.hijriOffset) : null;
  return (
    <div className="glass rf-card">
      <DateField label="تاریخ تولد" value={birth} onChange={setBirth} />
      <CalPick value={cal} onChange={setCal} />
      {bad && <p className="form-error">تاریخ تولد نمی‌تواند در آینده باشد.</p>}
      {r && (
        <div className="tool-result">
          <b className="big-num">{ymd(r)}</b>
          <div className="tool-line"><span>مجموع روزهای زندگی</span><b>{fa(r.days)} روز</b></div>
          <div className="tool-line"><span>روز هفتهٔ تولد</span><b>{label(birth, s.cal, s.hijriOffset, { weekday: 'long' })}</b></div>
          {next && <div className="tool-line"><span>تولد بعدی</span><b>{next.inDays === 0 ? 'امروز!' : `${fa(next.inDays)} روز دیگر`} · {label(next.date, s.cal, s.hijriOffset, { weekday: 'long' })} {fullDate(next.date, s.cal, s.hijriOffset)}</b></div>}
        </div>
      )}
    </div>
  );
}

export function ToolsPage({ onBack }: { onBack: () => void }) {
  const [tool, setTool] = useState<Tool | null>(null);
  const cur = TOOLS.find((x) => x.id === tool);
  return (
    <>
      <header className="dd-head">
        <button className="icon-btn" aria-label={cur ? 'بازگشت به جعبه ابزار' : 'بازگشت'} onClick={() => (cur ? setTool(null) : onBack())}><Icon name="chevronRight" /></button>
        <span>{cur ? cur.title : 'جعبه ابزار'}</span>
        <span className="head-spacer" />
      </header>
      {!cur && (
        <div className="tool-grid">
          {TOOLS.map((x) => (
            <button key={x.id} className="glass tool-tile" onClick={() => setTool(x.id)}>
              <span className="tile blue" aria-hidden="true"><Icon name={x.icon} size={20} stroke={1.9} /></span>
              <b>{x.title}</b>
              <span>{x.sub}</span>
            </button>
          ))}
        </div>
      )}
      {tool === 'convert' && <Convert />}
      {tool === 'diff' && <Diff />}
      {tool === 'countdown' && <Countdown />}
      {tool === 'age' && <Age />}
    </>
  );
}
