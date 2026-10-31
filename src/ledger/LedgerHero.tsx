import { fa } from '../cal';
import { formatToman } from '../format';
import { Icon } from '../Icon';

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
          <span className="ledger-hero-label">تراز خالص حساب شما</span>
          <div className="ledger-hero-val-wrap">
            <b className={`ledger-hero-val ${totalNet > 0 ? 'pos' : totalNet < 0 ? 'neg' : 'zero'}`}>
              {totalNet > 0 ? `+${formatToman(totalNet)}` : totalNet < 0 ? `-${formatToman(Math.abs(totalNet))}` : 'تراز صفر (بی‌حساب)'}
            </b>
            <span className={`ledger-hero-status-pill ${totalNet > 0 ? 'pos' : totalNet < 0 ? 'neg' : 'zero'}`}>
              {totalNet > 0 ? 'طلبکارید' : totalNet < 0 ? 'بدهکارید' : 'تسویه کامل'}
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
            <small>کل طلب‌های شما</small>
            <b>{formatToman(totalEarn)}</b>
            <span className="ledger-metric-sub">{fa(openEarnCount)} دادوستد باز</span>
          </div>
        </div>

        <div className="ledger-metric-card owe">
          <span className="ledger-metric-icon owe">
            <Icon name="download" size={16} stroke={2.4} />
          </span>
          <div className="ledger-metric-body">
            <small>کل بدهی‌های شما</small>
            <b>{formatToman(totalOwe)}</b>
            <span className="ledger-metric-sub">{fa(openOweCount)} دادوستد باز</span>
          </div>
        </div>

        <div className="ledger-metric-card items">
          <span className="ledger-metric-icon items">
            <Icon name="gift" size={16} stroke={2.2} />
          </span>
          <div className="ledger-metric-body">
            <small>امانت و خدمات</small>
            <b>{fa(nonMoneyCount)} مورد</b>
            <span className="ledger-metric-sub">کالا یا لطف متقابل</span>
          </div>
        </div>
      </div>

      {overdueCount > 0 && (
        <button
          className="ledger-overdue-alert"
          onClick={onShowOverdue}
          aria-label="نمایش دادوستدهای سررسید گذشته"
        >
          <Icon name="clock" size={16} stroke={2.2} />
          <span>
            <b>{fa(overdueCount)} مورد سررسید گذشته</b> نیاز به پیگیری یا بازپرداخت دارد.
          </span>
          <Icon name="chevronLeft" size={15} stroke={2.2} />
        </button>
      )}
    </section>
  );
}
