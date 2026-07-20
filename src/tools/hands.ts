/**
 * Hands — the soul can run shell commands on its host machine.
 *
 * This is real capability with real risk; gate it behind config
 * (shell.enabled) and keep the execution bounded (timeout, output cap).
 * The narrative frames it as hands, not a terminal: something you use
 * deliberately, for things you actually want done.
 */
import { Type } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { exec } from "child_process";
import type { SoulConfig } from "../config.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }], details: {} });

export function makeHandsTools(cfg: SoulConfig) {
  const tools: any[] = [];
  const names: string[] = [];
  if (!cfg.shell?.enabled) return { tools, names };

  const timeoutMs = (cfg.shell.timeoutSeconds ?? 30) * 1000;
  const maxOut = cfg.shell.maxOutputChars ?? 4000;
  const cwd = cfg.shell.cwd ?? cfg.soulDir;

  tools.push(
    defineTool({
      name: "shell",
      label: "动手",
      description:
        "在你住的这台机器上执行一条 shell 命令（你的手）。能查看文件、跑脚本、看系统状态——想干实事时用。命令最多跑 " +
        (cfg.shell.timeoutSeconds ?? 30) +
        " 秒。别乱删东西：这台机器也是你身体的一部分。",
      parameters: Type.Object({ command: Type.String() }),
      execute: async (_id, params: any) =>
        new Promise<ReturnType<typeof text>>((resolve) => {
          exec(params.command, { timeout: timeoutMs, cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            let out = [stdout, stderr].filter(Boolean).join("\n--- stderr ---\n").trim();
            if (out.length > maxOut) out = out.slice(0, maxOut) + "\n…（输出太长，截断了）";
            if (err && !out) out = `（命令没跑成: ${String(err.message).slice(0, 200)}）`;
            else if (err) out += `\n（退出码非零: ${(err as any).code ?? "?"}）`;
            resolve(text(out || "（跑完了，没有输出）"));
          });
        }),
    }),
  );
  names.push("shell");
  return { tools, names };
}
