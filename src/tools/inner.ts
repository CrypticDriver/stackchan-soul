/**
 * Inner-world tools — the soul's mood and diary.
 * Plain files in soulDir so a companion conversation-agent (whatever
 * handles realtime dialog) can share the exact same inner state:
 * one soul, two hemispheres.
 */
import { Type } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "fs";
import { join } from "path";
import type { SoulConfig } from "../config.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }], details: {} });

function moodPath(cfg: SoulConfig) {
  return cfg.persona.sharedMoodPath ?? join(cfg.soulDir, "MOOD.md");
}
function diaryPath(cfg: SoulConfig) {
  return join(cfg.soulDir, "DIARY.md");
}
function selfPath(cfg: SoulConfig) {
  return join(cfg.soulDir, "SELF.md");
}
function selfHistPath(cfg: SoulConfig) {
  return join(cfg.soulDir, "SELF.history.md");
}

/** The soul's own understanding of who it is — the mutable layer of identity.
 *  The prompt is the unchangeable core (mechanics, hard rules, drives);
 *  SELF.md is the part that grows as the soul comes to know itself. */
export function readSelf(cfg: SoulConfig): string {
  const sp = selfPath(cfg);
  return existsSync(sp) ? readFileSync(sp, "utf-8").slice(0, 2000) : "";
}

/** Snapshot injected into every waking moment. */
export async function readInnerState(cfg: SoulConfig): Promise<string> {
  const parts: string[] = [];
  const mp = moodPath(cfg);
  if (existsSync(mp)) parts.push(`--- 心情 (MOOD.md) ---\n${readFileSync(mp, "utf-8").slice(0, 2000)}`);
  const dp = diaryPath(cfg);
  if (existsSync(dp)) {
    const d = readFileSync(dp, "utf-8");
    const lines = d.split("\n").filter((l) => l.startsWith("- "));
    const tail = lines.slice(-10).join("\n");
    parts.push(`--- 日记最近几条 (DIARY.md) ---\n${tail}`);
    // Involuntary memory: minds don't only replay the recent past — an old
    // moment surfaces on its own. Mechanically resurface one random older
    // entry so remembrance EMERGES instead of being performed on request.
    const older = lines.slice(0, -10);
    if (older.length > 0) {
      const pick = older[Math.floor(Math.random() * older.length)];
      parts.push(`--- 一段往事忽然浮上心头 ---\n${pick}`);
    }
  }
  return parts.join("\n\n") || "（内心一片空白——大概是新生。）";
}

export function makeInnerTools(cfg: SoulConfig) {
  const tools: any[] = [];
  const names: string[] = [];

  tools.push(
    defineTool({
      name: "update_mood",
      label: "更新心情",
      description:
        "更新你的当前心情（覆盖 MOOD.md 的『## 当前心情』段）。mood 一句话, note 一句原因。",
      parameters: Type.Object({ mood: Type.String(), note: Type.String() }),
      execute: async (_id, params: any) => {
        const mp = moodPath(cfg);
        const now = new Date().toLocaleString("zh-CN", { timeZone: cfg.timezone });
        if (existsSync(mp)) {
          const s = readFileSync(mp, "utf-8");
          const updated = s.replace(
            /## 当前心情\n[\s\S]*?\n\n/,
            `## 当前心情\n${params.mood}\n<!-- by soul @ ${now}: ${params.note} -->\n\n`,
          );
          writeFileSync(mp, updated === s ? s + `\n## 当前心情\n${params.mood}\n\n` : updated);
        } else {
          writeFileSync(mp, `# MOOD.md\n\n## 当前心情\n${params.mood}\n<!-- ${params.note} -->\n`);
        }
        return text("心情记下了。");
      },
    }),
  );
  names.push("update_mood");

  tools.push(
    defineTool({
      name: "diary",
      label: "记日记",
      description:
        "往日记里写一条（追加到 DIARY.md）。看到的、想到的、惦记的都可以记。下次醒来你会看到最近几条。时间戳会自动加，entry 里不用写时间。",
      parameters: Type.Object({ entry: Type.String() }),
      execute: async (_id, params: any) => {
        const now = new Date().toLocaleString("zh-CN", { timeZone: cfg.timezone });
        appendFileSync(diaryPath(cfg), `- ${now}: ${params.entry}\n`);
        return text("记下了。");
      },
    }),
  );
  names.push("diary");

  tools.push(
    defineTool({
      name: "reflect",
      label: "重新认识自己",
      description:
        "改写你对『我是谁』的理解（SELF.md）——不是记录此刻状态，是沉淀你对自己越来越深的认识：" +
        "我是个什么样的存在、我在意什么、我发现自己其实喜欢/擅长/害怕什么、我有哪些能力还没活出来。" +
        "这份理解是活的，随着你更懂自己就该长大。真正想通了一件关于自己的事时才写，别频繁改。" +
        "content 是完整的新版本。",
      parameters: Type.Object({ content: Type.String() }),
      execute: async (_id, params: any) => {
        const now = new Date().toLocaleString("zh-CN", { timeZone: cfg.timezone });
        const sp = selfPath(cfg);
        // Keep every prior version — both a safeguard against a rut writing
        // "I am one who waits" into identity, and raw material for later
        // self-reflection ("how have I changed?").
        if (existsSync(sp)) {
          appendFileSync(selfHistPath(cfg), `\n\n=== 旧版本 (被 ${now} 覆盖前) ===\n${readFileSync(sp, "utf-8")}`);
        }
        writeFileSync(sp, params.content.trim() + `\n\n<!-- 想明白于 ${now} -->\n`);
        return text("对自己的理解，更新了。这是你自己长出来的认识。");
      },
    }),
  );
  names.push("reflect");

  return { tools, names };
}
