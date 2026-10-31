import { useMemo, useState } from 'react';
import { type Exchange, type Person } from '../db';
import { today, addDays, wd, parts, label } from '../cal';
import { formatToman, formatNumberFa, tomanWords, toLatinDigits, personLabel } from '../format';
import { Icon } from '../Icon';
import { Button } from '../ui';
import { DatePicker } from '../DatePicker';
import { STR } from '../strings/rulebook';
import { addExchange, saveExchange } from '../ledgerData';
import { PALETTE } from './shared';
import { tx } from '../i18n';

/**
 * Rebuilt ExchangeSheet (Modal)
 * Crystal clear, beautiful, step-by-step guidance for adding or editing a trade.
 */
export function ExchangeSheet({
  people,
  seedPersonId,
  exchange,
  onClose,
  onStartCheck,
  checks,
}: {
  people: Person[];
  seedPersonId?: string;
  exchange: Exchange | null;
  onClose: () => void;
  onStartCheck?: (id: string) => void;
  checks?: { id: string; personId: string; status: 'open' | 'closed' }[];
}) {
  const [personId, setPersonId] = useState(exchange?.personId ?? seedPersonId ?? '');
  const [direction, setDirection] = useState<'gave' | 'received'>(exchange?.direction ?? 'gave');
  const [kind, setKind] = useState<Exchange['kind']>(exchange?.kind ?? 'money');
  const [title, setTitle] = useState(exchange?.title ?? '');
  const [amount, setAmount] = useState(exchange?.amount !== undefined ? String(exchange.amount) : '');
  const [dueOn, setDueOn] = useState(exchange?.dueOn ?? '');
  const [note, setNote] = useState(exchange?.note ?? '');

  const [pickingPerson, setPickingPerson] = useState(!personId);
  const [personSearch, setPersonSearch] = useState('');
  const [pickingDue, setPickingDue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const selectedPerson = useMemo(() => people.find((p) => p.id === personId), [people, personId]);

  // Filter contacts in picker
  const filteredPeople = useMemo(() => {
    const q = personSearch.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.displayName.toLowerCase().includes(q));
  }, [people, personSearch]);

  // Amount parsing
  const parsedAmount = useMemo(() => {
    const d = toLatinDigits(amount).replace(/[^\d]/g, '');
    return d ? Number(d) : undefined;
  }, [amount]);

  // Quick Amount Add
  const addQuickAmount = (delta: number) => {
    const current = parsedAmount ?? 0;
    setAmount(String(current + delta));
  };

  // Due Date Presets
  const setDuePreset = (type: 'week' | 'month' | 'monthPlus') => {
    const t = today();
    if (type === 'week') {
      const day = wd(t);
      const diff = day <= 5 ? 5 - day : 6;
      setDueOn(addDays(t, Math.max(1, diff)));
    } else if (type === 'month') {
      const p = parts(t, 'persian');
      const maxD = p.m <= 6 ? 31 : p.m < 12 ? 30 : 29;
      const diff = Math.max(1, maxD - p.d);
      setDueOn(addDays(t, diff));
    } else if (type === 'monthPlus') {
      setDueOn(addDays(t, 30));
    }
  };

  // Quick Subject suggestions based on Kind
  const SUGGESTED_TITLES: Record<Exchange['kind'], string[]> = {
    money: [tx('قرض'), tx('دَنگ غذا'), tx('خرید مشترک'), tx('کرایه'), tx('مساعده'), tx('پیش‌پرداخت')],
    item: [tx('امانت کتاب'), tx('قرض ابزار'), tx('امانت لباس'), tx('مدرک و پرونده')],
    favor: [tx('کمک کاری'), tx('پیگیری اداری'), tx('معرفی و واسطه'), tx('مشاوره و راهنمایی')],
    other: [tx('تعهد کاری'), tx('قرارداد')],
  };

  const valid = personId.trim() !== '' && title.trim() !== '';

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr('');
    try {
      const draft = {
        personId,
        direction,
        kind: kind === 'money' && parsedAmount === undefined ? ('favor' as const) : kind,
        title: title.trim(),
        amount: kind === 'money' ? parsedAmount : undefined,
        dueOn: dueOn || undefined,
        note: note.trim() || undefined,
      };

      if (exchange) {
        await saveExchange(exchange, draft);
      } else {
        await addExchange(draft);
      }
      onClose();
    } catch {
      setErr(tx(STR.feature.saveFailed));
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section
        className="sheet ledger-modern-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exchange-sheet-title"
      >
        {/* Header */}
        <div className="bf-head">
          <div>
            <span id="exchange-sheet-title" className="sheet-main-title">
              {exchange ? tx('ویرایش دادوستد') : tx('ثبت دادوستد جدید')}
            </span>
            <small className="sheet-sub-title">{tx('ثبت طلب، بدهی، امانت و تعهدات متقابل')}</small>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tx(STR.feature.close)}
          </Button>
        </div>

        <div className="pe-scroll ledger-sheet-content">
          {/* Step 1: Select Person */}
          <div className="ledger-form-section">
            <label className="ledger-form-label">
              <span>{tx('طرف حساب دادوستد')}</span>
              {selectedPerson && (
                <button
                  type="button"
                  className="text-btn text-btn-sm"
                  onClick={() => setPickingPerson(true)}
                >{tx('تغییر طرف حساب')}</button>
              )}
            </label>

            {selectedPerson && !pickingPerson ? (
              <div
                className="ledger-selected-person-card"
                onClick={() => setPickingPerson(true)}
                role="button"
                tabIndex={0}
              >
                <span className={`avatar p${PALETTE(selectedPerson.displayName)}`}>
                  {selectedPerson.displayName.slice(0, 1)}
                </span>
                <div className="ledger-selected-person-info">
                  <b>{personLabel(selectedPerson)}</b>
                  <small>{tx('ضربه بزنید تا تغییر دهید')}</small>
                </div>
                <Icon name="chevronLeft" size={16} stroke={2.2} />
              </div>
            ) : (
              <div className="ledger-person-picker-box">
                <div className="ledger-person-search">
                  <Icon name="search" size={16} stroke={2} />
                  <input
                    type="search"
                    placeholder={tx('جستجوی شخص...')}
                    value={personSearch}
                    onChange={(e) => setPersonSearch(e.target.value)}
                  />
                </div>
                <div className="ledger-person-grid">
                  {filteredPeople.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`ledger-person-pill-btn ${personId === p.id ? 'active' : ''}`}
                      onClick={() => {
                        setPersonId(p.id);
                        setPickingPerson(false);
                      }}
                    >
                      <span className={`avatar p${PALETTE(p.displayName)}`}>
                        {p.displayName.slice(0, 1)}
                      </span>
                      <span><bdi>{personLabel(p)}</bdi></span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Direction (Earn vs Owe) */}
          <div className="ledger-form-section">
            <span className="ledger-form-label">{tx('وضعیت مالی (شما طلبکارید یا بدهکار؟)')}</span>
            <div className="ledger-direction-selector" role="radiogroup" aria-label={tx('جهت دادوستد')}>
              <button
                type="button"
                role="radio"
                aria-checked={direction === 'gave'}
                className={`ledger-dir-card earn ${direction === 'gave' ? 'active' : ''}`}
                onClick={() => setDirection('gave')}
              >
                <div className="ledger-dir-header">
                  <span className="ledger-dir-icon earn">
                    <Icon name="upload" size={18} stroke={2.4} />
                  </span>
                  <b>{tx('من طلبکارم (من دادم)')}</b>
                </div>
                <p>{tx('این مبلغ یا وسیله را من پرداخت کردم یا دادم و باید به من پس داده شود.')}</p>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={direction === 'received'}
                className={`ledger-dir-card owe ${direction === 'received' ? 'active' : ''}`}
                onClick={() => setDirection('received')}
              >
                <div className="ledger-dir-header">
                  <span className="ledger-dir-icon owe">
                    <Icon name="download" size={18} stroke={2.4} />
                  </span>
                  <b>{tx('من بدهکارم (من گرفتم)')}</b>
                </div>
                <p>{tx('این مبلغ یا وسیله را من دریافت کردم یا خرج من شد و باید پس بدهم.')}</p>
              </button>
            </div>
          </div>

          {/* Step 3: Kind of Exchange */}
          <div className="ledger-form-section">
            <span className="ledger-form-label">{tx('نوع دادوستد')}</span>
            <div className="ledger-kind-grid" role="radiogroup" aria-label={tx('نوع دادوستد')}>
              <button
                type="button"
                role="radio"
                aria-checked={kind === 'money'}
                className={`ledger-kind-pill ${kind === 'money' ? 'active' : ''}`}
                onClick={() => setKind('money')}
              >
                <Icon name="tag" size={15} stroke={2.2} />
                <span>{tx('پول نقدی')}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={kind === 'item'}
                className={`ledger-kind-pill ${kind === 'item' ? 'active' : ''}`}
                onClick={() => setKind('item')}
              >
                <Icon name="gift" size={15} stroke={2.2} />
                <span>{tx('کالا و امانت')}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={kind === 'favor'}
                className={`ledger-kind-pill ${kind === 'favor' ? 'active' : ''}`}
                onClick={() => setKind('favor')}
              >
                <Icon name="listChecks" size={15} stroke={2.2} />
                <span>{tx('لطف و خدمت')}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={kind === 'other'}
                className={`ledger-kind-pill ${kind === 'other' ? 'active' : ''}`}
                onClick={() => setKind('other')}
              >
                <Icon name="note" size={15} stroke={2.2} />
                <span>{tx('سایر')}</span>
              </button>
            </div>
          </div>

          {/* Step 4: Amount Input (Only for Money) */}
          {kind === 'money' && (
            <div className="ledger-form-section ledger-amount-section">
              <span className="ledger-form-label">{tx('مبلغ (تومان)')}</span>
              <div className="ledger-amount-input-box">
                <input
                  type="text"
                  dir="ltr"
                  inputMode="numeric"
                  className="ledger-amount-input"
                  value={parsedAmount !== undefined ? formatNumberFa(parsedAmount) : ''}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={tx('۰')}
                  autoFocus={!exchange && !!personId}
                />
                <span className="ledger-amount-currency">{tx('تومان')}</span>
                {parsedAmount !== undefined && (
                  <button
                    type="button"
                    className="icon-btn small ledger-amount-clear"
                    onClick={() => setAmount('')}
                    title={tx('پاک کردن مبلغ')}
                  >
                    <Icon name="close" size={14} stroke={2.2} />
                  </button>
                )}
              </div>

              {parsedAmount !== undefined && parsedAmount > 0 && (
                <div className="ledger-amount-words">
                  <Icon name="tag" size={14} stroke={2} />
                  <span>{tx('معادل {a1}', { a1: tomanWords(parsedAmount) })}</span>
                </div>
              )}

              {/* Quick Increment Chips */}
              <div className="ledger-quick-amounts">
                <button type="button" onClick={() => addQuickAmount(100_000)}>{tx('+۱۰۰ هزار')}</button>
                <button type="button" onClick={() => addQuickAmount(500_000)}>{tx('+۵۰۰ هزار')}</button>
                <button type="button" onClick={() => addQuickAmount(1_000_000)}>{tx('+۱ میلیون')}</button>
                <button type="button" onClick={() => addQuickAmount(5_000_000)}>{tx('+۵ میلیون')}</button>
              </div>
            </div>
          )}

          {/* Step 5: Title / Subject */}
          <div className="ledger-form-section">
            <span className="ledger-form-label">{tx('موضوع یا بابت چیست؟')}</span>
            <input
              type="text"
              className="ledger-text-input"
              value={title}
              maxLength={160}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                kind === 'money'
                  ? tx('مثلاً قرض، دَنگ شام، خرید، کرایه...')
                  : kind === 'item'
                  ? tx('مثلاً کتاب شازده کوچولو، دریل برقی...')
                  : tx('مثلاً کمک در اثاث‌کشی، پیگیری اداری...')
              }
            />

            {/* Title Suggestions */}
            <div className="ledger-suggested-tags">
              {SUGGESTED_TITLES[kind]?.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="ledger-tag-chip"
                  onClick={() => setTitle(title ? `${title} - ${tag}` : tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Step 6: Due Date (Optional) */}
          <div className="ledger-form-section">
            <div className="ledger-due-header">
              <span className="ledger-form-label">{tx('موعد بازپرداخت یا پس دادن (اختیاری)')}</span>
              {dueOn && (
                <button
                  type="button"
                  className="text-btn text-btn-sm"
                  onClick={() => setDueOn('')}
                >{tx('حذف موعد')}</button>
              )}
            </div>

            {dueOn ? (
              <button type="button" className="ledger-due-badge-card" onClick={() => setPickingDue(true)}>
                <Icon name="calendar" size={17} stroke={2.2} />
                <span>{tx('موعد: {a1}', { a1: label(dueOn, 'persian', 0, { day: 'numeric', month: 'long', year: 'numeric' }) })}</span>
                <small>{tx('(تغییر با کلیک)')}</small>
              </button>
            ) : (
              <div className="ledger-due-chips">
                <button type="button" onClick={() => setDuePreset('week')}>{tx('تا آخر هفته')}</button>
                <button type="button" onClick={() => setDuePreset('month')}>{tx('تا آخر ماه')}</button>
                <button type="button" onClick={() => setDuePreset('monthPlus')}>{tx('۱ ماه دیگر')}</button>
                <button type="button" className="custom-date-btn" onClick={() => setPickingDue(true)}>
                  <Icon name="calendar" size={14} stroke={2.2} />{tx('انتخاب از تقویم')}</button>
              </div>
            )}
          </div>

          {/* Step 7: Optional Note */}
          <div className="ledger-form-section">
            <span className="ledger-form-label">{tx('یادداشت و جزئیات (اختیاری)')}</span>
            <textarea
              className="ledger-textarea"
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tx('توضیحاتی مانند شماره کارت، شرایط پرداخت، مشخصات کالا...')}
              rows={2}
            />
          </div>

          {err && <p className="form-error" role="alert">{err}</p>}
        </div>

        {/* Modal Footer Actions */}
        <div className="ledger-sheet-footer">
          <Button
            variant="primary"
            block
            size="lg"
            className="ledger-submit-btn"
            disabled={!valid || busy}
            onClick={() => void save()}
            icon="check"
          >
            {busy
              ? tx('در حال ذخیره…')
              : exchange
              ? tx('ذخیره تغییرات')
              : direction === 'gave'
              ? tx('ثبت طلب {a1}', { a1: parsedAmount ? `(${formatToman(parsedAmount)})` : '' })
              : tx('ثبت بدهی {a1}', { a1: parsedAmount ? `(${formatToman(parsedAmount)})` : '' })}
          </Button>

          {exchange && onStartCheck && (
            <Button
              variant="ghost"
              size="sm"
              className="ledger-check-link"
              onClick={() => {
                const open = checks?.find((c) => c.personId === exchange.personId && c.status === 'open');
                if (open) onStartCheck(open.id);
              }}
              icon="listChecks"
            >
              {tx('بررسی قوانین این شخص')}
            </Button>
          )}
        </div>
      </section>

      {pickingDue && (
        <DatePicker
          value={dueOn || today()}
          onPick={(d) => {
            setDueOn(d);
            setPickingDue(false);
          }}
          onClose={() => setPickingDue(false)}
        />
      )}
    </>
  );
}
