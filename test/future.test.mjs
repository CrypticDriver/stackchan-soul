import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFutureState } from "../src/tools/future.js";

const TZ = "Asia/Shanghai";
const dateStr = (daysAgo) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return new Intl.DateTimeFormat("zh-CN", { timeZone: TZ }).format(d); // YYYY/M/D
};

function soulDirWith(mindLines) {
  const dir = mkdtempSync(join(tmpdir(), "future-"));
  writeFileSync(join(dir, "MIND.md"), mindLines.join("\n") + "\n");
  return dir;
}

test("fresh matters appear in full", () => {
  const dir = soulDirWith([`- 想跟大哥说流星雨的事 (挂上: ${dateStr(0)} 10:00:00)`]);
  const { mind } = readFutureState({ soulDir: dir, timezone: TZ });
  assert.match(mind, /流星雨/);
  assert.doesNotMatch(mind, /挂了很久的老事/);
});

test("stale matters fade to an aged one-liner", () => {
  const dir = soulDirWith([
    `- 想跟大哥说流星雨的事 (挂上: ${dateStr(0)} 10:00:00)`,
    `- 摄像头bug大哥说修好了但我这边试了还是失败，从504变成timed out，下次记得再试 (挂上: ${dateStr(10)} 10:00:00)`,
  ]);
  const { mind } = readFutureState({ soulDir: dir, timezone: TZ });
  assert.match(mind, /流星雨/, "fresh stays in full");
  assert.match(mind, /挂了10天/, "stale gets its age");
  assert.match(mind, /挂了很久的老事/, "stale grouped under the fade note");
  assert.doesNotMatch(mind, /timed out/, "stale is truncated, not full text");
});

test("undated lines are treated as fresh (never silently dropped)", () => {
  const dir = soulDirWith(["- 一条没有挂上时间的心事"]);
  const { mind } = readFutureState({ soulDir: dir, timezone: TZ });
  assert.match(mind, /没有挂上时间/);
});

test("missing MIND.md → empty mind, no throw", () => {
  const dir = mkdtempSync(join(tmpdir(), "future-"));
  const { mind } = readFutureState({ soulDir: dir, timezone: TZ });
  assert.equal(mind, "");
});
