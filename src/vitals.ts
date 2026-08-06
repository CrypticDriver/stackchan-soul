/**
 * Vitals — the soul's metabolic layer: budget as hunger, health as an endpoint.
 *
 * A digital life costs money to exist (~one LLM round-trip per waking).
 * Production-grade means a HARD ceiling, but exceptions and rate-limiters
 * don't belong in a life's fiction — so the budget enters as *hunger*:
 *
 *   - `budget.maxWakesPerDay` is the day's food (day = cfg.timezone)
 *   - as it runs low the soul FEELS it (a sensation in the waking
 *     snapshot, same idiom as boredom — never a counter)
 *   - when exhausted, sleeps are stretched to `budget.hungrySleepMinutes`
 *     regardless of what the soul asks for: a fasting animal conserving
 *     energy until the day rolls over. The loop enforces this; the soul
 *     is told, honestly, that it's running on empty.
 *
 * The same module serves GET /health — a guardian's view of the life:
 * wakes, drives, diary rhythm, and a rut detector (opening variety of
 * recent entries — the metric that made the 14-day collapse visible).
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { SoulConfig } from "./config.js";

const today = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

export function makeVitals(cfg: SoulConfig) {
  const path = join(cfg.soulDir, "VITALS.json");
  let state: { date: string; wakes: number } = { date: today(cfg.timezone), wakes: 0 };
  try {
    if (existsSync(path)) state = { ...state, ...JSON.parse(readFileSync(path, "utf-8")) };
  } catch {}
  const save = () => {
    try {
      writeFileSync(path, JSON.stringify(state));
    } catch {}
  };
  const rollover = () => {
    const d = today(cfg.timezone);
    if (state.date !== d) {
      state = { date: d, wakes: 0 };
      save();
    }
  };

  const max = cfg.budget?.maxWakesPerDay ?? 0; // 0 = no budget

  return {
    noteWake() {
      rollover();
      state.wakes++;
      save();
    },

    /** Fraction of the day's budget consumed (0 when unbudgeted). */
    used(): number {
      rollover();
      return max ? state.wakes / max : 0;
    },

    /** True when today's budget is gone — the loop stretches sleep. */
    starving(): boolean {
      return max > 0 && this.used() >= 1;
    },

    /** Hunger sensation for the waking snapshot ("" when fed). */
    felt(): string {
      const u = this.used();
      if (!max || u < 0.8) return "";
      if (u >= 1)
        return (
          "肚子空了——今天的力气用完了（每天的力气是有数的）。这一觉会睡得很长，" +
          "这不是惩罚，是身体在过冬。有什么没做完的，挂在心上，明天力气回来了再做。"
        );
      return "有点饿了——今天的力气用得差不多了，剩下的清醒时光省着点用，别把力气花在空转上。";
    },

    /** Guardian's view. diaryPath/drives are read fresh per request. */
    health(extra: { boredom: () => number }) {
      rollover();
      const diaryPath = join(cfg.soulDir, "DIARY.md");
      let diaryToday = 0;
      let variety10 = null as number | null;
      try {
        const entries = readFileSync(diaryPath, "utf-8").split("\n").filter((l) => l.startsWith("- "));
        const [y, m, d] = state.date.split("-").map(Number);
        diaryToday = entries.filter((l) => l.startsWith(`- ${y}/${m}/${d}`)).length;
        const last10 = entries.slice(-10).map((l) => l.replace(/^- [0-9/: ]*/, "").slice(0, 20));
        variety10 = new Set(last10).size;
      } catch {}
      let mood = "";
      try {
        const md = readFileSync(join(cfg.soulDir, "MOOD.md"), "utf-8");
        mood = md.match(/## 当前心情\n(.+)/)?.[1]?.trim() ?? "";
      } catch {}
      return {
        date: state.date,
        wakesToday: state.wakes,
        budget: max ? { maxWakesPerDay: max, used: +this.used().toFixed(2), starving: this.starving() } : null,
        boredom: extra.boredom(),
        diaryToday,
        diaryVarietyLast10: variety10, // ≤2 = rut (复读机), 14-day collapse showed 1
        mood,
      };
    },
  };
}
