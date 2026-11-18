export type Category = {
  id: number;
  name: string;
};

export type Habit = {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  /** Category id in the database, or null when the habit has no category */
  categoryId: number | null;
  /** Display name of the category, filled in by HabitsContext ("Uncategorized" when none) */
  category: string;
  /** 1–7 days per week */
  targetPerWeek: number;
  /** ISO date string (yyyy-MM-dd) */
  createdAt: string;
  /** Unique local dates (yyyy-MM-dd) on which the habit was completed */
  completions: string[];
  archived?: boolean;
};

export type HabitInput = Pick<
  Habit,
  'name' | 'description' | 'color' | 'icon' | 'categoryId' | 'targetPerWeek'
>;

export const UNCATEGORIZED = 'Uncategorized';
