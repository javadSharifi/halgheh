import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportAll, importAll } from './db';
import { fa } from './cal';
import { formatBytes } from './format';
import { Icon, type IconName } from './Icon';
import { askNotifications, biometric, isNative, restoreBackupZip, shareBackup, shareBackupZip } from './native';
import { type Theme, type WeekStart, updateSettings, useSettings } from './settings';
import { Choice } from './Choice';
import { DEFAULT_URL, getCfg } from './sync';
import { PinFlow } from './Lock';
import { setBio, useLock } from './lockStore';
import { Toggle as Switch } from './Toggle';

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

export function SettingsPage({ openSync }: { openSync: () => void }) {
  const { weekStart, theme, remind } = useSettings();
  const lock = useLock();
  const [pinFlow, setPinFlow] = useState<'set' | 'change' | 'off' | null>(null);
  const [canBio, setCanBio] = useState(false);
  useEffect(() => { biometric.available().then(setCanBio); }, []);
  const [msg, setMsg] = useState('');
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const cfg = getCfg();
  const online = navigator.onLine;

  const toggleRemind = async (on: boolean) => {
    if (on && !(await askNotifications())) return setMsg('اجازه نمایش اعلان داده نشد. از تنظیمات اندروید فعالش کنید.');
    setMsg('');
    updateSettings({ remind: on });
  };
  const download = async () => {
    if (isNative) return shareBackup().catch(() => setMsg('ساخت پشتیبان ناموفق بود.'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([await exportAll()], { type: 'application/json' }));
    a.download = `halgheh-backup-${new Date().toLocaleDateString('sv')}.json`;
    a.click();
  };
  const [zipBusy, setZipBusy] = useState(false);
  // B3: the complete backup — rows plus photo files — in one archive
  const backupZip = async () => {
    setZipBusy(true);
    setMsg('');
    try {
      const r = await shareBackupZip();
      setMsg(
        `پشتیبان کامل ساخته شد: ${fa(r.photos)} عکس` +
          (r.missing ? ` · ${fa(r.missing)} فایل روی این گوشی نبود` : '') +
          ` · ${formatBytes(r.bytes)}`,
      );
    } catch {
      setMsg('ساخت پشتیبان کامل ناموفق بود.');
    } finally {
      setZipBusy(false);
    }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    try {
      // B3: one control for both formats; a .zip carries the photo files too
      if (file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip')) {
        const r = await restoreBackupZip(file);
        setMsg(`پشتیبان بازیابی شد${r.photos ? ` · ${fa(r.photos)} عکس` : ''}.`);
      } else {
        await importAll(await file.text());
        setMsg('پشتیبان بازیابی شد.');
      }
    } catch {
      setMsg('فایل پشتیبان معتبر نیست.');
    }
  };

  const syncStatus = !cfg ? 'غیرفعال' : !online ? `آفلاین${pending ? ` · ${fa(pending)} در صف` : ''}` : pending ? `${fa(pending)} در صف` : 'همگام شد';
  const syncTone = !cfg ? '' : !online || pending ? 'warn' : 'ok';

  return (
    <>
      <div className="page-head"><h1>تنظیمات</h1></div>

      <section>
        <h2 className="sec-title">برنامه</h2>
        <div className="glass set-list">
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
            <Row icon="bell" tone="blue" name="یادآوری کارها و تولدها"><Switch on={remind} label="یادآوری کارها و تولدها" onChange={toggleRemind} /></Row>
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
        <h2 className="sec-title">داده و همگام‌سازی</h2>
        <div className="glass set-list">
          {DEFAULT_URL && (
            <button className="set-row as-btn" onClick={openSync}>
              <span className="tile blue" aria-hidden="true"><Icon name="refresh" size={17} stroke={1.9} /></span>
              <span className="set-name">همگام‌سازی</span>
              <span className={`sync-state ${syncTone}`}><i />{syncStatus}</span>
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          )}
          <div className="set-actions">
            <button onClick={() => void backupZip()} disabled={zipBusy}><Icon name="archive" size={18} stroke={1.9} />{zipBusy ? 'در حال ساخت…' : 'پشتیبان کامل (با عکس)'}</button>
            <button onClick={download}><Icon name="download" size={18} stroke={1.9} />فقط داده (JSON)</button>
            <label className="btn"><Icon name="upload" size={18} stroke={1.9} />بازیابی از فایل<input type="file" accept="application/json,.zip,application/zip" hidden onChange={(e) => upload(e.target.files?.[0])} /></label>
          </div>
        </div>
        {msg && <p className="hint set-msg" role="status">{msg}</p>}
      </section>

      {pinFlow && <PinFlow mode={pinFlow} onClose={() => setPinFlow(null)} />}
    </>
  );
}
