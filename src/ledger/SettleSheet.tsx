import { useMemo, useState } from 'react';
import { type Exchange, type ExchangeSettlement } from '../db';
import { label } from '../cal';
import { formatToman, formatNumberFa, tomanWords, toLatinDigits } from '../format';
import { ask } from '../confirm';
import { Icon } from '../Icon';
import { STR } from '../strings/rulebook';
import { addSettlement, deleteSettlement, settleExchange } from '../ledgerData';
import { isMoney, remainingOf } from '../domain/ledger';
import { tx } from '../i18n';

/**
 * Rebuilt SettleSheet (Payment & Settlement Modal)
 */
export function SettleSheet({
  exchange,
  settlements,
  personName,
  onClose,
}: {
  exchange: Exchange;
  settlements: ExchangeSettlement[];
  personName: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [partialNote, setPartialNote] = useState('');
  const [busy, setBusy] = useState(false);

  const left = remainingOf(exchange, settlements) ?? (exchange.amount ?? 0);
  const canPartial = isMoney(exchange) && exchange.amount !== undefined;

  const parsedPartial = useMemo(() => {
    const d = toLatinDigits(partialAmount).replace(/[^\d]/g, '');
    return d ? Number(d) : undefined;
  }, [partialAmount]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'partial' && canPartial && parsedPartial) {
        await addSettlement(exchange, parsedPartial, partialNote);
      } else {
        await settleExchange(exchange);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const removeSettlement = async (s: ExchangeSettlement) => {
    if (
      await ask({
        title: tx(STR.ledger.settlementDelete),
        message: tx(STR.ledger.settlementDeleteBody),
        confirm: tx(STR.feature.delete),
        icon: 'trash',
      })
    ) {
      await deleteSettlement(s, exchange);
    }
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet ledger-modern-sheet" role="dialog" aria-modal="true">
        <div className="bf-head">
          <div>
            <span className="sheet-main-title">{tx('تسویه و پرداخت')}</span>
            <small className="sheet-sub-title">
              <bdi>{exchange.title}</bdi> ({personName})
            </small>
          </div>
          <button className="text-btn" onClick={onClose}>
            {tx(STR.feature.close)}
          </button>
        </div>

        <div className="pe-scroll ledger-sheet-content">
          {/* Summary Card */}
          {isMoney(exchange) && exchange.amount !== undefined && (
            <div className="glass ledger-settle-summary">
              <div className="ledger-settle-sum-row">
                <span>{tx('کل مبلغ دادوستد:')}</span>
                <b>{formatToman(exchange.amount)}</b>
              </div>
              <div className="ledger-settle-sum-row">
                <span>{tx('پرداخت‌های قبلی:')}</span>
                <b>{formatToman(exchange.amount - left)}</b>
              </div>
              <div className="ledger-settle-sum-row highlight">
                <span>{tx('باقیمانده برای تسویه:')}</span>
                <b className="left-amount">{formatToman(left)}</b>
              </div>
            </div>
          )}

          {canPartial && (
            <div className="ledger-mode-tabs" role="radiogroup" aria-label={tx('روش تسویه')}>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'full'}
                className={mode === 'full' ? 'active' : ''}
                onClick={() => setMode('full')}
              >{tx('تسویهٔ کامل باقیمانده (')}{formatToman(left)})
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'partial'}
                className={mode === 'partial' ? 'active' : ''}
                onClick={() => setMode('partial')}
              >{tx('پرداخت بخشی (مرحله‌ای)')}</button>
            </div>
          )}

          {mode === 'partial' && canPartial && (
            <div className="ledger-form-section ledger-amount-section">
              <span className="ledger-form-label">{tx('مبلغ پرداختی این نوبت (تومان)')}</span>
              <div className="ledger-amount-input-box">
                <input
                  type="text"
                  dir="ltr"
                  inputMode="numeric"
                  className="ledger-amount-input"
                  value={parsedPartial !== undefined ? formatNumberFa(parsedPartial) : ''}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder={tx('۰')}
                  autoFocus
                />
                <span className="ledger-amount-currency">{tx('تومان')}</span>
              </div>

              {parsedPartial !== undefined && parsedPartial > 0 && (
                <div className="ledger-amount-words">
                  <Icon name="tag" size={14} stroke={2} />
                  <span>{tx('معادل {a1}', { a1: tomanWords(parsedPartial) })}</span>
                </div>
              )}

              {/* Quick buttons */}
              <div className="ledger-quick-amounts">
                <button type="button" onClick={() => setPartialAmount(String(Math.round(left / 2)))}>{tx('۵۰٪ باقیمانده')}</button>
                <button type="button" onClick={() => setPartialAmount(String(Math.round(left / 4)))}>{tx('۲۵٪ باقیمانده')}</button>
                <button type="button" onClick={() => setPartialAmount(String(left))}>{tx('کل باقیمانده')}</button>
              </div>

              <input
                type="text"
                className="ledger-text-input"
                style={{ marginTop: '10px' }}
                value={partialNote}
                onChange={(e) => setPartialNote(e.target.value)}
                placeholder={tx('توضیح این پرداخت (اختیاری، مثلاً قسط اول)')}
              />
            </div>
          )}

          {/* Past settlements history */}
          {settlements.length > 0 && (
            <div className="ledger-settlements-history">
              <span className="ledger-form-label">{tx('تاریخچه پرداخت‌های ثبت‌شده:')}</span>
              <div className="ledger-history-list">
                {settlements.map((s) => (
                  <div key={s.id} className="ledger-history-row">
                    <span className="ledger-history-date">
                      {label(s.date, 'persian', 0, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <b className="ledger-history-amount">{formatToman(s.amount)}</b>
                    {s.note && <span className="ledger-history-note">({s.note})</span>}
                    <button
                      type="button"
                      className="icon-btn small danger"
                      onClick={() => void removeSettlement(s)}
                      title={tx('حذف این پرداخت')}
                    >
                      <Icon name="trash" size={14} stroke={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="ledger-sheet-footer">
          <button
            type="button"
            className="primary ledger-submit-btn"
            disabled={busy || (mode === 'partial' && !parsedPartial)}
            onClick={() => void save()}
          >
            <Icon name="check" size={18} stroke={2.4} />
            {busy
              ? tx('در حال ثبت…')
              : mode === 'partial'
              ? tx('ثبت پرداخت {a1}', { a1: parsedPartial ? `(${formatToman(parsedPartial)})` : '' })
              : tx('تسویه کامل ({a1})', { a1: formatToman(left) })}
          </button>
        </div>
      </section>
    </>
  );
}
