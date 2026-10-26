import { useState } from 'react';
import { CALS, CAL_NAMES, type Cal, addDays, fa, gridCells, label, month, parts, today, wd } from './cal';
import { Icon } from './Icon';
import { isHoliday } from './events';
import { useSettings } from './settings';

const WEEKDAYS = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']; // by JS weekday, 0 = Sunday

/** Bottom sheet to pick a day in any of the three calendars. */
export function DatePicker({ value, onPick, onClose }: { value: string; onPick: (d: string) => void; onClose: () => void }) {
  const s = useSettings();
  const off = s.hijriOffset;
  const [cal, setCal] = useState<Cal>(s.cal);
  const [anchor, setAnchor] = useState(value);
  const days = month(anchor, cal, off);
  const cells = gridCells(days, s.weekStart);
  const t = today();

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <div className="glass sheet" role="dialog" aria-label="انتخاب تاریخ">
        <div className="seg">
          {CALS.map((c) => (
            <button key={c} className={c === cal ? 'on' : ''} aria-pressed={c === cal} onClick={() => setCal(c)}>{CAL_NAMES[c]}</button>
          ))}
        </div>
        <div className="month-head">
          <button className="icon-btn" aria-label="ماه قبل" onClick={() => setAnchor(addDays(days[0], -1))}><Icon name="chevronRight" /></button>
          <div className="month-title"><b>{label(anchor, cal, off, { month: 'long', year: 'numeric' })}</b></div>
          <button className="icon-btn" aria-label="ماه بعد" onClick={() => setAnchor(addDays(days[days.length - 1], 1))}><Icon name="chevronLeft" /></button>
        </div>
        <div className="week-head" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (s.weekStart + i) % 7).map((w) => <span key={w} className={w === 5 ? 'fri' : ''}>{WEEKDAYS[w]}</span>)}
        </div>
        <div className="grid">
          {cells.map((d) => (
            <button
              key={d}
              aria-label={label(d, cal, off, { weekday: 'long', day: 'numeric', month: 'long' })}
              aria-pressed={d === value}
              className={`cell compact${d === value ? ' sel' : ''}${d === t ? ' today' : ''}${wd(d) === 5 || isHoliday(d) ? ' fri' : ''}${days.includes(d) ? '' : ' out'}`}
              onClick={() => onPick(d)}
            >
              <b>{fa(parts(d, cal, off).d)}</b>
            </button>
          ))}
        </div>
        <div className="sheet-actions">
          <button onClick={() => { setAnchor(t); onPick(t); }}>امروز</button>
          <button onClick={onClose}>بستن</button>
        </div>
      </div>
    </>
  );
}
