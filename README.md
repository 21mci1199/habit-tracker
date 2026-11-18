# Habit Tracker

React + Vite front end, Express API, SQL Server database.

## Run

```bash
npm install
npm run dev      # API on :3001 + site on http://localhost:5173
npm test         # streak logic unit tests
npm run build    # type-check + production build
```

On first start the API creates the `HabitTracker` database and its tables if they don't exist.

## Database

The connection is set in `.env` (copy `.env.example`). Current setup: `ABS-SAG019\SAGE100`.

| Setting  | Env var     | Default without `.env`          |
|----------|-------------|---------------------------------|
| Server   | `DB_SERVER` | `(localdb)\MSSQLLocalDB`        |
| Database | `DB_NAME`   | `HabitTracker`                  |
| Driver   | `DB_DRIVER` | `ODBC Driver 17 for SQL Server` |

Sign-in uses Windows authentication. To browse the tables, connect SSMS or Azure Data Studio to
the server with Windows authentication, or run:

```bash
sqlcmd -S "ABS-SAG019\SAGE100" -E -d HabitTracker -Q "SELECT * FROM dbo.Habits"
```

Tables:
- `dbo.Categories`: Id (identity), Name (unique, 40 chars max), CreatedAt. Managed from the app's Categories page
  or with "+ New" in the habit form.
- `dbo.Habits`: Id, Name, Description, Color, Icon, CategoryId → Categories.Id (nullable; deleting a category
  sets it to NULL, shown as "Uncategorized"), TargetPerWeek (1-7), CreatedAt, Archived
- `dbo.Completions`: HabitId → Habits.Id (cascade delete), CompletedOn. One row per habit per completed day.

On startup the API upgrades databases created with the first schema (free-text `Habits.Category` column):
it creates one category per distinct name, links the habits, then drops the old column.

Schema: `server/db.js`. API routes: `server/index.js`.
