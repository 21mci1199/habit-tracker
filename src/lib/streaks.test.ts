import { describe, expect, it } from 'vitest';
import type { Habit } from '../types';
import { completionRate, currentStreak, longestStreak, weekProgress } from './streaks';

// Wednesday 18 Nov 2026; its week starts Monday 16 Nov.
const TODAY = new Date(2026, 10, 18);

const habit = (targetPerWeek: number, days: string[], createdAt = '2026-01-01'): Habit => ({
  id: 'h',
  name: 'Test',
  color: '#000',
  icon: '✅',
  categoryId: null,
  category: 'Test',
  targetPerWeek,
  createdAt,
  completions: days.map((d) => `2026-11-${d}`),
});

describe('currentStreak (daily)', () => {
  it('counts consecutive days ending today', () => {
    expect(currentStreak(habit(7, ['16', '17', '18']), TODAY)).toEqual({ count: 3, unit: 'days' });
  });
  it('does not reset before today is checked off', () => {
    expect(currentStreak(habit(7, ['16', '17']), TODAY).count).toBe(2);
  });
  it('a gap breaks the streak', () => {
    expect(currentStreak(habit(7, ['14', '16', '17']), TODAY).count).toBe(2);
  });
  it('is 0 when yesterday and today are both missed', () => {
    expect(currentStreak(habit(7, ['15']), TODAY).count).toBe(0);
    expect(currentStreak(habit(7, []), TODAY).count).toBe(0);
  });
});

describe('currentStreak (weekly target)', () => {
  // Weeks: 02-08, 09-15, 16-22 (current)
  it('counts past weeks that met the target; an unfinished current week does not break it', () => {
    const h = habit(3, ['02', '04', '06', '09', '11', '13', '16']);
    expect(currentStreak(h, TODAY)).toEqual({ count: 2, unit: 'weeks' });
  });
  it('includes the current week once the target is met', () => {
    const h = habit(3, ['02', '04', '06', '09', '11', '13', '16', '17', '18']);
    expect(currentStreak(h, TODAY).count).toBe(3);
  });
  it('a missed week breaks the streak', () => {
    expect(currentStreak(habit(3, ['02', '04', '09', '11', '13']), TODAY).count).toBe(1);
    expect(currentStreak(habit(3, ['02', '04', '06', '09']), TODAY).count).toBe(0);
  });
  it('Sunday belongs to the week that started the previous Monday', () => {
    expect(currentStreak(habit(1, ['15']), TODAY).count).toBe(1); // Sun: week of the 9th
    expect(currentStreak(habit(1, ['16']), TODAY).count).toBe(1); // Mon: current week
    expect(currentStreak(habit(1, ['08']), TODAY).count).toBe(0); // week of the 9th missed
  });
});

describe('longestStreak', () => {
  it('finds the best daily run', () => {
    expect(longestStreak(habit(7, ['01', '02', '03', '05', '06']))).toEqual({ count: 3, unit: 'days' });
  });
  it('finds the best weekly run', () => {
    // week of 2nd: 2 done, week of 9th: 2 done, week of 16th: 1 (target missed)
    const h = habit(2, ['02', '03', '09', '10', '16']);
    expect(longestStreak(h)).toEqual({ count: 2, unit: 'weeks' });
  });
  it('is 0 with no completions', () => {
    expect(longestStreak(habit(7, [])).count).toBe(0);
  });
});

describe('weekProgress', () => {
  it('counts completions in the current week only', () => {
    expect(weekProgress(habit(4, ['15', '16', '18']), TODAY)).toEqual({ done: 2, target: 4 });
  });
});

describe('completionRate', () => {
  it('compares completions to the weekly target over the window', () => {
    const days = Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, '0'));
    expect(completionRate(habit(7, days), 30, TODAY)).toBeCloseTo(0.5);
  });
  it('does not penalise days before the habit was created', () => {
    expect(completionRate(habit(7, ['17', '18'], '2026-11-17'), 30, TODAY)).toBe(1);
  });
  it('caps at 100%', () => {
    expect(completionRate(habit(1, ['16', '17', '18'], '2026-11-16'), 30, TODAY)).toBe(1);
  });
});
