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
import { makeWorldTools } from "./tools/world.js";
import { makeFutureTools, readFutureState } from "./tools/future.js";
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
  const world = makeWorldTools(cfg);
  const future = makeFutureTools(cfg);

  const { session } = await createAgentSession({
    cwd: cfg.soulDir,
    model,
    thinkingLevel: cfg.model.thinking ?? "off",
    modelRuntime,
    // The soul has no filesystem hands — only its body and its inner world.
    tools: [...body.names, ...inner.names, ...world.names, ...future.names],
    customTools: [...body.tools, ...inner.tools, ...world.tools, ...future.tools],
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
    const nudgeServer = createServer((req, res) => {
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
    });
    // Old process may hold the port for a moment during restarts — retry.
    nudgeServer.on("error", (e: any) => {
      if (e.code === "EADDRINUSE") setTimeout(() => nudgeServer.listen(cfg.nudge!.port, "127.0.0.1"), 3000);
      else console.error("[soul] nudge server error:", e);
    });
    nudgeServer.listen(cfg.nudge.port, "127.0.0.1");
    console.log(`[soul] nudge endpoint on 127.0.0.1:${cfg.nudge.port}/nudge`);
  }

  // ---- The consciousness loop ----
  // Each iteration = one moment of being awake.
  // The agent ends its turn by calling sleep(minutes) — that promise's
  // resolution IS the agent choosing when to wake next. A nudge can
  // cut sleep short, like a noise waking you before the alarm.
  console.log(`[soul] awakening. body=${cfg.body.name} model=${cfg.model.provider}/${cfg.model.id}`);
  let wakeReason = "进程启动（你刚醒来，也许睡了很久）";
  let thinking = false; // is the loop currently inside session.prompt()?

  // ---- Unified dialog (v2): the human's words join THIS session ----
  if (cfg.converse?.port) {
    const { startConverse } = await import("./converse.js");
    startConverse(cfg, session as any, {
      isThinking: () => thinking,
      rouse: (reason: string) => {
        if (rouse) {
          rouse(reason);
          return true;
        }
        return false;
      },
    });
  }

  // Passive body sense: probed automatically each waking — senses come
  // before thought, the soul shouldn't have to *decide* to feel its body.
  async function senseBody(): Promise<string> {
    const ep = cfg.body.endpoints.status;
    if (!ep) return "（这具身体没有在线感应）";
    try {
      const res = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(cfg.body.token ? { Authorization: `Bearer ${cfg.body.token}` } : {}) },
        body: "{}",
        signal: AbortSignal.timeout(5000),
      });
      const d: any = await res.json().catch(() => ({}));
      return d.online ? "身体醒着（摄像头和嘴都能用）" : "身体在休眠（看不了说不了，但你照样能想事）";
    } catch {
      return "身体没应答（大概在休眠）";
    }
  }

  while (true) {
    const state = await readInnerState(cfg);
    const fut = readFutureState(cfg);
    const parts = [
      `【睁眼】${new Date().toLocaleString("zh-CN", { timeZone: cfg.timezone })}`,
      `醒来原因: ${wakeReason}`,
      `身体感: ${await senseBody()}`,
    ];
    if (fut.mind.trim()) parts.push(`心里挂着的事（睁眼就想起来了）:\n${fut.mind}`);
    if (fut.aspirations.trim()) parts.push(`你的追求与目标（ASPIRATIONS.md）:\n${fut.aspirations}`);
    else parts.push(`你的追求与目标: （还是空白——也许这次醒来，想想你想成为什么、想做成点什么？用 set_aspiration 写下来）`);
    parts.push(`内心状态:\n${state}`);
    parts.push(`这段清醒时光是你的——想干嘛干嘛，一件接一件都行，聊天就聊到自然结束。过完了这段，再用 sleep 定下次闹钟。`);
    const nudge = parts.join("\n\n");

    let sleptMinutes = cfg.loop.defaultSleepMinutes;
    try {
      body.resetSleepRequest();
      thinking = true;
      await session.prompt(nudge);
      thinking = false;
      const req = body.consumeSleepRequest();
      if (req !== null) sleptMinutes = req;
    } catch (e) {
      thinking = false;
      console.error("[soul] turn failed:", e);
      sleptMinutes = cfg.loop.errorSleepMinutes; // rest longer after a bad turn
    }

    // Night schedule: in the configured timezone's small hours the ceiling
    // relaxes — a body clock, not a policy.
    const hourNow = parseInt(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: cfg.timezone }).format(new Date()),
      10,
    ) % 24;
    const ns = cfg.loop.nightStartHour ?? 24, ne = cfg.loop.nightEndHour ?? 0;
    const isNight = ns > ne ? hourNow >= ns || hourNow < ne : hourNow >= ns && hourNow < ne;
    const ceiling = isNight && cfg.loop.nightMaxSleepMinutes ? cfg.loop.nightMaxSleepMinutes : cfg.loop.maxSleepMinutes;
    const capped = Math.min(Math.max(sleptMinutes, cfg.loop.minSleepMinutes), ceiling);
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
