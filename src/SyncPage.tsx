import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Outbox, db, exportAll } from './db';
import { addDays, fa, label, parts, today } from './cal';
import { clock, formatBytes } from './format';
import { ask } from './confirm';
import { Icon, type IconName } from './Icon';
import { useOnline } from './online';
import { useSettings } from './settings';
import { DEFAULT_URL, HttpError, connect, disableSync, getCfg, syncNow } from './sync';

const errorText = (e: unknown) =>
  e instanceof HttpError
    ? e.status === 409 ? 'با این ایمیل قبلاً حساب ساخته شده. وارد شوید.'
      : e.status === 401 ? 'ایمیل یا رمز اشتباه است، یا حسابی با این ایمیل نیست.'
      : e.status === 413 ? 'سقف داده‌ی حساب پر شده است.'
      : `خطای سرور (${e.status}).`
    : 'اتصال به سرور برقرار نشد. اینترنت را بررسی کنید.';

const KIND: Record<Outbox['t'], { icon: IconName; tone: string; name: string }> = {
  notes: { icon: 'note', tone: 'purple', name: 'یادداشت' },
  tasks: { icon: 'repeat', tone: 'blue', name: 'کار تکراری' },
  done: { icon: 'check', tone: 'blue', name: 'انجام کار' },
  birthdays: { icon: 'cake', tone: 'peach', name: 'تولد' },
};
const OP = { create: 'ایجاد', edit: 'ویرایش', delete: 'حذف' } as const;
const SHOWN = 5; // pending rows listed before "and N more"

type Pending = { o: Outbox; title: string };

/** "امروز ۱۰:۴۲", "دیروز ۲۱:۳۰", or the date in the main calendar. */
function when(ms: number, cal: ReturnType<typeof useSettings>['cal'], off: number) {
  const day = new Date(ms).toLocaleDateString('sv');
  const t = today();
  const hhmm = clock(ms);
  if (day === t) return `امروز ${hhmm}`;
  if (day === addDays(t, -1)) return `دیروز ${hhmm}`;
  return `${label(day, cal, off, { day: 'numeric', month: 'long' })} ${hhmm}`;
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
  const { cal, hijriOffset: off } = useSettings();
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
  const data = useLiveQuery(async () => ({
    notes: await db.notes.count(),
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
    title = 'همگام‌سازی غیرفعال است';
    text = DEFAULT_URL ? 'داده‌ها فقط روی همین دستگاه‌اند. برای داشتن آن‌ها روی چند دستگاه، همگام‌سازی را فعال کنید.' : 'سرور همگام‌سازی در این نسخه تنظیم نشده است. برنامه کاملاً آفلاین کار می‌کند.';
  } else if (busy) {
    title = 'در حال همگام‌سازی…';
    text = 'لطفاً صبر کنید.';
  } else if (!online) {
    title = 'آفلاین هستید';
    text = 'همه‌چیز روی همین گوشی ذخیره شده است. با وصل شدن به اینترنت، تغییرها خودکار همگام می‌شوند.';
  } else if (n > 0) {
    title = 'تغییرات در انتظار ارسال';
    text = `${fa(n)} تغییر آمادهٔ همگام‌سازی است.`;
  } else {
    title = 'همه‌چیز به‌روز است';
    text = cfg.at ? `آخرین همگام‌سازی: ${when(cfg.at, cal, off)}` : 'هنوز همگام‌سازی نشده است.';
  }
  const cloudOn = !!cfg && online;

  return (
    <>
      <header className="dd-head">
        <button className="icon-btn" aria-label="بازگشت به تنظیمات" onClick={onBack}><Icon name="chevronRight" /></button>
        <span>همگام‌سازی</span>
        <span className="head-spacer" />
      </header>

      <section className="glass sync-status" aria-label="وضعیت اتصال">
        <div className="flow" aria-hidden="true">
          <div className="dev-tile"><Icon name="smartphone" size={28} stroke={1.7} /><span className="badge-ok"><Icon name="check" size={12} stroke={3} /></span></div>
          <div className="link">
            <i />
            {n > 0 ? <span className="chip-warn">{fa(n)} تغییر</span> : cfg && online ? <span className="chip-ok">به‌روز</span> : null}
          </div>
          <div className={`cloud-tile${cloudOn ? ' on' : ''}`}><Icon name={cloudOn ? 'cloudCheck' : 'cloudOff'} size={28} stroke={1.7} /></div>
        </div>
        <b>{title}</b>
        <p>{text}</p>
        {err && <p className="form-error" role="alert">{err}</p>}
      </section>

      {!cfg && DEFAULT_URL && (
        <section className="glass sync-card" aria-label="حساب کاربری">
          <div className="sc-head"><span><Icon name="cloudCheck" size={16} stroke={1.9} />حساب کاربری</span></div>
          <div className="radios rf-kind" role="radiogroup" aria-label="ورود یا ساخت حساب">
            <button role="radio" aria-checked={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>ساخت حساب</button>
            <button role="radio" aria-checked={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>ورود</button>
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ایمیل" dir="ltr" autoComplete="email" aria-label="ایمیل" />
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="رمز (حداقل ۸ نویسه)" dir="ltr" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} aria-label="رمز" />
          {mode === 'register' && <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="تکرار رمز" dir="ltr" autoComplete="new-password" aria-label="تکرار رمز" />}
          {mode === 'register' && pw2 !== '' && pw !== pw2 && <p className="form-error">دو رمز یکی نیست.</p>}
          <button className="primary" disabled={busy || !formOk} onClick={() => run(() => connect(DEFAULT_URL, email, pw, mode))}>{mode === 'register' ? 'ساخت حساب و همگام‌سازی' : 'ورود و همگام‌سازی'}</button>
          <p className="hint">ایمیل تأیید نمی‌شود و رمز روی سرور ذخیره نمی‌شود، پس رمز فراموش‌شده قابل بازیابی نیست. داده‌های روی گوشی در هر حال می‌مانند.</p>
        </section>
      )}

      <section className="glass sync-card" aria-label="دادهٔ محلی">
        <div className="sc-head">
          <span><Icon name="database" size={16} stroke={1.9} />دادهٔ محلی</span>
          {data && <small>{formatBytes(data.bytes)} روی دستگاه</small>}
        </div>
        <div className="stats">
          {([['یادداشت', data?.notes], ['کار تکراری', data?.tasks], ['تولد', data?.birthdays]] as const).map(([k, v]) => (
            <div key={k}><b>{fa(v ?? 0)}</b><span>{k}</span></div>
          ))}
        </div>
      </section>

      {cfg && (
        <section className="glass sync-pending" aria-label="در انتظار همگام‌سازی">
          <div className="sc-head"><span>در انتظار همگام‌سازی</span>{n > 0 && <em className="chip-warn">{fa(n)}</em>}</div>
          {n === 0 && <p className="hint empty">چیزی در انتظار ارسال نیست.</p>}
          {pending.slice(0, SHOWN).map(({ o, title }) => {
            const k = KIND[o.t];
            return (
              <div key={o.key} className="pend-row">
                <span className={`tile ${k.tone}`} aria-hidden="true"><Icon name={k.icon} size={17} stroke={1.9} /></span>
                <div>
                  <b>{title ? `${k.name} «${title}»` : o.deleted ? `${k.name} حذف‌شده` : k.name}</b>
                  <span>{OP[o.op ?? 'edit']} · {when(o.updatedAt, cal, off)}</span>
                </div>
              </div>
            );
          })}
          {n > SHOWN && <p className="hint more">و {fa(n - SHOWN)} مورد دیگر</p>}
        </section>
      )}

      {cfg && (
        <section className="glass backup-row" aria-label="پشتیبان ابری">
          <span className="tile green" aria-hidden="true"><Icon name="cloudCheck" size={17} stroke={1.9} /></span>
          <div>
            <b>پشتیبان ابری</b>
            <span>{cfg.at ? `آخرین پشتیبان: ${label(new Date(cfg.at).toLocaleDateString('sv'), cal, off, { weekday: 'long', day: 'numeric', month: 'long' })}، ${clock(cfg.at)}` : 'هنوز پشتیبانی گرفته نشده است'}</span>
          </div>
          <em className="chip-ok">خودکار</em>
        </section>
      )}

      {cfg && (
        <section className="glass sync-card" aria-label="حساب کاربری">
          <div className="sc-head"><span><Icon name="lock" size={16} stroke={1.9} />حساب کاربری</span></div>
          <p className="hint" dir="ltr" style={{ textAlign: 'start' }}>{cfg.email ?? 'حساب قدیمی (با کلید)'}</p>
          <button className="danger-btn" disabled={busy} onClick={async () => (await ask({ title: 'خروج از حساب؟', message: 'داده‌های همین دستگاه می‌مانند، ولی دیگر با سرور همگام نمی‌شوند. با ورود دوباره، همگام‌سازی ادامه پیدا می‌کند.', confirm: 'خروج', icon: 'cloudOff' })) && run(disableSync)}>خروج از حساب</button>
        </section>
      )}

      {cfg && (
        <div className="rf-foot">
          <button className="primary big-btn" disabled={busy || !online} onClick={() => run(syncNow)}><Icon name="refresh" size={19} stroke={2.2} />{busy ? 'در حال همگام‌سازی…' : 'همگام‌سازی اکنون'}</button>
        </div>
      )}
    </>
  );
}
