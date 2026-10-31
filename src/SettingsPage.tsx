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
import { LANGS, tx, tk } from './i18n';

import { Card, Button } from './ui';

const WEEK_STARTS: [WeekStart, string][] = [[6, tk('شنبه')], [0, tk('یکشنبه')], [1, tk('دوشنبه')]];
const THEMES: [Theme, string, IconName][] = [['light', tk('روشن'), 'sun'], ['dark', tk('تیره'), 'moon'], ['auto', tk('خودکار'), 'contrast']];

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
  const { weekStart, theme, remind, hideNames, lang } = useSettings();
  const lock = useLock();
  const [pinFlow, setPinFlow] = useState<'set' | 'change' | 'off' | null>(null);
  const [canBio, setCanBio] = useState(false);
  useEffect(() => { biometric.available().then(setCanBio); }, []);
  const [msg, setMsg] = useState('');
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const cfg = getCfg();
  const online = navigator.onLine;

  const toggleRemind = async (on: boolean) => {
    if (on && !(await askNotifications())) return setMsg(tx('اجازه نمایش اعلان داده نشد. از تنظیمات اندروید فعالش کنید.'));
    setMsg('');
    updateSettings({ remind: on });
  };
  const download = async () => {
    if (isNative) return shareBackup().catch(() => setMsg(tx('ساخت پشتیبان ناموفق بود.')));
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
      const bytes = formatBytes(r.bytes);
      setMsg(
        r.missing
          ? tx('پشتیبان کامل ساخته شد: {a1} عکس · {a2} فایل روی این گوشی نبود · {a3}', { a1: fa(r.photos), a2: fa(r.missing), a3: bytes })
          : tx('پشتیبان کامل ساخته شد: {a1} عکس · {a2}', { a1: fa(r.photos), a2: bytes }),
      );
    } catch {
      setMsg(tx('ساخت پشتیبان کامل ناموفق بود.'));
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
        setMsg(r.photos ? tx('پشتیبان بازیابی شد · {a1} عکس.', { a1: fa(r.photos) }) : tx('پشتیبان بازیابی شد.'));
      } else {
        await importAll(await file.text());
        setMsg(tx('پشتیبان بازیابی شد.'));
      }
    } catch {
      setMsg(tx('فایل پشتیبان معتبر نیست.'));
    }
  };

  const syncStatus = !cfg ? tx('غیرفعال') : !online ? (pending ? tx('آفلاین · {a1} در صف', { a1: fa(pending) }) : tx('آفلاین')) : pending ? tx('{a1} در صف', { a1: fa(pending) }) : tx('همگام شد');
  const syncTone = !cfg ? '' : !online || pending ? 'warn' : 'ok';

  return (
    <>
      <div className="page-head"><h1>{tx('تنظیمات')}</h1></div>

      <section>
        <h2 className="sec-title">{tx('برنامه')}</h2>
        <Card variant="glass" className="set-list">
          <Row icon="alignLeft" tone="green" name={tx('شروع هفته')}>
            <span className="set-value">{WEEK_STARTS.find(([v]) => v === weekStart)?.[1]}<Icon name="chevronLeft" size={16} stroke={2} />
              <Choice className="pick-hit" label={tx('شروع هفته')} value={weekStart} options={WEEK_STARTS} onChange={(w) => updateSettings({ weekStart: w })} />
            </span>
          </Row>
          <Row icon="moreCircle" tone="blue" name={tx('زبان برنامه')}>
            <span className="set-value">{LANGS.find(([v]) => v === lang)?.[1]}<Icon name="chevronLeft" size={16} stroke={2} />
              <Choice className="pick-hit" label={tx('زبان برنامه')} value={lang} options={LANGS} onChange={(l) => updateSettings({ lang: l })} />
            </span>
          </Row>
        </Card>
      </section>

      <section>
        <h2 className="sec-title">{tx('ظاهر')}</h2>
        <Card variant="glass" className="theme-row" role="radiogroup" aria-label={tx('پوسته')}>
          {THEMES.map(([k, n, icon]) => (
            <button key={k} role="radio" aria-checked={theme === k} className={theme === k ? 'on' : ''} onClick={() => updateSettings({ theme: k })}><Icon name={icon} size={18} stroke={1.9} />{n}</button>
          ))}
        </Card>
      </section>

      {isNative && (
        <section>
          <h2 className="sec-title">{tx('اعلان‌ها')}</h2>
          <Card variant="glass" className="set-list">
            <Row icon="bell" tone="blue" name={tx('یادآوری کارها و تولدها')}><Switch on={remind} label={tx('یادآوری کارها و تولدها')} onChange={toggleRemind} /></Row>
            {remind && (
              <Row icon="bell" tone="purple" name={tx('مخفی کردن نام‌ها در اعلان')}><Switch on={hideNames} label={tx('مخفی کردن نام‌ها در اعلان')} onChange={(v) => updateSettings({ hideNames: v })} /></Row>
            )}
          </Card>
        </section>
      )}

      <section>
        <h2 className="sec-title">{tx('امنیت')}</h2>
        <Card variant="glass" className="set-list">
          <Row icon="lock" tone="purple" name={tx('قفل برنامه')}><Switch on={!!lock} label={tx('قفل برنامه')} onChange={(on) => setPinFlow(on ? 'set' : 'off')} /></Row>
          {lock && (
            <>
              <button className="set-row as-btn" onClick={() => setPinFlow('change')}>
                <span className="tile blue" aria-hidden="true"><Icon name="settings" size={17} stroke={1.9} /></span>
                <span className="set-name">{tx('تغییر پین')}</span>
                <Icon name="chevronLeft" size={16} stroke={2} />
              </button>
              {canBio && <Row icon="smartphone" tone="green" name={tx('باز کردن با اثر انگشت')}><Switch on={lock.bio} label={tx('باز کردن با اثر انگشت')} onChange={setBio} /></Row>}
            </>
          )}
        </Card>
        <p className="hint set-msg">{tx('پین فقط روی همین گوشی می‌ماند. اگر فراموشش کنی راه بازیابی نیست، فقط پاک کردن دادهٔ برنامه.')}</p>
      </section>

      <section>
        <h2 className="sec-title">{tx('داده و همگام‌سازی')}</h2>
        <Card variant="glass" className="set-list">
          {DEFAULT_URL && (
            <button className="set-row as-btn" onClick={openSync}>
              <span className="tile blue" aria-hidden="true"><Icon name="refresh" size={17} stroke={1.9} /></span>
              <span className="set-name">{tx('همگام‌سازی')}</span>
              <span className={`sync-state ${syncTone}`}><i />{syncStatus}</span>
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          )}
          <div className="set-actions">
            <button onClick={() => void backupZip()} disabled={zipBusy}><Icon name="archive" size={18} stroke={1.9} />{zipBusy ? tx('در حال ساخت…') : tx('پشتیبان کامل (با عکس)')}</button>
            <button onClick={download}><Icon name="download" size={18} stroke={1.9} />{tx('فقط داده (JSON)')}</button>
            <label className="btn"><Icon name="upload" size={18} stroke={1.9} />{tx('بازیابی از فایل')}<input type="file" accept="application/json,.zip,application/zip" hidden onChange={(e) => upload(e.target.files?.[0])} /></label>
          </div>
        </Card>
        {msg && <p className="hint set-msg" role="status">{msg}</p>}
      </section>

      {pinFlow && <PinFlow mode={pinFlow} onClose={() => setPinFlow(null)} />}
    </>
  );
}
