import type { Habit } from '../types';

/** Key used when habits were stored in the browser, before the SQL Server database. */
const LEGACY_KEY = 'habit-tracker:v1';

export function loadLegacyHabits(): Habit[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data?.habits) ? (data.habits as Habit[]) : [];
  } catch {
    return [];
  }
}

export function clearLegacyHabits(): void {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}
