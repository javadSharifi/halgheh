import { Fragment, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Birthday, type Task, db } from './db';
import { CAL_NAMES, fa, label, today } from './cal';
import { faDigits, firstRun, isTime } from './format';
import { Icon } from './Icon';
import type { Note } from './notes';
import { clearRecents, findMatch, lastSearch, loadRecents, saveRecent, searchAll, snippet } from './search';
import { useSettings } from './settings';

type Filter = 'all' | 'notes' | 'tasks' | 'birthdays';
const FILTERS: [Filter, string][] = [['all', 'همه'], ['notes', 'یادداشت‌ها'], ['tasks', 'کارها'], ['birthdays', 'تولدها']];
const PALETTE = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;

/** Text with the matched part marked. */
function Hl({ text, q }: { text: string; q: string }) {
  const m = findMatch(text, q);
  if (!m) return <>{text}</>;
  return (
    <>
      {text.slice(0, m[0])}
      <mark>{text.slice(m[0], m[1])}</mark>
      {text.slice(m[1])}
    </>
  );
}

type Props = {
  initialFilter?: Filter;
  onClose: () => void;
  openNote: (n: Note) => void;
  openTask: (id: string) => void;
  openBirthday: (id: string) => void;
};

export function SearchPage({ initialFilter, onClose, openNote, openTask, openBirthday }: Props) {
  const { cal, hijriOffset: off } = useSettings();
  const [q, setQ] = useState(lastSearch.q);
  const [filter, setFilter] = useState<Filter>(initialFilter ?? lastSearch.filter);
  const [recents, setRecents] = useState(loadRecents);
  const t = today();

  const notes = useLiveQuery(() => db.notes.toArray(), []) ?? [];
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const birthdays = useLiveQuery(() => db.birthdays.toArray(), []) ?? [];
  const res = useMemo(() => searchAll(q, { notes, tasks, birthdays }, t, off), [q, notes, tasks, birthdays, t, off]);
  const total = res.notes.length + res.tasks.length + res.birthdays.length;
  const searching = q.trim() !== '';

  const set = (v: string) => {
    setQ(v);
    lastSearch.q = v;
  };
  const pickFilter = (f: Filter) => {
    setFilter(f);
    lastSearch.filter = f;
  };
  const remember = () => {
    saveRecent(q);
    setRecents(loadRecents());
  };
  const close = () => {
    lastSearch.q = '';
    lastSearch.filter = 'all';
    onClose();
  };
  const open = (f: () => void) => () => {
    remember();
    f();
  };

  const show = (k: Filter) => filter === 'all' || filter === k;
  const dayLabel = (d: string, long = true) => label(d, cal, off, long ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long' });

  const taskSub = (x: Task) => {
    if (x.active === false) return 'متوقف';
    const d = x.on ?? firstRun(x.mask, t);
    return `${d ? dayLabel(d) : ''}${isTime(x.time) ? ` · ${faDigits(x.time)}` : ''}`;
  };
  const bdaySub = (b: Birthday, inDays: number | null) => {
    if (inDays === null) return CAL_NAMES[b.cal];
    const d = new Date(`${t}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + inDays);
    const date = d.toISOString().slice(0, 10);
    return `${dayLabel(date)} · ${inDays === 0 ? 'امروز' : `${fa(inDays)} روز دیگر`}`;
  };

  return (
    <>
      <form className="search-top" onSubmit={(e) => { e.preventDefault(); remember(); }} role="search">
        <label className="search-field">
          <Icon name="search" size={20} stroke={1.9} />
          <span className="sr-only">جستجو در یادداشت‌ها، کارها و تولدها</span>
          <input type="search" autoFocus value={q} placeholder="جستجو در یادداشت‌ها، کارها و تولدها" onChange={(e) => set(e.target.value)} />
          {q && <button type="button" className="clear" aria-label="پاک کردن جستجو" onClick={() => set('')}><span><Icon name="close" size={12} stroke={3} /></span></button>}
        </label>
        <button type="button" className="text-btn big" onClick={close}>انصراف</button>
      </form>

      <div className="tabs" role="tablist" aria-label="دسته‌بندی نتایج">
        {FILTERS.map(([k, n]) => (
          <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => pickFilter(k)}>{k === 'all' && searching ? `${n} · ${fa(total)}` : n}</button>
        ))}
      </div>

      {!searching && recents.length > 0 && (
        <section className="recents">
          <div><h2>جستجوهای اخیر</h2><button className="text-btn" onClick={() => { clearRecents(); setRecents([]); }}>پاک کردن</button></div>
          <div className="recent-chips">
            {recents.map((r) => <button key={r} onClick={() => set(r)}><Icon name="history" size={14} stroke={1.9} />{r}</button>)}
          </div>
        </section>
      )}
      {!searching && recents.length === 0 && <p className="hint search-hint">برای یافتن یادداشت‌ها، کارها و تولدها تایپ کنید.</p>}

      {searching && (
        <div className="results">
          <span role="status" className="count-line">{total ? `${fa(total)} نتیجه برای «${q.trim()}»` : `نتیجه‌ای برای «${q.trim()}» پیدا نشد`}</span>

          {show('birthdays') && res.birthdays.length > 0 && (
            <section className="glass res-group" aria-label="تولدها">
              <span className="g-label peach">تولدها</span>
              {res.birthdays.map(({ b, inDays }) => (
                <button key={b.id} className="res-row" onClick={open(() => openBirthday(b.id))}>
                  <span className={`avatar p${PALETTE(b.name)}`} aria-hidden="true">{b.name.slice(0, 1)}</span>
                  <div><b><Hl text={b.name} q={q} /></b><span>{bdaySub(b, inDays)}</span></div>
                  <Icon name="chevronLeft" size={16} stroke={2} />
                </button>
              ))}
            </section>
          )}

          {show('tasks') && res.tasks.length > 0 && (
            <section className="glass res-group" aria-label="کارها">
              <span className="g-label blue">کارها</span>
              {res.tasks.map((x) => (
                <button key={x.id} className="res-row" onClick={open(() => openTask(x.id))}>
                  <span className="tile blue sq" aria-hidden="true"><Icon name="listChecks" size={18} stroke={1.9} /></span>
                  <div><b><Hl text={x.title} q={q} /></b><span>{taskSub(x)}</span></div>
                  <Icon name="chevronLeft" size={16} stroke={2} />
                </button>
              ))}
            </section>
          )}

          {show('notes') && res.notes.length > 0 && (
            <section className="glass res-group" aria-label="یادداشت‌ها">
              <span className="g-label purple">یادداشت‌ها</span>
              {res.notes.map((n) => (
                <button key={n.id} className="res-row note" onClick={open(() => openNote(n))}>
                  <span className="tile purple sq" aria-hidden="true"><Icon name="note" size={18} stroke={1.9} /></span>
                  <div>
                    <div className="res-top"><b><Hl text={n.title || 'بدون عنوان'} q={q} /></b><small>{dayLabel(n.date, false)}</small></div>
                    {n.text.trim() && <span><Fragment><Hl text={snippet(n.text, q)} q={q} /></Fragment></span>}
                  </div>
                </button>
              ))}
            </section>
          )}
        </div>
      )}
    </>
  );
}
