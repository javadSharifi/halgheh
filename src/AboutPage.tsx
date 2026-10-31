import appIcon from './assets/app-icon.png';

export function AboutPage() {
  return (
    <>
      <div className="page-head"><h1>دربارهٔ حلقه</h1></div>
      <section className="glass about-card">
        <img className="about-logo" src={appIcon} alt="نشان حلقه" width={64} height={64} />
        <b>حلقه</b>
        <p>دفترچهٔ خصوصی آدم‌هایی که می‌شناسی؛ مهارت‌ها، رابطه‌ها و کارهایی که به تو سپرده‌اند.</p>
        <p className="hint">داده‌ها روی همین گوشی می‌مانند. همگام‌سازی ابری اختیاری است و دادهٔ سرور رمزنگاری نمی‌شود.</p>
        <span className="about-version">نسخه ۱.۰.۰</span>
      </section>
    </>
  );
}
