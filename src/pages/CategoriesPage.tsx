import { useState, type FormEvent } from 'react';
import { UNCATEGORIZED, type Category } from '../types';
import { useHabits } from '../state/HabitsContext';

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export function CategoriesPage() {
  const { categories, habits, addCategory } = useHabits();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const counts = new Map<number | null, number>();
  for (const h of habits) counts.set(h.categoryId, (counts.get(h.categoryId) ?? 0) + 1);
  const uncategorized = counts.get(null) ?? 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await addCategory(name);
      setName('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="page-head">
        <div>
          <h1>Categories</h1>
          <p className="muted">Group your habits and filter the dashboard by category</p>
        </div>
      </section>

      <form className="card add-category" onSubmit={submit}>
        <label htmlFor="category-name">New category</label>
        <div className="inline-row">
          <input
            id="category-name"
            maxLength={40}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Health, Work, Family"
            aria-invalid={!!error}
          />
          <button type="submit" className="btn primary" disabled={!name.trim() || saving}>
            {saving ? 'Adding…' : 'Add category'}
          </button>
        </div>
        {error && <span className="field-error" role="alert">{error}</span>}
      </form>

      <section className="card">
        <h2>
          {plural(categories.length, 'category', 'categories')}
        </h2>
        {categories.length === 0 ? (
          <p className="muted">No categories yet. Add one above, or from the habit form.</p>
        ) : (
          <ul className="category-list">
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} count={counts.get(c.id) ?? 0} />
            ))}
          </ul>
        )}
        {uncategorized > 0 && (
          <p className="muted small category-note">
            {plural(uncategorized, 'habit')} {uncategorized === 1 ? 'has' : 'have'} no category ({UNCATEGORIZED}).
          </p>
        )}
      </section>
    </>
  );
}

function CategoryRow({ category, count }: { category: Category; count: number }) {
  const { renameCategory, deleteCategory } = useHabits();
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete'>('view');
  const [value, setValue] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setMode('view');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    if (value.trim() === category.name) return setMode('view');
    void run(() => renameCategory(category.id, value));
  };

  return (
    <li className="category-row">
      {mode === 'edit' ? (
        <form className="inline-row grow" onSubmit={save}>
          <input
            autoFocus
            maxLength={40}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setMode('view');
                setValue(category.name);
                setError(null);
              }
            }}
            aria-label={`New name for ${category.name}`}
            aria-invalid={!!error}
          />
          <button type="submit" className="btn small primary" disabled={!value.trim() || busy}>Save</button>
          <button
            type="button"
            className="btn small ghost"
            onClick={() => {
              setMode('view');
              setValue(category.name);
              setError(null);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <div className="grow">
            <strong>{category.name}</strong>
            <span className="muted small"> · {plural(count, 'habit')}</span>
          </div>
          {mode === 'confirm-delete' ? (
            <div className="row-actions">
              <span className="muted small">
                {count > 0 ? `Delete? ${plural(count, 'habit')} will become uncategorized.` : 'Delete?'}
              </span>
              <button className="btn small danger" disabled={busy} onClick={() => run(() => deleteCategory(category.id))}>
                Delete
              </button>
              <button className="btn small ghost" onClick={() => setMode('view')}>Cancel</button>
            </div>
          ) : (
            <div className="row-actions">
              <button
                className="btn small ghost"
                onClick={() => {
                  setValue(category.name);
                  setMode('edit');
                }}
              >
                Rename
              </button>
              <button className="btn small ghost" onClick={() => setMode('confirm-delete')}>Delete</button>
            </div>
          )}
        </>
      )}
      {error && <span className="field-error full" role="alert">{error}</span>}
    </li>
  );
}
