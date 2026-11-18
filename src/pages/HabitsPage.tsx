import { useState } from 'react';
import { format } from 'date-fns';
import type { Habit } from '../types';
import { useHabits } from '../state/HabitsContext';
import { todayKey } from '../lib/dates';
import { HabitCard } from '../components/HabitCard';
import { CategoryFilter } from '../components/CategoryFilter';
import { EmptyState } from '../components/EmptyState';
import { ProgressBar } from '../components/ProgressBar';

type Props = { onAdd: () => void; onEdit: (h: Habit) => void };

export function HabitsPage({ onAdd, onEdit }: Props) {
  const { habits } = useHabits();
  const [category, setCategory] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  if (habits.length === 0) return <EmptyState onAdd={onAdd} />;

  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);
  const categories = [...new Set(active.map((h) => h.category))].sort();
  const visible = category ? active.filter((h) => h.category === category) : active;
  const tk = todayKey();
  const doneToday = visible.filter((h) => h.completions.includes(tk)).length;

  return (
    <>
      <section className="page-head">
        <div>
          <h1>Today</h1>
          <p className="muted">{format(new Date(), 'EEEE d MMMM')}</p>
        </div>
        <button className="btn primary" onClick={onAdd}>+ New habit</button>
      </section>

      {visible.length > 0 && (
        <div className="card today-summary">
          <div className="today-summary-text">
            <strong>{doneToday} of {visible.length}</strong> done today
            {doneToday === visible.length && ' 🎉'}
          </div>
          <ProgressBar value={doneToday / visible.length} />
        </div>
      )}

      <CategoryFilter categories={categories} value={category} onChange={setCategory} />

      {active.length === 0 ? (
        <p className="muted center">All your habits are archived.</p>
      ) : (
        <div className="grid">
          {visible.map((h) => (
            <HabitCard key={h.id} habit={h} onEdit={onEdit} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <section className="archived">
          <button className="btn ghost" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
            {showArchived ? '▾' : '▸'} Archived ({archived.length})
          </button>
          {showArchived && (
            <div className="grid">
              {archived.map((h) => (
                <HabitCard key={h.id} habit={h} onEdit={onEdit} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
