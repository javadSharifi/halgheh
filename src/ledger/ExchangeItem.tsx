import { type Exchange, type ExchangeSettlement } from '../db';
import { fa } from '../cal';
import { formatToman } from '../format';
import { ask } from '../confirm';
import { Icon } from '../Icon';
import { STR } from '../strings/rulebook';
import { deleteExchange, reopenExchange } from '../ledgerData';
import { dueText, isMoney, isOverdue, isSettled, remainingOf } from '../domain/ledger';

/** Balance chips showing earn, owe and net */
export function BalanceChips({ earn, owe }: { earn: number; owe: number }) {
  const net = earn - owe;
  return (
    <span className="balance-chips">
      {earn > 0 && <em className="bal earn">طلب: {formatToman(earn)}</em>}
      {owe > 0 && <em className="bal owe">بدهی: {formatToman(owe)}</em>}
      <em className={`bal net${net === 0 ? ' zero' : net > 0 ? ' pos' : ' neg'}`}>
        {net === 0 ? 'بی‌حساب' : `${net > 0 ? 'طلب خالص' : 'بدهی خالص'}: ${formatToman(Math.abs(net))}`}
      </em>
    </span>
  );
}

/** Single modern transaction item */
export function ExchangeItem({
  exchange,
  settlements,
  today: t,
  onSettle,
  onEdit,
}: {
  exchange: Exchange;
  settlements: ExchangeSettlement[];
  today: string;
  onSettle: () => void;
  onEdit: () => void;
}) {
  const mine = settlements.filter((s) => s.exchangeId === exchange.id);
  const settled = isSettled(exchange, mine);
  const left = remainingOf(exchange, mine);
  const due = dueText(exchange.dueOn, t, fa);
  const overdue = isOverdue(exchange, t);
  const isCash = isMoney(exchange);
  const totalAmount = exchange.amount ?? 0;
  const paidAmount = totalAmount - (left ?? totalAmount);
  const progressPercent = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;

  return (
    <div className={`ledger-item-card ${settled ? 'settled' : ''}`}>
      <div className="ledger-item-main" onClick={onEdit} role="button" tabIndex={0}>
        <div className="ledger-item-top">
          <div className="ledger-item-badge-wrap">
            <span
              className={`ledger-item-type-badge ${
                isCash
                  ? exchange.direction === 'gave'
                    ? 'badge-earn'
                    : 'badge-owe'
                  : exchange.kind === 'item'
                  ? 'badge-item'
                  : 'badge-favor'
              }`}
            >
              <Icon
                name={
                  isCash
                    ? exchange.direction === 'gave'
                      ? 'upload'
                      : 'download'
                    : exchange.kind === 'item'
                    ? 'gift'
                    : 'listChecks'
                }
                size={13}
                stroke={2.4}
              />
              {isCash
                ? exchange.direction === 'gave'
                  ? 'طلب شما (دادید)'
                  : 'بدهی شما (گرفتید)'
                : exchange.kind === 'item'
                ? 'امانت کالا'
                : 'لطف و خدمت'}
            </span>

            {exchange.dueOn && !settled && (
              <span className={`ledger-item-due-badge ${overdue ? 'overdue' : ''}`}>
                <Icon name="clock" size={12} stroke={2.2} />
                {due}
                {overdue ? ' (سررسید گذشته)' : ''}
              </span>
            )}

            {settled && <span className="ledger-item-settled-badge">تسویه شده</span>}
          </div>

          {isCash && totalAmount > 0 && (
            <div className="ledger-item-price-col">
              <b className={`ledger-item-amount ${exchange.direction === 'gave' ? 'earn' : 'owe'}`}>
                {formatToman(totalAmount)}
              </b>
              {!settled && left !== undefined && left > 0 && left !== totalAmount && (
                <small className="ledger-item-rem">باقیمانده: {formatToman(left)}</small>
              )}
            </div>
          )}
        </div>

        <div className="ledger-item-title-row">
          <b className="ledger-item-title">{exchange.title}</b>
        </div>

        {/* Progress Bar for partial payments */}
        {isCash && !settled && paidAmount > 0 && totalAmount > 0 && (
          <div className="ledger-item-progress-box">
            <div className="progress">
              <i style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="ledger-item-progress-labels">
              <span>{formatToman(paidAmount)} پرداخت شده</span>
              <span>{fa(progressPercent)}٪</span>
            </div>
          </div>
        )}

        {exchange.note && <p className="ledger-item-note">{exchange.note}</p>}
      </div>

      {/* Action Buttons */}
      <div className="ledger-item-actions">
        {settled ? (
          <button
            className="icon-btn small on"
            title="بازگشایی مجدد دادوستد"
            aria-label={`بازگشایی مجدد دادوستد: ${exchange.title}`}
            onClick={(e) => {
              e.stopPropagation();
              void reopenExchange(exchange);
            }}
          >
            <Icon name="undo" size={15} stroke={2.2} />
          </button>
        ) : (
          <button
            className="icon-btn small ledger-settle-btn"
            title="تسویه یا پرداخت"
            aria-label={`تسویه یا پرداخت: ${exchange.title}`}
            onClick={(e) => {
              e.stopPropagation();
              onSettle();
            }}
          >
            <Icon name="checkCircle" size={16} stroke={2.2} />
            <span className="ledger-btn-text-hide-sm">تسویه</span>
          </button>
        )}

        <button
          className="icon-btn small"
          title="ویرایش دادوستد"
          aria-label={`ویرایش: ${exchange.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Icon name="settings" size={15} stroke={2.2} />
        </button>

        <button
          className="icon-btn small danger"
          title="حذف دادوستد"
          aria-label={`حذف: ${exchange.title}`}
          onClick={async (e) => {
            e.stopPropagation();
            if (
              await ask({
                title: STR.ledger.deleteTitle,
                message: STR.ledger.deleteBody,
                confirm: STR.feature.delete,
                icon: 'trash',
              })
            ) {
              await deleteExchange(exchange);
            }
          }}
        >
          <Icon name="trash" size={15} stroke={2} />
        </button>
      </div>
    </div>
  );
}
