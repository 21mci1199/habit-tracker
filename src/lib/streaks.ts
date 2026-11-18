import { addDays, differenceInCalendarDays, max as maxDate, subDays, subWeeks } from 'date-fns';
import type { Habit } from '../types';
import { fromKey, toKey, weekStart } from './dates';

export type Streak = { count: number; unit: 'days' | 'weeks' };

const isDaily = (h: Habit) => h.targetPerWeek >= 7;

function countInWeek(set: Set<string>, start: Date): number {
  let n = 0;
  for (let i = 0; i < 7; i++) if (set.has(toKey(addDays(start, i)))) n++;
  return n;
}

/**
 * Daily habits (7/7): consecutive completed days ending today
 * (or yesterday, if today is not checked off yet).
 * Other habits: consecutive weeks meeting the target. The current week
 * counts once its target is met; an unfinished week never breaks the streak.
 */
export function currentStreak(h: Habit, today: Date = new Date()): Streak {
  const set = new Set(h.completions);
  if (isDaily(h)) {
    let d = set.has(toKey(today)) ? today : subDays(today, 1);
    let count = 0;
    while (set.has(toKey(d))) {
      count++;
      d = subDays(d, 1);
    }
    return { count, unit: 'days' };
  }
  let ws = weekStart(today);
  let count = countInWeek(set, ws) >= h.targetPerWeek ? 1 : 0;
  ws = subWeeks(ws, 1);
  while (countInWeek(set, ws) >= h.targetPerWeek) {
    count++;
    ws = subWeeks(ws, 1);
  }
  return { count, unit: 'weeks' };
}

/** Longest run ever, using the same rules as currentStreak. */
export function longestStreak(h: Habit): Streak {
  const daily = isDaily(h);
  let points: Date[];
  if (daily) {
    points = [...new Set(h.completions)].sort().map(fromKey);
  } else {
    const perWeek = new Map<string, number>();
    for (const k of new Set(h.completions)) {
      const wk = toKey(weekStart(fromKey(k)));
      perWeek.set(wk, (perWeek.get(wk) ?? 0) + 1);
    }
    points = [...perWeek]
      .filter(([, n]) => n >= h.targetPerWeek)
      .map(([wk]) => wk)
      .sort()
      .map(fromKey);
  }
  const step = daily ? 1 : 7;
  let best = 0;
  let run = 0;
  points.forEach((p, i) => {
    run = i > 0 && differenceInCalendarDays(p, points[i - 1]) === step ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return { count: best, unit: daily ? 'days' : 'weeks' };
}

export function weekProgress(h: Habit, today: Date = new Date()) {
  const done = countInWeek(new Set(h.completions), weekStart(today));
  return { done, target: h.targetPerWeek };
}

/**
 * Completions over the last `days` days relative to what the weekly target
 * expects (0 to 1). The window never starts before the habit existed.
 */
export function completionRate(h: Habit, days = 30, today: Date = new Date()): number {
  const earliest = [fromKey(h.createdAt), ...h.completions.map(fromKey)].reduce((a, b) =>
    a < b ? a : b,
  );
  const start = maxDate([subDays(today, days - 1), earliest]);
  const windowDays = differenceInCalendarDays(today, start) + 1;
  if (windowDays <= 0) return 0;
  const startKey = toKey(start);
  const endKey = toKey(today);
  const done = new Set(h.completions.filter((k) => k >= startKey && k <= endKey)).size;
  const expected = (h.targetPerWeek / 7) * windowDays;
  return Math.min(1, done / expected);
}

export function formatStreak({ count, unit }: Streak): string {
  const word = unit === 'days' ? 'day' : 'week';
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
