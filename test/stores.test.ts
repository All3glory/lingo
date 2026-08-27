import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoreProvider } from "../src/mcp/stores.ts";

test("routes to the default store when no project is given", () => {
  const dir = mkdtempSync(join(tmpdir(), "lingo-sp-"));
  const def = join(dir, "root", ".lingo", "lingo.sqlite");
  const sp = new StoreProvider(def, dir);

  sp.get().upsertElement({ area: "A", name: "one" });
  assert.equal(sp.default().listElements().length, 1);
  sp.close();
});

test("a project path routes to <cwd>/<project>/.lingo/lingo.sqlite", () => {
  const dir = mkdtempSync(join(tmpdir(), "lingo-sp-"));
  const sp = new StoreProvider(join(dir, ".lingo", "lingo.sqlite"), dir);

  sp.get("packages/api").upsertElement({ area: "Auth", name: "login" });
  sp.get("packages/web").upsertElement({ area: "Home", name: "Hero" });

  assert.equal(sp.get("packages/api").listElements()[0].name, "login");
  assert.equal(sp.get("packages/web").listElements()[0].name, "Hero");
  assert.equal(sp.default().listElements().length, 0);
  sp.close();
});

test("the same project resolves to one cached store", () => {
  const dir = mkdtempSync(join(tmpdir(), "lingo-sp-"));
  const sp = new StoreProvider(join(dir, ".lingo", "lingo.sqlite"), dir);
  assert.equal(sp.get("sub"), sp.get("./sub"));
  sp.close();
});
