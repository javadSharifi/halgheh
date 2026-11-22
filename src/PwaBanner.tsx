import { Icon } from './Icon';
import { tx } from './i18n';
import { isNative } from './native';
import { applyUpdate, dismissUpdatePrompt, usePwaUpdate } from './pwa';
import { Button } from './ui';

/** Floating update banner shown when a newer service worker build is waiting to activate. */
export function PwaUpdateBanner({ hidden }: { hidden?: boolean }) {
  const { needRefresh, dismissed, updating } = usePwaUpdate();

  if (isNative || hidden || !needRefresh || dismissed) return null;

  return (
    <div className="pwa-banner-wrap" role="region" aria-live="polite" aria-label={tx('به‌روزرسانی برنامه')}>
      <div className="pwa-banner glass">
        <span className="tile blue" aria-hidden="true">
          <Icon name="refresh" size={17} stroke={1.9} />
        </span>
        <div className="pwa-banner-text">
          <b>{tx('نسخهٔ جدید آماده است')}</b>
          <span>{tx('برای دریافت آخرین تغییرات، برنامه را به‌روزرسانی کنید.')}</span>
        </div>
        <div className="pwa-banner-actions">
          <Button variant="primary" size="sm" onClick={() => void applyUpdate()} disabled={updating}>
            {updating ? tx('در حال به‌روزرسانی…') : tx('به‌روزرسانی')}
          </Button>
          <Button variant="ghost" size="sm" onClick={dismissUpdatePrompt} disabled={updating}>
            {tx('بعداً')}
          </Button>
        </div>
      </div>
    </div>
  );
}
