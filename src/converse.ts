/**
 * Unified consciousness — dialog joins the stream of consciousness.
 *
 * There is no separate "conversation agent". When the human speaks, their
 * words are injected into the SAME session that dreams, keeps a diary and
 * watches the news:
 *   - soul asleep  → wake it with the words as the wake reason
 *   - soul awake   → steer(): interrupt its train of thought, like calling
 *                    someone's name while they're reading
 *
 * The endpoint speaks OpenAI chat-completions, so any voice stack that can
 * talk to an LLM can talk to a living soul instead.
 */
import { createServer } from "http";
import type { SoulConfig } from "./config.js";

export interface ConverseBridge {
  /** Resolve when the soul finishes the turn triggered by this utterance. */
  say(utterance: string): Promise<string>;
}

interface SessionLike {
  prompt(text: string, options?: any): Promise<void>;
  steer(text: string): Promise<void>;
  getLastAssistantText(): string | undefined;
  subscribe(fn: (e: any) => void): () => void;
  state: { messages: any[] };
}

interface LoopState {
  /** Is the consciousness loop currently inside session.prompt()? */
  isThinking(): boolean;
  /** Wake the sleeping loop with a reason (resolves its sleep promise). */
  rouse(reason: string): boolean;
}

/**
 * Create the converse bridge + HTTP endpoint.
 * Design notes:
 * - We mark dialog turns with a wrapper so the soul knows the human is
 *   actually speaking to it right now (vs. ambient events).
 * - The reply is whatever the soul says in THAT turn — captured via
 *   agent_settled + getLastAssistantText().
 */
export function startConverse(cfg: SoulConfig, session: SessionLike, loop: LoopState) {
  const port = cfg.converse?.port;
  if (!port) return;

  async function say(utterance: string): Promise<string> {
    const wrapped = `【大哥正在对你说话】"${utterance}"\n（这是实时对话——直接口语回答他，先回话，别的事回完再说。）`;
    console.log(`[converse] 大哥: ${utterance}`);

    // Snapshot-diff capture: record the message count BEFORE injecting our
    // words; after the turn settles, the reply = all assistant text among the
    // NEW messages. No streaming races, no stale tails.
    const baseCount = session.state.messages.length;
    // Strip inner monologue: the soul narrates itself in（...）. A message that
    // is ENTIRELY parenthetical is pure thought (e.g. "（打个盹，5分钟后…）"),
    // never spoken to the human. Trailing parentheticals inside a real reply
    // are trimmed too.
    const spoken = (s: string): string =>
      s.replace(/（[^（）]*）/gu, " ").replace(/\s+/g, " ").trim();
    // The reply is the FIRST real spoken assistant message after our words —
    // NOT the whole turn. The consciousness loop keeps producing text after it
    // answers ("接下来干点啥呢…", "打个盹吧"); joining all of that made the
    // voice stack read several utterances as if answering twice.
    const collectNew = (): string => {
      for (const m of session.state.messages.slice(baseCount)) {
        if (m?.role !== "assistant") continue;
        const c = m.content;
        let t = "";
        if (typeof c === "string") t = c;
        else if (Array.isArray(c)) t = c.filter((p) => p?.type === "text" && p.text).map((p) => p.text).join(" ");
        const s = spoken(t);
        if (s) return s; // first message with actual speech wins
      }
      return "";
    };
    const settled = new Promise<string>((resolve) => {
      const finish = () => {
        unsub();
        clearTimeout(guard);
        resolve(collectNew());
      };
      const unsub = session.subscribe((e: any) => {
        if ((e.type === "agent_settled" || e.type === "agent_end") && session.state.messages.length > baseCount) {
          finish();
        }
      });
      // Voice stacks time out; don't hang forever if something goes sideways.
      const guard = setTimeout(finish, 45_000);
    });

    // Single-entry design (avoids concurrent prompt() races):
    // - asleep  → rouse(): the loop wakes and prompts with our words as the
    //             wake reason. One prompt, issued by the loop.
    // - awake   → steer(): interject into the running turn, like calling
    //             someone's name while they're reading.
    const roused = loop.rouse(wrapped);
    if (!roused) {
      await session.steer(wrapped);
    }
    const reply = await settled;
    console.log(`[converse] 狗蛋${roused ? "(醒来)" : "(接话)"}: ${reply || "（没答上来）"}`);
    return reply;
  }

  const server = createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.statusCode = 404;
      return res.end();
    }
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      try {
        const body = JSON.parse(raw);
        const msgs = body.messages ?? [];
        const last = [...msgs].reverse().find((m: any) => m.role === "user");
        let content = typeof last?.content === "string" ? last.content : JSON.stringify(last?.content ?? "");
        // voice stacks often wrap user text in {"content": "...", "emotion": ...}
        try {
          const inner = JSON.parse(content);
          if (inner && typeof inner === "object" && inner.content) content = inner.content;
        } catch {}

        const reply = await say(content);
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            id: "soul-converse",
            object: "chat.completion",
            model: "soul",
            choices: [
              { index: 0, message: { role: "assistant", content: reply }, finish_reason: "stop" },
            ],
          }),
        );
      } catch (e: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: { message: String(e?.message ?? e) } }));
      }
    });
  });
  server.on("error", (e: any) => {
    if (e.code === "EADDRINUSE") {
      console.error(`[soul] converse port ${port} busy, retrying in 3s...`);
      setTimeout(() => server.listen(port, "127.0.0.1"), 3000);
    } else console.error("[soul] converse server error:", e);
  });
  server.listen(port, "127.0.0.1");
  console.log(`[soul] converse endpoint on 127.0.0.1:${port}/v1/chat/completions`);
  return { say };
}
