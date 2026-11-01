import { fa } from '../cal';
import { formatToman } from '../format';
import { Icon } from '../Icon';
import { tn, tx } from '../i18n';

/** Net balance + earn/owe/items metrics + overdue alert. Pure presentation. */
export function LedgerHero({
  totalEarn,
  totalOwe,
  openEarnCount,
  openOweCount,
  nonMoneyCount,
  overdueCount,
  onShowOverdue,
}: {
  totalEarn: number;
  totalOwe: number;
  openEarnCount: number;
  openOweCount: number;
  nonMoneyCount: number;
  overdueCount: number;
  onShowOverdue: () => void;
}) {
  const totalNet = totalEarn - totalOwe;

  return (
    <section className="glass ledger-hero">
      <div className="ledger-hero-top">
        <div className="ledger-hero-net">
          <span className="ledger-hero-label">{tx('تراز خالص حساب شما')}</span>
          <div className="ledger-hero-val-wrap">
            <b className={`ledger-hero-val ${totalNet > 0 ? 'pos' : totalNet < 0 ? 'neg' : 'zero'}`}>
              {totalNet > 0 ? `+${formatToman(totalNet)}` : totalNet < 0 ? `-${formatToman(Math.abs(totalNet))}` : tx('تراز صفر (بی‌حساب)')}
            </b>
            <span className={`ledger-hero-status-pill ${totalNet > 0 ? 'pos' : totalNet < 0 ? 'neg' : 'zero'}`}>
              {totalNet > 0 ? tx('طلبکارید') : totalNet < 0 ? tx('بدهکارید') : tx('تسویه کامل')}
            </span>
          </div>
        </div>
      </div>

      <div className="ledger-hero-metrics">
        <div className="ledger-metric-card earn">
          <span className="ledger-metric-icon earn">
            <Icon name="upload" size={16} stroke={2.4} />
          </span>
          <div className="ledger-metric-body">
            <small>{tx('کل طلب‌های شما')}</small>
            <b>{formatToman(totalEarn)}</b>
            <span className="ledger-metric-sub">{tn('{n} دادوستد باز', openEarnCount)}</span>
          </div>
        </div>

        <div className="ledger-metric-card owe">
          <span className="ledger-metric-icon owe">
            <Icon name="download" size={16} stroke={2.4} />
          </span>
          <div className="ledger-metric-body">
            <small>{tx('کل بدهی‌های شما')}</small>
            <b>{formatToman(totalOwe)}</b>
            <span className="ledger-metric-sub">{tn('{n} دادوستد باز', openOweCount)}</span>
          </div>
        </div>

        <div className="ledger-metric-card items">
          <span className="ledger-metric-icon items">
            <Icon name="gift" size={16} stroke={2.2} />
          </span>
          <div className="ledger-metric-body">
            <small>{tx('امانت و خدمات')}</small>
            <b>{tn('{n} مورد', nonMoneyCount)}</b>
            <span className="ledger-metric-sub">{tx('کالا یا لطف متقابل')}</span>
          </div>
        </div>
      </div>

      {overdueCount > 0 && (
        <button
          className="ledger-overdue-alert"
          onClick={onShowOverdue}
          aria-label={tx('نمایش دادوستدهای سررسید گذشته')}
        >
          <Icon name="clock" size={16} stroke={2.2} />
          <span>
            <b>{tn('{n} مورد سررسید گذشته', overdueCount)}</b>{' '}{tx('نیاز به پیگیری یا بازپرداخت دارد.')}</span>
          <Icon name="chevronLeft" size={15} stroke={2.2} />
        </button>
      )}
    </section>
  );
}
