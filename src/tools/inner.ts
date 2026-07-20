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

  return { tools, names };
}
