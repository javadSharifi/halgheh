import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Outbox, db, exportAll } from './db';
import { addDays, fa, label, today } from './cal';
import { clock, formatBytes } from './format';
import { ask } from './confirm';
import { Icon, type IconName } from './Icon';
import { useOnline } from './online';
import { DEFAULT_URL, HttpError, connect, disableSync, getCfg, syncNow } from './sync';
import { downloadMissingPhotos, photoQueueStatus, uploadPendingPhotos } from './photoSync';
import { STR } from './strings/rulebook';
import { tk, tn, tx } from './i18n';

const errorText = (e: unknown) =>
  e instanceof HttpError
    ? e.status === 409 ? tx('با این ایمیل قبلاً حساب ساخته شده. وارد شوید.')
      : e.status === 401 ? tx('ایمیل یا رمز اشتباه است، یا حسابی با این ایمیل نیست.')
      : e.status === 413 ? tx('سقف داده‌ی حساب پر شده است.')
      : e.status === 429 ? tx('تلاش‌های شما زیاد بوده است. چند دقیقه بعد دوباره امتحان کنید.')
      : tx('خطای سرور ({a1}).', { a1: e.status })
    : tx('اتصال به سرور برقرار نشد. اینترنت را بررسی کنید.');

const KIND: Record<Outbox['t'], { icon: IconName; tone: string; name: string }> = {
  tasks: { icon: 'repeat', tone: 'blue', name: tk('کار') },
  done: { icon: 'check', tone: 'blue', name: tk('انجام کار') },
  birthdays: { icon: 'cake', tone: 'peach', name: tk('تولد') },
  people: { icon: 'users', tone: 'blue', name: tk('فرد') },
  tags: { icon: 'tag', tone: 'purple', name: tk('برچسب') },
  personTags: { icon: 'tag', tone: 'purple', name: tk('برچسب فرد') },
  personNotes: { icon: 'note', tone: 'green', name: tk('یادداشت') },
  skills: { icon: 'toolbox', tone: 'purple', name: tk('مهارت') },
  personSkills: { icon: 'toolbox', tone: 'purple', name: tk('مهارت فرد') },
  ratings: { icon: 'target', tone: 'blue', name: tk('امتیاز') },
  relationships: { icon: 'users', tone: 'green', name: tk('رابطه') },
  photos: { icon: 'image', tone: 'purple', name: tk('عکس') },
  interactions: { icon: 'history', tone: 'peach', name: tk('تعامل') },
  ruleCategories: { icon: 'alignLeft', tone: 'purple', name: tx(STR.sync.kindCategory) },
  rules: { icon: 'listChecks', tone: 'blue', name: tx(STR.sync.kindRule) },
  ruleReviews: { icon: 'repeat', tone: 'green', name: tx(STR.sync.kindReview) },
  compareSessions: { icon: 'target', tone: 'blue', name: tx(STR.sync.kindSession) },
  compareItems: { icon: 'tag', tone: 'peach', name: tx(STR.sync.kindItem) },
  compareChecks: { icon: 'checkCircle', tone: 'green', name: tx(STR.sync.kindCheck) },
  ruleBreaks: { icon: 'close', tone: 'peach', name: tx(STR.sync.kindBreak) },
  ruleChecks: { icon: 'listChecks', tone: 'purple', name: tx(STR.sync.kindPersonCheck) },
  ruleCheckItems: { icon: 'check', tone: 'green', name: tx(STR.sync.kindPersonCheckItem) },
  exchanges: { icon: 'repeat', tone: 'blue', name: tx(STR.sync.kindExchange) },
  exchangeSettlements: { icon: 'checkCircle', tone: 'green', name: tx(STR.sync.kindSettlement) },
};
const OP = { create: tk('ایجاد'), edit: tk('ویرایش'), delete: tk('حذف') } as const;
const SHOWN = 5; // pending rows listed before "and N more"

type Pending = { o: Outbox; title: string };

/** "امروز ۱۰:۴۲", "دیروز ۲۱:۳۰", or the date in the Jalali calendar. */
function when(ms: number) {
  const day = new Date(ms).toLocaleDateString('sv');
  const t = today();
  const hhmm = clock(ms);
  if (day === t) return tx('امروز {a1}', { a1: hhmm });
  if (day === addDays(t, -1)) return tx('دیروز {a1}', { a1: hhmm });
  return `${label(day, 'persian', 0, { day: 'numeric', month: 'long' })} ${hhmm}`;
}

async function loadPending(): Promise<Pending[]> {
  const rows = (await db.outbox.toArray()).sort((a, b) => b.updatedAt - a.updatedAt); // newest first; the outbox is small, so no index
  return Promise.all(
    rows.map(async (o) => {
      let title = '';
      if (!o.deleted) {
        if (o.t === 'done') title = (await db.tasks.get(o.id.split('|')[0]))?.title ?? '';
        else {
          const r = (await db[o.t].get(o.id)) as { title?: string; name?: string } | undefined;
          title = r?.title || r?.name || '';
        }
      }
      return { o, title };
    }),
  );
}

export function SyncPage({ onBack }: { onBack: () => void }) {
  const online = useOnline();
  const [, rerender] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const formOk = emailOk && pw.length >= 8 && (mode === 'login' || pw === pw2);
  const cfg = getCfg();
  const pending = useLiveQuery(loadPending, []) ?? [];
  // B2b: photo files live outside the row sync, so their queue is reported separately
  const photoQueue = useLiveQuery(() => photoQueueStatus(), []) ?? { pending: 0, uploaded: 0, total: 0 };
  const data = useLiveQuery(async () => ({
    tasks: await db.tasks.count(),
    birthdays: await db.birthdays.count(),
    bytes: new Blob([await exportAll()]).size,
  }), []);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await f();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
      rerender((n) => n + 1);
    }
  };

  const n = pending.length;
  let title: string;
  let text: string;
  if (!cfg) {
    title = tx('همگام‌سازی غیرفعال است');
    text = DEFAULT_URL ? tx('داده‌ها فقط روی همین دستگاه‌اند. برای داشتن آن‌ها روی چند دستگاه، همگام‌سازی را فعال کنید.') : tx('سرور همگام‌سازی در این نسخه تنظیم نشده است. برنامه کاملاً آفلاین کار می‌کند.');
  } else if (busy) {
    title = tx('در حال همگام‌سازی…');
    text = tx('لطفاً صبر کنید.');
  } else if (!online) {
    title = tx('آفلاین هستید');
    text = tx('همه‌چیز روی همین گوشی ذخیره شده است. با وصل شدن به اینترنت، تغییرها خودکار همگام می‌شوند.');
  } else if (n > 0) {
    title = tx('تغییرات در انتظار ارسال');
    text = tx('{a1} تغییر آمادهٔ همگام‌سازی است.', { a1: fa(n) });
  } else {
    title = tx('همه‌چیز به‌روز است');
    text = cfg.at ? tx('آخرین همگام‌سازی: {a1}', { a1: when(cfg.at) }) : tx('هنوز همگام‌سازی نشده است.');
  }
  const cloudOn = !!cfg && online;

  return (
    <>
      <header className="dd-head">
        <button className="icon-btn" aria-label={tx('بازگشت به تنظیمات')} onClick={onBack}><Icon name="chevronRight" /></button>
        <span>{tx('همگام‌سازی')}</span>
        <span className="head-spacer" />
      </header>

      <section className="glass sync-status" aria-label={tx('وضعیت اتصال')}>
        <div className="flow" aria-hidden="true">
          <div className="dev-tile"><Icon name="smartphone" size={28} stroke={1.7} /><span className="badge-ok"><Icon name="check" size={12} stroke={3} /></span></div>
          <div className="link">
            <i />
            {n > 0 ? <span className="chip-warn">{tn('{n} تغییر', n)}</span> : cfg && online ? <span className="chip-ok">{tx('به‌روز')}</span> : null}
          </div>
          <div className={`cloud-tile${cloudOn ? ' on' : ''}`}><Icon name={cloudOn ? 'cloudCheck' : 'cloudOff'} size={28} stroke={1.7} /></div>
        </div>
        <b>{title}</b>
        <p>{text}</p>
        {err && <p className="form-error" role="alert">{err}</p>}
      </section>

      {!cfg && DEFAULT_URL && (
        <section className="glass sync-card" aria-label={tx('حساب کاربری')}>
          <div className="sc-head"><span><Icon name="cloudCheck" size={16} stroke={1.9} />{tx('حساب کاربری')}</span></div>
          <div className="radios rf-kind" role="radiogroup" aria-label={tx('ورود یا ساخت حساب')}>
            <button role="radio" aria-checked={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>{tx('ساخت حساب')}</button>
            <button role="radio" aria-checked={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>{tx('ورود')}</button>
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tx('ایمیل')} dir="ltr" autoComplete="email" aria-label={tx('ایمیل')} />
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={tx('رمز (حداقل ۸ نویسه)')} dir="ltr" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} aria-label={tx('رمز')} />
          {mode === 'register' && <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder={tx('تکرار رمز')} dir="ltr" autoComplete="new-password" aria-label={tx('تکرار رمز')} />}
          {mode === 'register' && pw2 !== '' && pw !== pw2 && <p className="form-error">{tx('دو رمز یکی نیست.')}</p>}
          <button className="primary" disabled={busy || !formOk} onClick={() => run(() => connect(DEFAULT_URL, email, pw, mode))}>{mode === 'register' ? tx('ساخت حساب و همگام‌سازی') : tx('ورود و همگام‌سازی')}</button>
          {mode === 'register' ? (
            <div className="warn-box" role="note">
              <b><Icon name="info" size={15} stroke={2} />{tx('رمز را جای مطمئن نگه دار')}</b>
              <p>{tx('ایمیل تأیید نمی‌شود و راهی برای بازیابی رمز نیست. اگر رمز را فراموش کنی، پشتیبان ابری برای همیشه از دست می‌رود. داده‌ها روی سرور رمزنگاری نمی‌شوند. داده‌های روی گوشی در هر حال می‌مانند.')}</p>
            </div>
          ) : (
            <p className="hint">{tx('ایمیل تأیید نمی‌شود. اگر رمز را فراموش کرده‌ای راه بازیابی نیست. داده‌ها روی سرور رمزنگاری نمی‌شوند.')}</p>
          )}
        </section>
      )}

      <section className="glass sync-card" aria-label={tx('دادهٔ محلی')}>
        <div className="sc-head">
          <span><Icon name="database" size={16} stroke={1.9} />{tx('دادهٔ محلی')}</span>
          {data && <small>{tx('{a1} روی دستگاه', { a1: formatBytes(data.bytes) })}</small>}
        </div>
        <div className="stats">
          {([[tx('کار'), data?.tasks], [tx('تولد'), data?.birthdays], [tx('عکس'), photoQueue.total]] as const).map(([k, v]) => (
            <div key={k}><b>{fa(v ?? 0)}</b><span>{k}</span></div>
          ))}
        </div>
      </section>

      {cfg && photoQueue.total > 0 && (
        <section className="glass sync-card" aria-label={tx('فایل عکس‌ها')}>
          <div className="sc-head">
            <span><Icon name="image" size={16} stroke={1.9} />{tx('فایل عکس‌ها')}</span>
            {photoQueue.pending > 0 ? <em className="chip-warn">{tx('{a1} در صف', { a1: fa(photoQueue.pending) })}</em> : <em className="chip-ok">{tx('همه آپلود شد')}</em>}
          </div>
          <p className="hint">
            {photoQueue.pending > 0
              ? tx('{a1} فایل عکس هنوز روی سرور نیست. با وصل بودن اینترنت خودکار فرستاده می‌شود.', { a1: fa(photoQueue.pending) })
              : tx('{a1} فایل عکس روی سرور است.', { a1: fa(photoQueue.uploaded) })}
          </p>
          <div className="set-actions">
            <button disabled={busy} onClick={() => run(async () => { await uploadPendingPhotos(); })}>
              <Icon name="upload" size={17} stroke={1.9} />{tx('آپلود فایل‌ها')}</button>
            <button disabled={busy} onClick={() => run(async () => { await downloadMissingPhotos(); })}>
              <Icon name="download" size={17} stroke={1.9} />{tx('دریافت فایل‌های گمشده')}</button>
          </div>
        </section>
      )}

      {cfg && (
        <section className="glass sync-pending" aria-label={tx('در انتظار همگام‌سازی')}>
          <div className="sc-head"><span>{tx('در انتظار همگام‌سازی')}</span>{n > 0 && <em className="chip-warn">{fa(n)}</em>}</div>
          {n === 0 && <p className="hint empty">{tx('چیزی در انتظار ارسال نیست.')}</p>}
          {pending.slice(0, SHOWN).map(({ o, title }) => {
            const k = KIND[o.t];
            return (
              <div key={o.key} className="pend-row">
                <span className={`tile ${k.tone}`} aria-hidden="true"><Icon name={k.icon} size={17} stroke={1.9} /></span>
                <div>
                  <b>{title ? `${k.name} «${title}»` : o.deleted ? tx('{a1} حذف‌شده', { a1: k.name }) : k.name}</b>
                  <span>{OP[o.op ?? 'edit']} · {when(o.updatedAt)}</span>
                </div>
              </div>
            );
          })}
          {n > SHOWN && <p className="hint more">{tx('و {a1} مورد دیگر', { a1: fa(n - SHOWN) })}</p>}
        </section>
      )}

      {cfg && (
        <section className="glass backup-row" aria-label={tx('پشتیبان ابری')}>
          <span className="tile green" aria-hidden="true"><Icon name="cloudCheck" size={17} stroke={1.9} /></span>
          <div>
            <b>{tx('پشتیبان ابری')}</b>
            <span>{cfg.at ? tx('آخرین پشتیبان: {a1}، {a2}', { a1: label(new Date(cfg.at).toLocaleDateString('sv'), 'persian', 0, { weekday: 'long', day: 'numeric', month: 'long' }), a2: clock(cfg.at) }) : tx('هنوز پشتیبانی گرفته نشده است')}</span>
          </div>
          <em className="chip-ok">{tx('خودکار')}</em>
        </section>
      )}

      {cfg && (
        <section className="glass sync-card" aria-label={tx('حساب کاربری')}>
          <div className="sc-head"><span><Icon name="lock" size={16} stroke={1.9} />{tx('حساب کاربری')}</span></div>
          <p className="hint" dir="ltr" style={{ textAlign: 'start' }}>{cfg.email ?? tx('حساب قدیمی (با کلید)')}</p>
          <button className="danger-btn" disabled={busy} onClick={async () => (await ask({ title: tx('خروج از حساب؟'), message: tx('داده‌های همین دستگاه می‌مانند، ولی دیگر با سرور همگام نمی‌شوند. با ورود دوباره، همگام‌سازی ادامه پیدا می‌کند.'), confirm: tx('خروج'), icon: 'cloudOff' })) && run(disableSync)}>{tx('خروج از حساب')}</button>
        </section>
      )}

      {cfg && (
        <div className="rf-foot">
          <button className="primary big-btn" disabled={busy || !online} onClick={() => run(syncNow)}><Icon name="refresh" size={19} stroke={2.2} />{busy ? tx('در حال همگام‌سازی…') : tx('همگام‌سازی اکنون')}</button>
        </div>
      )}
    </>
  );
}
