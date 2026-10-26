import { Icon } from './Icon';

export function GalleryPage() {
  return (
    <>
      <div className="page-head"><h1>گالری</h1></div>
      <section className="glass empty-state">
        <span className="tile purple" aria-hidden="true"><Icon name="image" size={24} stroke={1.7} /></span>
        <b>عکسی نیست</b>
        <p className="hint">کارت ویزیت، مدارک و عکس‌هایی که به آدم‌ها مربوط‌اند اینجا نگه داشته می‌شوند.</p>
      </section>
    </>
  );
}
