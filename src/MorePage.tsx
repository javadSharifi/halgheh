import { Icon, type IconName } from './Icon';
import { tx } from './i18n';

type Props = {
  openSettings: () => void;
  openSync: () => void;
  openArchive: () => void;
  openAbout: () => void;
  openTasks: () => void;
  openBirthdays: () => void;
  openGallery: () => void;
};

function Row({ icon, tone, name, onClick }: { icon: IconName; tone: 'blue' | 'purple' | 'green'; name: string; onClick: () => void }) {
  return (
    <button className="set-row as-btn" onClick={onClick}>
      <span className={`tile ${tone}`} aria-hidden="true"><Icon name={icon} size={17} stroke={1.9} /></span>
      <span className="set-name">{name}</span>
      <Icon name="chevronLeft" size={16} stroke={2} />
    </button>
  );
}

export function MorePage({ openSettings, openSync, openArchive, openAbout, openTasks, openBirthdays, openGallery }: Props) {
  return (
    <>
      <div className="page-head"><h1>{tx('بیشتر')}</h1></div>

      <section>
        <div className="glass set-list">
          <Row icon="image" tone="purple" name={tx('گالری')} onClick={openGallery} />
          <Row icon="settings" tone="blue" name={tx('تنظیمات')} onClick={openSettings} />
          <Row icon="cloudCheck" tone="purple" name={tx('حساب و پشتیبان')} onClick={openSync} />
          <Row icon="archive" tone="green" name={tx('افراد بایگانی‌شده')} onClick={openArchive} />
          <Row icon="info" tone="blue" name={tx('دربارهٔ حلقه')} onClick={openAbout} />
        </div>
      </section>

      <section>
        <div className="glass set-list">
          <Row icon="listChecks" tone="blue" name={tx('همهٔ کارها')} onClick={openTasks} />
          <Row icon="cakeCandles" tone="purple" name={tx('تولدها')} onClick={openBirthdays} />
        </div>
      </section>
    </>
  );
}
