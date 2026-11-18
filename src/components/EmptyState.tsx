export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card empty">
      <div className="empty-icon" aria-hidden>🌱</div>
      <h2>No habits yet</h2>
      <p className="muted">Start small. Add one habit you want to build and check it off each day.</p>
      <button className="btn primary" onClick={onAdd}>+ Add your first habit</button>
    </div>
  );
}
