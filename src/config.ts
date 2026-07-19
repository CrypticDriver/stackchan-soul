/**
 * Config — everything device-specific lives here, so the soul core stays universal.
 * Loaded from soul.config.json (path via SOUL_CONFIG env or ./soul.config.json).
 */
import { readFileSync } from "fs";
import { resolve } from "path";

export interface SoulConfig {
  /** Where the soul keeps its life: session JSONL, inner-state files. */
  soulDir: string;
  timezone: string;
  model: {
    provider: string; // e.g. "amazon-bedrock"
    id: string;       // e.g. "global.anthropic.claude-sonnet-5"
    thinking?: "off" | "low" | "medium" | "high";
  };
  loop: {
    defaultSleepMinutes: number; // if the agent forgets to call sleep
    minSleepMinutes: number;     // safety floor (cost control)
    maxSleepMinutes: number;     // safety ceiling (never comatose)
    errorSleepMinutes: number;   // back-off after a failed turn
  };
  body: {
    name: string; // e.g. "StackChan(狗蛋)"
    /** HTTP endpoints the body adapter exposes. All optional — the soul
     *  only gets tools for endpoints that are configured. */
    endpoints: {
      /** GET/POST → { online: bool } — is the body reachable right now? */
      status?: string;
      /** POST {question} → { text } — capture image via body camera and describe.
       *  (For StackChan this proxies the vision chain.) */
      look?: string;
      /** POST {text} → speak through the body's voice (TTS). */
      speak?: string;
      /** POST {emotion} → show an expression. */
      express?: string;
    };
    /** Optional bearer token for body endpoints. */
    token?: string;
  };
  persona: {
    /** The soul's name, human's name, and freeform personality notes,
     *  interpolated into the consciousness prompt. */
    name: string;
    human: string;
    notes: string;
    /** Path to a shared mood file (e.g. a dialog agent's workspace MOOD.md) so a
     *  companion "conversation agent" shares the same inner state. Optional. */
    sharedMoodPath?: string;
  };
  log: { streamThoughts: boolean };
}

export function loadConfig(): SoulConfig {
  const p = resolve(process.env.SOUL_CONFIG ?? "./soul.config.json");
  const cfg = JSON.parse(readFileSync(p, "utf-8")) as SoulConfig;
  const loopDefaults = { defaultSleepMinutes: 45, minSleepMinutes: 10, maxSleepMinutes: 480, errorSleepMinutes: 60 };
  cfg.loop = Object.assign(loopDefaults, cfg.loop ?? {});
  cfg.log = Object.assign({ streamThoughts: true }, cfg.log ?? {});
  return cfg;
}
