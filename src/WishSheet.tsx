import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, put, uid } from './db';
import { today } from './cal';
import { Icon } from './Icon';
import { normPhone } from './phone';
import { waNumber, wishTexts } from './wishes';
import { Share } from '@capacitor/share';
import { tx } from './i18n';
import { Button, FormPage, FormSection, InputField } from './ui';

/**
 * The birthday wish: a ready text (by the person's gender), editable, sent through a messaging app, and optionally written
 * into the person's history as one interaction so "keep in touch" sees it.
 */
export function WishSheet({ name, phone, personId, onClose }: { name: string; phone?: string; personId?: string; onClose: () => void }) {
  const person = useLiveQuery(() => (personId ? db.people.get(personId) : undefined), [personId]);
  const texts = wishTexts(person?.gender, name);
  const [text, setText] = useState(texts[0]);
  const [recorded, setRecorded] = useState(false);
  // the birthday row may have no number while the person's profile does
  const number = phone || person?.phones[0];
  const tel = number ? normPhone(number) : '';
  const enc = encodeURIComponent(text);

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked: the text is still in the box above to copy by hand
    }
  };
  // the system share sheet lists every installed messenger (Bale, Eitaa, Instagram, ...), so none needs its own button
  const share = () => void Share.share({ text, dialogTitle: tx('ارسال تبریک') }).catch(() => {});

  const record = async () => {
    if (!personId) return;
    await put('interactions', {
      id: uid(),
      personId,
      type: 'message',
      occurredAt: today(),
      summary: tx('تبریک تولد فرستادم'),
      updatedAt: Date.now(),
    });
    setRecorded(true);
  };

  return (
    <FormPage title={tx('تبریک به {a1}', { a1: name })} icon="cake" onClose={onClose}>
      <section className="wish-hero">
        <span className="wish-cake" aria-hidden="true"><Icon name="cake" size={30} stroke={1.8} /></span>
        <b><bdi>{name}</bdi></b>
        <span>{tx('یک متن آماده انتخاب کن، اگر خواستی ویرایشش کن، بعد بفرست.')}</span>
      </section>

      <FormSection title={tx('متن تبریک')} icon="note">
        <div className="wish-options" role="radiogroup" aria-label={tx('متن تبریک')}>
          {texts.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={text === t} className={`wish-option${text === t ? ' on' : ''}`} onClick={() => setText(t)}>
              <span className="wish-radio" aria-hidden="true">{text === t && <Icon name="check" size={13} stroke={3} />}</span>
              <span>{t}</span>
            </button>
          ))}
        </div>
        <InputField
          label={tx('ویرایش متن')}
          multiline
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </FormSection>

      <FormSection title={tx('ارسال با')} icon="upload">
        <div className="wish-send">
          {tel && <a className="wish-send-btn" href={`sms:${tel}?body=${enc}`}><Icon name="note" size={22} stroke={1.9} /><span>{tx('پیامک')}</span></a>}
          {tel && <a className="wish-send-btn" href={`https://wa.me/${waNumber(tel)}?text=${enc}`} target="_blank" rel="noopener"><Icon name="phone" size={22} stroke={1.9} /><span>{tx('واتساپ')}</span></a>}
          <a className="wish-send-btn" href={`https://t.me/share/url?url=%20&text=${enc}`} target="_blank" rel="noopener"><Icon name="upload" size={22} stroke={1.9} /><span>{tx('تلگرام')}</span></a>
          <a className="wish-send-btn" href={`mailto:?body=${enc}`}><Icon name="file" size={22} stroke={1.9} /><span>{tx('ایمیل')}</span></a>
          <button type="button" className="wish-send-btn" onClick={share}><Icon name="repeat" size={22} stroke={1.9} /><span>{tx('سایر برنامه‌ها')}</span></button>
          <button type="button" className="wish-send-btn" onClick={() => void copy()}><Icon name={copied ? 'check' : 'note'} size={22} stroke={1.9} /><span>{copied ? tx('کپی شد') : tx('کپی متن')}</span></button>
        </div>
        {!tel && <p className="hint">{tx('برای پیامک و واتساپ، شماره‌ای برای این فرد ثبت کن.')}</p>}
      </FormSection>

      {personId && (
        <Button variant="secondary" block disabled={recorded} onClick={() => void record()} icon={recorded ? 'check' : 'history'}>
          {recorded ? tx('در تاریخچه ثبت شد') : tx('بعد از فرستادن، در تاریخچه ثبت کن')}
        </Button>
      )}
    </FormPage>
  );
}
