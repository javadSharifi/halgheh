import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Person, db } from './db';
import { CAL_NAMES, fa, label, today } from './cal';
import { faDigits, isTime, personLabel } from './format';
import { buildIndex, bdayIn, personFacts, queryWords, runSearch, type Doc } from './domain/search';
import { STATUS_LABEL } from './skills';
import { CRITERION_LABEL } from './ratings';
import { clearRecents, findMatch, lastSearch, loadRecents, saveRecent } from './search';
import { Icon } from './Icon';
import { STR } from './strings/rulebook';
import { tx, tk } from './i18n';
import { Card, Chip } from './ui';

type Filter = 'all' | 'people' | 'notes' | 'todos' | 'photos' | 'birthdays' | 'rules' | 'exchanges';
const FILTERS: [Filter, string][] = [
  ['all', tk('همه')],
  ['people', tk('افراد')],
  ['notes', tk('یادداشت‌ها')],
  ['todos', tk('کارها')],
  ['photos', tk('عکس‌ها')],
  ['birthdays', tk('تولدها')],
  ['rules', tx(STR.search.chip)],
  ['exchanges', tx(STR.ledger.title)],
];
const PALETTE = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;
const KIND_NAME: Record<Doc['kind'], string> = {
  person: tk('فرد'),
  note: tk('یادداشت'),
  todo: tk('کار'),
  interaction: tk('تعامل'),
  tag: tk('برچسب'),
  birthday: tk('تولد'),
  photo: tk('عکس'),
  rule: STR.search.kind,
  exchange: STR.ledger.kindExchange,
};
/** Section headings need the plural, and the generic "…ها" suffix does not fit every word. */
const KIND_PLURAL: Partial<Record<Doc['kind'], string>> = { rule: STR.search.section, exchange: STR.ledger.title };
const KIND_ICON = { person: 'users', note: 'note', todo: 'listChecks', interaction: 'history', tag: 'tag', birthday: 'cake', photo: 'image', rule: 'listChecks', exchange: 'repeat' } as const;
const KIND_TONE = { person: 'blue', note: 'green', todo: 'blue', interaction: 'peach', tag: 'purple', birthday: 'peach', photo: 'purple', rule: 'purple', exchange: 'green' } as const;

/** Text with the first matched word marked. */
function Hl({ text, words }: { text: string; words: string[] }) {
  const m = words.map((w) => findMatch(text, w)).find((x): x is [number, number] => !!x);
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
  openPerson: (id: string) => void;
  openTask: (id: string) => void;
  openBirthday: (id: string) => void;
  /** Rules are not edited in the search screen; opening one goes to the rulebook, where the full context lives. */
  openRule: (id: string) => void;
};

export function SearchPage({ initialFilter, onClose, openPerson, openTask, openBirthday, openRule }: Props) {
  const [q, setQ] = useState(lastSearch.q);
  const [filter, setFilter] = useState<Filter>(initialFilter ?? (lastSearch.filter as Filter) ?? 'all');
  const [recents, setRecents] = useState(loadRecents);
  const t = today();
  // the page opens with an empty box, so none of the tables are read until the user actually searches
  const words = queryWords(q);
  const active = words.length > 0;

  const people = useLiveQuery(() => (active ? db.people.toArray() : []), [active]) ?? [];
  const tasks = useLiveQuery(() => (active ? db.tasks.toArray() : []), [active]) ?? [];
  const birthdays = useLiveQuery(() => (active ? db.birthdays.toArray() : []), [active]) ?? [];
  const notes = useLiveQuery(() => (active ? db.personNotes.toArray() : []), [active]) ?? [];
  const interactions = useLiveQuery(() => (active ? db.interactions.toArray() : []), [active]) ?? [];
  const tags = useLiveQuery(() => (active ? db.tags.toArray() : []), [active]) ?? [];
  const personTags = useLiveQuery(() => (active ? db.personTags.toArray() : []), [active]) ?? [];
  const photos = useLiveQuery(() => (active ? db.photos.toArray() : []), [active]) ?? [];
  const skills = useLiveQuery(() => (active ? db.skills.toArray() : []), [active]) ?? [];
  const personSkills = useLiveQuery(() => (active ? db.personSkills.toArray() : []), [active]) ?? [];
  const ratings = useLiveQuery(() => (active ? db.ratings.toArray() : []), [active]) ?? [];
  const rules = useLiveQuery(() => (active ? db.rules.toArray() : []), [active]) ?? [];
  const exchanges = useLiveQuery(() => (active ? db.exchanges.toArray() : []), [active]) ?? [];

  const index = useMemo(
    () => buildIndex({ people, tasks, birthdays, notes, interactions, tags, personTags, photos, skills, personSkills, ratings, rules, exchanges }),
    [people, tasks, birthdays, notes, interactions, tags, personTags, photos, skills, personSkills, ratings, rules, exchanges],
  );
  // section 6: every person result shows which fields matched, the evidence status, the trust rating and the last contact
  const facts = useMemo(
    () => personFacts({ people, tasks, birthdays, notes, interactions, tags, personTags, photos, skills, personSkills, ratings }),
    [people, tasks, birthdays, notes, interactions, tags, personTags, photos, skills, personSkills, ratings],
  );
  const hits = useMemo(() => runSearch(index, q), [index, q]);
  const byPerson = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  // people first (the notebook is a people app), then the rows that hang off them, then standalone rows
  const order: Doc['kind'][] = ['person', 'interaction', 'note', 'todo', 'birthday', 'exchange', 'photo', 'rule', 'tag'];
  const sorted = [...hits].sort((a, b) => order.indexOf(a.doc.kind) - order.indexOf(b.doc.kind));
  const counts = order.reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: sorted.filter((h) => h.doc.kind === k).length }), {});
  const total = sorted.length;
  const searching = words.length > 0;

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

  const show = (k: Doc['kind']) =>
    filter === 'all' ||
    (filter === 'people' && k === 'person') ||
    (filter === 'notes' && (k === 'note' || k === 'interaction')) ||
    (filter === 'todos' && k === 'todo') ||
    (filter === 'photos' && k === 'photo') ||
    (filter === 'birthdays' && k === 'birthday') ||
    (filter === 'rules' && k === 'rule') ||
    (filter === 'exchanges' && k === 'exchange');

  const dayLabel = (d: string) => label(d, 'persian', 0, { weekday: 'long', day: 'numeric', month: 'long' });

  const sub = (h: (typeof hits)[number]) => {
    const d = h.doc;
    if (d.kind === 'person') {
      const p = byPerson.get(d.id);
      const meta = [p?.occupation, p?.city].filter(Boolean).join(' · ');
      return meta || tx('در دفترچهٔ آدم‌ها');
    }
    if (d.kind === 'note' || d.kind === 'interaction') { const p = byPerson.get(d.personId ?? ''); return p ? personLabel(p) : ''; }
    if (d.kind === 'todo') {
      const x = tasks.find((k) => k.id === d.id);
      return x ? `${x.on ? dayLabel(x.on) : tx('بدون تاریخ')}${isTime(x.time) ? ` · ${faDigits(x.time)}` : ''}` : '';
    }
    if (d.kind === 'birthday') {
      const b = birthdays.find((k) => k.id === d.id);
      if (!b) return '';
      const inDays = bdayIn(b, t, 0);
      return inDays === null ? tx(CAL_NAMES[b.cal]) : inDays === 0 ? tx('{a1} · امروز', { a1: tx(CAL_NAMES[b.cal]) }) : tx('{a1} · {a2} روز دیگر', { a1: tx(CAL_NAMES[b.cal]), a2: fa(inDays) });
    }
    if (d.kind === 'photo') { const p = byPerson.get(d.personId ?? ''); return p ? personLabel(p) : tx('در گالری'); }
    if (d.kind === 'rule') return tx(STR.feature.title);
    if (d.kind === 'exchange') { const p = byPerson.get(d.personId ?? ''); return p ? personLabel(p) : tx(STR.ledger.title); }
    return tx('برچسب');
  };

  const go = (h: (typeof hits)[number]) => {
    const d = h.doc;
    if (d.kind === 'person') return () => openPerson(d.id);
    if (d.kind === 'note' || d.kind === 'interaction') return d.personId ? () => openPerson(d.personId!) : undefined;
    if (d.kind === 'todo') return () => openTask(d.id);
    if (d.kind === 'birthday') return () => openBirthday(d.id);
    if (d.kind === 'rule') return () => openRule(d.id);
    // a ledger row is opened through its person: the ledger page itself has no per-row route
    if (d.kind === 'exchange') return d.personId ? () => openPerson(d.personId!) : undefined;
    if (d.kind === 'photo') return d.personId ? () => openPerson(d.personId!) : undefined;
    return undefined;
  };

  return (
    <>
      <form className="search-top" onSubmit={(e) => { e.preventDefault(); remember(); }} role="search">
        <label className="search-field">
          <Icon name="search" size={20} stroke={1.9} />
          <span className="sr-only">{tx('جستجو در دفترچه')}</span>
          <input type="search" autoFocus value={q} placeholder={tx('نام، شماره، مهارت، یادداشت…')} onChange={(e) => set(e.target.value)} />
          {q && <button type="button" className="clear" aria-label={tx('پاک کردن جستجو')} onClick={() => set('')}><span><Icon name="close" size={12} stroke={3} /></span></button>}
        </label>
        <button type="button" className="text-btn big" onClick={close}>{tx('انصراف')}</button>
      </form>

      <div className="tabs" role="tablist" aria-label={tx('دسته‌بندی نتایج')}>
        {FILTERS.map(([k, n]) => (
          <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => pickFilter(k)}>
            {k === 'all' && searching ? `${n} · ${fa(total)}` : n}
          </button>
        ))}
      </div>

      {!searching && recents.length > 0 && (
        <section className="recents">
          <div><h2>{tx('جستجوهای اخیر')}</h2><button className="text-btn" onClick={() => { clearRecents(); setRecents([]); }}>{tx('پاک کردن')}</button></div>
          <div className="recent-chips">
            {recents.map((r) => (
              <Chip key={r} icon="history" onClick={() => set(r)}>
                {r}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {!searching && recents.length === 0 && (
        <Card variant="glass" className="empty-state search-empty">
          <span className="tile blue" aria-hidden="true"><Icon name="search" size={24} stroke={1.8} /></span>
          <b>{tx('چه کسی را می‌خواهی پیدا کنی؟')}</b>
          <p className="hint">{tx('نام، شمارهٔ تلفن، شهر، شغل، برچسب یا بخشی از یک یادداشت را بنویس. همهٔ کلمه‌ها باید پیدا شوند.')}</p>
        </Card>
      )}

      {searching && (
        <div className="results">
          <span role="status" className="count-line">
            {total ? tx('{a1} نتیجه برای «{a2}»', { a1: fa(total), a2: q.trim() }) : tx('نتیجه‌ای برای «{a1}» پیدا نشد', { a1: q.trim() })}
          </span>

          {total === 0 && (
            <Card variant="glass" className="empty-state search-empty">
              <span className="tile purple" aria-hidden="true"><Icon name="search" size={22} stroke={1.8} /></span>
              <b>{tx('چیزی پیدا نشد')}</b>
              <p className="hint">{tx('هجی را ساده‌تر کن یا فقط بخشی از نام را بنویس؛ ي/ك عربی و نیم‌فاصله اهمیتی ندارند.')}</p>
            </Card>
          )}

          {order.filter((k) => show(k) && counts[k] > 0).map((kind) => (
            <Card key={kind} variant="glass" className="res-group" aria-label={KIND_NAME[kind]}>
              <span className="g-label">{tx(KIND_PLURAL[kind] ?? '') || tx('{a1}ها', { a1: tx(KIND_NAME[kind]) })}</span>
              {sorted.filter((h) => h.doc.kind === kind).map((h) => {
                const action = go(h);
                const Row = action ? 'button' : 'div';
                return (
                  <Row key={h.doc.id} className="res-row" onClick={action}>
                    {kind === 'person' ? (
                      <span className={`avatar p${PALETTE(h.doc.title)}`} aria-hidden="true">{h.doc.title.slice(0, 1)}</span>
                    ) : (
                      <span className={`tile ${KIND_TONE[kind]} sq`} aria-hidden="true"><Icon name={KIND_ICON[kind]} size={18} stroke={1.9} /></span>
                    )}
                    <div>
                      <b><Hl text={h.doc.title} words={words} /></b>
                      <span>{sub(h)}</span>
                      {/* the "why" chips section 6 asks for: matched fields, evidence, trust (or unrated), last contact */}
                      {kind === 'person' && (
                        <em className="why-chips">
                          {h.why.length > 0 && <i>{h.why.slice(0, 2).map((w) => (w.length > 20 ? `${w.slice(0, 20)}…` : w)).join(' · ')}</i>}
                          {facts.evidence.has(h.doc.id) && <i className="w-ev">{tx(STATUS_LABEL[facts.evidence.get(h.doc.id) as keyof typeof STATUS_LABEL])}</i>}
                          <i className={`w-trust${facts.trust.has(h.doc.id) ? '' : ' none'}`}>
                            {facts.trust.has(h.doc.id)
                              ? tx('{a1}: {a2}', { a1: tx(CRITERION_LABEL.trustworthiness), a2: fa(facts.trust.get(h.doc.id)!) })
                              : tx('ثبت نشده')}
                          </i>
                          {facts.last.has(h.doc.id) && <i className="w-when">{label(facts.last.get(h.doc.id)!, 'persian', 0, { day: 'numeric', month: 'long' })}</i>}
                        </em>
                      )}
                      {kind !== 'person' && action && h.why.length > 1 && (
                        <em className="why-chips">{h.why.slice(0, 2).map((w, i) => <i key={i}>{w.length > 24 ? `${w.slice(0, 24)}…` : w}</i>)}</em>
                      )}
                    </div>
                    {action && <Icon name="chevronLeft" size={16} stroke={2} />}
                  </Row>
                );
              })}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export type { Filter as SearchFilter };
export type { Person };
