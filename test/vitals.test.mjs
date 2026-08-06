import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { makeVitals } from "../src/vitals.js";

const TZ = "Asia/Shanghai";
const fresh = (budget) =>
  makeVitals({ soulDir: mkdtempSync(join(tmpdir(), "vitals-")), timezone: TZ, budget });

test("hunger escalates: fed → peckish at 80% → starving at 100%", () => {
  const v = fresh({ maxWakesPerDay: 10 });
  for (let i = 0; i < 7; i++) v.noteWake();
  assert.equal(v.felt(), "", "fed below 80%");
  v.noteWake();
  assert.match(v.felt(), /饿/, "peckish at 80%");
  assert.equal(v.starving(), false);
  v.noteWake();
  v.noteWake();
  assert.match(v.felt(), /力气用完/, "starving message at 100%");
  assert.equal(v.starving(), true);
});

test("no budget configured → never hungry, never starving", () => {
  const v = fresh(undefined);
  for (let i = 0; i < 500; i++) v.noteWake();
  assert.equal(v.felt(), "");
  assert.equal(v.starving(), false);
});

test("health reports wakes, budget, boredom, and the rut detector", () => {
  const dir = mkdtempSync(join(tmpdir(), "vitals-"));
  // 10 identical openings = the collapse signature (variety 1)
  const rut = Array.from({ length: 10 }, (_, i) => `- 2026/8/6 ${i}:00:00: 故障第十四天，继续等着`).join("\n");
  writeFileSync(join(dir, "DIARY.md"), rut + "\n");
  writeFileSync(join(dir, "MOOD.md"), "# MOOD.md\n\n## 当前心情\n平静地等着\n");
  const v = makeVitals({ soulDir: dir, timezone: TZ, budget: { maxWakesPerDay: 100 } });
  v.noteWake();
  const h = v.health({ boredom: () => 42 });
  assert.equal(h.wakesToday, 1);
  assert.equal(h.budget.maxWakesPerDay, 100);
  assert.equal(h.boredom, 42);
  assert.equal(h.diaryVarietyLast10, 1, "rut detected");
  assert.equal(h.mood, "平静地等着");
});

test("health survives missing inner-state files", () => {
  const v = fresh({ maxWakesPerDay: 10 });
  const h = v.health({ boredom: () => 0 });
  assert.equal(h.diaryToday, 0);
  assert.equal(h.mood, "");
});
