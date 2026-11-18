import type { Category, Habit, HabitInput } from '../types';

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `${method} ${url} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const habitUrl = (id: string) => `/api/habits/${encodeURIComponent(id)}`;

export const api = {
  list: () => request<Habit[]>('GET', '/api/habits'),
  create: (habit: Habit) => request('POST', '/api/habits', habit),
  update: (id: string, input: HabitInput) => request('PUT', habitUrl(id), input),
  setArchived: (id: string, archived: boolean) => request('PATCH', `${habitUrl(id)}/archived`, { archived }),
  remove: (id: string) => request('DELETE', habitUrl(id)),
  setCompletion: (id: string, date: string, done: boolean) =>
    request(done ? 'PUT' : 'DELETE', `${habitUrl(id)}/completions/${date}`),
  import: (habits: Habit[]) => request<{ imported: number }>('POST', '/api/import', { habits }),

  listCategories: () => request<Category[]>('GET', '/api/categories'),
  createCategory: (name: string) => request<Category>('POST', '/api/categories', { name }),
  renameCategory: (id: number, name: string) => request<Category>('PUT', `/api/categories/${id}`, { name }),
  deleteCategory: (id: number) => request('DELETE', `/api/categories/${id}`),
};
