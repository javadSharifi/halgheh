import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { fa, parts, today } from './cal';
import { Icon } from './Icon';
import { useOnline } from './online';
import { getCfg } from './sync';
import { birthdaysWithin, followUpsDue, followUpLabel, recentPeople } from './todayFeed';
import { listTodos, overdue } from './todoFilters';
import { dueCount, dueRules } from './domain/rules/schedule';
import { STR } from './strings/rulebook';
import { dueExchanges } from './domain/ledger';
import { TodayWidget } from './TodayWidget';

const PALETTE = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;

/** Connection chip: only meaningful when sync is on, otherwise the app is simply local and says nothing. */
function StatusChip() {
  const online = useOnline();
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  if (!getCfg()) return null;
  if (!online) return <span className="status"><Icon name="wifiOff" size={14} stroke={2} />آفلاین</span>;
  return pending ? <span className="status"><Icon name="refresh" size={14} stroke={2} />در حال همگام‌سازی</span> : <span className="status"><Icon name="cloudCheck" size={14} stroke={2} />همگام شد</span>;
}

type Props = {
  openSearch: () => void;
  openPerson: (id: string) => void;
  openTask: (id: string | null) => void;
  openTodos: () => void;
  openRulebook: () => void;
  openReview: () => void;
  openLedger: () => void;
};

/**
 * Redesigned Today Dashboard:
 * Answers "what needs me today" with clear visual hierarchy, distinct card personalities,
 * streamlined layout, and zero clutter.
 */
export function TodayPage({ openSearch, openPerson, openTask, openTodos, openRulebook, openReview, openLedger }: Props) {
  const t = today();
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const dones = useLiveQuery(() => db.done.toArray(), []) ?? [];
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
  const fresh = useMemo(() => recentPeople(people), [people]);
  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, p.displayName])), [people]);

  const rulesDue = useMemo(() => dueCount(rules, t), [rules, t]);
  const pinned = useMemo(() => dueRules(rules.filter((r) => r.pinned), t, 3), [rules, t]);
  const ledgerDue = useMemo(() => dueExchanges(exchanges, t), [exchanges, t]);

  const hasUrgentItems = late.length > 0 || rulesDue > 0 || ledgerDue.length > 0 || pinned.length > 0;

  return (
    <div className="today-container">
      {/* 1. All-in-one Today Widget: Clock, Calendar, Today's Tasks & Quick Add */}
      <TodayWidget
        tasks={tasks}
        dones={dones}
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
          aria-label="تولد امروز"
        >
          <div className="bcc-left">
            <div className="bcc-icon-glow">
              <Icon name="cake" size={24} stroke={2} />
            </div>
            <div className="bcc-text">
              <b>امروز تولد {bdaysToday.map((x) => x.b.name).join(' و ')} است!</b>
              <span>
                {bdaysToday[0].b.year
                  ? `${fa(parts(t, bdaysToday[0].b.cal, 0).y - bdaysToday[0].b.year)} ساله می‌شود · تبریک یادت نره`
                  : 'این روز زیبا را گرامی بدار'}
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
          >
            مشاهده
          </button>
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
              aria-label="کارهای عقب‌افتاده"
            >
              <div className="ob-info">
                <div className="ob-icon">
                  <Icon name="clock" size={18} stroke={2.2} />
                </div>
                <div className="ob-text">
                  <b>کارهای عقب‌افتاده</b>
                  <span>{fa(late.length)} کار منتظر انجام یا تعیین زمان است</span>
                </div>
              </div>
              <div className="ob-badge">
                بررسی <Icon name="chevronLeft" size={13} stroke={2.4} />
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
              aria-label="مرور روزانه آیین‌نامه"
            >
              <div className="rrc-left">
                <div className="rrc-icon">
                  <Icon name="repeat" size={20} stroke={2.2} />
                </div>
                <div className="rrc-content">
                  <b>{STR.feature.title} · مرور روزانه</b>
                  <span>{STR.today.cardTitle(rulesDue)} آمادهٔ بررسی است</span>
                </div>
              </div>
              <button
                type="button"
                className="rrc-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  openReview();
                }}
              >
                شروع مرور
              </button>
            </div>
          ) : pinned.length > 0 ? (
            <div
              className="rule-ritual-card"
              onClick={openRulebook}
              role="button"
              tabIndex={0}
              aria-label="اصل سنجاق‌شده آیین‌نامه"
            >
              <div className="rrc-left">
                <div className="rrc-icon">
                  <Icon name="pin" size={19} stroke={2.2} />
                </div>
                <div className="rrc-content">
                  <b>{pinned[0].title}</b>
                  <span>{pinned[0].why || 'از اصول سنجاق‌شدهٔ آیین‌نامه'}</span>
                </div>
              </div>
              <span className="ob-badge">آیین‌نامه</span>
            </div>
          ) : null}

          {/* Ledger Due Card */}
          {ledgerDue.length > 0 && (
            <div
              className="ledger-alert-card"
              onClick={openLedger}
              role="button"
              tabIndex={0}
              aria-label="موعد تبادل‌ها"
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
                    {nameOf.get(ledgerDue[0].personId) ?? 'کسی'}
                    {ledgerDue.length > 1 ? ` · و ${fa(ledgerDue.length - 1)} مورد دیگر` : ''}
                  </span>
                </div>
              </div>
              <span className="lac-badge">
                {STR.ledger.title} <Icon name="chevronLeft" size={12} stroke={2} />
              </span>
            </div>
          )}
        </div>
      )}



      {/* 5. Upcoming Birthdays (Only shown if any upcoming in next 1..7 days) */}
      {bdaysLater.length > 0 && (
        <section aria-label="تولدهای پیش‌رو">
          <div className="section-head" style={{ margin: '8px 4px 6px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--muted)' }}>
              تولدهای هفته
            </h2>
          </div>
          <div className="upcoming-bdays-strip">
            {bdaysLater.map(({ b, inDays }) => (
              <div
                key={b.id}
                className="ub-chip"
                onClick={() => b.personId && openPerson(b.personId)}
                role="button"
                tabIndex={0}
                aria-label={`تولد ${b.name}`}
              >
                <span className={`avatar p${PALETTE(b.name)}`} aria-hidden="true">
                  {b.name.slice(0, 1)}
                </span>
                <div className="ub-info">
                  <span className="ub-name">{b.name}</span>
                  <span className="ub-days">{inDays === 1 ? 'فردا' : `${fa(inDays)} روز دیگر`}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Follow-ups Due (Clean connection cards) */}
      {due.length > 0 && (
        <section className="glass followups-card" aria-label="پیگیری‌ها">
          <div className="fc-head">
            <h2>پیگیری‌ها</h2>
            <span className="progress-pill">{fa(due.length)} مورد</span>
          </div>
          {due.slice(0, 3).map((x) => (
            <button
              key={x.id}
              type="button"
              className="fc-row"
              onClick={() => openPerson(x.personId)}
              aria-label={`پیگیری ${nameOf.get(x.personId) ?? 'شخص'}`}
            >
              <span className={`avatar p${PALETTE(nameOf.get(x.personId) ?? '')}`} aria-hidden="true">
                {(nameOf.get(x.personId) ?? '؟').slice(0, 1)}
              </span>
              <div className="fc-details">
                <span className="fc-name">{nameOf.get(x.personId) ?? 'کسی'}</span>
                <span className="fc-sub">{x.summary}</span>
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
            >
              و {fa(due.length - 3)} پیگیری دیگر
            </button>
          )}
        </section>
      )}

      {/* 7. Recently Added People (Horizontal avatar reel) */}
      {fresh.length > 0 && (
        <section className="fresh-reel-container" aria-label="تازه‌افزوده‌ها">
          <div className="frc-head">
            <h2>تازه‌افزوده‌ها</h2>
            <button type="button" className="text-btn" onClick={openSearch}>همه</button>
          </div>
          <div className="fresh-reel">
            {fresh.map((p) => (
              <button
                key={p.id}
                type="button"
                className="fresh-person-item"
                onClick={() => openPerson(p.id)}
                aria-label={`پروفایل ${p.displayName}`}
              >
                <span className={`avatar p${PALETTE(p.displayName)}`} aria-hidden="true">
                  {p.displayName.slice(0, 1)}
                </span>
                <span>{p.displayName}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 8. Global empty state when app is brand new */}
      {tasks.length === 0 && people.filter((p) => !p.isSelf).length === 0 && (
        <section className="glass empty-state" aria-label="حلقه خالی است">
          <span className="tile blue" aria-hidden="true">
            <Icon name="users" size={24} stroke={1.7} />
          </span>
          <b>حلقه خالی است</b>
          <p className="hint">از تب «افراد» آدم‌هایت را اضافه کن؛ کارها و تولدهایشان همین‌جا می‌آید.</p>
        </section>
      )}
    </div>
  );
}
