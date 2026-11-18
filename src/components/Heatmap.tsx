import { addDays, format, isAfter, subWeeks } from 'date-fns';
import type { Habit } from '../types';
import { toKey, weekStart } from '../lib/dates';

const WEEKS = 12;
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

/** Share of habits completed on each day over the last 12 weeks. */
export function Heatmap({ habits, today }: { habits: Habit[]; today: Date }) {
  const start = subWeeks(weekStart(today), WEEKS - 1);
  const sets = habits.map((h) => new Set(h.completions));

  const columns = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      const key = toKey(date);
      const count = sets.reduce((n, s) => n + (s.has(key) ? 1 : 0), 0);
      const ratio = habits.length ? count / habits.length : 0;
      return { date, key, count, ratio, future: isAfter(date, today) };
    }),
  );

  const level = (r: number) => (r === 0 ? 0 : r < 0.34 ? 1 : r < 0.67 ? 2 : r < 1 ? 3 : 4);

  return (
    <div className="heatmap-wrap">
      <div className="heatmap">
        <div className="heatmap-labels">
          {DAY_LABELS.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
        {columns.map((col, i) => (
          <div className="heatmap-col" key={i}>
            {col.map((c) => (
              <span
                key={c.key}
                className={`cell ${c.future ? 'future' : `l${level(c.ratio)}`}`}
                title={c.future ? '' : `${format(c.date, 'EEE d MMM')}: ${c.count}/${habits.length} done`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap-legend muted">
        Less <span className="cell l0" /><span className="cell l1" /><span className="cell l2" />
        <span className="cell l3" /><span className="cell l4" /> More
      </div>
    </div>
  );
}
