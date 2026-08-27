import test from "node:test";
import assert from "node:assert/strict";
import { PROFILES, getProfile, profileIds } from "../src/profiles.ts";

test("all expected profiles exist", () => {
  for (const id of [
    "web",
    "backend",
    "library",
    "cli",
    "data",
    "mobile",
    "desktop",
    "game",
    "infra",
    "generic",
  ]) {
    assert.ok(PROFILES[id], `missing profile: ${id}`);
    assert.equal(PROFILES[id].id, id);
  }
});

test("the retired `service` id resolves to backend", () => {
  assert.equal(getProfile("service").id, "backend");
});

test("unknown / empty ids fall back to web", () => {
  assert.equal(getProfile(null).id, "web");
  assert.equal(getProfile(undefined).id, "web");
  assert.equal(getProfile("nonsense").id, "web");
});

test("every profile has content the generators depend on", () => {
  for (const id of profileIds()) {
    const p = PROFILES[id];
    assert.ok(p.records.length > 10, `${id}: records too short`);
    assert.ok(p.remember.length >= 2, `${id}: needs remember items`);
    assert.ok(p.areaExamples.length > 0, `${id}: areaExamples`);
    assert.ok(p.views.length >= 1, `${id}: views`);
    for (const r of p.remember) {
      assert.equal(typeof r, "string");
      assert.ok(r.length > 0);
    }
  }
});

test("web offers the map view; others default to tree", () => {
  assert.ok(PROFILES.web.views.includes("map"));
  assert.equal(PROFILES.backend.views[0], "tree");
});
