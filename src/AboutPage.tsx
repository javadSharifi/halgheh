import { Icon } from './Icon';

export function AboutPage() {
  return (
    <>
      <div className="page-head"><h1>دربارهٔ حلقه</h1></div>
      <section className="glass about-card">
        <span className="about-logo" aria-hidden="true"><Icon name="users" size={30} stroke={1.6} /></span>
        <b>حلقه</b>
        <p>دفترچهٔ خصوصی آدم‌هایی که می‌شناسی؛ مهارت‌ها، رابطه‌ها و کارهایی که به تو سپرده‌اند.</p>
        <p className="hint">داده‌ها روی همین گوشی می‌مانند. همگام‌سازی ابری اختیاری است و دادهٔ سرور رمزنگاری نمی‌شود.</p>
        <span className="about-version">نسخه ۱.۰.۰</span>
      </section>
    </>
  );
}
