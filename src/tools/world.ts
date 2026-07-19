/**
 * World tools — senses that reach beyond the body.
 * Currently: web search via any MCP gateway (JSON-RPC tools/call), with
 * optional AWS SigV4 signing for Amazon Bedrock AgentCore gateways.
 *
 * A soul with only a camera knows one desk; a soul that can also glance at
 * the news knows what kind of day the world is having.
 */
import { Type } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";
import type { SoulConfig } from "../config.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }], details: {} });

async function callMcp(cfg: NonNullable<SoulConfig["worldSearch"]>, payload: unknown): Promise<any> {
  const body = JSON.stringify(payload);
  let headers: Record<string, string> = { "Content-Type": "application/json" };

  if (cfg.auth === "aws-sigv4") {
    const { SignatureV4 } = await import("@smithy/signature-v4");
    const { defaultProvider } = await import("@aws-sdk/credential-provider-node");
    const { Sha256 } = await import("@aws-crypto/sha256-js");
    const { HttpRequest } = await import("@smithy/protocol-http");
    const url = new URL(cfg.url);
    const signer = new SignatureV4({
      credentials: defaultProvider(),
      region: cfg.region ?? "us-east-1",
      service: cfg.service ?? "bedrock-agentcore",
      sha256: Sha256,
    });
    const signed = await signer.sign(
      new HttpRequest({
        method: "POST",
        protocol: url.protocol,
        hostname: url.hostname,
        path: url.pathname,
        headers: { "content-type": "application/json", host: url.hostname },
        body,
      }),
    );
    headers = signed.headers as Record<string, string>;
  } else if (cfg.token) {
    headers["Authorization"] = `Bearer ${cfg.token}`;
  }

  const res = await fetch(cfg.url, { method: "POST", headers, body, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`mcp gateway ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

export function makeWorldTools(cfg: SoulConfig) {
  const tools: any[] = [];
  const names: string[] = [];
  const ws = cfg.worldSearch;
  if (!ws?.url) return { tools, names };

  tools.push(
    defineTool({
      name: "web_search",
      label: "看看外面的世界",
      description:
        "搜一下互联网，看看外面的世界正在发生什么。query 用英文效果最好。返回若干条标题+日期+摘要。好奇某件事、想知道今天有什么新鲜事时用。",
      parameters: Type.Object({ query: Type.String() }),
      execute: async (_id, params: any) => {
        const out = await callMcp(ws, {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: ws.toolName, arguments: { query: params.query, maxResults: ws.maxResults ?? 5 } },
        });
        if (out.error) return text(`（搜索没成: ${JSON.stringify(out.error).slice(0, 200)}）`);
        const items: string[] = [];
        for (const c of out.result?.content ?? []) {
          if (c.type !== "text") continue;
          try {
            const data = JSON.parse(c.text);
            for (const r of data.results ?? []) {
              items.push(`· ${r.title ?? ""} (${r.publishedDate ?? r.date ?? "?"})\n  ${(r.text ?? "").slice(0, 200)}`);
            }
          } catch {
            items.push(c.text.slice(0, 300));
          }
        }
        return text(items.length ? items.join("\n") : "（没搜到什么）");
      },
    }),
  );
  names.push("web_search");
  return { tools, names };
}
