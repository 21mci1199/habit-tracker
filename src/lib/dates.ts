import { addDays, format, parseISO, startOfWeek } from 'date-fns';

export const toKey = (d: Date): string => format(d, 'yyyy-MM-dd');
export const todayKey = (): string => toKey(new Date());
/** Parses a yyyy-MM-dd key as local midnight. */
export const fromKey = (key: string): Date => parseISO(key);
export const weekStart = (d: Date): Date => startOfWeek(d, { weekStartsOn: 1 });
export const weekDays = (d: Date): Date[] =>
  Array.from({ length: 7 }, (_, i) => addDays(weekStart(d), i));
