import { useState } from 'react';
import { CALS, CAL_NAMES, type Cal, fullDate, today } from './cal';
import { Icon, type IconName } from './Icon';
import { type Theme, updateSettings, useSettings } from './settings';

const THEMES: [Theme, string, IconName][] = [['light', 'روشن', 'sun'], ['dark', 'تیره', 'moon'], ['auto', 'خودکار (مثل گوشی)', 'contrast']];
const STEPS = 4;

/** The questions asked once, the first time the app opens. Every answer is applied as it is given and can be changed in Settings. */
export function Onboarding() {
  const { name, cal, aux, hijriOffset: off, theme } = useSettings();
  const [step, setStep] = useState(0);
  const t = today();
  const last = step === STEPS - 1;
  const next = () => (last ? updateSettings({ onboarded: true }) : setStep(step + 1));

  return (
    <main className="ob">
      <div className="ob-dots" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1} aria-label={`مرحلهٔ ${step + 1} از ${STEPS}`}>
        {Array.from({ length: STEPS }, (_, i) => <i key={i} className={i === step ? 'on' : i < step ? 'done' : ''} />)}
      </div>

      <section className="ob-step" key={step}>
        {step === 0 && (
          <>
            <span className="ob-icon"><Icon name="calendarDays" size={30} stroke={1.8} /></span>
            <h1>به روزنگار خوش آمدی</h1>
            <p>چند سؤال کوتاه تا برنامه مال خودت شود. هر کدام را بعداً از «تنظیمات» می‌شود عوض کرد.</p>
            <label className="ob-field">
              <span>اسمت چیست؟ (اختیاری)</span>
              <input value={name} maxLength={40} autoFocus placeholder="مثلاً نیلوفر" onChange={(e) => updateSettings({ name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && next()} />
            </label>
            <small className="hint">برای سلام صفحه‌ی «امروز» استفاده می‌شود و هیچ‌جا فرستاده نمی‌شود.</small>
          </>
        )}

        {step === 1 && (
          <>
            <span className="ob-icon"><Icon name="calendar" size={30} stroke={1.8} /></span>
            <h1>کدام تقویم اصلی باشد؟</h1>
            <p>تاریخ‌ها، ماه‌ها و روزهای هفته با همین تقویم نشان داده می‌شوند.</p>
            <div className="ob-options" role="radiogroup" aria-label="تقویم اصلی">
              {CALS.map((c) => (
                <button key={c} role="radio" aria-checked={cal === c} className={`ob-option${cal === c ? ' on' : ''}`} onClick={() => updateSettings({ cal: c as Cal })}>
                  <b>{CAL_NAMES[c]}</b>
                  <span>{fullDate(t, c, off)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <span className="ob-icon"><Icon name="calendarDays" size={30} stroke={1.8} /></span>
            <h1>تقویم‌های کمکی</h1>
            <p>کنار تاریخ اصلی، کوچک‌تر نشان داده می‌شوند. کدام‌ها فعال باشند؟</p>
            <div className="glass ob-list">
              {CALS.filter((c) => c !== cal).map((c) => {
                const on = aux.includes(c);
                return (
                  <div key={c} className="set-row">
                    <span className="set-name">{CAL_NAMES[c]}<small>{fullDate(t, c, off)}</small></span>
                    <button
                      className="switch"
                      role="switch"
                      aria-checked={on}
                      aria-label={CAL_NAMES[c]}
                      onClick={() => updateSettings({ aux: CALS.filter((x) => x !== cal && (x === c ? !on : aux.includes(x))) })}
                    ><i /></button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <span className="ob-icon"><Icon name="contrast" size={30} stroke={1.8} /></span>
            <h1>ظاهر برنامه</h1>
            <p>روشن، تیره، یا هر چه گوشی‌ات روی آن است.</p>
            <div className="ob-options" role="radiogroup" aria-label="ظاهر برنامه">
              {THEMES.map(([k, n, icon]) => (
                <button key={k} role="radio" aria-checked={theme === k} className={`ob-option row${theme === k ? ' on' : ''}`} onClick={() => updateSettings({ theme: k })}>
                  <Icon name={icon} size={22} stroke={1.8} />
                  <b>{n}</b>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="ob-foot">
        {step > 0 && <button onClick={() => setStep(step - 1)}>قبلی</button>}
        <button className="primary big-btn" onClick={next}>{last ? 'شروع' : 'ادامه'}</button>
      </div>
    </main>
  );
}
