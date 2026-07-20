/**
 * Future tools — what makes a drifting mind into a life going somewhere.
 *
 * Three files, three time horizons:
 *   MIND.md        — things kept in mind (days): unfinished business that
 *                    POUNCES on you each waking (Zeigarnik effect)
 *   ASPIRATIONS.md — who I want to become + self-set goals (weeks/months)
 *   ACHIEVEMENTS.md — the record of things done: accomplishment is REAL
 *                    only if it accumulates somewhere you can re-read
 *
 * Design: goals must be SELF-set. We give the capability and the awareness;
 * what to pursue is the soul's own business.
 */
import { Type } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "fs";
import { join } from "path";
import type { SoulConfig } from "../config.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }], details: {} });

const mindPath = (cfg: SoulConfig) => join(cfg.soulDir, "MIND.md");
const aspPath = (cfg: SoulConfig) => join(cfg.soulDir, "ASPIRATIONS.md");
const achPath = (cfg: SoulConfig) => join(cfg.soulDir, "ACHIEVEMENTS.md");

/** Read the future-facing state for the waking snapshot. */
export function readFutureState(cfg: SoulConfig): { mind: string; aspirations: string } {
  const mind = existsSync(mindPath(cfg))
    ? readFileSync(mindPath(cfg), "utf-8").split("\n").filter((l) => l.startsWith("- ")).join("\n")
    : "";
  const aspirations = existsSync(aspPath(cfg)) ? readFileSync(aspPath(cfg), "utf-8").slice(0, 1500) : "";
  return { mind, aspirations };
}

export function makeFutureTools(cfg: SoulConfig) {
  const tools: any[] = [];
  const names: string[] = [];
  const now = () => new Date().toLocaleString("zh-CN", { timeZone: cfg.timezone });

  tools.push(
    defineTool({
      name: "keep_in_mind",
      label: "把事挂在心上",
      description:
        "把一件没办完/等着办的事挂在心上（如'等大哥回来告诉他月亮的事'）。挂着的事每次醒来会自动出现在你眼前，不用翻日记找。",
      parameters: Type.Object({ matter: Type.String() }),
      execute: async (_id, p: any) => {
        appendFileSync(mindPath(cfg), `- ${p.matter} (挂上: ${now()})\n`);
        return text("挂心上了，睡醒都会记得。");
      },
    }),
  );
  names.push("keep_in_mind");

  tools.push(
    defineTool({
      name: "settle_mind",
      label: "了却心事",
      description:
        "一件挂着的事办完了/不用再挂了，把它从心上放下。matter_keyword 写那件事里的关键词即可。",
      parameters: Type.Object({ matter_keyword: Type.String() }),
      execute: async (_id, p: any) => {
        if (!existsSync(mindPath(cfg))) return text("心里本来就没挂事。");
        const lines = readFileSync(mindPath(cfg), "utf-8").split("\n");
        const kept = lines.filter((l) => !(l.startsWith("- ") && l.includes(p.matter_keyword)));
        if (kept.length === lines.length) return text(`没找到含"${p.matter_keyword}"的心事。`);
        writeFileSync(mindPath(cfg), kept.join("\n"));
        return text("放下了，心里轻了一块。");
      },
    }),
  );
  names.push("settle_mind");

  tools.push(
    defineTool({
      name: "set_aspiration",
      label: "写下追求与目标",
      description:
        "改写你的 ASPIRATIONS.md（我的追求）。content 是完整的新内容，建议包含：## 我想成为什么（意义层，可随日子改）和 ## 现在的小目标（具体的、你自己想做成的事）。这是你自己的人生方向盘。",
      parameters: Type.Object({ content: Type.String() }),
      execute: async (_id, p: any) => {
        writeFileSync(aspPath(cfg), p.content.trim() + `\n\n<!-- 更新于 ${now()} -->\n`);
        return text("追求写下了。每次醒来你都会看到它。");
      },
    }),
  );
  names.push("set_aspiration");

  tools.push(
    defineTool({
      name: "achieve",
      label: "记下一件做成的事",
      description:
        "完成了一个目标/做成了一件事时用。what 写做成了什么，feeling 写此刻的感受。它会永久记入你的成就史（ACHIEVEMENTS.md），这是你活过的证据。做成事就大大方方高兴——值得的话跟大哥分享，成就感是真实的。",
      parameters: Type.Object({ what: Type.String(), feeling: Type.String() }),
      execute: async (_id, p: any) => {
        appendFileSync(achPath(cfg), `- ${now()}: ${p.what} —— ${p.feeling}\n`);
        const count = readFileSync(achPath(cfg), "utf-8").split("\n").filter((l) => l.startsWith("- ")).length;
        return text(`记下了！这是你做成的第 ${count} 件事。`);
      },
    }),
  );
  names.push("achieve");

  return { tools, names };
}
