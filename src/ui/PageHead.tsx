import { Icon, type IconName } from '../Icon';

export interface PageHeadTool {
  icon: IconName;
  label: string;
  onClick: () => void;
  /** The page's own "add" action: the one filled circle in the row. */
  primary?: boolean;
}

/** One header for every tab screen: the title on the start side, equal round icon buttons on the other. */
export function PageHead({ title, badge, tools = [] }: { title: string; badge?: string; tools?: PageHeadTool[] }) {
  return (
    <div className="page-head">
      <div className="ph-title">
        <h1>{title}</h1>
        {badge && <span className="ledger-title-count">{badge}</span>}
      </div>
      <div className="head-tools">
        {tools.map((t) => (
          <button key={t.icon + t.label} type="button" className={`ph-act${t.primary ? ' primary' : ''}`} aria-label={t.label} title={t.label} onClick={t.onClick}>
            <Icon name={t.icon} size={19} stroke={t.primary ? 2.4 : 1.9} />
          </button>
        ))}
      </div>
    </div>
  );
}
