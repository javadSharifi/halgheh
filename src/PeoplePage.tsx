import { Icon } from './Icon';

export function PeoplePage() {
  return (
    <>
      <div className="page-head"><h1>افراد</h1></div>
      <section className="glass empty-state">
        <span className="tile blue" aria-hidden="true"><Icon name="users" size={24} stroke={1.7} /></span>
        <b>هنوز کسی اضافه نشده</b>
        <p className="hint">آدم‌هایی که می‌شناسی، مهارت‌ها و رابطه‌هایشان اینجا جمع می‌شود.</p>
      </section>
    </>
  );
}
