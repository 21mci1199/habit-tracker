import express from 'express';
import { config, getPool, sql } from './db.js';

const PORT = Number(process.env.PORT ?? 3001);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SQL_DUPLICATE_KEY = [2601, 2627];
const SQL_FK_VIOLATION = 547;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const sqlErrorNumber = (e) => e?.number ?? e?.originalError?.info?.number ?? e?.originalError?.number;

function checkId(id) {
  if (!UUID_RE.test(id)) throw new HttpError(400, 'Invalid habit id');
  return id;
}

function checkCategoryId(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Invalid category id');
  return n;
}

function checkDate(d) {
  if (typeof d !== 'string' || !DATE_RE.test(d) || Number.isNaN(Date.parse(d))) {
    throw new HttpError(400, 'Invalid date, expected yyyy-MM-dd');
  }
  return d;
}

function checkCategoryName(v) {
  const name = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (!name) throw new HttpError(400, 'Category name is required');
  if (name.length > 40) throw new HttpError(400, 'Category name must be 40 characters or fewer');
  return name;
}

/** Validates the editable fields of a habit. */
function checkInput(b) {
  const str = (v, max, field, required = true) => {
    if (v == null || v === '') {
      if (required) throw new HttpError(400, `${field} is required`);
      return null;
    }
    if (typeof v !== 'string' || v.trim().length > max) throw new HttpError(400, `${field} is invalid`);
    return v.trim();
  };
  const target = Number(b?.targetPerWeek);
  if (!Number.isInteger(target) || target < 1 || target > 7) {
    throw new HttpError(400, 'targetPerWeek must be 1-7');
  }
  return {
    name: str(b.name, 60, 'name'),
    description: str(b.description, 200, 'description', false),
    color: str(b.color, 9, 'color'),
    icon: str(b.icon, 16, 'icon'),
    categoryId: b.categoryId == null ? null : checkCategoryId(b.categoryId),
    targetPerWeek: target,
  };
}

const bindInput = (req, h) =>
  req
    .input('name', sql.NVarChar(60), h.name)
    .input('description', sql.NVarChar(200), h.description)
    .input('color', sql.VarChar(9), h.color)
    .input('icon', sql.NVarChar(16), h.icon)
    .input('categoryId', sql.Int, h.categoryId)
    .input('target', sql.TinyInt, h.targetPerWeek);

/** Turns SQL constraint errors on habit writes into readable 400s. */
function habitWriteError(e) {
  if (sqlErrorNumber(e) === SQL_FK_VIOLATION) return new HttpError(400, 'That category no longer exists');
  return e;
}

async function insertHabit(tx, h) {
  await bindInput(new sql.Request(tx), h)
    .input('id', sql.UniqueIdentifier, h.id)
    .input('createdAt', sql.VarChar(10), h.createdAt)
    .input('archived', sql.Bit, h.archived ? 1 : 0)
    .query(`INSERT INTO dbo.Habits (Id, Name, Description, Color, Icon, CategoryId, TargetPerWeek, CreatedAt, Archived)
            VALUES (@id, @name, @description, @color, @icon, @categoryId, @target, CAST(@createdAt AS DATE), @archived)`);
  for (const d of new Set(h.completions ?? [])) {
    await new sql.Request(tx)
      .input('id', sql.UniqueIdentifier, h.id)
      .input('d', sql.VarChar(10), checkDate(d))
      .query('INSERT INTO dbo.Completions (HabitId, CompletedOn) VALUES (@id, CAST(@d AS DATE))');
  }
}

/** Returns the id of the category with this name, creating it if needed (used by the import). */
async function categoryIdForName(tx, rawName) {
  if (typeof rawName !== 'string' || !rawName.trim()) return null;
  const name = checkCategoryName(rawName);
  const r = await new sql.Request(tx)
    .input('name', sql.NVarChar(40), name)
    .query(`IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Name = @name)
              INSERT INTO dbo.Categories (Name) VALUES (@name);
            SELECT Id FROM dbo.Categories WHERE Name = @name;`);
  return r.recordset[0].Id;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', wrap(async (_req, res) => {
  await (await getPool()).request().query('SELECT 1');
  res.json({ ok: true, server: config.server, database: config.database });
}));

/* ---------- Categories ---------- */

app.get('/api/categories', wrap(async (_req, res) => {
  const r = await (await getPool()).request().query(`
    SELECT c.Id AS id, c.Name AS name, COUNT(h.Id) AS habitCount
    FROM dbo.Categories c LEFT JOIN dbo.Habits h ON h.CategoryId = c.Id
    GROUP BY c.Id, c.Name ORDER BY c.Name`);
  res.json(r.recordset);
}));

app.post('/api/categories', wrap(async (req, res) => {
  const name = checkCategoryName(req.body?.name);
  try {
    const r = await (await getPool()).request()
      .input('name', sql.NVarChar(40), name)
      .query('INSERT INTO dbo.Categories (Name) OUTPUT INSERTED.Id AS id, INSERTED.Name AS name VALUES (@name)');
    res.status(201).json(r.recordset[0]);
  } catch (e) {
    if (SQL_DUPLICATE_KEY.includes(sqlErrorNumber(e))) throw new HttpError(409, `A category named "${name}" already exists`);
    throw e;
  }
}));

app.put('/api/categories/:id', wrap(async (req, res) => {
  const name = checkCategoryName(req.body?.name);
  try {
    const r = await (await getPool()).request()
      .input('id', sql.Int, checkCategoryId(req.params.id))
      .input('name', sql.NVarChar(40), name)
      .query('UPDATE dbo.Categories SET Name = @name WHERE Id = @id');
    if (!r.rowsAffected[0]) throw new HttpError(404, 'Category not found');
    res.json({ id: Number(req.params.id), name });
  } catch (e) {
    if (SQL_DUPLICATE_KEY.includes(sqlErrorNumber(e))) throw new HttpError(409, `A category named "${name}" already exists`);
    throw e;
  }
}));

/** Deleting a category keeps its habits; they become uncategorized (ON DELETE SET NULL). */
app.delete('/api/categories/:id', wrap(async (req, res) => {
  await (await getPool()).request()
    .input('id', sql.Int, checkCategoryId(req.params.id))
    .query('DELETE FROM dbo.Categories WHERE Id = @id');
  res.json({ ok: true });
}));

/* ---------- Habits ---------- */

app.get('/api/habits', wrap(async (_req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT LOWER(CONVERT(char(36), Id)) AS id, Name AS name, Description AS description, Color AS color,
           Icon AS icon, CategoryId AS categoryId, TargetPerWeek AS targetPerWeek,
           CONVERT(char(10), CreatedAt, 23) AS createdAt, Archived AS archived
    FROM dbo.Habits ORDER BY CreatedAt, Name;
    SELECT LOWER(CONVERT(char(36), HabitId)) AS habitId, CONVERT(char(10), CompletedOn, 23) AS d
    FROM dbo.Completions ORDER BY CompletedOn;`);
  const [habits, completions] = result.recordsets;
  const byHabit = new Map(habits.map((h) => [h.id, []]));
  for (const c of completions) byHabit.get(c.habitId)?.push(c.d);
  res.json(
    habits.map((h) => ({
      ...h,
      description: h.description ?? undefined,
      archived: Boolean(h.archived),
      completions: byHabit.get(h.id),
    })),
  );
}));

app.post('/api/habits', wrap(async (req, res) => {
  const h = { ...checkInput(req.body), id: checkId(req.body.id), createdAt: checkDate(req.body.createdAt) };
  const tx = new sql.Transaction(await getPool());
  await tx.begin();
  try {
    await insertHabit(tx, h);
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw habitWriteError(e);
  }
  res.status(201).json({ ok: true });
}));

app.put('/api/habits/:id', wrap(async (req, res) => {
  const h = checkInput(req.body);
  let r;
  try {
    r = await bindInput((await getPool()).request(), h)
      .input('id', sql.UniqueIdentifier, checkId(req.params.id))
      .query(`UPDATE dbo.Habits SET Name=@name, Description=@description, Color=@color, Icon=@icon,
              CategoryId=@categoryId, TargetPerWeek=@target WHERE Id=@id`);
  } catch (e) {
    throw habitWriteError(e);
  }
  if (!r.rowsAffected[0]) throw new HttpError(404, 'Habit not found');
  res.json({ ok: true });
}));

app.patch('/api/habits/:id/archived', wrap(async (req, res) => {
  const r = await (await getPool()).request()
    .input('id', sql.UniqueIdentifier, checkId(req.params.id))
    .input('archived', sql.Bit, req.body?.archived ? 1 : 0)
    .query('UPDATE dbo.Habits SET Archived=@archived WHERE Id=@id');
  if (!r.rowsAffected[0]) throw new HttpError(404, 'Habit not found');
  res.json({ ok: true });
}));

app.delete('/api/habits/:id', wrap(async (req, res) => {
  await (await getPool()).request()
    .input('id', sql.UniqueIdentifier, checkId(req.params.id))
    .query('DELETE FROM dbo.Habits WHERE Id=@id');
  res.json({ ok: true });
}));

app.put('/api/habits/:id/completions/:date', wrap(async (req, res) => {
  const r = await (await getPool()).request()
    .input('id', sql.UniqueIdentifier, checkId(req.params.id))
    .input('d', sql.VarChar(10), checkDate(req.params.date))
    .query(`IF NOT EXISTS (SELECT 1 FROM dbo.Habits WHERE Id=@id) SELECT 0 AS found
            ELSE BEGIN
              IF NOT EXISTS (SELECT 1 FROM dbo.Completions WHERE HabitId=@id AND CompletedOn=CAST(@d AS DATE))
                INSERT INTO dbo.Completions (HabitId, CompletedOn) VALUES (@id, CAST(@d AS DATE));
              SELECT 1 AS found
            END`);
  if (!r.recordset[0].found) throw new HttpError(404, 'Habit not found');
  res.json({ ok: true });
}));

app.delete('/api/habits/:id/completions/:date', wrap(async (req, res) => {
  await (await getPool()).request()
    .input('id', sql.UniqueIdentifier, checkId(req.params.id))
    .input('d', sql.VarChar(10), checkDate(req.params.date))
    .query('DELETE FROM dbo.Completions WHERE HabitId=@id AND CompletedOn=CAST(@d AS DATE)');
  res.json({ ok: true });
}));

/**
 * One-time import of habits that were stored in the browser. Existing ids are skipped.
 * Accepts the old shape ({ category: "Health" }) and creates missing categories by name.
 */
app.post('/api/import', wrap(async (req, res) => {
  const list = Array.isArray(req.body?.habits) ? req.body.habits : [];
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  let imported = 0;
  try {
    for (const b of list) {
      const categoryId = b.categoryId != null ? checkCategoryId(b.categoryId) : await categoryIdForName(tx, b.category);
      const h = {
        ...checkInput({ ...b, categoryId }),
        id: checkId(b.id),
        createdAt: checkDate(b.createdAt),
        archived: Boolean(b.archived),
        completions: Array.isArray(b.completions) ? b.completions : [],
      };
      const exists = await new sql.Request(tx)
        .input('id', sql.UniqueIdentifier, h.id)
        .query('SELECT 1 AS x FROM dbo.Habits WHERE Id=@id');
      if (exists.recordset.length) continue;
      await insertHabit(tx, h);
      imported++;
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw habitWriteError(e);
  }
  res.json({ imported });
}));

app.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Database error' : err.message });
});

getPool()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API on http://localhost:${PORT}  (SQL Server ${config.server}, database ${config.database})`);
    });
  })
  .catch((e) => {
    console.error('Could not connect to SQL Server:', e.message);
    process.exit(1);
  });
