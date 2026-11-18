import sql from 'mssql/msnodesqlv8.js';

export const config = {
  server: process.env.DB_SERVER ?? '(localdb)\\MSSQLLocalDB',
  database: process.env.DB_NAME ?? 'HabitTracker',
  driver: process.env.DB_DRIVER ?? 'ODBC Driver 17 for SQL Server',
};

if (!/^\w+$/.test(config.database)) throw new Error(`Invalid DB_NAME: ${config.database}`);

const connectionString = (database) =>
  `Driver={${config.driver}};Server=${config.server};Database=${database};Trusted_Connection=yes;`;

const SCHEMA = `
IF OBJECT_ID(N'dbo.Categories', N'U') IS NULL
CREATE TABLE dbo.Categories (
  Id        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Categories PRIMARY KEY,
  Name      NVARCHAR(40)      NOT NULL CONSTRAINT UQ_Categories_Name UNIQUE,
  CreatedAt DATETIME2(0)      NOT NULL CONSTRAINT DF_Categories_CreatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.Habits', N'U') IS NULL
CREATE TABLE dbo.Habits (
  Id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Habits PRIMARY KEY,
  Name          NVARCHAR(60)     NOT NULL,
  Description   NVARCHAR(200)    NULL,
  Color         VARCHAR(9)       NOT NULL,
  Icon          NVARCHAR(16)     NOT NULL,
  CategoryId    INT              NULL
                CONSTRAINT FK_Habits_Categories REFERENCES dbo.Categories(Id) ON DELETE SET NULL,
  TargetPerWeek TINYINT          NOT NULL CONSTRAINT CK_Habits_Target CHECK (TargetPerWeek BETWEEN 1 AND 7),
  CreatedAt     DATE             NOT NULL,
  Archived      BIT              NOT NULL CONSTRAINT DF_Habits_Archived DEFAULT 0
);

-- Migration from the first schema, where the category was free text in Habits.Category
IF COL_LENGTH(N'dbo.Habits', N'CategoryId') IS NULL
  ALTER TABLE dbo.Habits ADD CategoryId INT NULL
    CONSTRAINT FK_Habits_Categories REFERENCES dbo.Categories(Id) ON DELETE SET NULL;

IF COL_LENGTH(N'dbo.Habits', N'Category') IS NOT NULL
  EXEC(N'
    BEGIN TRANSACTION;
    INSERT INTO dbo.Categories (Name)
      SELECT DISTINCT LTRIM(RTRIM(h.Category)) FROM dbo.Habits h
      WHERE LTRIM(RTRIM(h.Category)) <> N''''
        AND NOT EXISTS (SELECT 1 FROM dbo.Categories c WHERE c.Name = LTRIM(RTRIM(h.Category)));
    UPDATE h SET CategoryId = c.Id
      FROM dbo.Habits h JOIN dbo.Categories c ON c.Name = LTRIM(RTRIM(h.Category))
      WHERE h.CategoryId IS NULL;
    ALTER TABLE dbo.Habits DROP COLUMN Category;
    COMMIT;');

IF OBJECT_ID(N'dbo.Completions', N'U') IS NULL
CREATE TABLE dbo.Completions (
  HabitId     UNIQUEIDENTIFIER NOT NULL
              CONSTRAINT FK_Completions_Habits REFERENCES dbo.Habits(Id) ON DELETE CASCADE,
  CompletedOn DATE             NOT NULL,
  CONSTRAINT PK_Completions PRIMARY KEY (HabitId, CompletedOn)
);
`;

let pool;

/** Creates the database and tables if needed, then returns a shared pool. */
export async function getPool() {
  if (pool) return pool;

  const master = await new sql.ConnectionPool({ connectionString: connectionString('master') }).connect();
  try {
    await master.request().query(`IF DB_ID(N'${config.database}') IS NULL CREATE DATABASE [${config.database}]`);
  } finally {
    await master.close();
  }

  pool = await new sql.ConnectionPool({ connectionString: connectionString(config.database) }).connect();
  await pool.request().batch(SCHEMA);
  return pool;
}

export { sql };
