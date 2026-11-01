import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, put } from './db';
import { fa, parts, today, wd } from './cal';
import { Icon } from './Icon';
import { useOnline } from './online';
import { getCfg } from './sync';
import { birthdaysWithin, followUpsDue, followUpLabel, recentPeople } from './todayFeed';
import { listTodos, overdue, doneDatesFor } from './todoFilters';
import { dueCount, dueRules } from './domain/rules/schedule';
import { STR } from './strings/rulebook';
import { dueExchanges } from './domain/ledger';
import { overdueContacts, withSnooze } from './domain/keepinTouch';
import { TodayWidget } from './TodayWidget';
import { tn, tx } from './i18n';
import { personLabel } from './format';

const PALETTE = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;

/** Connection chip: only meaningful when sync is on, otherwise the app is simply local and says nothing. */
function StatusChip() {
  const online = useOnline();
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  if (!getCfg()) return null;
  if (!online) return <span className="status"><Icon name="wifiOff" size={14} stroke={2} />{tx('آفلاین')}</span>;
  return pending ? <span className="status"><Icon name="refresh" size={14} stroke={2} />{tx('در حال همگام‌سازی')}</span> : <span className="status"><Icon name="cloudCheck" size={14} stroke={2} />{tx('همگام شد')}</span>;
}

type Props = {
  openSearch: () => void;
  openPerson: (id: string) => void;
  openTask: (id: string | null) => void;
  openTodos: () => void;
  openTouch: () => void;
  openWeekly: () => void;
  openRulebook: () => void;
  openReview: () => void;
  openLedger: () => void;
};

/**
 * Redesigned Today Dashboard:
 * Answers "what needs me today" with clear visual hierarchy, distinct card personalities,
 * streamlined layout, and zero clutter.
 */
export function TodayPage({ openSearch, openPerson, openTask, openTodos, openTouch, openWeekly, openRulebook, openReview, openLedger }: Props) {
  const t = today();
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  // only the done rows a task can own; the full history would load every tick ever recorded
  const dones = useLiveQuery(
    () => (tasks.length ? db.done.where('date').anyOf(doneDatesFor(tasks)).toArray() : []),
    [tasks],
  ) ?? [];
  const bdays = useLiveQuery(() => db.birthdays.toArray(), []) ?? [];
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const interactions = useLiveQuery(() => db.interactions.toArray(), []) ?? [];
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? [];
  const exchanges = useLiveQuery(() => db.exchanges.toArray(), []) ?? [];

  const todays = useMemo(() => listTodos(tasks, dones, 'today', t), [tasks, dones, t]);
  const late = useMemo(() => overdue(tasks, dones, t), [tasks, dones, t]);

  const soon = useMemo(() => birthdaysWithin(bdays, 7, t), [bdays, t]);
  const bdaysToday = useMemo(() => soon.filter((x) => x.inDays === 0), [soon]);
  const bdaysLater = useMemo(() => soon.filter((x) => x.inDays > 0), [soon]);

  const due = useMemo(() => followUpsDue(interactions, t), [interactions, t]);
  const ring = useMemo(() => overdueContacts(people, interactions, t, Date.now()), [people, interactions, t]);
  const fresh = useMemo(() => recentPeople(people), [people]);
  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, personLabel(p)])), [people]);

  const rulesDue = useMemo(() => dueCount(rules, t), [rules, t]);
  const pinned = useMemo(() => dueRules(rules.filter((r) => r.pinned), t, 3), [rules, t]);
  const ledgerDue = useMemo(() => dueExchanges(exchanges, t), [exchanges, t]);

  const hasUrgentItems = late.length > 0 || rulesDue > 0 || ledgerDue.length > 0 || pinned.length > 0;

  return (
    <div className="today-container">
      {/* 1. All-in-one Today Widget: Clock, Calendar, Today's Tasks & Quick Add */}
      <TodayWidget
        tasks={tasks}
        todays={todays}
        openTask={openTask}
        openSearch={openSearch}
        nameOf={nameOf}
        bdays={bdays}
        statusChip={<StatusChip />}
      />

      {/* 2. Birthday Today Celebration Banner (prominent & cheerful) */}
      {bdaysToday.length > 0 && (
        <section
          className="bday-celebrate-card"
          onClick={() => bdaysToday[0].b.personId && openPerson(bdaysToday[0].b.personId)}
          role="button"
          tabIndex={0}
          aria-label={tx('تولد امروز')}
        >
          <div className="bcc-left">
            <div className="bcc-icon-glow">
              <Icon name="cake" size={24} stroke={2} />
            </div>
            <div className="bcc-text">
              <b><bdi>{tx('امروز تولد {a1} است!', { a1: bdaysToday.map((x) => x.b.name).join(` ${tx('و')} `) })}</bdi></b>
              <span>
                {bdaysToday[0].b.year
                  ? tx('{a1} ساله می‌شود · تبریک یادت نره', { a1: fa(parts(t, bdaysToday[0].b.cal, 0).y - bdaysToday[0].b.year) })
                  : tx('این روز زیبا را گرامی بدار')}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="bcc-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (bdaysToday[0].b.personId) openPerson(bdaysToday[0].b.personId);
            }}
          >{tx('مشاهده')}</button>
        </section>
      )}

      {/* 3. Action Center: High-priority items needing attention (distinct identities) */}
      {hasUrgentItems && (
        <div className="action-center">
          {/* Overdue Tasks Alert Banner */}
          {late.length > 0 && (
            <div
              className="overdue-banner"
              onClick={openTodos}
              role="button"
              tabIndex={0}
              aria-label={tx('کارهای عقب‌افتاده')}
            >
              <div className="ob-info">
                <div className="ob-icon">
                  <Icon name="clock" size={18} stroke={2.2} />
                </div>
                <div className="ob-text">
                  <b>{tx('کارهای عقب‌افتاده')}</b>
                  <span>{tn('{n} کار منتظر انجام یا تعیین زمان است', late.length)}</span>
                </div>
              </div>
              <div className="ob-badge">{tx('بررسی')}<Icon name="chevronLeft" size={13} stroke={2.4} />
              </div>
            </div>
          )}

          {/* Rules Review Ritual Card */}
          {rulesDue > 0 ? (
            <div
              className="rule-ritual-card"
              onClick={openReview}
              role="button"
              tabIndex={0}
              aria-label={tx('مرور روزانه آیین‌نامه')}
            >
              <div className="rrc-left">
                <div className="rrc-icon">
                  <Icon name="repeat" size={20} stroke={2.2} />
                </div>
                <div className="rrc-content">
                  <b>{tx('{a1} · مرور روزانه', { a1: tx(STR.feature.title) })}</b>
                  <span>{tx('{a1} آمادهٔ بررسی است', { a1: tx(STR.today.cardTitle(rulesDue)) })}</span>
                </div>
              </div>
              <button
                type="button"
                className="rrc-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  openReview();
                }}
              >{tx('شروع مرور')}</button>
            </div>
          ) : pinned.length > 0 ? (
            <div
              className="rule-ritual-card"
              onClick={openRulebook}
              role="button"
              tabIndex={0}
              aria-label={tx('اصل سنجاق‌شده آیین‌نامه')}
            >
              <div className="rrc-left">
                <div className="rrc-icon">
                  <Icon name="pin" size={19} stroke={2.2} />
                </div>
                <div className="rrc-content">
                  <b>{pinned[0].title}</b>
                  <span>{pinned[0].why || tx('از اصول سنجاق‌شدهٔ آیین‌نامه')}</span>
                </div>
              </div>
              <span className="ob-badge">{tx('آیین‌نامه')}</span>
            </div>
          ) : null}

          {/* Ledger Due Card */}
          {ledgerDue.length > 0 && (
            <div
              className="ledger-alert-card"
              onClick={openLedger}
              role="button"
              tabIndex={0}
              aria-label={tx('موعد تبادل‌ها')}
            >
              <div className="lac-info">
                <span
                  className={`tile ${ledgerDue[0].direction === 'gave' ? 'blue' : 'peach'}`}
                  aria-hidden="true"
                >
                  <Icon name={ledgerDue[0].direction === 'gave' ? 'upload' : 'download'} size={16} stroke={2} />
                </span>
                <div>
                  <b style={{ fontSize: 14 }}>{ledgerDue[0].title}</b>
                  <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block' }}>
                    {ledgerDue.length > 1
                      ? tx('{a1} و {a2} مورد دیگر', { a1: nameOf.get(ledgerDue[0].personId) ?? tx('کسی'), a2: fa(ledgerDue.length - 1) })
                      : nameOf.get(ledgerDue[0].personId) ?? tx('کسی')}
                  </span>
                </div>
              </div>
              <span className="lac-badge">
                {tx(STR.ledger.title)} <Icon name="chevronLeft" size={12} stroke={2} />
              </span>
            </div>
          )}
        </div>
      )}



      {/* 5. Upcoming Birthdays (Only shown if any upcoming in next 1..7 days) */}
      {bdaysLater.length > 0 && (
        <section aria-label={tx('تولدهای پیش‌رو')}>
          <div className="section-head" style={{ margin: '8px 4px 6px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--muted)' }}>{tx('تولدهای هفته')}</h2>
          </div>
          <div className="upcoming-bdays-strip">
            {bdaysLater.map(({ b, inDays }) => (
              <div
                key={b.id}
                className="ub-chip"
                onClick={() => b.personId && openPerson(b.personId)}
                role="button"
                tabIndex={0}
                aria-label={tx('تولد {a1}', { a1: b.name })}
              >
                <span className={`avatar p${PALETTE(b.name)}`} aria-hidden="true">
                  {b.name.slice(0, 1)}
                </span>
                <div className="ub-info">
                  <span className="ub-name"><bdi>{b.name}</bdi></span>
                  <span className="ub-days">{inDays === 1 ? tx('فردا') : tx('{a1} روز دیگر', { a1: fa(inDays) })}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Follow-ups Due (Clean connection cards) */}
      {due.length > 0 && (
        <section className="glass followups-card" aria-label={tx('پیگیری‌ها')}>
          <div className="fc-head">
            <h2>{tx('پیگیری‌ها')}</h2>
            <span className="progress-pill">{tn('{n} مورد', due.length)}</span>
          </div>
          {due.slice(0, 3).map((x) => (
            <button
              key={x.id}
              type="button"
              className="fc-row"
              onClick={() => openPerson(x.personId)}
              aria-label={tx('پیگیری {a1}', { a1: nameOf.get(x.personId) ?? tx('شخص') })}
            >
              <span className={`avatar p${PALETTE(nameOf.get(x.personId) ?? '')}`} aria-hidden="true">
                {(nameOf.get(x.personId) ?? tx('؟')).slice(0, 1)}
              </span>
              <div className="fc-details">
                <span className="fc-name">{nameOf.get(x.personId) ?? tx('کسی')}</span>
                <span className="fc-sub"><bdi>{x.summary}</bdi></span>
              </div>
              <em className="due-chip">{followUpLabel(x.followUpDate, t)}</em>
            </button>
          ))}
          {due.length > 3 && (
            <button
              type="button"
              className="text-btn more-row"
              onClick={openSearch}
              style={{ padding: '6px 0' }}
            >{tn('و {n} پیگیری دیگر', due.length - 3)}</button>
          )}
        </section>
      )}

      {/* Weekly review: pushed to the front on Friday and Saturday, one tap away from More the rest of the week */}
      {(wd(t) === 5 || wd(t) === 6) && (
        <button type="button" className="glass followups-card wk-banner" onClick={openWeekly}>
          <span className="tile green" aria-hidden="true"><Icon name="history" size={20} stroke={1.9} /></span>
          <span className="wk-banner-text">
            <b>{tx('هفته تمام شد؟')}</b>
            <small>{tx('مرور هفتگی: با چه کسانی حرف زدی، چه چیزی عقب ماند، هفتهٔ بعد چه خبر است.')}</small>
          </span>
          <Icon name="chevronLeft" size={16} stroke={2} />
        </button>
      )}

      {/* 6b. Keep in touch: people whose ring is overdue */}
      {ring.length > 0 && (
        <section className="glass followups-card" aria-label={tx('چه کسی را صدا بزنم')}>
          <div className="fc-head">
            <h2>{tx('چه کسی را صدا بزنم')}</h2>
            <button type="button" className="progress-pill as-btn" onClick={openTouch}>{tn('{n} نفر', ring.length)} ‹</button>
          </div>
          {ring.slice(0, 3).map(({ person, days }) => (
            <div key={person.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="fc-row" style={{ flex: 1 }} onClick={() => openPerson(person.id)} aria-label={tx('پروفایل {a1}', { a1: person.displayName })}>
                <span className={`avatar p${PALETTE(person.displayName)}`} aria-hidden="true">{person.displayName.slice(0, 1)}</span>
                <div className="fc-details">
                  <span className="fc-name">{personLabel(person)}</span>
                  <span className="fc-sub">{tx('{a1} روز از آخرین تماس', { a1: fa(days) })}</span>
                </div>
              </button>
              <button className="mini-btn" onClick={() => put('people', withSnooze(person, Date.now()))}>{tx('یک هفته بعد')}</button>
            </div>
          ))}
        </section>
      )}

      {/* 7. Recently Added People (Horizontal avatar reel) */}
      {fresh.length > 0 && (
        <section className="fresh-reel-container" aria-label={tx('تازه‌افزوده‌ها')}>
          <div className="frc-head">
            <h2>{tx('تازه‌افزوده‌ها')}</h2>
            <button type="button" className="text-btn" onClick={openSearch}>{tx('همه')}</button>
          </div>
          <div className="fresh-reel">
            {fresh.map((p) => (
              <button
                key={p.id}
                type="button"
                className="fresh-person-item"
                onClick={() => openPerson(p.id)}
                aria-label={tx('پروفایل {a1}', { a1: p.displayName })}
              >
                <span className={`avatar p${PALETTE(p.displayName)}`} aria-hidden="true">
                  {p.displayName.slice(0, 1)}
                </span>
                <span><bdi>{personLabel(p)}</bdi></span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 8. Global empty state when app is brand new */}
      {tasks.length === 0 && people.filter((p) => !p.isSelf).length === 0 && (
        <section className="glass empty-state" aria-label={tx('حلقه خالی است')}>
          <span className="tile blue" aria-hidden="true">
            <Icon name="users" size={24} stroke={1.7} />
          </span>
          <b>{tx('حلقه خالی است')}</b>
          <p className="hint">{tx('از تب «افراد» آدم‌هایت را اضافه کن؛ کارها و تولدهایشان همین‌جا می‌آید.')}</p>
        </section>
      )}
    </div>
  );
}
