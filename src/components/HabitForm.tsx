import { useEffect, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Habit, HabitInput } from '../types';
import { useHabits } from '../state/HabitsContext';

export const COLORS = ['#4f46e5', '#0891b2', '#059669', '#65a30d', '#d97706', '#dc2626', '#db2777', '#7c3aed'];
export const ICONS = ['💧', '🏃', '📚', '🧘', '🥗', '💤', '✍️', '🎸', '💻', '🧹', '💊', '🌱', '🚭', '🙏', '💰', '🎯'];

type Props = {
  initial?: Habit;
  onSave: (input: HabitInput) => void;
  onCancel: () => void;
};

export function HabitForm({ initial, onSave, onCancel }: Props) {
  const { categories, addCategory } = useHabits();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [icon, setIcon] = useState(initial?.icon ?? ICONS[0]);
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [targetPerWeek, setTarget] = useState(initial?.targetPerWeek ?? 7);

  // Inline "new category" field
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  const createCategory = async () => {
    if (!newCategory.trim() || savingCategory) return;
    setSavingCategory(true);
    setCategoryError(null);
    try {
      const created = await addCategory(newCategory);
      setCategoryId(created.id);
      setNewCategory('');
      setAddingCategory(false);
    } catch (e) {
      setCategoryError((e as Error).message);
    } finally {
      setSavingCategory(false);
    }
  };

  const onNewCategoryKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // don't submit the habit form
      void createCategory();
    } else if (e.key === 'Escape') {
      e.stopPropagation(); // close only the inline field, not the whole form
      setAddingCategory(false);
      setCategoryError(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      icon,
      categoryId,
      targetPerWeek,
    });
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="modal" onSubmit={submit} aria-label={initial ? 'Edit habit' : 'New habit'}>
        <h2>{initial ? 'Edit habit' : 'New habit'}</h2>

        <label className="field">
          <span>Name</span>
          <input
            autoFocus
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Drink 2L of water"
          />
        </label>

        <label className="field">
          <span>Description <em>(optional)</em></span>
          <textarea
            rows={2}
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Why does this matter to you?"
          />
        </label>

        <div className="field">
          <label htmlFor={addingCategory ? 'new-category' : 'habit-category'}>Category</label>
          {addingCategory ? (
            <div className="inline-row">
              <input
                id="new-category"
                autoFocus
                maxLength={40}
                value={newCategory}
                onChange={(e) => {
                  setNewCategory(e.target.value);
                  setCategoryError(null);
                }}
                onKeyDown={onNewCategoryKey}
                placeholder="New category name"
                aria-invalid={!!categoryError}
              />
              <button
                type="button"
                className="btn small primary"
                onClick={createCategory}
                disabled={!newCategory.trim() || savingCategory}
              >
                {savingCategory ? 'Adding…' : 'Add'}
              </button>
              <button
                type="button"
                className="btn small ghost"
                onClick={() => {
                  setAddingCategory(false);
                  setCategoryError(null);
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="inline-row">
              <select
                id="habit-category"
                value={categoryId ?? ''}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn small ghost" onClick={() => setAddingCategory(true)}>
                + New
              </button>
            </div>
          )}
          {categoryError && <span className="field-error" role="alert">{categoryError}</span>}
        </div>

        <fieldset className="field">
          <legend>Icon</legend>
          <div className="picker">
            {ICONS.map((i) => (
              <button
                type="button"
                key={i}
                className={`icon-option ${i === icon ? 'selected' : ''}`}
                onClick={() => setIcon(i)}
                aria-pressed={i === icon}
              >
                {i}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Color</legend>
          <div className="picker">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`swatch ${c === color ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                aria-pressed={c === color}
              />
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>
            Target: <strong>{targetPerWeek === 7 ? 'every day' : `${targetPerWeek} ${targetPerWeek === 1 ? 'day' : 'days'} per week`}</strong>
          </span>
          <input
            type="range"
            min={1}
            max={7}
            value={targetPerWeek}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            {initial ? 'Save changes' : 'Add habit'}
          </button>
        </div>
      </form>
    </div>
  );
}
