import { expect, test } from 'vitest';
import { birthdaysWithin, followUpsDue, followUpLabel, recentPeople } from './todayFeed';
import type { Birthday, Interaction, Person } from './db';

test('followUpLabel calculates relative time correctly', () => {
  expect(followUpLabel('2026-10-28', '2026-10-28')).toBe('امروز');
  expect(followUpLabel('2026-10-27', '2026-10-28')).toBe('دیروز');
  expect(followUpLabel('2026-10-25', '2026-10-28')).toBe('۳ روز پیش');
});

test('followUpsDue filters and orders due interactions', () => {
  const list: Interaction[] = [
    { id: '1', personId: 'p1', type: 'call', occurredAt: '2026-10-01', summary: 'Chat', followUpDate: '2026-10-25', updatedAt: 1 },
    { id: '2', personId: 'p2', type: 'call', occurredAt: '2026-10-02', summary: 'Call', followUpDate: '2026-10-29', updatedAt: 2 },
    { id: '3', personId: 'p3', type: 'meeting', occurredAt: '2026-10-03', summary: 'Meet', followUpDate: '2026-10-20', updatedAt: 3 },
    { id: '4', personId: 'p4', type: 'message', occurredAt: '2026-10-04', summary: 'No follow up', updatedAt: 4 },
  ];

  const due = followUpsDue(list, '2026-10-28');
  expect(due.map((x) => x.id)).toEqual(['3', '1']);
});

test('recentPeople excludes self and archived, sorted by newest', () => {
  const people: Person[] = [
    { id: 'p1', displayName: 'Alice', phones: [], emails: [], createdAt: 100, updatedAt: 100 },
    { id: 'p2', displayName: 'Bob', isSelf: 1, phones: [], emails: [], createdAt: 500, updatedAt: 500 },
    { id: 'p3', displayName: 'Charlie', archivedAt: 400, phones: [], emails: [], createdAt: 400, updatedAt: 400 },
    { id: 'p4', displayName: 'David', phones: [], emails: [], createdAt: 300, updatedAt: 300 },
  ];

  const recent = recentPeople(people, 5);
  expect(recent.map((p) => p.displayName)).toEqual(['David', 'Alice']);
});

test('birthdaysWithin finds birthdays within range', () => {
  const bdays: Birthday[] = [
    { id: 'b1', name: 'Sara', cal: 'gregory', month: 10, day: 28, updatedAt: 1 },
    { id: 'b2', name: 'Ali', cal: 'gregory', month: 10, day: 30, updatedAt: 1 },
    { id: 'b3', name: 'Farhad', cal: 'gregory', month: 11, day: 15, updatedAt: 1 },
  ];

  const within = birthdaysWithin(bdays, 7, '2026-10-28', 0);
  expect(within.map((x) => x.b.name)).toEqual(['Sara', 'Ali']);
  expect(within[0].inDays).toBe(0);
  expect(within[1].inDays).toBe(2);
});
