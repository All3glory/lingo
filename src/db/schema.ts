/**
 * Lingo schema. One SQLite file per project.
 *
 * Kept as TS strings (not a .sql file) so esbuild bundles them into every entry
 * point without a copy step.
 *
 * Applied in three steps by `LingoStore.open`: tables, then `migrate()` (which
 * renames the v1–v3 `page` column to `area` and adds later columns), then
 * indexes — the indexes reference `area`, which the migration may still be
 * creating.
 */
export const SCHEMA_TABLES = /* sql */ `
CREATE TABLE IF NOT EXISTS elements (
  id             INTEGER PRIMARY KEY,
  area           TEXT NOT NULL,
  name           TEXT NOT NULL,
  file_path      TEXT,
  description    TEXT,
  previous_names TEXT NOT NULL DEFAULT '[]',
  kind           TEXT,
  region         TEXT,
  code_id        TEXT,
  parent         TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const SCHEMA_INDEXES = /* sql */ `
CREATE UNIQUE INDEX IF NOT EXISTS idx_elements_area_name ON elements (area, name);
CREATE INDEX IF NOT EXISTS idx_elements_area ON elements (area);
`;

/** Columns `migrate()` adds to a pre-existing table if missing. */
export const ADDED_COLUMNS: ReadonlyArray<{ name: string; ddl: string }> = [
  { name: "kind", ddl: "ALTER TABLE elements ADD COLUMN kind TEXT" },
  { name: "region", ddl: "ALTER TABLE elements ADD COLUMN region TEXT" },
  { name: "code_id", ddl: "ALTER TABLE elements ADD COLUMN code_id TEXT" },
  { name: "parent", ddl: "ALTER TABLE elements ADD COLUMN parent TEXT" },
];

/** Bump when the schema changes in a way that needs a migration step. */
export const SCHEMA_VERSION = 4;

/** `meta` key holding the project profile id (see profiles.ts). */
export const META_PROFILE = "profile";
