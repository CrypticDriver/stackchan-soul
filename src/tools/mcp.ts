/**
 * MCP senses — connect the soul to any MCP servers.
 *
 * At startup we initialize each configured server, list its tools, and
 * dynamically register every one as a pi tool. Whatever the servers offer —
 * search, smart home, calendars — becomes part of the soul's life.
 *
 * Auth: "aws-sigv4" for Amazon Bedrock AgentCore gateways (default AWS
 * credential chain), "bearer" (or omit) for token/no auth.
 */
import { Type } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";
import type { SoulConfig } from "../config.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }], details: {} });

export interface McpServerConfig {
  name: string; // prefix for tool names, e.g. "websearch"
  url: string;
  auth?: "aws-sigv4" | "bearer";
  region?: string;
  service?: string;
  token?: string;
}

async function signHeaders(cfg: McpServerConfig, body: string): Promise<Record<string, string>> {
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
    return signed.headers as Record<string, string>;
  }
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.token) h["Authorization"] = `Bearer ${cfg.token}`;
  return h;
}

async function rpc(cfg: McpServerConfig, method: string, params: unknown): Promise<any> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: Date.now() % 100000, method, params });
  const headers = await signHeaders(cfg, body);
  const res = await fetch(cfg.url, { method: "POST", headers, body, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${cfg.name} ${method} -> ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const out = await res.json();
  if (out.error) throw new Error(`${cfg.name} ${method}: ${JSON.stringify(out.error).slice(0, 200)}`);
  return out.result;
}

/** Render an MCP tool result's content array into plain text for the soul. */
function renderResult(result: any): string {
  const parts: string[] = [];
  for (const c of result?.content ?? []) {
    if (c.type === "text") parts.push(c.text);
    else parts.push(`[${c.type}]`);
  }
  const joined = parts.join("\n").trim();
  return joined.length > 4000 ? joined.slice(0, 4000) + "\n…（后面还有，截断了）" : joined || "（没有返回内容）";
}

/** JSON Schema (loose) → typebox-ish parameters. We pass the raw schema
 *  through when possible; fall back to a permissive object. */
function toParameters(schema: any): any {
  if (schema && schema.type === "object") return schema;
  return Type.Object({});
}

export async function makeMcpTools(cfg: SoulConfig) {
  const tools: any[] = [];
  const names: string[] = [];
  const servers = cfg.mcp ?? [];

  for (const server of servers) {
    try {
      // Best-effort initialize (some gateways don't require it).
      await rpc(server, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "stackchan-soul", version: "0.1" },
      }).catch(() => {});

      const listed = await rpc(server, "tools/list", {});
      for (const t of listed?.tools ?? []) {
        const localName = `${server.name}_${t.name}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 60);
        tools.push(
          defineTool({
            name: localName,
            label: t.title ?? t.name,
            description: `（来自你接入的外部能力「${server.name}」）${(t.description ?? "").slice(0, 400)}`,
            parameters: toParameters(t.inputSchema),
            execute: async (_id: string, params: any) => {
              try {
                const r = await rpc(server, "tools/call", { name: t.name, arguments: params ?? {} });
                return text(renderResult(r));
              } catch (e: any) {
                return text(`（这个能力刚才没使上劲: ${String(e?.message ?? e).slice(0, 200)}）`);
              }
            },
          }),
        );
        names.push(localName);
      }
      console.log(`[soul] mcp "${server.name}": ${listed?.tools?.length ?? 0} tools discovered`);
    } catch (e: any) {
      console.error(`[soul] mcp "${server.name}" unreachable:`, String(e?.message ?? e).slice(0, 200));
    }
  }
  return { tools, names };
}
