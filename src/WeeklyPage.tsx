import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { addDays, fa, label, today } from './cal';
import { dueExchanges } from './domain/ledger';
import { overdueContacts } from './domain/keepinTouch';
import { dueCount } from './domain/rules/schedule';
import { summarizeWeek } from './domain/weekly';
import { personLabel } from './format';
import { Icon, type IconName } from './Icon';
import { birthdaysWithin } from './todayFeed';
import { listTodos, overdue } from './todoFilters';
import { tn, tx } from './i18n';
import { Button, Card } from './ui';

const dayOfMs = (ms: number) => new Date(ms).toLocaleDateString('sv');

function Stat({ icon, tone, value, name }: { icon: IconName; tone: string; value: number; name: string }) {
  return (
    <div className="wk-stat">
      <span className={`tile ${tone}`} aria-hidden="true"><Icon name={icon} size={17} stroke={1.9} /></span>
      <b>{fa(value)}</b>
      <span>{name}</span>
    </div>
  );
}

/** The weekly review: the last 7 days in numbers, who needs a call, what slipped, and what the next 7 days hold. */
export function WeeklyPage({ openPerson, onClose }: { openPerson: (id: string) => void; onClose: () => void }) {
  const t = today();
  const from = addDays(t, -6);
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const interactions = useLiveQuery(() => db.interactions.toArray(), []) ?? [];
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const dones = useLiveQuery(() => db.done.toArray(), []) ?? [];
  const reviews = useLiveQuery(() => db.ruleReviews.toArray(), []) ?? [];
  const breaks = useLiveQuery(() => db.ruleBreaks.toArray(), []) ?? [];
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? [];
  const exchanges = useLiveQuery(() => db.exchanges.toArray(), []) ?? [];
  const bdays = useLiveQuery(() => db.birthdays.toArray(), []) ?? [];

  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, personLabel(p)])), [people]);
  const week = useMemo(() => summarizeWeek(from, t, { interactions, dones, reviews, breaks }, dayOfMs), [from, t, interactions, dones, reviews, breaks]);
  const quiet = useMemo(() => overdueContacts(people, interactions, t, Date.now()).slice(0, 5), [people, interactions, t]);
  const late = useMemo(() => overdue(tasks, dones, t), [tasks, dones, t]);
  const ahead = useMemo(() => listTodos(tasks, dones, 'upcoming', t).filter((r) => r.due && r.due <= addDays(t, 7)).length, [tasks, dones, t]);
  const soon = useMemo(() => birthdaysWithin(bdays, 7, t).filter((x) => x.inDays > 0), [bdays, t]);
  const dueRules = dueCount(rules.filter((r) => !r.archivedAt), t);
  const owed = dueExchanges(exchanges, t).length;
  const topRule = week.topBroken && rules.find((r) => r.id === week.topBroken!.ruleId);
  const range = `${label(from, 'persian', 0, { day: 'numeric', month: 'long' })} ${tx('تا')} ${label(t, 'persian', 0, { day: 'numeric', month: 'long' })}`;

  return (
    <>
      <header className="dd-head">
        <Button variant="ghost" size="icon-md" aria-label={tx('بازگشت')} onClick={onClose} icon="chevronRight" />
        <span>{tx('مرور هفتگی')}</span>
        <span className="head-spacer" />
      </header>
      <p className="hint wk-range">{range}</p>

      <div className="wk-stats">
        <Stat icon="users" tone="purple" value={week.interactionCount} name={tx('تعامل')} />
        <Stat icon="checkCircle" tone="green" value={week.tasksDone} name={tx('کار انجام‌شده')} />
        <Stat icon="listChecks" tone="blue" value={week.reviews} name={tx('مرور قانون')} />
        <Stat icon="close" tone="peach" value={week.breaks} name={tx('شکست قانون')} />
      </div>

      <section className="glass followups-card">
        <div className="fc-head"><h2>{tx('با چه کسانی حرف زدی')}</h2></div>
        {week.talkedTo.length === 0 ? (
          <p className="hint">{tx('این هفته تعاملی ثبت نکردی. یک تماس کوتاه هم حساب است.')}</p>
        ) : (
          <div className="wk-chips">
            {week.talkedTo.slice(0, 12).map((x) => (
              <button key={x.personId} type="button" className="mini-btn" onClick={() => openPerson(x.personId)}>
                <bdi>{nameOf.get(x.personId) ?? '…'}</bdi>{x.count > 1 ? ` · ${fa(x.count)}` : ''}
              </button>
            ))}
          </div>
        )}
      </section>

      {quiet.length > 0 && (
        <section className="glass followups-card">
          <div className="fc-head">
            <h2>{tx('وقتش است زنگ بزنی')}</h2>
            <span className="progress-pill">{tn('{n} نفر', quiet.length)}</span>
          </div>
          {quiet.map(({ person, days }) => (
            <button key={person.id} type="button" className="fc-row" onClick={() => openPerson(person.id)}>
              <div className="fc-details">
                <span className="fc-name"><bdi>{personLabel(person)}</bdi></span>
                <span className="fc-sub">{tx('{a1} روز از آخرین تعامل', { a1: fa(days) })}</span>
              </div>
            </button>
          ))}
        </section>
      )}

      {(late.length > 0 || topRule || dueRules > 0 || owed > 0) && (
        <section className="glass followups-card">
          <div className="fc-head"><h2>{tx('چیزهایی که عقب مانده')}</h2></div>
          {late.length > 0 && <p className="wk-line"><Icon name="clock" size={15} stroke={2} />{tn('{n} کار از موعدش گذشته', late.length)}</p>}
          {dueRules > 0 && <p className="wk-line"><Icon name="listChecks" size={15} stroke={2} />{tn('{n} قانون برای مرور مانده', dueRules)}</p>}
          {owed > 0 && <p className="wk-line"><Icon name="repeat" size={15} stroke={2} />{tn('{n} دادوستد سررسید شده', owed)}</p>}
          {topRule && week.topBroken && <p className="wk-line"><Icon name="target" size={15} stroke={2} />{tx('بیشترین شکست: «{a1}» ({a2} بار)', { a1: topRule.title, a2: fa(week.topBroken.count) })}</p>}
        </section>
      )}

      <section className="glass followups-card">
        <div className="fc-head"><h2>{tx('هفتهٔ پیش‌رو')}</h2></div>
        <p className="wk-line"><Icon name="calendar" size={15} stroke={2} />{ahead > 0 ? tn('{n} کار با موعد در هفتهٔ آینده', ahead) : tx('کار با موعدی در هفتهٔ آینده نیست.')}</p>
        {soon.map(({ b, inDays }) => (
          <p key={b.id + inDays} className="wk-line"><Icon name="cake" size={15} stroke={2} />{tx('تولد {a1} — {a2} روز دیگر', { a1: b.name, a2: fa(inDays) })}</p>
        ))}
      </section>

      {week.interactionCount === 0 && week.tasksDone === 0 && week.reviews === 0 && (
        <Card className="empty-state small"><p className="hint">{tx('هفتهٔ آرامی بوده؛ از همین حالا یک کار کوچک را شروع کن.')}</p></Card>
      )}
    </>
  );
}
