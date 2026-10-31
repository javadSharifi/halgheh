import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { fa, label } from './cal';
import { Icon } from './Icon';
import { CRITERION_LABEL } from './ratings';
import { STATUS_LABEL } from './skills';
import { introducers, whoCan, type Hit } from './whoCanEngine';
import { tn, tx } from './i18n';

const PALETTE = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;

/**
 * R4: "who do I know who can do X?". Specialists first, then people matched only through other fields; introducers get
 * their own section and are never mixed in (section 6). Every row shows the plain facts behind its place — evidence,
 * trustworthiness, last contact — and no row shows a single summed score.
 */
export function WhoCan({ initialQuery, openPerson, onClose }: { initialQuery?: string; openPerson: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState(initialQuery ?? '');
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const skills = useLiveQuery(() => db.skills.toArray(), []) ?? [];
  const personSkills = useLiveQuery(() => db.personSkills.toArray(), []) ?? [];
  const ratings = useLiveQuery(() => db.ratings.toArray(), []) ?? [];
  const interactions = useLiveQuery(() => db.interactions.toArray(), []) ?? [];
  const tags = useLiveQuery(() => db.tags.toArray(), []) ?? [];
  const personTags = useLiveQuery(() => db.personTags.toArray(), []) ?? [];
  const notes = useLiveQuery(() => db.personNotes.toArray(), []) ?? [];
  const relationships = useLiveQuery(() => db.relationships.toArray(), []) ?? [];

  const data = useMemo(
    () => ({ people, skills, personSkills, ratings, interactions, tags, personTags, notes }),
    [people, skills, personSkills, ratings, interactions, tags, personTags, notes],
  );
  const hitList = useMemo(() => whoCan(q, data), [q, data]);
  const specialists = hitList.filter((h) => h.isSpecialist);
  const others = hitList.filter((h) => !h.isSpecialist);
  const refs = useMemo(() => introducers(specialists, data, relationships), [specialists, data, relationships]);
  const searching = q.trim() !== '';

  const trustOf = (h: Hit) => h.why.trust;
  const lastOf = (h: Hit) => (h.why.lastContact ? label(h.why.lastContact, 'persian', 0, { day: 'numeric', month: 'long' }) : null);

  const Card = ({ hit }: { hit: Hit }) => (
    <button className="glass who-card" onClick={() => openPerson(hit.person.id)}>
      <span className={`avatar p${PALETTE(hit.person.displayName)}`} aria-hidden="true">{hit.person.displayName.slice(0, 1)}</span>
      <span className="who-body">
        <b>{hit.person.displayName}</b>
        {[hit.person.occupation, hit.person.city].filter(Boolean).length > 0 && (
          <span className="who-meta">{[hit.person.occupation, hit.person.city].filter(Boolean).join(' · ')}</span>
        )}
        <span className="why-chips">
          {hit.why.skills.length > 0 && <i className="w-skill"><Icon name="toolbox" size={11} stroke={2.2} />{hit.why.skills.join(`${tx('،')} `)}</i>}
          {hit.why.evidence && <i className="w-ev">{tx(STATUS_LABEL[hit.why.evidence])}</i>}
          {/* the one trust criterion, side by side with the evidence, never added to it */}
          <i className={`w-trust${trustOf(hit) === undefined ? ' none' : ''}`}>
            <Icon name="target" size={11} stroke={2.2} />
            {trustOf(hit) === undefined ? tx('ثبت نشده') : tx('{a1}: {a2}', { a1: tx(CRITERION_LABEL.trustworthiness), a2: fa(trustOf(hit)!) })}
          </i>
          {lastOf(hit) && <i className="w-when"><Icon name="history" size={11} stroke={2.2} />{lastOf(hit)}</i>}
        </span>
      </span>
      <Icon name="chevronLeft" size={16} stroke={2} />
    </button>
  );

  return (
    <>
      <header className="dd-head">
        <button className="icon-btn" aria-label={tx('بازگشت')} onClick={onClose}><Icon name="chevronRight" /></button>
        <span>{tx('چه کسی می‌تواند')}</span>
        <span className="head-spacer" />
      </header>

      <form className="search-top" onSubmit={(e) => e.preventDefault()} role="search">
        <label className="search-field">
          <Icon name="search" size={20} stroke={1.9} />
          <span className="sr-only">{tx('چه کسی می‌تواند')}</span>
          <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('چه کاری؟ مثلاً لوله‌کشی')} />
          {q && <button type="button" className="clear" aria-label={tx('پاک کردن')} onClick={() => setQ('')}><span><Icon name="close" size={12} stroke={3} /></span></button>}
        </label>
      </form>

      {!searching && (
        <section className="glass empty-state search-empty">
          <span className="tile purple" aria-hidden="true"><Icon name="toolbox" size={24} stroke={1.8} /></span>
          <b>{tx('چه کاری را می‌خواهی انجام دهد؟')}</b>
          <p className="hint">{tx('یک مهارت بنویس تا ببینی چه کسی آن را بلد است، و اگر خودت کسی را نمی‌شناسی، چه کسی می‌تواند معرفی کند.')}</p>
        </section>
      )}

      {searching && hitList.length === 0 && (
        <section className="glass empty-state search-empty">
          <b>{tx('کسی پیدا نشد')}</b>
          <p className="hint">{tx('کلمهٔ دیگری امتحان کن، یا در پروفایل افراد مهارتشان را ثبت کن.')}</p>
        </section>
      )}

      {specialists.length > 0 && (
        <section>
          <h2 className="sec-title">{tx('متخصص‌ها')}<small>{tn('{n} نفر', specialists.length)}</small></h2>
          <div className="who-list">{specialists.map((h) => <Card key={h.person.id} hit={h} />)}</div>
        </section>
      )}

      {refs.length > 0 && (
        <section>
          <h2 className="sec-title">{tx('از طریق معرفی')}<small>{tn('{n} مسیر', refs.length)}</small></h2>
          <div className="who-list">
            {refs.map((s) => (
              <button key={`${s.pathText}`} className="glass who-card ref-card" onClick={() => openPerson(s.person.id)}>
                <span className={`avatar p${PALETTE(s.person.displayName)}`} aria-hidden="true">{s.person.displayName.slice(0, 1)}</span>
                <span className="who-body">
                  <b>{s.specialist.displayName}</b>
                  <span className="ref-path">
                    <bdi>{s.pathWithTrades}</bdi>
                    {s.uncertain && <em className="c-dup">{tx('شاید')}</em>}
                  </span>
                  <span className="who-meta">
                                      {s.specialist.occupation
                      ? tx('{a1} · از طریق {a2}', { a1: s.specialist.occupation, a2: s.person.displayName })
                      : tx('از طریق {a1}', { a1: s.person.displayName })}
                  </span>
                </span>
                <Icon name="chevronLeft" size={16} stroke={2} />
              </button>
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="sec-title">{tx('بقیه')}<small>{tn('{n} نفر', others.length)}</small></h2>
          <div className="who-list">{others.map((h) => <Card key={h.person.id} hit={h} />)}</div>
        </section>
      )}
    </>
  );
}
