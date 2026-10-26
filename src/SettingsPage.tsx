import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, importAll } from './db';
import { CALS, CAL_NAMES, type Cal, fa } from './cal';
import { Icon, type IconName } from './Icon';
import { askNotifications, biometric, isNative, shareBackup } from './native';
import { type Theme, type WeekStart, updateSettings, useSettings } from './settings';
import { Choice } from './Choice';
import { DEFAULT_URL, getCfg } from './sync';
import { PinFlow } from './Lock';
import { setBio, useLock } from './lockStore';

const WEEK_STARTS: [WeekStart, string][] = [[6, 'شنبه'], [0, 'یکشنبه'], [1, 'دوشنبه']];
const THEMES: [Theme, string, IconName][] = [['light', 'روشن', 'sun'], ['dark', 'تیره', 'moon'], ['auto', 'خودکار', 'contrast']];

function Row({ icon, tone, name, children }: { icon: IconName; tone: 'blue' | 'purple' | 'green'; name: string; children: React.ReactNode }) {
  return (
    <div className="set-row">
      <span className={`tile ${tone}`} aria-hidden="true"><Icon name={icon} size={17} stroke={1.9} /></span>
      <span className="set-name">{name}</span>
      {children}
    </div>
  );
}

const Switch = ({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) => (
  <button className="switch" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}><i /></button>
);

/** Choose which other calendars are shown small next to the main one. */
function AuxSheet({ main, aux, onClose }: { main: Cal; aux: Cal[]; onClose: () => void }) {
  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <div className="glass sheet" role="dialog" aria-label="تقویم‌های کمکی">
        <b className="sheet-title">تقویم‌های کمکی</b>
        {CALS.filter((c) => c !== main).map((c) => (
          <div key={c} className="set-row">
            <span className="set-name">{CAL_NAMES[c]}</span>
            <Switch on={aux.includes(c)} label={CAL_NAMES[c]} onChange={(v) => updateSettings({ aux: CALS.filter((x) => x !== main && (x === c ? v : aux.includes(x))) })} />
          </div>
        ))}
        <div className="sheet-actions"><button onClick={onClose}>بستن</button></div>
      </div>
    </>
  );
}

export function SettingsPage({ openSync }: { openSync: () => void }) {
  const { name, cal, aux, weekStart, theme, remind, ongoing } = useSettings();
  const [auxOpen, setAuxOpen] = useState(false);
  const lock = useLock();
  // Sync is hidden: five quick taps on the title open it (and keep it listed afterwards); a connected account always lists it.
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem('syncUnlocked') === '1');
  const taps = useRef({ n: 0, at: 0 });
  const tapTitle = () => {
    const t = taps.current;
    t.n = Date.now() - t.at < 2000 ? t.n + 1 : 1;
    t.at = Date.now();
    if (t.n >= 5 && DEFAULT_URL) {
      t.n = 0;
      localStorage.setItem('syncUnlocked', '1');
      setUnlocked(true);
      openSync();
    }
  };
  const [pinFlow, setPinFlow] = useState<'set' | 'change' | 'off' | null>(null);
  const [canBio, setCanBio] = useState(false);
  useEffect(() => { biometric.available().then(setCanBio); }, []);
  const [msg, setMsg] = useState('');
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const cfg = getCfg();
  const online = navigator.onLine;

  const toggle = (key: 'remind' | 'ongoing') => async (on: boolean) => {
    if (on && !(await askNotifications())) return setMsg('اجازه نمایش اعلان داده نشد. از تنظیمات اندروید فعالش کنید.');
    setMsg('');
    updateSettings({ [key]: on });
  };
  const download = async () => {
    if (isNative) return shareBackup().catch(() => setMsg('ساخت پشتیبان ناموفق بود.'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([await (await import('./db')).exportAll()], { type: 'application/json' }));
    a.download = `date-backup-${new Date().toLocaleDateString('sv')}.json`;
    a.click();
  };
  const upload = async (file?: File) => {
    if (!file) return;
    try {
      await importAll(await file.text());
      setMsg('پشتیبان بازیابی شد.');
    } catch {
      setMsg('فایل پشتیبان معتبر نیست.');
    }
  };

  const syncStatus = !cfg ? 'غیرفعال' : !online ? `آفلاین${pending ? ` · ${fa(pending)} در صف` : ''}` : pending ? `${fa(pending)} در صف` : 'همگام شد';
  const syncTone = !cfg ? '' : !online || pending ? 'warn' : 'ok';

  return (
    <>
      <div className="page-head"><h1 onClick={tapTitle}>تنظیمات</h1></div>

      <section>
        <h2 className="sec-title">تقویم</h2>
        <div className="glass set-list">
          <Row icon="note" tone="green" name="نام شما">
            <input className="set-input" value={name} maxLength={40} placeholder="برای سلام صفحه‌ی امروز" onChange={(e) => updateSettings({ name: e.target.value })} />
          </Row>
          <Row icon="calendar" tone="blue" name="تقویم اصلی">
            <span className="set-value">{CAL_NAMES[cal]}<Icon name="chevronLeft" size={16} stroke={2} />
              <Choice className="pick-hit" label="تقویم اصلی" value={cal} options={CALS.map((c) => [c, CAL_NAMES[c]])} onChange={(c) => updateSettings({ cal: c })} />
            </span>
          </Row>
          <button className="set-row as-btn" onClick={() => setAuxOpen(true)}>
            <span className="tile purple" aria-hidden="true"><Icon name="calendarDays" size={17} stroke={1.9} /></span>
            <span className="set-name">تقویم‌های کمکی</span>
            <span className="set-value">{aux.length ? aux.map((c) => CAL_NAMES[c]).join('، ') : 'هیچ‌کدام'}<Icon name="chevronLeft" size={16} stroke={2} /></span>
          </button>
          <Row icon="alignLeft" tone="green" name="شروع هفته">
            <span className="set-value">{WEEK_STARTS.find(([v]) => v === weekStart)?.[1]}<Icon name="chevronLeft" size={16} stroke={2} />
              <Choice className="pick-hit" label="شروع هفته" value={weekStart} options={WEEK_STARTS} onChange={(w) => updateSettings({ weekStart: w })} />
            </span>
          </Row>
        </div>
      </section>

      <section>
        <h2 className="sec-title">ظاهر</h2>
        <div className="glass theme-row" role="radiogroup" aria-label="پوسته">
          {THEMES.map(([k, n, icon]) => (
            <button key={k} role="radio" aria-checked={theme === k} className={theme === k ? 'on' : ''} onClick={() => updateSettings({ theme: k })}><Icon name={icon} size={18} stroke={1.9} />{n}</button>
          ))}
        </div>
      </section>

      {isNative && (
        <section>
          <h2 className="sec-title">اعلان‌ها</h2>
          <div className="glass set-list">
            <Row icon="bell" tone="blue" name="یادآوری کارها و تولدها"><Switch on={remind} label="یادآوری کارها و تولدها" onChange={toggle('remind')} /></Row>
            <Row icon="pin" tone="purple" name="اعلان ثابت خلاصهٔ روز"><Switch on={ongoing} label="اعلان ثابت خلاصهٔ روز" onChange={toggle('ongoing')} /></Row>
          </div>
        </section>
      )}

      <section>
        <h2 className="sec-title">امنیت</h2>
        <div className="glass set-list">
          <Row icon="lock" tone="purple" name="قفل برنامه"><Switch on={!!lock} label="قفل برنامه" onChange={(on) => setPinFlow(on ? 'set' : 'off')} /></Row>
          {lock && (
            <>
              <button className="set-row as-btn" onClick={() => setPinFlow('change')}>
                <span className="tile blue" aria-hidden="true"><Icon name="settings" size={17} stroke={1.9} /></span>
                <span className="set-name">تغییر پین</span>
                <Icon name="chevronLeft" size={16} stroke={2} />
              </button>
              {canBio && <Row icon="smartphone" tone="green" name="باز کردن با اثر انگشت"><Switch on={lock.bio} label="باز کردن با اثر انگشت" onChange={setBio} /></Row>}
            </>
          )}
        </div>
        <p className="hint set-msg">پین فقط روی همین گوشی می‌ماند. اگر فراموشش کنی راه بازیابی نیست، فقط پاک کردن دادهٔ برنامه.</p>
      </section>

      <section>
        <h2 className="sec-title">{cfg || unlocked ? 'داده و همگام‌سازی' : 'پشتیبان'}</h2>
        <div className="glass set-list">
          {(cfg || unlocked) && (
            <button className="set-row as-btn" onClick={openSync}>
              <span className="tile blue" aria-hidden="true"><Icon name="refresh" size={17} stroke={1.9} /></span>
              <span className="set-name">همگام‌سازی</span>
              <span className={`sync-state ${syncTone}`}><i />{syncStatus}</span>
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          )}
          <div className="set-actions">
            <button onClick={download}><Icon name="download" size={18} stroke={1.9} />خروجی پشتیبان</button>
            <label className="btn"><Icon name="upload" size={18} stroke={1.9} />بازیابی از فایل<input type="file" accept="application/json" hidden onChange={(e) => upload(e.target.files?.[0])} /></label>
          </div>
        </div>
        {msg && <p className="hint set-msg" role="status">{msg}</p>}
      </section>

      {pinFlow && <PinFlow mode={pinFlow} onClose={() => setPinFlow(null)} />}
      {auxOpen && <AuxSheet main={cal} aux={aux} onClose={() => setAuxOpen(false)} />}
    </>
  );
}
