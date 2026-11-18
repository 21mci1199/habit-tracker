import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { UNCATEGORIZED, type Category, type Habit, type HabitInput } from '../types';
import { api } from '../lib/api';
import { clearLegacyHabits, loadLegacyHabits } from '../lib/storage';
import { todayKey } from '../lib/dates';

type Action =
  | { type: 'set'; habits: Habit[] }
  | { type: 'add'; habit: Habit }
  | { type: 'update'; id: string; changes: Partial<Habit> }
  | { type: 'delete'; id: string }
  | { type: 'toggle'; id: string; date: string }
  | { type: 'clearCategory'; categoryId: number };

function reducer(state: Habit[], action: Action): Habit[] {
  switch (action.type) {
    case 'set':
      return action.habits;
    case 'add':
      return [...state, action.habit];
    case 'update':
      return state.map((h) => (h.id === action.id ? { ...h, ...action.changes } : h));
    case 'delete':
      return state.filter((h) => h.id !== action.id);
    case 'toggle':
      return state.map((h) => {
        if (h.id !== action.id) return h;
        const has = h.completions.includes(action.date);
        return {
          ...h,
          completions: has
            ? h.completions.filter((d) => d !== action.date)
            : [...h.completions, action.date].sort(),
        };
      });
    case 'clearCategory':
      return state.map((h) => (h.categoryId === action.categoryId ? { ...h, categoryId: null } : h));
  }
}

const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

export type LoadStatus = 'loading' | 'ready' | 'error';

type HabitsApi = {
  habits: Habit[];
  categories: Category[];
  status: LoadStatus;
  error: string | null;
  reload: () => void;
  dismissError: () => void;
  addHabit: (input: HabitInput) => void;
  updateHabit: (id: string, input: HabitInput) => void;
  deleteHabit: (id: string) => void;
  setArchived: (id: string, archived: boolean) => void;
  toggleCompletion: (id: string, date: string) => void;
  /** These wait for the server and throw its message (e.g. duplicate name) so forms can show it. */
  addCategory: (name: string) => Promise<Category>;
  renameCategory: (id: number, name: string) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
};

const HabitsContext = createContext<HabitsApi | null>(null);

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

let legacyImport: Promise<void> | null = null;

/** Sends habits left in browser storage to the database once, then clears them. */
function importLegacy(): Promise<void> {
  legacyImport ??= (async () => {
    const legacy = loadLegacyHabits();
    if (!legacy.length) return;
    await api.import(legacy);
    clearLegacyHabits();
  })().catch((e) => {
    legacyImport = null; // allow a retry
    throw e;
  });
  return legacyImport;
}

/** Loads habits and categories, importing any habits left in browser storage on first run. */
async function fetchAll(): Promise<[Habit[], Category[]]> {
  await importLegacy();
  return Promise.all([api.list(), api.listCategories()]);
}

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [rawHabits, dispatch] = useReducer(reducer, []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const habitsRef = useRef(rawHabits);
  habitsRef.current = rawHabits;

  const reload = useCallback(() => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    fetchAll()
      .then(([list, cats]) => {
        dispatch({ type: 'set', habits: list });
        setCategories([...cats].sort(byName));
        setStatus('ready');
        setError(null);
      })
      .catch((e: Error) => {
        setStatus((s) => (s === 'ready' ? s : 'error'));
        setError(e.message);
      });
  }, []);

  useEffect(reload, [reload]);

  /** Every habit carries its category's current display name, so renames show up everywhere. */
  const habits = useMemo(() => {
    const names = new Map(categories.map((c) => [c.id, c.name]));
    return rawHabits.map((h) => ({
      ...h,
      category: (h.categoryId != null && names.get(h.categoryId)) || UNCATEGORIZED,
    }));
  }, [rawHabits, categories]);

  /** Applies a change locally right away, then saves it; on failure, shows the error and reloads. */
  const persist = useCallback(
    (action: Action, save: () => Promise<unknown>) => {
      dispatch(action);
      save().catch((e: Error) => {
        setError(`Not saved: ${e.message}`);
        reload();
      });
    },
    [reload],
  );

  const value = useMemo<HabitsApi>(
    () => ({
      habits,
      categories,
      status,
      error,
      reload,
      dismissError: () => setError(null),
      addHabit: (input) => {
        const habit: Habit = {
          ...input,
          category: '',
          id: newId(),
          createdAt: todayKey(),
          completions: [],
          archived: false,
        };
        persist({ type: 'add', habit }, () => api.create(habit));
      },
      updateHabit: (id, input) => persist({ type: 'update', id, changes: input }, () => api.update(id, input)),
      deleteHabit: (id) => persist({ type: 'delete', id }, () => api.remove(id)),
      setArchived: (id, archived) =>
        persist({ type: 'update', id, changes: { archived } }, () => api.setArchived(id, archived)),
      toggleCompletion: (id, date) => {
        const done = !habitsRef.current.find((h) => h.id === id)?.completions.includes(date);
        persist({ type: 'toggle', id, date }, () => api.setCompletion(id, date, done));
      },
      addCategory: async (name) => {
        const created = await api.createCategory(name);
        setCategories((cs) => [...cs, created].sort(byName));
        return created;
      },
      renameCategory: async (id, name) => {
        const renamed = await api.renameCategory(id, name);
        setCategories((cs) => cs.map((c) => (c.id === id ? renamed : c)).sort(byName));
      },
      deleteCategory: async (id) => {
        await api.deleteCategory(id);
        setCategories((cs) => cs.filter((c) => c.id !== id));
        dispatch({ type: 'clearCategory', categoryId: id });
      },
    }),
    [habits, categories, status, error, reload, persist],
  );

  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
}

export function useHabits(): HabitsApi {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error('useHabits must be used inside <HabitsProvider>');
  return ctx;
}
