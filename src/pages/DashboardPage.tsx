import { useState, type CSSProperties } from 'react';
import { startOfDay } from 'date-fns';
import { useHabits } from '../state/HabitsContext';
import { toKey } from '../lib/dates';
import { completionRate, currentStreak, formatStreak, longestStreak, weekProgress } from '../lib/streaks';
import { StatTile } from '../components/StatTile';
import { Heatmap } from '../components/Heatmap';
import { CategoryFilter } from '../components/CategoryFilter';
import { EmptyState } from '../components/EmptyState';
import { ProgressBar } from '../components/ProgressBar';

export function DashboardPage({ onAdd }: { onAdd: () => void }) {
  const { habits } = useHabits();
  const [category, setCategory] = useState<string | null>(null);

  const active = habits.filter((h) => !h.archived);
  if (active.length === 0) return <EmptyState onAdd={onAdd} />;

  const today = startOfDay(new Date());
  const tk = toKey(today);
  const categories = [...new Set(active.map((h) => h.category))].sort();
  const visible = category ? active.filter((h) => h.category === category) : active;

  const rows = visible.map((h) => ({
    habit: h,
    current: currentStreak(h, today),
    longest: longestStreak(h),
    week: weekProgress(h, today),
    rate: completionRate(h, 30, today),
    doneToday: h.completions.includes(tk),
  }));

  const doneToday = rows.filter((r) => r.doneToday).length;
  const avgRate = rows.length ? rows.reduce((s, r) => s + r.rate, 0) / rows.length : 0;
  const best = rows.reduce<(typeof rows)[number] | null>(
    (b, r) => (!b || r.current.count > b.current.count ? r : b),
    null,
  );

  return (
    <>
      <section className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">How all your habits are going</p>
        </div>
        <button className="btn primary" onClick={onAdd}>+ New habit</button>
      </section>

      <CategoryFilter categories={categories} value={category} onChange={setCategory} />

      <div className="stats">
        <StatTile label="Done today" value={`${doneToday}/${rows.length}`} hint={<ProgressBar value={rows.length ? doneToday / rows.length : 0} />} />
        <StatTile label="Active habits" value={rows.length} hint={category ?? `${categories.length} ${categories.length === 1 ? 'category' : 'categories'}`} />
        <StatTile
          label="Best current streak"
          value={best && best.current.count > 0 ? `🔥 ${formatStreak(best.current)}` : '—'}
          hint={best && best.current.count > 0 ? `${best.habit.icon} ${best.habit.name}` : 'Check something off!'}
        />
        <StatTile label="30-day completion" value={`${Math.round(avgRate * 100)}%`} hint="Average against targets" />
      </div>

      <section className="card">
        <h2>Habits overview</h2>
        <div className="table-wrap">
          <table className="overview">
            <thead>
              <tr>
                <th>Habit</th>
                <th>Today</th>
                <th>Streak</th>
                <th>Best</th>
                <th>This week</th>
                <th>30 days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ habit: h, current, longest, week, rate, doneToday: d }) => (
                <tr key={h.id} style={{ '--habit': h.color } as CSSProperties}>
                  <td>
                    <span className="row-habit">
                      <span className="dot" aria-hidden>{h.icon}</span>
                      <span>
                        <strong>{h.name}</strong>
                        <span className="muted small"> · {h.category}</span>
                      </span>
                    </span>
                  </td>
                  <td>{d ? <span className="ok">✓</span> : <span className="muted">–</span>}</td>
                  <td className="nowrap">🔥 {formatStreak(current)}</td>
                  <td className="nowrap muted">{formatStreak(longest)}</td>
                  <td className="week-cell">
                    <ProgressBar value={week.done / week.target} color={h.color} />
                    <span className="small muted">{week.done}/{week.target}</span>
                  </td>
                  <td className="nowrap">{Math.round(rate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Activity, last 12 weeks</h2>
        <Heatmap habits={visible} today={today} />
      </section>
    </>
  );
}
