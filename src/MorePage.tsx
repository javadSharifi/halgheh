import { Icon, type IconName } from './Icon';

type Props = {
  openSettings: () => void;
  openSync: () => void;
  openArchive: () => void;
  openAbout: () => void;
  openTasks: () => void;
  openBirthdays: () => void;
  openRulebook: () => void;
  openLedger: () => void;
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

export function MorePage({ openSettings, openSync, openArchive, openAbout, openTasks, openBirthdays, openRulebook, openLedger, openGallery }: Props) {
  return (
    <>
      <div className="page-head"><h1>بیشتر</h1></div>

      <section>
        <div className="glass set-list">
          <Row icon="image" tone="purple" name="گالری" onClick={openGallery} />
          <Row icon="settings" tone="blue" name="تنظیمات" onClick={openSettings} />
          <Row icon="cloudCheck" tone="purple" name="حساب و پشتیبان" onClick={openSync} />
          <Row icon="archive" tone="green" name="افراد بایگانی‌شده" onClick={openArchive} />
          <Row icon="info" tone="blue" name="دربارهٔ حلقه" onClick={openAbout} />
        </div>
      </section>

      <section>
        <h2 className="sec-title">قانون‌ها و کارها</h2>
        <div className="glass set-list">
          <Row icon="listChecks" tone="purple" name="قوانین من" onClick={openRulebook} />
        </div>
        <div className="glass set-list more-gap">
          <Row icon="repeat" tone="green" name="دادوستدها" onClick={openLedger} />
          <Row icon="listChecks" tone="blue" name="همهٔ کارها" onClick={openTasks} />
          <Row icon="cakeCandles" tone="purple" name="تولدها" onClick={openBirthdays} />
        </div>
      </section>
    </>
  );
}
