import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Exchange, type Person, db } from './db';
import { today, addDays, wd, parts, label } from './cal';
import { formatToman, formatNumberFa, tomanWords, toLatinDigits, personLabel } from './format';
import { Icon } from './Icon';
import { Button, FormPage, FormSection, InputField } from './ui';
import { DatePicker } from './DatePicker';
import { STR } from './strings/rulebook';
import { addExchange, saveExchange } from './ledgerData';
import { PALETTE } from './ledger/shared';
import { tx } from './i18n';

/**
 * ExchangePage:
 * Dedicated full-screen page for registering a new exchange or editing an existing one.
 * Replaces the cramped bottom modal sheet with a clean, spacious, high-contrast interface.
 */
export function ExchangePage({
  exchangeId,
  seedPersonId,
  onBack,
  openCheck,
}: {
  exchangeId?: string | null;
  seedPersonId?: string;
  onBack: () => void;
  openCheck?: (id: string) => void;
}) {
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const exchange = useLiveQuery(
    async () => {
      if (!exchangeId) return null;
      const found = await db.exchanges.get(exchangeId);
      return found ?? null;
    },
    [exchangeId]
  );
  const checks = useLiveQuery(() => db.ruleChecks.toArray(), []) ?? [];

  // Wait if we were given an exchangeId but exchange row is still loading
  if (exchangeId && exchange === undefined) {
    return (
      <div className="exchange-page">
        <header className="page-head exchange-page-head">
          <button className="icon-btn" onClick={onBack} aria-label={tx('بازگشت')}>
            <Icon name="chevronRight" size={20} stroke={2.4} />
          </button>
          <h1>{tx('ویرایش دادوستد')}</h1>
        </header>
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
          {tx('در حال بارگذاری…')}
        </div>
      </div>
    );
  }

  return (
    <ExchangeForm
      key={exchangeId ?? 'new'}
      exchange={exchange ?? null}
      seedPersonId={seedPersonId}
      people={people.filter((p) => !p.archivedAt && !p.isSelf)}
      checks={checks}
      onBack={onBack}
      openCheck={openCheck}
    />
  );
}

function ExchangeForm({
  exchange,
  seedPersonId,
  people,
  checks,
  onBack,
  openCheck,
}: {
  exchange: Exchange | null;
  seedPersonId?: string;
  people: Person[];
  checks: { id: string; personId: string; status: 'open' | 'closed' }[];
  onBack: () => void;
  openCheck?: (id: string) => void;
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
    return people.filter((p) => {
      const nameMatch = p.displayName.toLowerCase().includes(q);
      const phoneMatch = p.phones?.some((ph) => ph.includes(q));
      return nameMatch || phoneMatch;
    });
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
      onBack();
    } catch {
      setErr(tx(STR.feature.saveFailed));
      setBusy(false);
    }
  };

  return (
    <FormPage
      title={exchange ? tx('ویرایش دادوستد') : tx('ثبت دادوستد جدید')}
      icon={exchange ? 'edit' : 'plus'}
      onClose={onBack}
      onSave={() => void save()}
      saveLabel={exchange ? tx('ذخیره') : tx('ثبت')}
      saveDisabled={!valid}
      busy={busy}
      error={err}
    >
        {/* Step 1: Select Person (طرف حساب) */}
        <FormSection>
          <div className="exchange-section-header">
            <span className="fp-section-title">{tx('طرف حساب دادوستد')}</span>
            {selectedPerson && !pickingPerson && (
              <button
                type="button"
                className="text-btn text-btn-sm"
                onClick={() => setPickingPerson(true)}
              >
                {tx('تغییر طرف حساب')}
              </button>
            )}
          </div>

          {selectedPerson && !pickingPerson ? (
            <div
              className="exchange-selected-person"
              onClick={() => setPickingPerson(true)}
              role="button"
              tabIndex={0}
            >
              <span className={`avatar p${PALETTE(selectedPerson.displayName)}`}>
                {selectedPerson.displayName.slice(0, 1)}
              </span>
              <div className="exchange-selected-person-info">
                <b>{personLabel(selectedPerson)}</b>
                <small>{selectedPerson.phones?.[0] || tx('ضربه بزنید تا تغییر دهید')}</small>
              </div>
              <span className="exchange-change-pill">{tx('تغییر')}</span>
            </div>
          ) : (
            <div className="exchange-person-picker">
              <InputField
                type="search"
                icon="search"
                aria-label={tx('جستجوی شخص...')}
                placeholder={tx('جستجوی شخص...')}
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
                autoFocus={!selectedPerson}
              />

              <div className="exchange-people-list" role="listbox" aria-label={tx('فهرست اشخاص')}>
                {filteredPeople.length === 0 ? (
                  <div className="exchange-empty-people">
                    <p>{tx('مخاطبی با این نام پیدا نشد.')}</p>
                  </div>
                ) : (
                  filteredPeople.map((p) => {
                    const isCurrent = personId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="option"
                        aria-selected={isCurrent}
                        className={`exchange-person-row ${isCurrent ? 'selected' : ''}`}
                        onClick={() => {
                          setPersonId(p.id);
                          setPickingPerson(false);
                        }}
                      >
                        <span className={`avatar p${PALETTE(p.displayName)}`}>
                          {p.displayName.slice(0, 1)}
                        </span>
                        <div className="exchange-person-row-meta">
                          <b><bdi>{personLabel(p)}</bdi></b>
                          {p.phones?.[0] && <small>{p.phones[0]}</small>}
                        </div>
                        {isCurrent && (
                          <span className="exchange-person-check-icon">
                            <Icon name="check" size={16} stroke={2.8} />
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {selectedPerson && (
                <button
                  type="button"
                  className="exchange-cancel-pick-btn"
                  onClick={() => setPickingPerson(false)}
                >
                  {tx('انصراف از تغییر')}
                </button>
              )}
            </div>
          )}
        </FormSection>

        {/* Step 2: Financial Direction (طلبکار یا بدهکار) */}
        <FormSection>
          <span className="fp-section-title">{tx('وضعیت مالی (شما طلبکارید یا بدهکار؟)')}</span>
          <div className="exchange-direction-grid" role="radiogroup" aria-label={tx('جهت دادوستد')}>
            <button
              type="button"
              role="radio"
              aria-checked={direction === 'gave'}
              className={`exchange-dir-btn earn ${direction === 'gave' ? 'active' : ''}`}
              onClick={() => setDirection('gave')}
            >
              <span className="exchange-dir-icon earn">
                <Icon name="upload" size={17} stroke={2.5} />
              </span>
              <div className="exchange-dir-info">
                <b>{tx('من طلبکارم')}</b>
                <small>{tx('من دادم')}</small>
              </div>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={direction === 'received'}
              className={`exchange-dir-btn owe ${direction === 'received' ? 'active' : ''}`}
              onClick={() => setDirection('received')}
            >
              <span className="exchange-dir-icon owe">
                <Icon name="download" size={17} stroke={2.5} />
              </span>
              <div className="exchange-dir-info">
                <b>{tx('من بدهکارم')}</b>
                <small>{tx('من گرفتم')}</small>
              </div>
            </button>
          </div>
        </FormSection>

        {/* Step 3: Kind of Exchange (نوع دادوستد) */}
        <FormSection>
          <span className="fp-section-title">{tx('نوع دادوستد')}</span>
          <div className="exchange-kind-grid" role="radiogroup" aria-label={tx('نوع دادوستد')}>
            <button
              type="button"
              role="radio"
              aria-checked={kind === 'money'}
              className={`exchange-kind-btn ${kind === 'money' ? 'active' : ''}`}
              onClick={() => setKind('money')}
            >
              <Icon name="tag" size={16} stroke={2.2} />
              <span>{tx('پول نقدی')}</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={kind === 'item'}
              className={`exchange-kind-btn ${kind === 'item' ? 'active' : ''}`}
              onClick={() => setKind('item')}
            >
              <Icon name="gift" size={16} stroke={2.2} />
              <span>{tx('کالا و امانت')}</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={kind === 'favor'}
              className={`exchange-kind-btn ${kind === 'favor' ? 'active' : ''}`}
              onClick={() => setKind('favor')}
            >
              <Icon name="listChecks" size={16} stroke={2.2} />
              <span>{tx('لطف و خدمت')}</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={kind === 'other'}
              className={`exchange-kind-btn ${kind === 'other' ? 'active' : ''}`}
              onClick={() => setKind('other')}
            >
              <Icon name="note" size={16} stroke={2.2} />
              <span>{tx('سایر')}</span>
            </button>
          </div>
        </FormSection>

        {/* Step 4: Amount Input (Only for Money) */}
        {kind === 'money' && (
          <FormSection>
            <div className="exchange-amount-head">
              <span className="fp-section-title">{tx('مبلغ (تومان)')}</span>
              <span className="exchange-currency-pill">{tx('تومان')}</span>
            </div>

            <InputField
              dir="ltr"
              inputMode="numeric"
              aria-label={tx('مبلغ (تومان)')}
              value={parsedAmount !== undefined ? formatNumberFa(parsedAmount) : ''}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={tx('۰')}
              autoFocus={!exchange && !!personId}
            />

            {parsedAmount !== undefined && parsedAmount > 0 && (
              <div className="exchange-amount-words">
                <Icon name="tag" size={14} stroke={2} />
                <span>{tx('معادل {a1}', { a1: tomanWords(parsedAmount) })}</span>
              </div>
            )}

            {/* Quick Increment Chips */}
            <div className="exchange-quick-amounts">
              <button type="button" onClick={() => addQuickAmount(100_000)}>
                {tx('+۱۰۰ هزار')}
              </button>
              <button type="button" onClick={() => addQuickAmount(500_000)}>
                {tx('+۵۰۰ هزار')}
              </button>
              <button type="button" onClick={() => addQuickAmount(1_000_000)}>
                {tx('+۱ میلیون')}
              </button>
              <button type="button" onClick={() => addQuickAmount(5_000_000)}>
                {tx('+۵ میلیون')}
              </button>
            </div>
          </FormSection>
        )}

        {/* Step 5: Title / Subject */}
        <FormSection>
          <InputField
            label={tx('موضوع یا بابت چیست؟')}
            required
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
          <div className="exchange-suggested-tags">
            {SUGGESTED_TITLES[kind]?.map((tag) => (
              <button
                key={tag}
                type="button"
                className="exchange-tag-chip"
                onClick={() => setTitle(title ? `${title} - ${tag}` : tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </FormSection>

        {/* Step 6: Due Date (Optional) */}
        <FormSection>
          <div className="exchange-section-header">
            <span className="fp-section-title">
              {tx('موعد بازپرداخت یا پس دادن (اختیاری)')}
            </span>
            {dueOn && (
              <button
                type="button"
                className="text-btn text-btn-sm"
                onClick={() => setDueOn('')}
              >
                {tx('حذف موعد')}
              </button>
            )}
          </div>

          {dueOn ? (
            <div
              className="exchange-due-badge-card"
              onClick={() => setPickingDue(true)}
              role="button"
              tabIndex={0}
            >
              <Icon name="calendar" size={18} stroke={2.2} />
              <div className="exchange-due-badge-info">
                <b>
                  {tx('موعد: {a1}', {
                    a1: label(dueOn, 'persian', 0, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }),
                  })}
                </b>
                <small>({tx('ضربه بزنید تا تغییر دهید')})</small>
              </div>
              <Icon name="chevronLeft" size={16} stroke={2.2} />
            </div>
          ) : (
            <div className="exchange-due-chips">
              <button type="button" onClick={() => setDuePreset('week')}>
                {tx('تا آخر هفته')}
              </button>
              <button type="button" onClick={() => setDuePreset('month')}>
                {tx('تا آخر ماه')}
              </button>
              <button type="button" onClick={() => setDuePreset('monthPlus')}>
                {tx('۱ ماه دیگر')}
              </button>
              <button
                type="button"
                className="custom-date-btn"
                onClick={() => setPickingDue(true)}
              >
                <Icon name="calendar" size={15} stroke={2.2} />
                {tx('انتخاب از تقویم')}
              </button>
            </div>
          )}
        </FormSection>

        {/* Step 7: Optional Note */}
        <FormSection>
          <label className="fp-section-title" htmlFor="exchange-note-input">
            {tx('یادداشت و جزئیات (اختیاری)')}
          </label>
          <InputField
            id="exchange-note-input"
            multiline
            rows={3}
            aria-label={tx('یادداشت و جزئیات (اختیاری)')}
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            placeholder={tx('توضیحاتی مانند شماره کارت، شرایط پرداخت، مشخصات کالا...')}
          />
        </FormSection>

        {exchange && openCheck && (
          <Button
            variant="ghost"
            block
            icon="listChecks"
            onClick={() => {
              const open = checks.find((c) => c.personId === exchange.personId && c.status === 'open');
              if (open) openCheck(open.id);
            }}
          >
            {tx('بررسی قوانین این شخص')}
          </Button>
        )}

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
    </FormPage>
  );
}
