import { useCallback, useState } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { Habit, HabitInput } from './types';
import { HabitsProvider, useHabits } from './state/HabitsContext';
import { HabitForm } from './components/HabitForm';
import { DashboardPage } from './pages/DashboardPage';
import { HabitsPage } from './pages/HabitsPage';
import { CategoriesPage } from './pages/CategoriesPage';

type FormState = { open: false } | { open: true; habit?: Habit };

function Shell() {
  const { addHabit, updateHabit, status, error, reload, dismissError } = useHabits();
  const [form, setForm] = useState<FormState>({ open: false });

  const openAdd = useCallback(() => setForm({ open: true }), []);
  const openEdit = useCallback((habit: Habit) => setForm({ open: true, habit }), []);
  const close = useCallback(() => setForm({ open: false }), []);

  const save = (input: HabitInput) => {
    if (form.open && form.habit) updateHabit(form.habit.id, input);
    else addHabit(input);
    close();
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">🔥 Habits</span>
          <nav>
            <NavLink to="/" end>Dashboard</NavLink>
            <NavLink to="/habits">Today</NavLink>
            <NavLink to="/categories">Categories</NavLink>
          </nav>
        </div>
      </header>
      <main className="container">
        {error && (
          <div className="banner" role="alert">
            <span>
              {status === 'error' ? "Can't reach the database. Is the API server running? " : ''}
              <span className="muted">{error}</span>
            </span>
            <span className="banner-actions">
              <button className="btn small" onClick={reload}>Retry</button>
              {status === 'ready' && (
                <button className="btn small ghost" onClick={dismissError}>Dismiss</button>
              )}
            </span>
          </div>
        )}
        {status === 'loading' && <p className="muted center">Loading habits…</p>}
        {status === 'ready' && (
        <Routes>
          <Route path="/" element={<DashboardPage onAdd={openAdd} />} />
          <Route path="/habits" element={<HabitsPage onAdd={openAdd} onEdit={openEdit} />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        )}
      </main>
      {form.open && (
        <HabitForm
          initial={form.habit}
          onSave={save}
          onCancel={close}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <HabitsProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Shell />
      </HashRouter>
    </HabitsProvider>
  );
}
