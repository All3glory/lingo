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

test("every profile except generic offers a map, map-first", () => {
  for (const id of profileIds()) {
    const p = PROFILES[id];
    if (id === "generic") {
      assert.equal(p.map, undefined);
      continue;
    }
    assert.ok(p.map, `${id}: no map config`);
    assert.equal(p.views[0], "map", `${id}: map should be the default view`);
  }
});

test("kind-based maps cover the whole vocabulary", () => {
  for (const id of profileIds()) {
    const p = PROFILES[id];
    if (!p.map || p.map.by !== "kind") continue;
    const inABand = new Set(p.map.bands.flatMap((b) => b.match));
    for (const kind of p.kinds) {
      if (kind === "other") continue;
      assert.ok(
        inABand.has(kind),
        `${id}: kind "${kind}" is in the vocabulary but no map band`,
      );
    }
    // and no band references a kind that isn't in the vocabulary
    for (const m of inABand) {
      assert.ok(
        p.kinds.includes(m),
        `${id}: map band references unknown kind "${m}"`,
      );
    }
  }
});

test("web's map is a region silhouette", () => {
  assert.equal(PROFILES.web.map?.by, "region");
  assert.equal(PROFILES.web.map?.layout, "silhouette");
  assert.equal(PROFILES.web.map?.bands.length, 4);
});
