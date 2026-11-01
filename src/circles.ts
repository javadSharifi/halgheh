import type { Person } from './db';
import { tk } from './i18n';

export type Circle = NonNullable<Person['circle']>;

/** How close a person is. `days` is the contact rhythm suggested for the group; the user can still change it per person. */
export const CIRCLES: { key: Circle; name: string; days: number }[] = [
  { key: 'close', name: tk('صمیمی'), days: 14 },
  { key: 'friend', name: tk('دوست'), days: 30 },
  { key: 'acquaintance', name: tk('آشنا'), days: 90 },
  { key: 'distant', name: tk('دور (سالی یک بار)'), days: 365 },
];

export const circleDays = (c: Circle | undefined) => CIRCLES.find((x) => x.key === c)?.days;
