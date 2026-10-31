import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, put, uid } from './db';
import { today, fa } from './cal';
import { Icon } from './Icon';
import { normPhone } from './phone';
import { waNumber, wishTexts } from './wishes';
import { tx } from './i18n';
import { Sheet, InputField, Button } from './ui';

/**
 * The birthday wish: a ready text (by the person's gender), editable, sent through a messaging app, and optionally written
 * into the person's history as one interaction so "keep in touch" sees it.
 */
export function WishSheet({ name, phone, personId, onClose }: { name: string; phone?: string; personId?: string; onClose: () => void }) {
  const person = useLiveQuery(() => (personId ? db.people.get(personId) : undefined), [personId]);
  const texts = wishTexts(person?.gender, name);
  const [text, setText] = useState(texts[0]);
  const [recorded, setRecorded] = useState(false);
  const tel = phone ? normPhone(phone) : '';
  const enc = encodeURIComponent(text);

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
    <Sheet open onClose={onClose} title={tx('تبریک به {a1}', { a1: name })}>
      <div className="pe-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="radios" role="radiogroup" aria-label={tx('متن تبریک')} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {texts.map((t, i) => (
            <button key={t} role="radio" aria-checked={text === t} className={text === t ? 'on' : ''} onClick={() => setText(t)}>
              {tx('متن {a1}', { a1: fa(i + 1) })}
            </button>
          ))}
        </div>

        <InputField
          label={tx('متن تبریک')}
          multiline
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="inline-actions">
          {tel && <a className="mini-btn" href={`sms:${tel}?body=${enc}`}><Icon name="note" size={15} stroke={2} />{tx('پیامک')}</a>}
          {tel && <a className="mini-btn" href={`https://wa.me/${waNumber(tel)}?text=${enc}`} target="_blank" rel="noopener"><Icon name="note" size={15} stroke={2} />{tx('واتساپ')}</a>}
          <a className="mini-btn" href={`tg://msg?text=${enc}`}><Icon name="note" size={15} stroke={2} />{tx('تلگرام')}</a>
          <a className="mini-btn" href={`mailto:?body=${enc}`}><Icon name="file" size={15} stroke={2} />{tx('ایمیل')}</a>
        </div>

        {personId && (
          <Button
            variant="primary"
            block
            disabled={recorded}
            onClick={() => void record()}
            icon={recorded ? 'check' : 'history'}
          >
            {recorded ? tx('ثبت شد') : tx('ثبت به‌عنوان تعامل')}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
