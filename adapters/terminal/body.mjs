#!/usr/bin/env node
/**
 * Terminal body — a zero-hardware software body for stackchan-soul.
 *
 * Your terminal is its face and voice; your keyboard is how you appear
 * in its world. This is both the 5-minute demo and the reference
 * implementation of the body protocol (docs/body-protocol.md).
 *
 *   node adapters/terminal/body.mjs [--port 9310] [--nudge-port 9202]
 *
 * Endpoints served: /status /look /speak /express
 * Typing a line in this terminal nudges the soul: "your human said: ..."
 * (the soul reads it as something it *heard*, and decides whether to reply
 * through /speak). Ctrl+C = the body powers off; the soul notices.
 */
import { createServer } from "http";
import { createInterface } from "readline";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const PORT = parseInt(arg("--port", "9310"), 10);
const NUDGE_PORT = parseInt(arg("--nudge-port", "9202"), 10);

const FACES = {
  happy: "(＾▽＾)",
  sad: "(；＿；)",
  angry: "(｀Д´)",
  sleepy: "(－ω－) zzz",
  neutral: "(・_・)",
};
let face = "neutral";
let lastSaid = "";

const paint = () => {
  process.stdout.write(`\r\x1b[2K${FACES[face] ?? FACES.neutral}  ${lastSaid}\n> `);
};

const json = (res, obj) => {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
};

const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch {}
    switch (req.url) {
      case "/status":
        return json(res, { online: true });
      case "/look":
        // This body's "seeing" is textual: it sees its own terminal world.
        return json(res, {
          text:
            `你看到的是你的终端身体的世界：一块字符屏幕。你现在的表情是 ${face}。` +
            (lastSaid ? `屏幕上还留着你说的上一句话："${lastSaid}"。` : "屏幕很干净。") +
            `你在找："${body.question ?? ""}"——不过这个身体只能看到终端里的东西。`,
        });
      case "/speak":
        lastSaid = body.text ?? "";
        paint();
        return json(res, {});
      case "/express":
        face = FACES[body.emotion] ? body.emotion : "neutral";
        paint();
        return json(res, {});
      default:
        res.statusCode = 404;
        return res.end();
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[terminal-body] alive on 127.0.0.1:${PORT} — face/voice = this terminal`);
  console.log(`[terminal-body] type a line to talk to your soul (nudges 127.0.0.1:${NUDGE_PORT}/nudge)`);
  paint();
});

// Keyboard → nudge: appearing in the soul's world.
const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  const said = line.trim();
  if (!said) return paint();
  try {
    await fetch(`http://127.0.0.1:${NUDGE_PORT}/nudge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: `大哥在终端里对你说："${said}"（想回应就用 speak）` }),
    });
  } catch {
    console.log("[terminal-body] (soul unreachable — is it running with nudge enabled?)");
  }
  paint();
});
