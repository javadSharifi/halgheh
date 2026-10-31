import { useState } from 'react';
import { CALS, CAL_NAMES, type Cal, addDays, fa, gridCells, label, month, parts, today, wd, wdInitial } from './cal';
import { Icon } from './Icon';
import { useSettings } from './settings';
import { tx } from './i18n';

/** Bottom sheet to pick a day in any of the three calendars. */
export function DatePicker({ value, onPick, onClose }: { value: string; onPick: (d: string) => void; onClose: () => void }) {
  const { weekStart } = useSettings();
  const [cal, setCal] = useState<Cal>('persian');
  const [anchor, setAnchor] = useState(value);
  const days = month(anchor, cal, 0);
  const cells = gridCells(days, weekStart);
  const t = today();

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <div className="glass sheet" role="dialog" aria-label={tx('انتخاب تاریخ')}>
        <div className="seg">
          {CALS.map((c) => (
            <button key={c} className={c === cal ? 'on' : ''} aria-pressed={c === cal} onClick={() => setCal(c)}>{tx(CAL_NAMES[c])}</button>
          ))}
        </div>
        <div className="month-head">
          <button className="icon-btn" aria-label={tx('ماه قبل')} onClick={() => setAnchor(addDays(days[0], -1))}><Icon name="chevronRight" /></button>
          <div className="month-title"><b>{label(anchor, cal, 0, { month: 'long', year: 'numeric' })}</b></div>
          <button className="icon-btn" aria-label={tx('ماه بعد')} onClick={() => setAnchor(addDays(days[days.length - 1], 1))}><Icon name="chevronLeft" /></button>
        </div>
        <div className="week-head" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7).map((w) => <span key={w} className={w === 5 ? 'fri' : ''}>{wdInitial(w)}</span>)}
        </div>
        <div className="grid">
          {cells.map((d) => (
            <button
              key={d}
              aria-label={label(d, cal, 0, { weekday: 'long', day: 'numeric', month: 'long' })}
              aria-pressed={d === value}
              className={`cell compact${d === value ? ' sel' : ''}${d === t ? ' today' : ''}${wd(d) === 5 ? ' fri' : ''}${days.includes(d) ? '' : ' out'}`}
              onClick={() => onPick(d)}
            >
              <b>{fa(parts(d, cal, 0).d)}</b>
            </button>
          ))}
        </div>
        <div className="sheet-actions">
          <button onClick={() => { setAnchor(t); onPick(t); }}>{tx('امروز')}</button>
          <button onClick={onClose}>{tx('بستن')}</button>
        </div>
      </div>
    </>
  );
}
