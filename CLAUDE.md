# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start API (:3001) + Vite dev server (:5173) concurrently
npm test          # Run unit tests (Vitest, no watch)
npm run build     # Type-check (tsc --noEmit) then Vite production build
npm run server    # API only, with --watch (auto-restarts on file change)
npm run web       # Vite only
```

Run a single test file:
```bash
npx vitest run src/lib/streaks.test.ts
```

## Architecture

**Two-process app.** `npm run dev` launches both together via `concurrently`:

- **API** (`server/`): Node.js + Express, SQL Server via `mssql/msnodesqlv8` (Windows authentication, no password). `server/db.js` owns the connection pool, creates the database and tables on first start, and runs the schema migration (free-text `Category` column → `Categories` table). `server/index.js` defines all routes.
- **Frontend** (`src/`): React 18 + TypeScript, bundled by Vite. During dev, Vite proxies `/api/*` to `http://localhost:3001` (see `vite.config.ts`). Uses `HashRouter`, so all navigation is client-side with no server routing needed.

**State management** is a single React context (`src/state/HabitsContext.tsx`). It holds the full habit and category lists, fetched once on mount. All mutations use an **optimistic update** pattern: the local state is dispatched immediately via `useReducer`, then the API call fires. On failure the error is shown and the state is reloaded from the server. Category mutations (`addCategory`, `renameCategory`, `deleteCategory`) are async and throw so forms can display server-side validation errors (e.g. duplicate name).

**Data flow on startup:** `HabitsContext` calls `fetchAll()`, which first runs a one-shot legacy import (`POST /api/import`) if `localStorage` contains habits from the old browser-only version (`habit-tracker:v1`), then fetches habits and categories in parallel.

**Domain types** (`src/types.ts`):
- `Habit.id` is a client-generated UUID (uuid v4 via `crypto.randomUUID`).
- `Habit.categoryId` is the DB integer FK; `Habit.category` is the display name, denormalized into the habit by `HabitsContext` from the categories list.
- `HabitInput` is the user-editable subset of `Habit` (omits `id`, `createdAt`, `completions`, `archived`).

**Streak/stats logic** (`src/lib/streaks.ts`) is pure functions over `Habit`. Daily habits (`targetPerWeek === 7`) streak by consecutive days. All others streak by consecutive weeks meeting the target. Week boundaries are Monday-based (`src/lib/dates.ts`). These functions are the only unit-tested code.

**API conventions** (`server/index.js`):
- All routes use the `wrap()` helper for async error propagation.
- SQL inputs are always parameterized; habit ids are UUIDs, category ids are integers.
- Duplicate name on categories → 409. FK violations on habit writes → 400. All 500s log to console and return a generic message.
- `DELETE /api/categories/:id` uses `ON DELETE SET NULL`, so deleting a category never deletes its habits.

## Database

Configured via `.env` (copy `.env.example`). Defaults to `(localdb)\MSSQLLocalDB` with no `.env`.

The schema lives entirely in `server/db.js` as inline SQL run at startup — there are no migration files.
