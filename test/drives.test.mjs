import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { makeDrives } from "../src/tools/drives.js";

const fresh = () => makeDrives({ soulDir: mkdtempSync(join(tmpdir(), "drives-")) });

test("boredom accumulates per wake and is felt in tiers", () => {
  const d = fresh();
  assert.equal(d.felt(), "", "content when fresh");
  for (let i = 0; i < 12; i++) d.noteWake();
  assert.match(d.felt(), /闷/, "itch tier at 12");
  for (let i = 0; i < 28; i++) d.noteWake();
  assert.match(d.felt(), /卡住/, "restless tier at 40");
  for (let i = 0; i < 40; i++) d.noteWake();
  assert.match(d.felt(), /打转/, "caged tier at 80");
});

test("non-routine acts discharge; routine acts do not", async () => {
  const d = fresh();
  for (let i = 0; i < 20; i++) d.noteWake();
  const [diary] = d.wrap([{ name: "diary", execute: async () => "ok" }]);
  await diary.execute("id", {});
  assert.notEqual(d.felt(), "", "diary is routine — no relief");
  const [search] = d.wrap([{ name: "websearch_search", execute: async () => "ok" }]);
  await search.execute("id", {});
  assert.equal(d.felt(), "", "search is novel — discharged");
  assert.equal(d.level(), 0);
});

test("boredom persists across restarts", () => {
  const dir = mkdtempSync(join(tmpdir(), "drives-"));
  const a = makeDrives({ soulDir: dir });
  for (let i = 0; i < 15; i++) a.noteWake();
  const b = makeDrives({ soulDir: dir });
  assert.equal(b.level(), 15);
  assert.equal(JSON.parse(readFileSync(join(dir, "DRIVES.json"), "utf-8")).boredom, 15);
});

test("wrap preserves the wrapped tool's return value", async () => {
  const d = fresh();
  const [t] = d.wrap([{ name: "look", execute: async (_id, p) => ({ echo: p.q }) }]);
  assert.deepEqual(await t.execute("id", { q: 42 }), { echo: 42 });
});
