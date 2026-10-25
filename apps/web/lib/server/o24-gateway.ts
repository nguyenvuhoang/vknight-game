// Server-side client for the O24OpenAPI gateway. Import only from route
// handlers / server code: it reads server-only env vars (never NEXT_PUBLIC_*).
import type { GatewayResponse } from "@/lib/api/character-types";

if (typeof window !== "undefined") {
  throw new Error("o24-gateway is server-only");
}

/** Workflows the BFF may call. Callers pick from this list, never from user input. */
export const WORKFLOWS = {
  listCharacters: "WF_BO_GET_LIST_CHARACTER",
  chapterMap: "WF_BO_GET_CHAPTER_MAP",
  mapGameplay: "WF_BO_GET_MAP_GAMEPLAY",
} as const;
type WorkflowId = (typeof WORKFLOWS)[keyof typeof WORKFLOWS];

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly kind: "config" | "timeout" | "network" | "http" | "backend" | "format",
    readonly status?: number,
  ) {
    super(message);
  }
}

function config() {
  const base = process.env.O24_API_BASE_URL?.trim();
  if (!base) throw new GatewayError("O24_API_BASE_URL is not set", "config");
  let url: URL;
  try {
    url = new URL("/api/v1/gateway", base);
  } catch {
    throw new GatewayError("O24_API_BASE_URL is not a valid URL", "config");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !loopback && process.env.NODE_ENV === "production") {
    throw new GatewayError("O24_API_BASE_URL must use https in production", "config");
  }
  return {
    url,
    app: process.env.O24_API_APP?.trim() || "BO",
    lang: process.env.O24_API_LANG?.trim() || "vi",
    // Optional service credentials. WF_BO_GET_LIST_CHARACTER currently answers
    // anonymously, so these are only sent when configured.
    token: process.env.O24_API_TOKEN?.trim() || "",
    device: process.env.O24_API_DEVICE_ID?.trim() || "",
    timeoutMs: Number(process.env.O24_API_TIMEOUT_MS) || 8000,
  };
}

/** POST a workflow to the gateway; resolves with `data` or throws GatewayError. */
export async function callWorkflow<T>(workflowid: WorkflowId, fields: Record<string, unknown>): Promise<T> {
  const cfg = config();
  const headers: Record<string, string> = {
    app: cfg.app,
    lang: cfg.lang,
    "content-type": "application/json",
    accept: "application/json",
  };
  if (cfg.token) headers.uid = cfg.token;
  if (cfg.device) headers.my_device = cfg.device;

  let res: Response;
  try {
    res = await fetch(cfg.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ workflowid, fields }),
      signal: AbortSignal.timeout(cfg.timeoutMs),
      cache: "no-store",
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new GatewayError(`gateway timed out after ${cfg.timeoutMs}ms`, "timeout");
    }
    throw new GatewayError(`gateway unreachable: ${e instanceof Error ? e.message : String(e)}`, "network");
  }

  if (!res.ok) throw new GatewayError(`gateway HTTP ${res.status}`, "http", res.status);

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new GatewayError("gateway returned non-JSON", "format");
  }
  const env = body as Partial<GatewayResponse<T>>;
  if (typeof env !== "object" || env === null || typeof env.success !== "boolean") {
    throw new GatewayError("gateway envelope missing `success`", "format");
  }
  if (!env.success) {
    throw new GatewayError(`workflow failed: ${env.code ?? "?"} ${env.message ?? ""}`.trim(), "backend");
  }
  if (env.data == null) throw new GatewayError("workflow returned no data", "format");
  return env.data;
}
