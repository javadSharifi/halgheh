import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { PIN_LEN, checkPin, clearLock, getLock, setPin, useLock } from './lockStore';
import { biometric } from './native';
import { fa } from './cal';

/** Dots and a keypad; calls `onDone` with the PIN once it is complete. */
function PinPad({ title, hint, error, onDone, onBio, onCancel }: { title: string; hint?: string; error?: string; onDone: (pin: string) => void; onBio?: () => void; onCancel?: () => void }) {
  const [pin, setP] = useState('');
  const push = (d: string) => {
    const next = (pin + d).slice(0, PIN_LEN);
    setP(next);
    if (next.length === PIN_LEN) setTimeout(() => { onDone(next); setP(''); }, 120);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <div className="pad">
      <span className="ob-icon" aria-hidden="true"><Icon name="lock" size={26} stroke={1.8} /></span>
      <h1>{title}</h1>
      {hint && <p className="hint">{hint}</p>}
      <div className="pin-dots" role="img" aria-label={`${fa(pin.length)} از ${fa(PIN_LEN)} رقم`}>
        {Array.from({ length: PIN_LEN }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}
      </div>
      <p className="form-error pin-err" role="alert">{error ?? ' '}</p>
      <div className="keypad">
        {keys.map((k) => <button key={k} onClick={() => push(k)}>{fa(+k)}</button>)}
        {onBio ? <button aria-label="باز کردن با اثر انگشت" onClick={onBio}><Icon name="smartphone" size={22} stroke={1.8} /></button> : <span />}
        <button onClick={() => push('0')}>{fa(0)}</button>
        <button aria-label="پاک کردن" onClick={() => setP(pin.slice(0, -1))}><Icon name="chevronLeft" size={22} stroke={1.8} /></button>
      </div>
      {onCancel && <button className="text-btn big" onClick={onCancel}>انصراف</button>}
    </div>
  );
}

/** Covers the whole app until the PIN (or the fingerprint) is right. Five wrong PINs in a row wait 30 seconds. */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const lock = useLock();
  const [err, setErr] = useState('');
  const [fails, setFails] = useState(0);
  const [until, setUntil] = useState(0);
  const [hasBio, setHasBio] = useState(false);
  const tried = useRef(false);
  const bio = async () => (await biometric.auth()) && onUnlock();
  useEffect(() => {
    biometric.available().then((ok) => {
      setHasBio(ok && !!lock?.bio);
      if (ok && lock?.bio && !tried.current) {
        tried.current = true;
        bio();
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (pin: string) => {
    if (Date.now() < until) return setErr('کمی صبر کن و دوباره امتحان کن.');
    if (await checkPin(pin)) return onUnlock();
    const n = fails + 1;
    setFails(n % 5);
    if (n % 5 === 0) {
      setUntil(Date.now() + 30_000);
      setErr('۵ بار اشتباه. ۳۰ ثانیه صبر کن.');
    } else setErr('پین درست نیست.');
  };
  return (
    <div className="lock-screen" role="dialog" aria-label="قفل برنامه">
      <PinPad title="پین را وارد کن" error={err} onDone={submit} onBio={hasBio ? bio : undefined} />
    </div>
  );
}

/** Settings flows: turn the lock on, change the PIN, or turn it off. */
export function PinFlow({ mode, onClose }: { mode: 'set' | 'change' | 'off'; onClose: () => void }) {
  const [step, setStep] = useState<'old' | 'new' | 'again'>(mode === 'set' ? 'new' : 'old');
  const [first, setFirst] = useState('');
  const [err, setErr] = useState('');
  const [hasBio, setHasBio] = useState(false);
  useEffect(() => { biometric.available().then(setHasBio); }, []);
  const done = async (pin: string) => {
    setErr('');
    if (step === 'old') {
      if (!(await checkPin(pin))) return setErr('پین درست نیست.');
      if (mode === 'off') {
        clearLock();
        return onClose();
      }
      return setStep('new');
    }
    if (step === 'new') {
      setFirst(pin);
      return setStep('again');
    }
    if (pin !== first) {
      setStep('new');
      return setErr('دو پین یکی نبود. دوباره از اول.');
    }
    await setPin(pin, mode === 'change' ? !!getLock()?.bio : hasBio);
    onClose();
  };
  const title = { old: 'پین فعلی را وارد کن', new: mode === 'set' ? 'یک پین ۴ رقمی انتخاب کن' : 'پین جدید', again: 'پین را دوباره وارد کن' }[step];
  return (
    <div className="lock-screen" role="dialog" aria-label="تنظیم قفل برنامه">
      <PinPad key={step} title={title} error={err} onDone={done} onCancel={onClose} />
    </div>
  );
}
