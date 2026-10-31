import appIcon from './assets/app-icon.png';
import { tx } from './i18n';

export function AboutPage() {
  return (
    <>
      <div className="page-head"><h1>{tx('دربارهٔ حلقه')}</h1></div>
      <section className="glass about-card">
        <img className="about-logo" src={appIcon} alt={tx('نشان حلقه')} width={64} height={64} />
        <b>{tx('حلقه')}</b>
        <p>{tx('دفترچهٔ خصوصی آدم‌هایی که می‌شناسی؛ مهارت‌ها، رابطه‌ها و کارهایی که به تو سپرده‌اند.')}</p>
        <p className="hint">{tx('داده‌ها روی همین گوشی می‌مانند. همگام‌سازی ابری اختیاری است و دادهٔ سرور رمزنگاری نمی‌شود.')}</p>
        <span className="about-version">{tx('نسخه ۱.۰.۰')}</span>
      </section>
    </>
  );
}
