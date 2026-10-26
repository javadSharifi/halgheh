import { fa } from './cal';
import type { DayEvents } from './events';

/** The day's occasions, official days off marked. With `max`, the rest collapse into "and N more". */
export function EventList({ ev, max }: { ev: DayEvents | null; max?: number }) {
  if (!ev) return null;
  const shown = max ? ev.list.slice(0, max) : ev.list;
  return (
    <ul className="event-list">
      {shown.map((e) => (
        <li key={e.title} className={e.holiday ? 'hol' : ''}>
          <i aria-hidden="true" />
          <span>{e.title}</span>
          {e.holiday && <em>تعطیل</em>}
        </li>
      ))}
      {max && ev.list.length > max && <li className="more"><span>و {fa(ev.list.length - max)} مناسبت دیگر</span></li>}
    </ul>
  );
}
