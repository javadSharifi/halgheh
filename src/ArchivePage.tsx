import { Icon } from './Icon';

export function ArchivePage() {
  return (
    <>
      <div className="page-head"><h1>افراد بایگانی‌شده</h1></div>
      <section className="glass empty-state">
        <span className="tile green" aria-hidden="true"><Icon name="archive" size={24} stroke={1.7} /></span>
        <b>کسی بایگانی نشده</b>
        <p className="hint">افرادی که از فهرست اصلی کنار می‌گذارید، بدون پاک‌شدن داده‌ها اینجا می‌مانند.</p>
      </section>
    </>
  );
}
