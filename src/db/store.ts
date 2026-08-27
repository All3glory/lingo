import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { LingoElement, LogElementInput } from "../types.ts";
import {
  ADDED_COLUMNS,
  META_PROFILE,
  SCHEMA_INDEXES,
  SCHEMA_TABLES,
  SCHEMA_VERSION,
} from "./schema.ts";

interface ElementRow {
  id: number;
  area: string;
  name: string;
  file_path: string | null;
  description: string | null;
  previous_names: string;
  kind: string | null;
  region: string | null;
  code_id: string | null;
  parent: string | null;
  created_at: string;
  updated_at: string;
}

function rowToElement(row: ElementRow): LingoElement {
  let previousNames: string[] = [];
  try {
    const parsed = JSON.parse(row.previous_names);
    if (Array.isArray(parsed)) {
      previousNames = parsed.filter((v): v is string => typeof v === "string");
    }
  } catch {
    // Tolerate a legacy delimited string; fall back to empty history.
  }
  return {
    id: row.id,
    area: row.area,
    name: row.name,
    filePath: row.file_path,
    description: row.description,
    previousNames,
    kind: row.kind ?? null,
    region: row.region ?? null,
    codeId: row.code_id ?? null,
    parent: row.parent ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export interface UpsertResult {
  element: LingoElement;
  action: "created" | "updated" | "renamed";
}

/**
 * Owns all reads and writes to a Lingo SQLite file.
 *
 * Runs only under a real `node` process (the bundled MCP server or the db-cli
 * reader) — never in the VS Code extension host, which has no `node:sqlite`.
 */
export class LingoStore {
  private readonly db: DatabaseSync;

  private constructor(db: DatabaseSync) {
    this.db = db;
  }

  static open(dbPath: string): LingoStore {
    if (dbPath !== ":memory:") {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
    const db = new DatabaseSync(dbPath);
    // Deliberately NOT WAL: with WAL, commits land in a `-wal` sidecar and the
    // main file's mtime doesn't move until a checkpoint, so the extension's
    // file watcher never sees the change.
    db.exec("PRAGMA journal_mode = DELETE;");
    db.exec("PRAGMA busy_timeout = 4000;");
    db.exec("PRAGMA foreign_keys = ON;");

    // Tables first, then structural migration of an older DB, then indexes —
    // the indexes reference `area`, which `migrate()` may still be renaming.
    db.exec(SCHEMA_TABLES);
    migrate(db);
    db.exec(SCHEMA_INDEXES);

    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('schema_version', ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run(String(SCHEMA_VERSION));
    return new LingoStore(db);
  }

  close(): void {
    this.db.close();
  }

  /**
   * Record an element. Idempotent on (area, name). If `previousName` is given
   * and matches an existing row, that row is renamed in place and its old name
   * is appended to `previous_names`.
   */
  upsertElement(input: LogElementInput): UpsertResult {
    const area = input.area.trim();
    const name = input.name.trim();
    if (!area || !name) {
      throw new Error("`area` and `name` are required and cannot be blank.");
    }
    const file = input.file?.trim() || null;
    const description = input.description?.trim() || null;
    const kind = input.kind?.trim() || null;
    const region = input.region?.trim() || null;
    const codeId = input.codeId?.trim() || null;
    const parent = input.parent?.trim() || null;
    const previousName = input.previousName?.trim() || null;

    const findByName = this.db.prepare(
      "SELECT * FROM elements WHERE area = ? AND name = ?",
    );

    const current = findByName.get(area, name) as ElementRow | undefined;
    if (current) {
      this.db
        .prepare(
          `UPDATE elements SET
             file_path = COALESCE(?, file_path),
             description = COALESCE(?, description),
             kind = COALESCE(?, kind),
             region = COALESCE(?, region),
             code_id = COALESCE(?, code_id),
             parent = COALESCE(?, parent),
             updated_at = ${NOW}
           WHERE id = ?`,
        )
        .run(file, description, kind, region, codeId, parent, current.id);
      return { element: this.requireById(current.id), action: "updated" };
    }

    if (previousName && previousName !== name) {
      const prior = findByName.get(area, previousName) as ElementRow | undefined;
      if (prior) {
        const history = safeParseArray(prior.previous_names);
        history.push(previousName);
        this.db
          .prepare(
            `UPDATE elements SET
               name = ?,
               file_path = COALESCE(?, file_path),
               description = COALESCE(?, description),
               kind = COALESCE(?, kind),
               region = COALESCE(?, region),
               code_id = COALESCE(?, code_id),
               parent = COALESCE(?, parent),
               previous_names = ?,
               updated_at = ${NOW}
             WHERE id = ?`,
          )
          .run(
            name,
            file,
            description,
            kind,
            region,
            codeId,
            parent,
            JSON.stringify(history),
            prior.id,
          );
        return { element: this.requireById(prior.id), action: "renamed" };
      }
    }

    const initialHistory = previousName ? [previousName] : [];
    const inserted = this.db
      .prepare(
        `INSERT INTO elements
           (area, name, file_path, description, kind, region, code_id, parent,
            previous_names)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        area,
        name,
        file,
        description,
        kind,
        region,
        codeId,
        parent,
        JSON.stringify(initialHistory),
      );
    return {
      element: this.requireById(Number(inserted.lastInsertRowid)),
      action: "created",
    };
  }

  getElement(area: string, name: string): LingoElement | null {
    const row = this.db
      .prepare("SELECT * FROM elements WHERE area = ? AND name = ?")
      .get(area.trim(), name.trim()) as ElementRow | undefined;
    return row ? rowToElement(row) : null;
  }

  listElements(areaFilter?: string): LingoElement[] {
    const rows = areaFilter
      ? (this.db
          .prepare(
            "SELECT * FROM elements WHERE area = ? ORDER BY name COLLATE NOCASE",
          )
          .all(areaFilter.trim()) as unknown as ElementRow[])
      : (this.db
          .prepare(
            "SELECT * FROM elements ORDER BY area COLLATE NOCASE, name COLLATE NOCASE",
          )
          .all() as unknown as ElementRow[]);
    return rows.map(rowToElement);
  }

  listAreas(): string[] {
    const rows = this.db
      .prepare(
        "SELECT DISTINCT area FROM elements ORDER BY area COLLATE NOCASE",
      )
      .all() as unknown as { area: string }[];
    return rows.map((r) => r.area);
  }

  getMeta(key: string): string | null {
    const row = this.db
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO meta (key, value) VALUES (?, ?) " +
          "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value);
  }

  getProfile(): string | null {
    return this.getMeta(META_PROFILE);
  }

  setProfile(id: string): void {
    this.setMeta(META_PROFILE, id);
  }

  private requireById(id: number): LingoElement {
    const row = this.db
      .prepare("SELECT * FROM elements WHERE id = ?")
      .get(id) as ElementRow | undefined;
    if (!row) {
      throw new Error(`Element ${id} vanished after write.`);
    }
    return rowToElement(row);
  }
}

/** Bring an older database forward: rename `page` -> `area`, add new columns. */
function migrate(db: DatabaseSync): void {
  const cols = () =>
    new Set(
      (
        db.prepare("PRAGMA table_info(elements)").all() as unknown as {
          name: string;
        }[]
      ).map((c) => c.name),
    );

  let names = cols();
  if (names.has("page") && !names.has("area")) {
    db.exec("DROP INDEX IF EXISTS idx_elements_page_name");
    db.exec("DROP INDEX IF EXISTS idx_elements_page");
    db.exec("ALTER TABLE elements RENAME COLUMN page TO area");
    names = cols();
  }
  for (const col of ADDED_COLUMNS) {
    if (!names.has(col.name)) {
      db.exec(col.ddl);
    }
  }
}

function safeParseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}
