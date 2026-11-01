import type { Gender } from './db/types';
import { tx } from './i18n';
import { normPhone } from './phone';

/** Two ready-made congratulation texts, picked by the person's gender; unknown gender gets the neutral pair. */
export function wishTexts(gender: Gender | undefined, name: string): [string, string] {
  const a1 = name;
  if (gender === 'f') {
    return [
      tx('تولدت مبارک {a1} جان! سالی پر از شادی و سلامتی برات آرزو می‌کنم.', { a1 }),
      tx('{a1} عزیز، تولدت مبارک! امیدوارم این سال بهترین سال زندگی‌ات باشد.', { a1 }),
    ];
  }
  if (gender === 'm') {
    return [
      tx('{a1} جان، تولدت مبارک! سالی پر از موفقیت و سلامتی برات آرزو می‌کنم.', { a1 }),
      tx('تولدت مبارک {a1}! امیدوارم سالی پر از خبرهای خوب داشته باشی.', { a1 }),
    ];
  }
  return [
    tx('تولدت مبارک {a1}! سالی پر از شادی و سلامتی برات آرزو می‌کنم.', { a1 }),
    tx('{a1} عزیز، تولدت مبارک! روز خوبی داشته باشی.', { a1 }),
  ];
}

// shortcut: only an Iranian local 09… is folded to +98; another country needs its own dial code
/** wa.me wants the international number: 0912… becomes 98912…. */
export const waNumber = (phone: string) => normPhone(phone).replace(/^0/, '98');
