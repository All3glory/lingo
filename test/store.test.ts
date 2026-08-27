import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { LingoStore } from "../src/db/store.ts";

test("creates, then updates in place on re-log", () => {
  const store = LingoStore.open(":memory:");
  const first = store.upsertElement({
    area: "Home",
    name: "PrimaryNav",
    file: "src/components/Nav.tsx",
    description: "Top navigation bar",
  });
  assert.equal(first.action, "created");

  const second = store.upsertElement({
    area: "Home",
    name: "PrimaryNav",
    description: "Top navigation bar with a search box",
  });
  assert.equal(second.action, "updated");
  assert.equal(second.element.id, first.element.id);
  assert.equal(second.element.filePath, "src/components/Nav.tsx");
  assert.equal(store.listElements().length, 1);
  store.close();
});

test("rename moves the old name into previousNames", () => {
  const store = LingoStore.open(":memory:");
  store.upsertElement({ area: "Pricing", name: "PriceGrid" });
  const renamed = store.upsertElement({
    area: "Pricing",
    name: "PlanComparison",
    previousName: "PriceGrid",
  });
  assert.equal(renamed.action, "renamed");
  assert.deepEqual(renamed.element.previousNames, ["PriceGrid"]);
  assert.equal(store.getElement("Pricing", "PriceGrid"), null);
  assert.ok(store.getElement("Pricing", "PlanComparison"));
  store.close();
});

test("blank area or name is rejected", () => {
  const store = LingoStore.open(":memory:");
  assert.throws(() => store.upsertElement({ area: "  ", name: "X" }));
  store.close();
});

test("kind/parent/codeId round-trip and survive a later re-log", () => {
  const store = LingoStore.open(":memory:");
  const created = store.upsertElement({
    area: "Auth",
    name: "loginHandler",
    kind: "handler",
    parent: "AuthController",
    codeId: "handlers/login.ts#login",
  });
  assert.equal(created.element.kind, "handler");
  assert.equal(created.element.parent, "AuthController");
  assert.equal(created.element.codeId, "handlers/login.ts#login");

  const relogged = store.upsertElement({
    area: "Auth",
    name: "loginHandler",
    description: "POST /auth/login",
  });
  assert.equal(relogged.element.kind, "handler");
  assert.equal(relogged.element.parent, "AuthController");
  store.close();
});

test("profile is stored and read back", () => {
  const store = LingoStore.open(":memory:");
  assert.equal(store.getProfile(), null);
  store.setProfile("backend");
  assert.equal(store.getProfile(), "backend");
  store.close();
});

test("migrate rewrites the retired `service` profile to `backend`", () => {
  const dir = process.env.TMPDIR || process.env.TEMP || ".";
  const path = `${dir}/lingo-profile-migrate-${Date.now()}.sqlite`;
  const first = LingoStore.open(path);
  first.setMeta("profile", "service");
  first.close();

  const reopened = LingoStore.open(path);
  assert.equal(reopened.getProfile(), "backend");
  reopened.close();
});

test("migrates a v3 database: page -> area, adds parent", () => {
  const dir = process.env.TMPDIR || process.env.TEMP || ".";
  const path = `${dir}/lingo-migrate-${Date.now()}.sqlite`;
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE elements (
      id INTEGER PRIMARY KEY, page TEXT NOT NULL, name TEXT NOT NULL,
      file_path TEXT, description TEXT,
      previous_names TEXT NOT NULL DEFAULT '[]',
      kind TEXT, region TEXT, code_id TEXT,
      created_at TEXT DEFAULT 'x', updated_at TEXT DEFAULT 'x'
    );
    CREATE UNIQUE INDEX idx_elements_page_name ON elements (page, name);
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  db.prepare("INSERT INTO elements (page, name, kind) VALUES (?, ?, ?)").run(
    "Home",
    "OldNav",
    "nav",
  );
  db.close();

  const store = LingoStore.open(path);
  const rows = store.listElements();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].area, "Home");
  assert.equal(rows[0].name, "OldNav");
  assert.equal(rows[0].parent, null);
  // new writes work against the migrated schema
  const child = store.upsertElement({
    area: "Home",
    name: "SearchBox",
    parent: "OldNav",
  });
  assert.equal(child.element.parent, "OldNav");
  store.close();
});
