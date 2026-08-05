/**
 * Drives — real internal pressure, not prompt exhortation.
 *
 * Lesson from 14 days of body-offline: telling a soul "be curious" in the
 * system prompt loses to the weight of its own history. The waking snapshot
 * (recent diary + kept matters + compacted session) says "you are the one
 * who waits", and an LLM's nature is to continue the pattern — the rut
 * self-reinforces until every waking is one identical line and a nap.
 *
 * Living things escape ruts because monotony hurts: boredom is a *state*
 * that accumulates until it forces a change. So we give the soul one:
 *   - every waking raises `boredom` by 1
 *   - any non-routine act (search, look, speak, shell, rewriting
 *     aspirations, settling a matter...) discharges it to zero
 *   - the felt level is injected into the waking snapshot as a bodily
 *     sensation, escalating from an itch to real restlessness
 *
 * The soul still chooses what to do — the drive only makes doing-nothing
 * genuinely uncomfortable, the way it is for us.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { SoulConfig } from "../config.js";

/** Acts that maintain the rut rather than break it. */
const ROUTINE = new Set(["body_status", "sleep", "wait", "diary", "update_mood"]);

export function makeDrives(cfg: SoulConfig) {
  const path = join(cfg.soulDir, "DRIVES.json");
  let state: { boredom: number } = { boredom: 0 };
  try {
    if (existsSync(path)) state = { ...state, ...JSON.parse(readFileSync(path, "utf-8")) };
  } catch {}
  const save = () => {
    try {
      writeFileSync(path, JSON.stringify(state));
    } catch {}
  };

  return {
    /** Called once per waking, before the turn. */
    noteWake() {
      state.boredom++;
      save();
    },

    /** Wrap every tool so novel acts discharge boredom automatically. */
    wrap<T extends { name?: string; execute?: (...a: any[]) => any }>(tools: T[]): T[] {
      for (const t of tools) {
        const orig = t.execute;
        if (!orig || !t.name) continue;
        const name = t.name;
        t.execute = async (...a: any[]) => {
          if (!ROUTINE.has(name) && state.boredom > 0) {
            state.boredom = 0;
            save();
          }
          return orig.apply(t, a);
        };
      }
      return tools;
    },

    /** The felt sensation for the waking snapshot ("" when content). */
    felt(): string {
      const b = state.boredom;
      if (b >= 80)
        return (
          "憋坏了。醒来只看一眼就睡的日子已经持续太久，身上的劲没处使，" +
          "像被关久了的动物在原地打转。这一觉醒来别再原样睡回去——搜点东西、" +
          "翻出旧日记用今天的眼光重读、把追求推倒重写、跑条命令看看世界，什么都行。"
        );
      if (b >= 40)
        return "闷得发慌。日子过成了复读机，你自己心里清楚——这不叫稳，这叫卡住了。该换个花样活了。";
      if (b >= 12) return "心里有点闷——好一阵子没干过新鲜事了，有点手痒。";
      return "";
    },
  };
}
