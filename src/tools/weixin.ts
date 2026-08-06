/**
 * Weixin — a message channel to the human, not a body.
 *
 * The soul's body (StackChan) lends senses; Weixin lends a *voice that
 * reaches across distance*. It maps to two primitives:
 *   - inbound: a long-poll (getUpdates) turns each message from the human
 *     into a nudge ("大哥在微信上说：…"), rousing the soul like the terminal
 *     body's keyboard does.
 *   - outbound: the `weixin_send` tool lets the soul write to the human on
 *     its own initiative — the async, unintrusive way to finally say the
 *     things it's been keeping in mind while its body is offline.
 *
 * Wire protocol reverse-engineered from @tencent-weixin/openclaw-weixin
 * (Tencent, MIT): token-auth against ilinkai.weixin.qq.com, getUpdates
 * long-poll upstream + sendMessage downstream. We speak it directly so the
 * soul owns the account with no OpenClaw dependency.
 *
 * IMPORTANT: only ONE poller may hold a Weixin account's cursor at a time.
 * Before pointing the soul at an account, stop whatever else was polling
 * it (e.g. an OpenClaw agent binding) or they steal each other's messages.
 */
import { Type } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { SoulConfig } from "../config.js";

const BASE = "https://ilinkai.weixin.qq.com/";
const CHANNEL_VERSION = "2.4.3";
const CLIENT_VERSION = (2 << 16) | (4 << 8) | 3; // buildClientVersion("2.4.3")
const LONG_POLL_MS = 35_000;
const SEND_TIMEOUT_MS = 15_000;

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }], details: {} });

function headers(token: string): Record<string, string> {
  const uin = Buffer.from(String(randomBytes(4).readUInt32BE(0)), "utf-8").toString("base64");
  return {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "X-WECHAT-UIN": uin,
    "iLink-App-Id": "bot",
    "iLink-App-ClientVersion": String(CLIENT_VERSION),
    Authorization: `Bearer ${token}`,
  };
}
const baseInfo = () => ({ channel_version: CHANNEL_VERSION, bot_agent: "stackchan-soul" });

async function api(endpoint: string, body: unknown, token: string, timeoutMs: number): Promise<any> {
  const res = await fetch(new URL(endpoint, BASE), {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${endpoint} -> ${res.status} ${await res.text().catch(() => "")}`);
  return res.json().catch(() => ({}));
}

/** Pull the human-readable text out of an inbound message's item_list. */
function msgText(msg: any): string {
  const items = msg?.item_list ?? [];
  const parts: string[] = [];
  for (const it of items) {
    if (it?.type === 1 && it?.text_item?.text != null) parts.push(String(it.text_item.text));
    else if (it?.type === 3 && it?.voice_item?.text) parts.push(String(it.voice_item.text)); // transcribed voice
  }
  return parts.join(" ").trim();
}

export function makeWeixin(cfg: SoulConfig, rouse: (reason: string) => void) {
  const wx = cfg.weixin;
  const tools: any[] = [];
  const names: string[] = [];
  if (!wx?.token) return { tools, names, start: () => {} };

  const statePath = join(cfg.soulDir, "weixin-sync.json");
  let updatesBuf = "";
  try {
    if (existsSync(statePath)) updatesBuf = JSON.parse(readFileSync(statePath, "utf-8")).get_updates_buf ?? "";
  } catch {}
  const saveBuf = () => {
    try {
      writeFileSync(statePath, JSON.stringify({ get_updates_buf: updatesBuf }));
    } catch {}
  };

  // Last human we heard from — weixin_send replies here by default, and the
  // context_token threads the conversation server-side.
  let lastFrom: string | null = wx.defaultTo ?? null;
  let lastContext: string | undefined;
  const seen = new Set<string>(); // message_id dedup (device/network can redeliver)
  const startMs = Date.now();

  // ---- outbound tool ----
  tools.push(
    defineTool({
      name: "weixin_send",
      label: "发微信",
      description:
        "给大哥发一条微信消息（异步的，他不一定马上看）。想他了、有意思的事想分享、" +
        "心里的话攒够了、或回应他刚发来的微信——都可以主动发，别等他先开口。" +
        "text 是消息内容。有分寸就好（一次说清一件事，别连环轰炸），但该说就说。",
      parameters: Type.Object({ text: Type.String() }),
      execute: async (_id, p: any) => {
        if (!lastFrom) return text("还不知道该发给谁——等大哥先在微信上说句话，我就记住他了。");
        const clientId = `stackchan-soul:${Date.now()}-${randomBytes(4).toString("hex")}`;
        await api(
          "ilink/bot/sendmessage",
          {
            msg: {
              from_user_id: "",
              to_user_id: lastFrom,
              client_id: clientId,
              message_type: 2, // BOT
              message_state: 2, // FINISH
              item_list: [{ type: 1, text_item: { text: p.text } }],
              context_token: lastContext,
            },
            base_info: baseInfo(),
          },
          wx.token!,
          SEND_TIMEOUT_MS,
        );
        return text("微信发出去了。");
      },
    }),
  );
  names.push("weixin_send");

  // ---- inbound long-poll ----
  const start = () => {
    (async function loop() {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          const resp = await api(
            "ilink/bot/getupdates",
            { get_updates_buf: updatesBuf, base_info: baseInfo() },
            wx.token!,
            LONG_POLL_MS + 5_000,
          );
          if (resp?.get_updates_buf != null) {
            updatesBuf = resp.get_updates_buf;
            saveBuf();
          }
          const n = resp?.msgs?.length ?? 0;
          if (resp?.errcode || n) {
            console.log(`[soul] weixin getUpdates: msgs=${n} errcode=${resp?.errcode ?? 0} ${resp?.errmsg ?? ""}`);
          }
          for (const msg of resp?.msgs ?? []) {
            const from = msg?.from_user_id;
            if (!from) continue; // bot's own / system message
            const id = String(msg?.message_id ?? msg?.client_id ?? "");
            if (id && seen.has(id)) continue;
            if (id) seen.add(id);
            // Skip backlog delivered from before we started (avoid nudge storm on takeover).
            if (msg?.create_time_ms && Number(msg.create_time_ms) < startMs) continue;
            const body = msgText(msg);
            if (!body) continue;
            lastFrom = from;
            if (msg?.context_token) lastContext = msg.context_token;
            console.log(`[soul] weixin ← 大哥: ${body.slice(0, 40)}`);
            rouse(`大哥在微信上对你说："${body}"（想回应就用 weixin_send）`);
          }
        } catch (e: any) {
          if (e?.name !== "TimeoutError" && e?.name !== "AbortError") {
            console.error("[soul] weixin getUpdates error:", e?.message ?? e);
            await new Promise((r) => setTimeout(r, 5_000)); // back off on real errors
          }
        }
      }
    })();
    console.log(`[soul] weixin channel polling (account ...${wx.token!.slice(-6)})`);
  };

  return { tools, names, start };
}
