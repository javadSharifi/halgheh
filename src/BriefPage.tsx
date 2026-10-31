import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Person, db } from './db';
import { fa, label, monthName, parts, today } from './cal';
import { Icon } from './Icon';
import { STR, EXCHANGE_DIRECTION_LABEL } from './strings/rulebook';
import { normPhone } from './phone';
import { nextOccurrence } from './format';
import { CRITERION_LABEL, RATING_CRITERIA, SCORES, isScore } from './ratings';
import { TYPE_NAME } from './InteractionForm';
import { doneKey, doneDateFor } from './todoFilters';
import { dueText } from './domain/ledger';
import {
  briefBalance,
  briefNotes,
  briefRatings,
  hasAnyData,
  lastCheck,
  latestInteractions,
  myBreaksWithPerson,
  openExchanges,
  openFollowUps,
  openTodos,
  upcomingBirthday,
} from './domain/brief';
import { money, BalanceChips, ExchangeSheet } from './LedgerPage';
import { NewCheckSheet } from './PersonCheck';
import { InteractionForm } from './InteractionForm';
import { latestPlan } from './domain/rules/breaks';
import { tx } from './i18n';

const PALETTE = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;

/**
 * Part 4: one read-only page to open before meeting or calling someone. Each section only appears when it has data, so a
 * person with a single interaction gets one section, not eight empty ones. Nothing on this page writes except the buttons at
 * the bottom, which open the existing sheets.
 */
export function BriefPage({ personId, onBack, openCheck }: { personId: string; onBack: () => void; openCheck: (id: string) => void }) {
  const t = today();
  const person = useLiveQuery(() => db.people.get(personId), [personId]);
  const birthday = useLiveQuery(() => db.birthdays.where('personId').equals(personId).first(), [personId]);
  const interactions = useLiveQuery(() => db.interactions.where('personId').equals(personId).toArray(), [personId]) ?? [];
  const tasks = useLiveQuery(() => db.tasks.filter((x) => x.fromPersonId === personId).toArray(), [personId]) ?? [];
  const dones = useLiveQuery(() => db.done.toArray(), []) ?? [];
  const notes = useLiveQuery(() => db.personNotes.where('personId').equals(personId).toArray(), [personId]) ?? [];
  const ratings = useLiveQuery(() => db.ratings.where('personId').equals(personId).toArray(), [personId]) ?? [];
  const exchanges = useLiveQuery(() => db.exchanges.where('personId').equals(personId).toArray(), [personId]) ?? [];
  const settlements = useLiveQuery(() => db.exchangeSettlements.toArray(), []) ?? [];
  const checks = useLiveQuery(() => db.ruleChecks.where('personId').equals(personId).toArray(), [personId]) ?? [];
  const checkItems = useLiveQuery(() => db.ruleCheckItems.toArray(), []) ?? [];
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? [];
  const breaks = useLiveQuery(() => db.ruleBreaks.toArray(), []) ?? [];
  const [notesOpen, setNotesOpen] = useState(false);
  /** The brief's own actions reuse the existing sheets, so it never leaves the page mid-brief. */
  const [addingInteraction, setAddingInteraction] = useState(false);
  const [addingExchange, setAddingExchange] = useState(false);
  const [newCheck, setNewCheck] = useState(false);

  const latest = useMemo(() => latestInteractions(interactions, t), [interactions, t]);
  const followUps = useMemo(() => openFollowUps(interactions, t), [interactions, t]);
  const doneIds = useMemo(() => new Set(tasks.filter((task) => dones.some((d) => d.id === doneKey(task.id, doneDateFor(task)))).map((task) => task.id)), [tasks, dones]);
  const todos = useMemo(() => openTodos(tasks, doneIds, personId), [tasks, doneIds, personId]);
  const open = useMemo(() => openExchanges(exchanges, settlements, personId), [exchanges, settlements, personId]);
  const balance = useMemo(() => briefBalance(exchanges, settlements, personId), [exchanges, settlements, personId]);
  const bday = useMemo(() => {
    if (!birthday) return undefined;
    const next = nextOccurrence(birthday, t, 0);
    return upcomingBirthday(birthday, next?.inDays, 30);
  }, [birthday, t]);
  const myNotes = useMemo(() => briefNotes(notes), [notes]);
  const myRatings = useMemo(() => briefRatings(ratings, RATING_CRITERIA), [ratings]);
  const newestCheck = useMemo(() => [...checks].sort((a, b) => b.updatedAt - a.updatedAt)[0], [checks]);
  const check = useMemo(() => (newestCheck ? lastCheck(newestCheck, checkItems, rules) : undefined), [newestCheck, checkItems, rules]);
  const myBreaks = useMemo(() => myBreaksWithPerson(breaks, rules, personId, t), [breaks, rules, personId, t]);

  if (person === undefined) return <p className="hint">…</p>;
  if (!person) {
    return (
      <>
        <header className="dd-head">
          <button className="icon-btn" aria-label={tx(STR.feature.close)} onClick={onBack}><Icon name="chevronRight" /></button>
          <span>{tx(STR.brief.title)}</span>
          <span className="head-spacer" />
        </header>
        <p className="hint">{tx('این فرد پاک شده است.')}</p>
      </>
    );
  }

  const p: Person = person;
  const phone = p.phones.filter(Boolean)[0];
  const nothing = !hasAnyData({ interactions: latest, todos, exchanges: open, birthday: bday, notes: myNotes, ratings: myRatings, check, breaks: myBreaks });

  return (
    <>
      <header className="dd-head">
        <button className="icon-btn" aria-label={tx(STR.feature.close)} onClick={onBack}><Icon name="chevronRight" /></button>
        <span>{tx(STR.brief.title)}</span>
        <span className="head-spacer" />
      </header>

      <section className="glass brief-hero">
        <span className={`avatar big p${PALETTE(p.displayName)}`} aria-hidden="true">{p.displayName.trim().slice(0, 1)}</span>
        <div className="brief-who">
          <b><bdi>{p.displayName}</bdi></b>
          <span>{[p.occupation, p.city].filter(Boolean).join(' · ') || tx(STR.brief.readOnly)}</span>
        </div>
      </section>

      {nothing && (
        <section className="glass empty-state">
          <span className="tile blue" aria-hidden="true"><Icon name="info" size={24} stroke={1.7} /></span>
          <b>{tx(STR.brief.empty)}</b>
          <p className="hint">{tx(STR.brief.emptyBody)}</p>
        </section>
      )}

      {latest && (
        <section>
          <h2 className="sec-title">{tx(STR.brief.interactions)}<small>{fa(latest.length)}</small></h2>
          <div className="glass timeline">
            {latest.map((x) => (
              <div key={x.id} className="tl-row">
                <span className="tl-dot" aria-hidden="true">
                  <Icon name={x.type === 'call' ? 'phone' : x.type === 'message' ? 'note' : x.type === 'meeting' ? 'users' : 'history'} size={14} stroke={2} />
                </span>
                <span className="tl-body">
                  <b><bdi>{x.summary}</bdi></b>
                  <span className="tl-meta">{tx(TYPE_NAME[x.type])} · {label(x.occurredAt, 'persian', 0, { day: 'numeric', month: 'long' })}</span>
                  {x.outcome && <span className="tl-out">{x.outcome}</span>}
                </span>
              </div>
            ))}
          </div>
          {followUps && (
            <div className="glass set-list brief-gap">
              {followUps.slice(0, 3).map((x) => (
                <div key={x.id} className="set-row">
                  <span className="tile peach" aria-hidden="true"><Icon name="bell" size={16} stroke={1.9} /></span>
                  <span className="set-name">
                    {tx(STR.brief.followUp)}
                    <small className="set-sub">{label(x.followUpDate, 'persian', 0, { day: 'numeric', month: 'long' })} · {x.summary}</small>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {todos && (
        <section>
          <h2 className="sec-title">{tx(STR.brief.todos)}<small>{fa(todos.length)}</small></h2>
          <div className="glass set-list">
            {todos.map((task) => (
              <div key={task.id} className="set-row">
                <span className="tile blue" aria-hidden="true"><Icon name="listChecks" size={16} stroke={1.9} /></span>
                <span className="set-name">
                  <bdi>{task.title}</bdi>
                  <small className="set-sub">{task.on ? label(task.on, 'persian', 0, { day: 'numeric', month: 'long' }) : tx('بدون موعد')}</small>
                </span>
                <em className="chip-ok">{tx(STR.brief.todoOpen)}</em>
              </div>
            ))}
          </div>
        </section>
      )}

      {(open || balance) && (
        <section>
          <div className="section-head">
            <h2>{tx(STR.brief.exchanges)}</h2>
            {balance && <BalanceChips earn={balance.earn} owe={balance.owe} />}
          </div>
          <div className="glass set-list">
            {(open ?? []).map((e) => (
              <div key={e.id} className="set-row">
                <span className={`tile ${e.direction === 'gave' ? 'blue' : 'peach'}`} aria-hidden="true">
                  <Icon name={e.direction === 'gave' ? 'upload' : 'download'} size={16} stroke={1.9} />
                </span>
                <span className="set-name">
                  <bdi>{e.title}</bdi>
                  <small className="set-sub">
                    {EXCHANGE_DIRECTION_LABEL[e.direction]}
                    {e.kind === 'money' && e.amount !== undefined ? ` · ${money(e.amount)}` : ''}
                    {e.dueOn ? ` · ${dueText(e.dueOn, t, fa)}` : ''}
                  </small>
                </span>
              </div>
            ))}
            {!open && balance && <p className="hint">{tx('دادوستد بازی نیست؛ فقط خالص پول بالاست.')}</p>}
          </div>
        </section>
      )}

      {bday && (
        <section>
          <h2 className="sec-title">{tx(STR.brief.birthday)}</h2>
          <div className="glass set-list">
            <div className="set-row">
              <span className="tile peach" aria-hidden="true"><Icon name="cake" size={16} stroke={1.9} /></span>
              <span className="set-name">
                {tx(STR.brief.birthdayIn(bday.inDays))}
                <small className="set-sub">
                  {fa(bday.birthday.day)} {monthName(bday.birthday.cal, bday.birthday.month)}
                  {bday.birthday.year && ` · ${tx('{a1} ساله', { a1: fa(parts(t, bday.birthday.cal, 0).y - bday.birthday.year) })}`}
                </small>
              </span>
            </div>
          </div>
        </section>
      )}

      {myNotes && (
        <section>
          <h2 className="sec-title">{tx(STR.brief.notes)}</h2>
          <div className="glass brief-notes">
            {myNotes.map((n) => (
              <p key={n.id} className={notesOpen ? undefined : 'clamp'}><bdi>{n.text}</bdi></p>
            ))}
            <button className="text-btn" onClick={() => setNotesOpen((x) => !x)}>
              {notesOpen ? tx(STR.brief.notesLess) : tx(STR.brief.notesMore)}
            </button>
          </div>
        </section>
      )}

      {myRatings && (
        <section>
          <h2 className="sec-title">{tx(STR.brief.ratings)}</h2>
          <div className="glass rate-grid brief-ratings">
            {myRatings.map(({ criterion, latest: r }) => (
              <div key={criterion} className="rate-cell static">
                <span className="rate-name">{tx(CRITERION_LABEL[criterion])}</span>
                {r && isScore(r.score) ? (
                  <>
                    <span className="rate-dots" aria-hidden="true">{SCORES.map((s) => <i key={s} className={s <= r.score ? 'on' : ''} />)}</span>
                    <span className="rate-value">{tx('{a1} از ۵', { a1: fa(r.score) })}</span>
                  </>
                ) : (
                  <>
                    <span className="rate-dots" aria-hidden="true">{SCORES.map((s) => <i key={s} />)}</span>
                    <span className="rate-value">{tx(STR.brief.ratingMissing)}</span>
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="hint rate-note">{tx('هر مورد جدا ارزیابی می‌شود؛ این‌ها با هم جمع یا میانگین نمی‌شوند.')}</p>
        </section>
      )}

      {check && (
        <section>
          <div className="section-head">
            <h2>{tx(STR.brief.lastCheck)}</h2>
            <span className="progress-pill">{check.check.status === 'closed' ? tx(STR.personCheck.closed) : tx(STR.personCheck.cardMode)}</span>
          </div>
          <div className="glass brief-check">
            <b className="brief-check-title">{check.check.title || tx(STR.personCheck.newTitle)}</b>
            <div className="check-summary compact">
              <div className="cs keeping"><b>{fa(check.counts.keeping)}</b><span>{tx(STR.personCheck.keepingCount)}</span></div>
              <div className="cs breaking"><b>{fa(check.counts.breaking)}</b><span>{tx(STR.personCheck.breakingCount)}</span></div>
              <div className="cs unknown"><b>{fa(check.counts.unknown)}</b><span>{tx(STR.personCheck.unknownCount)}</span></div>
            </div>
            {check.strict.length > 0 && (
              <div className="strict-list">
                <b className="strict-title"><Icon name="target" size={14} stroke={2.2} />{tx(STR.brief.strictBreaks)}</b>
                {check.strict.map((r) => <span key={r.id} className="strict-row">{r.title}</span>)}
              </div>
            )}
          </div>
        </section>
      )}

      {myBreaks && (
        <section>
          <h2 className="sec-title">{tx(STR.brief.myBreaks)}<small>{tx(STR.brief.myBreaksWindow)}</small></h2>
          <div className="glass set-list">
            {myBreaks.map(({ break: b, rule }) => {
              const plan = b.nextTimePlan?.trim() || latestPlan(breaks, rule.id);
              return (
                <div key={b.id} className="set-row brief-break">
                  <span className="tile peach" aria-hidden="true"><Icon name="close" size={16} stroke={2.2} /></span>
                  <span className="set-name">
                    <bdi>{rule.title}</bdi>
                    <small className="set-sub">{label(b.brokenOn, 'persian', 0, { day: 'numeric', month: 'long' })}{b.whatHappened ? ` · ${b.whatHappened}` : ''}</small>
                    {plan && <small className="set-sub brief-plan">{tx(STR.brief.plan)}: {plan}</small>}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="rf-foot brief-actions">
        <button className="big-btn" onClick={() => setAddingInteraction(true)}><Icon name="history" size={17} stroke={1.9} />{tx(STR.brief.addInteraction)}</button>
        <button className="big-btn" onClick={() => {
          const open = checks.find((c) => c.status === 'open');
          if (open) openCheck(open.id);
          else setNewCheck(true);
        }}><Icon name="listChecks" size={17} stroke={1.9} />{tx(STR.brief.startCheck)}</button>
        <button className="big-btn" onClick={() => setAddingExchange(true)}><Icon name="repeat" size={17} stroke={1.9} />{tx(STR.brief.addExchange)}</button>
        {phone ? (
          <a className="big-btn" href={`tel:${normPhone(phone)}`}><Icon name="phone" size={17} stroke={1.9} />{tx(STR.brief.call)}</a>
        ) : (
          <span className="big-btn disabled" aria-disabled="true"><Icon name="phone" size={17} stroke={1.9} />{tx(STR.brief.noPhone)}</span>
        )}
      </div>

      {addingInteraction && <InteractionForm personId={p.id} onClose={() => setAddingInteraction(false)} />}
      {addingExchange && <ExchangeSheet people={[p]} seedPersonId={p.id} exchange={null} onClose={() => setAddingExchange(false)} />}
      {newCheck && (
        <NewCheckSheet personId={p.id} onClose={() => setNewCheck(false)} onCreated={(id) => { setNewCheck(false); openCheck(id); }} />
      )}
    </>
  );
}
