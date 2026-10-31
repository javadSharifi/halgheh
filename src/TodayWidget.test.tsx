import { expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TodayWidget } from './TodayWidget';
import type { Task } from './db';
import { today } from './cal';

test('TodayWidget renders live clock display, calendar, and quick-add input', () => {
  const dummyTask: Task = {
    id: 't-1',
    title: 'خرید میوه برای مهمانی',
    mask: 0,
    on: today(),
    start: today(),
    active: true,
    updatedAt: Date.now(),
  };

  const html = renderToStaticMarkup(
    <TodayWidget
      tasks={[dummyTask]}
      dones={[]}
      todays={[{ task: dummyTask, done: false }]}
      openTask={() => {}}
      nameOf={new Map()}
    />
  );

  // Checks widget sections
  expect(html).toContain('today-widget');
  expect(html).toContain('tw-clock-display');
  expect(html).toContain('tw-cal-block');
  expect(html).toContain('کاری که باید امروز انجام بدم...');
  expect(html).toContain('افزودن');
  expect(html).toContain('خرید میوه برای مهمانی');
  expect(html).toContain('کارهای امروز');
});

test('TodayWidget renders empty state message when there are no tasks today', () => {
  const html = renderToStaticMarkup(
    <TodayWidget
      tasks={[]}
      dones={[]}
      todays={[]}
      openTask={() => {}}
      nameOf={new Map()}
    />
  );

  expect(html).toContain('کاری برای امروز ثبت نشده است');
});
