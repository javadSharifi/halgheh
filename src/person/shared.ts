import { type Cal, parts, today } from '../cal';
import { tx } from '../i18n';

const paletteOf = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;
/** "نام نام‌خانوادگی", or '' when it repeats the display name. */
const fullName = (p: { firstName?: string; lastName?: string; displayName: string }) => {
  const full = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  return full && full !== p.displayName ? full : '';
};
const smsHref = (phone: string, name: string) => `sms:${phone}?body=${encodeURIComponent(tx('سلام {a1}', { a1: name }))}`;

/** Completed years, or null when the birth year was not given. The birthday may not have come round yet this year. */
function ageOf(year: number | undefined, cal: Cal, month: number, day: number) {
  if (year === undefined) return null;
  const now = parts(today(), cal, 0);
  const hadIt = now.m > month || (now.m === month && now.d >= day);
  return now.y - year - (hadIt ? 0 : 1);
}

export { ageOf, fullName, paletteOf, smsHref };
