import appIcon from './assets/app-icon.png';
import { faDigits } from './format';
import { tx } from './i18n';
import { isNative } from './native';
import { APP_VERSION, applyUpdate, checkForUpdate, usePwaUpdate } from './pwa';
import { Card, Button } from './ui';

export function AboutPage() {
  const { supported, needRefresh, checking, updating, status } = usePwaUpdate();

  const statusText = needRefresh
    ? tx('نسخهٔ جدید آماده است')
    : status === 'upToDate'
      ? tx('برنامه به‌روز است')
      : status === 'offline'
        ? tx('دستگاه آفلاین است')
        : status === 'error'
          ? tx('خطا در بررسی به‌روزرسانی')
          : '';

  return (
    <>
      <div className="page-head"><h1>{tx('دربارهٔ حلقه')}</h1></div>
      <Card variant="glass" className="about-card">
        <img className="about-logo" src={appIcon} alt={tx('نشان حلقه')} width={64} height={64} />
        <b>{tx('حلقه')}</b>
        <p>{tx('دفترچهٔ خصوصی آدم‌هایی که می‌شناسی؛ مهارت‌ها، رابطه‌ها و کارهایی که به تو سپرده‌اند.')}</p>
        <p className="hint">{tx('داده‌ها روی همین گوشی می‌مانند. همگام‌سازی ابری اختیاری است و دادهٔ سرور رمزنگاری نمی‌شود.')}</p>
        <span className="about-version">{tx('نسخه {a1}', { a1: faDigits(APP_VERSION) })}</span>
        {!isNative && supported && (
          <div className="about-update">
            {needRefresh ? (
              <Button variant="primary" size="sm" icon="refresh" onClick={() => void applyUpdate()} disabled={updating}>
                {updating ? tx('در حال به‌روزرسانی…') : tx('نصب نسخهٔ جدید')}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" icon="refresh" onClick={() => void checkForUpdate()} disabled={checking}>
                {checking ? tx('در حال بررسی…') : tx('بررسی به‌روزرسانی')}
              </Button>
            )}
            {statusText && <span className="hint" role="status">{statusText}</span>}
          </div>
        )}
      </Card>
    </>
  );
}
