import { useState, type CSSProperties } from 'react';
import { format, isAfter, startOfDay } from 'date-fns';
import type { Habit } from '../types';
import { toKey, weekDays } from '../lib/dates';
import { currentStreak, formatStreak, weekProgress } from '../lib/streaks';
import { useHabits } from '../state/HabitsContext';
import { ProgressBar } from './ProgressBar';

type Props = { habit: Habit; onEdit: (h: Habit) => void };

export function HabitCard({ habit, onEdit }: Props) {
  const { toggleCompletion, setArchived, deleteHabit } = useHabits();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const today = startOfDay(new Date());
  const todayK = toKey(today);
  const done = new Set(habit.completions);
  const doneToday = done.has(todayK);
  const streak = currentStreak(habit, today);
  const week = weekProgress(habit, today);

  return (
    <article className={`card habit-card ${doneToday ? 'done' : ''}`} style={{ '--habit': habit.color } as CSSProperties}>
      <div className="habit-head">
        <span className="habit-icon" aria-hidden>{habit.icon}</span>
        <div className="habit-title">
          <h3>{habit.name}</h3>
          <div className="meta">
            <span className="chip">{habit.category}</span>
            <span>{habit.targetPerWeek === 7 ? 'Daily' : `${habit.targetPerWeek}×/week`}</span>
          </div>
        </div>
        <button
          className="check"
          onClick={() => toggleCompletion(habit.id, todayK)}
          aria-pressed={doneToday}
          aria-label={doneToday ? `Mark ${habit.name} as not done today` : `Mark ${habit.name} as done today`}
        >
          {doneToday ? '✓' : ''}
        </button>
      </div>

      {habit.description && <p className="desc">{habit.description}</p>}

      <div className="week-row" aria-label="This week">
        {weekDays(today).map((d) => {
          const k = toKey(d);
          const future = isAfter(d, today);
          return (
            <button
              key={k}
              className={`day ${done.has(k) ? 'on' : ''} ${k === todayK ? 'today' : ''}`}
              disabled={future}
              onClick={() => toggleCompletion(habit.id, k)}
              title={format(d, 'EEEE d MMM')}
              aria-label={`${format(d, 'EEEE')}: ${done.has(k) ? 'done' : 'not done'}`}
            >
              {format(d, 'EEEEE')}
            </button>
          );
        })}
      </div>

      <div className="habit-stats">
        <span className={`streak ${streak.count ? '' : 'zero'}`}>🔥 {formatStreak(streak)}</span>
        <span className="muted">
          {week.done}/{week.target} this week
        </span>
      </div>
      <ProgressBar value={week.done / week.target} color={habit.color} />

      <div className="card-actions">
        {confirmDelete ? (
          <>
            <span className="muted">Delete for good?</span>
            <button className="btn small danger" onClick={() => deleteHabit(habit.id)}>Delete</button>
            <button className="btn small ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </>
        ) : (
          <>
            <button className="btn small ghost" onClick={() => onEdit(habit)}>Edit</button>
            <button className="btn small ghost" onClick={() => setArchived(habit.id, !habit.archived)}>
              {habit.archived ? 'Restore' : 'Archive'}
            </button>
            <button className="btn small ghost" onClick={() => setConfirmDelete(true)}>Delete</button>
          </>
        )}
      </div>
    </article>
  );
}
