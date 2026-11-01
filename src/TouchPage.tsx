import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, put } from './db';
import { fa, today } from './cal';
import { ask } from './confirm';
import { CIRCLES, circleDays } from './circles';
import { daysSinceContact, lastSeen, withSnooze } from './domain/keepinTouch';
import { personLabel } from './format';
import { Icon } from './Icon';
import { tn, tx } from './i18n';
import { Button, Card } from './ui';

const paletteOf = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;

/**
 * "Keep in touch" overview: who has gone quiet for longer than their rhythm, then everyone grouped by closeness with how
 * long ago the last interaction was. The rhythm of a person stays theirs; the group only suggests it.
 */
export function TouchPage({ openPerson, onClose }: { openPerson: (id: string) => void; onClose: () => void }) {
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const interactions = useLiveQuery(() => db.interactions.toArray(), []) ?? [];
  const t = today();
  const now = Date.now();

  const live = useMemo(() => people.filter((p) => !p.isSelf && !p.archivedAt), [people]);
  const rows = useMemo(
    () => live.map((p) => ({ p, days: daysSinceContact(p, interactions, t, now), seen: !!lastSeen(p.id, interactions) })),
    [live, interactions, t, now],
  );
  const late = rows
    .filter(({ p, days }) => p.cadenceDays && days > p.cadenceDays && (p.dueSnoozeUntil ?? 0) <= now)
    .sort((a, b) => b.days - a.days);
  const groups = [...CIRCLES.map((c) => ({ key: c.key as string, title: tx(c.name), items: rows.filter((r) => r.p.circle === c.key) })), { key: '', title: tx('دسته‌بندی نشده'), items: rows.filter((r) => !r.p.circle) }].filter((g) => g.items.length);
  const withoutRhythm = live.filter((p) => p.circle && !p.cadenceDays);

  const applyDefaults = async () => {
    if (!(await ask({ title: tx('ریتم پیشنهادی برای {a1} نفر ثبت شود؟', { a1: fa(withoutRhythm.length) }), message: tx('فقط کسانی که دسته دارند ولی ریتم ندارند عوض می‌شوند. هر کدام را بعداً می‌توانی در پروفایلش تغییر بدهی یا خالی کنی.'), confirm: tx('ثبت') }))) return;
    for (const p of withoutRhythm) await put('people', { ...p, cadenceDays: circleDays(p.circle), updatedAt: Date.now() });
  };

  const row = ({ p, days, seen }: (typeof rows)[number], snooze: boolean) => (
    <div key={p.id} className="touch-row">
      <button type="button" className="fc-row" onClick={() => openPerson(p.id)} aria-label={tx('پروفایل {a1}', { a1: p.displayName })}>
        <span className={`avatar p${paletteOf(p.displayName)}`} aria-hidden="true">{p.displayName.slice(0, 1)}</span>
        <div className="fc-details">
          <span className="fc-name"><bdi>{personLabel(p)}</bdi></span>
          <span className="fc-sub">
            {seen ? tx('{a1} روز از آخرین تعامل', { a1: fa(days) }) : tx('هنوز تعاملی ثبت نشده')}
            {p.cadenceDays ? ` · ${p.cadenceDays === 365 ? tx('سالی یک بار') : tx('هر {a1} روز', { a1: fa(p.cadenceDays) })}` : ''}
          </span>
        </div>
      </button>
      {snooze && <button type="button" className="mini-btn" onClick={() => void put('people', withSnooze(p, Date.now()))}>{tx('یک هفته بعد')}</button>}
    </div>
  );

  return (
    <>
      <header className="dd-head">
        <Button variant="ghost" size="icon-md" aria-label={tx('بازگشت')} onClick={onClose} icon="chevronRight" />
        <span>{tx('حفظ ارتباط')}</span>
        <span className="head-spacer" />
      </header>

      {late.length > 0 ? (
        <section className="glass followups-card">
          <div className="fc-head">
            <h2>{tx('خیلی وقت است ندیده‌ای')}</h2>
            <span className="progress-pill">{tn('{n} نفر', late.length)}</span>
          </div>
          {late.map((r) => row(r, true))}
        </section>
      ) : (
        <Card className="empty-state">
          <span className="tile green" aria-hidden="true"><Icon name="checkCircle" size={24} stroke={1.8} /></span>
          <b>{tx('همه سر وقت‌اند')}</b>
          <p className="hint">{tx('کسی از ریتمش عقب نیفتاده. برای هر فرد در پروفایلش دسته و ریتم تماس بگذار.')}</p>
        </Card>
      )}

      {withoutRhythm.length > 0 && (
        <Button block icon="repeat" onClick={() => void applyDefaults()}>{tx('ریتم پیشنهادی دسته‌ها را برای {a1} نفر بگذار', { a1: fa(withoutRhythm.length) })}</Button>
      )}

      {groups.map((g) => (
        <section key={g.key || 'none'}>
          <h2 className="sec-title">{g.title}<small>{tn('{n} نفر', g.items.length)}</small></h2>
          <div className="glass followups-card">
            {g.items.sort((a, b) => b.days - a.days).map((r) => row(r, false))}
          </div>
        </section>
      ))}
    </>
  );
}
