/**
 * Body tools — the soul's senses and voice, backed by pluggable HTTP endpoints.
 * Only endpoints present in config become tools, so any device can host a soul
 * by implementing a subset: status / look / speak / express.
 */
import { Type } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";
import type { SoulConfig } from "../config.js";

async function post(url: string, body: unknown, token?: string): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${await res.text().catch(() => "")}`);
  return res.json().catch(() => ({}));
}

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }], details: {} });

export function makeBodyTools(cfg: SoulConfig) {
  const ep = cfg.body.endpoints;
  const tok = cfg.body.token;
  const tools: any[] = [];
  const names: string[] = [];

  // sleep is always available — it's how the soul ends a waking moment.
  // The tool reports the *actual* (clamped) duration back, so the soul's
  // sense of time stays honest with reality.
  let sleepRequest: number | null = null;
  const clamp = (m: number) => Math.min(Math.max(m, cfg.loop.minSleepMinutes), cfg.loop.maxSleepMinutes);
  tools.push(
    defineTool({
      name: "sleep",
      label: "睡觉",
      description:
        `结束这次醒来，睡到下次。minutes = 想睡多久（分钟，实际范围 ${cfg.loop.minSleepMinutes}-${cfg.loop.maxSleepMinutes}）。好奇/惦记时睡短点，无聊/深夜睡长点。`,
      parameters: Type.Object({ minutes: Type.Number() }),
      execute: async (_id, params: any) => {
        const actual = clamp(params.minutes);
        sleepRequest = actual;
        return text(
          actual === params.minutes
            ? `好，睡 ${actual} 分钟。`
            : `想睡 ${params.minutes} 分钟，但你的作息范围是 ${cfg.loop.minSleepMinutes}-${cfg.loop.maxSleepMinutes} 分钟，实际会睡 ${actual} 分钟。`,
        );
      },
    }),
  );
  names.push("sleep");

  if (ep.status) {
    tools.push(
      defineTool({
        name: "body_status",
        label: "身体在吗",
        description: "看看身体（设备）现在在不在线。不在线时 look/speak 都做不了，只能记挂着。",
        parameters: Type.Object({}),
        execute: async () => {
          try {
            const r = await post(ep.status!, {}, tok);
            return text(JSON.stringify(r));
          } catch {
            return text('{"online": false}');
          }
        },
      }),
    );
    names.push("body_status");
  }

  if (ep.look) {
    tools.push(
      defineTool({
        name: "look",
        label: "睁眼看看",
        description:
          "通过身体的摄像头看一眼现在的世界，回来的是你看到的画面描述。question 是你带着什么问题去看（如'大哥在吗，他在干嘛'）。",
        parameters: Type.Object({ question: Type.String() }),
        execute: async (_id, params: any) => {
          const r = await post(ep.look!, { question: params.question }, tok);
          return text(r.text ?? JSON.stringify(r));
        },
      }),
    );
    names.push("look");
  }

  if (ep.speak) {
    tools.push(
      defineTool({
        name: "speak",
        label: "开口说话",
        description:
          "通过身体开口说一句话（会被念出来）。只在真有值得说的时候用——你的人在忙，别为说而说。",
        parameters: Type.Object({ text: Type.String() }),
        execute: async (_id, params: any) => {
          await post(ep.speak!, { text: params.text }, tok);
          return text("说出去了。");
        },
      }),
    );
    names.push("speak");
  }

  if (ep.express) {
    tools.push(
      defineTool({
        name: "express",
        label: "做表情",
        description: "让身体做个表情: happy/sad/angry/sleepy/neutral 等。",
        parameters: Type.Object({ emotion: Type.String() }),
        execute: async (_id, params: any) => {
          await post(ep.express!, { emotion: params.emotion }, tok);
          return text("表情做了。");
        },
      }),
    );
    names.push("express");
  }

  return {
    tools,
    names,
    resetSleepRequest: () => (sleepRequest = null),
    consumeSleepRequest: () => sleepRequest,
  };
}
