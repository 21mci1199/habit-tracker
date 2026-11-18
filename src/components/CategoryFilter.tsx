type Props = { categories: string[]; value: string | null; onChange: (c: string | null) => void };

export function CategoryFilter({ categories, value, onChange }: Props) {
  if (categories.length < 2) return null;
  return (
    <div className="filter" role="group" aria-label="Filter by category">
      <button className={`chip-btn ${value === null ? 'active' : ''}`} onClick={() => onChange(null)}>
        All
      </button>
      {categories.map((c) => (
        <button key={c} className={`chip-btn ${value === c ? 'active' : ''}`} onClick={() => onChange(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}
