import { tx } from './i18n';

export type TodayTab = 'today' | 'tasks' | 'shopping' | 'birthdays';
const TABS: [TodayTab, string][] = [['today', 'امروز'], ['tasks', 'کارها'], ['shopping', 'خرید'], ['birthdays', 'تولدها']];

/** Switch shared by the daily screens, so tasks, shopping/comparison and birthdays are one tap from Today instead of buried in More. */
export function TodayTabs({ current, go }: { current: TodayTab; go: (p: TodayTab) => void }) {
  return (
    <div className="tabs today-tabs" role="tablist" aria-label={tx('بخش‌های روزانه')}>
      {TABS.map(([k, name]) => (
        <button key={k} role="tab" aria-selected={current === k} className={current === k ? 'on' : ''} onClick={() => go(k)}>{tx(name)}</button>
      ))}
    </div>
  );
}
