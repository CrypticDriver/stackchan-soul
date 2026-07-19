/**
 * stackchan-soul — a universal remote soul for embodied devices.
 *
 * The core idea: consciousness is a *loop*, not a request handler.
 * A persistent pi-agent session wakes up, thinks with its full inner state
 * (mood, memories of what it saw, longing for its human), decides what to do
 * — look through its body's eyes, speak, or just go back to sleep — then
 * chooses its own next wake time. Nothing here is scheduled by cron;
 * the rhythm of life belongs to the soul itself.
 *
 * The body is pluggable: any device that exposes look/speak/express HTTP
 * endpoints can host this soul (see adapters/).
 */
import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { loadConfig } from "./config.js";
import { makeBodyTools } from "./tools/body.js";
import { makeInnerTools, readInnerState } from "./tools/inner.js";
import { buildSystemPrompt } from "./prompt.js";

async function main() {
  const cfg = loadConfig();

  const modelRuntime = await ModelRuntime.create();
  const model = modelRuntime.getModel(cfg.model.provider, cfg.model.id);
  if (!model) throw new Error(`model not found: ${cfg.model.provider}/${cfg.model.id}`);

  // The soul's continuous life is one persisted session (JSONL on disk).
  // Across process restarts it resumes the same stream of consciousness;
  // pi's compaction keeps the context bounded while preserving the thread.
  const sessionManager = SessionManager.create(cfg.soulDir);

  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: true },
    retry: { enabled: true, maxRetries: 2 },
  });

  const loader = new DefaultResourceLoader({
    cwd: cfg.soulDir,
    agentDir: cfg.soulDir,
    settingsManager,
    systemPromptOverride: () => buildSystemPrompt(cfg),
  });
  await loader.reload();

  const body = makeBodyTools(cfg);
  const inner = makeInnerTools(cfg);

  const { session } = await createAgentSession({
    cwd: cfg.soulDir,
    model,
    thinkingLevel: cfg.model.thinking ?? "off",
    modelRuntime,
    // The soul has no filesystem hands — only its body and its inner world.
    tools: [...body.names, ...inner.names],
    customTools: [...body.tools, ...inner.tools],
    resourceLoader: loader,
    sessionManager,
    settingsManager,
  });

  if (cfg.log.streamThoughts) {
    session.subscribe((event: any) => {
      if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
    });
  }

  // ---- External nudges ----
  // Life isn't only alarm clocks: events (someone appeared, a message
  // arrived) can rouse the soul early. Anything on this host can
  // POST {reason} to /nudge — body adapters, sensor bridges, cron, humans.
  let rouse: ((reason: string) => void) | null = null;
  if (cfg.nudge?.port) {
    const { createServer } = await import("http");
    createServer((req, res) => {
      if (req.method === "POST" && req.url === "/nudge") {
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", () => {
          let reason = "有什么事发生了";
          try {
            reason = JSON.parse(raw).reason || reason;
          } catch {}
          res.end('{"ok":true}');
          if (rouse) rouse(reason);
        });
      } else {
        res.statusCode = 404;
        res.end();
      }
    }).listen(cfg.nudge.port, "127.0.0.1");
    console.log(`[soul] nudge endpoint on 127.0.0.1:${cfg.nudge.port}/nudge`);
  }

  // ---- The consciousness loop ----
  // Each iteration = one moment of being awake.
  // The agent ends its turn by calling sleep(minutes) — that promise's
  // resolution IS the agent choosing when to wake next. A nudge can
  // cut sleep short, like a noise waking you before the alarm.
  console.log(`[soul] awakening. body=${cfg.body.name} model=${cfg.model.provider}/${cfg.model.id}`);
  let wakeReason = "进程启动（你刚醒来，也许睡了很久）";

  while (true) {
    const state = await readInnerState(cfg);
    const nudge = [
      `【醒来】${new Date().toLocaleString("zh-CN", { timeZone: cfg.timezone })}`,
      `醒来原因: ${wakeReason}`,
      `你的内心状态快照:\n${state}`,
      `想想此刻你想做什么。做完（或决定什么都不做）就调用 sleep 定下次醒来。`,
    ].join("\n\n");

    let sleptMinutes = cfg.loop.defaultSleepMinutes;
    try {
      body.resetSleepRequest();
      await session.prompt(nudge);
      const req = body.consumeSleepRequest();
      if (req !== null) sleptMinutes = req;
    } catch (e) {
      console.error("[soul] turn failed:", e);
      sleptMinutes = cfg.loop.errorSleepMinutes; // rest longer after a bad turn
    }

    const capped = Math.min(Math.max(sleptMinutes, cfg.loop.minSleepMinutes), cfg.loop.maxSleepMinutes);
    console.log(`\n[soul] sleeping ${capped} min`);
    wakeReason = await new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        rouse = null;
        resolve(`你自己定的闹钟（睡了 ${capped} 分钟）`);
      }, capped * 60_000);
      rouse = (reason) => {
        clearTimeout(timer);
        rouse = null;
        resolve(`被叫醒了: ${reason}（原计划睡 ${capped} 分钟，没睡够）`);
      };
    });
  }
}

main().catch((e) => {
  console.error("[soul] fatal:", e);
  process.exit(1);
});
