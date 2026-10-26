import { Icon } from './Icon';

export function QuickAdd({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet quick-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-add-title">
        <div className="bf-head">
          <span id="quick-add-title">افزودن سریع</span>
          <button className="text-btn" onClick={onClose}>بستن</button>
        </div>
        <span className="tile blue" aria-hidden="true"><Icon name="users" size={20} stroke={1.8} /></span>
        <p className="hint">ثبت فرد فقط با یک نام، در گام بعدی فعال می‌شود. تا آن موقع از فهرست افراد شروع کنید.</p>
      </section>
    </>
  );
}
