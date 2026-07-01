import type {
  ApiStatus,
  DataFile,
  FinderOptions,
  IngestBatch,
  Lead,
  PipelineOptions,
} from "./types";

// All paths resolve through Next.js rewrites -> Python backend.
const BASE = "/api";

async function req<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  let body = init?.body;
  if (init?.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers, body });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function fetchStatus(): Promise<ApiStatus> {
  return req("/status");
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export function fetchLeads(params?: {
  min_score?: number;
  needs_enrichment?: string;
  buyer_type?: string;
  limit?: number;
}): Promise<{ leads: Lead[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.min_score) qs.set("min_score", String(params.min_score));
  if (params?.needs_enrichment) qs.set("needs_enrichment", params.needs_enrichment);
  if (params?.buyer_type) qs.set("buyer_type", params.buyer_type);
  if (params?.limit) qs.set("limit", String(params.limit));
  return req(`/leads?${qs}`);
}

export function exportLeadsCsvUrl(): string {
  return `${BASE}/leads/export`;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function fetchConfig(): Promise<Record<string, unknown>> {
  return req("/config");
}

export function saveConfig(cfg: Record<string, unknown>): Promise<{ ok: boolean }> {
  return req("/config", { method: "PUT", json: cfg });
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export function fetchFiles(): Promise<{ files: DataFile[] }> {
  return req("/files");
}

export function deleteFile(filename: string): Promise<{ ok: boolean }> {
  return req(`/files/${encodeURIComponent(filename)}`, { method: "DELETE" });
}

export function clearCache(): Promise<{ ok: boolean }> {
  return req("/cache", { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Pipeline  (returns job_id; caller subscribes to SSE stream)
// ---------------------------------------------------------------------------

export async function startPipeline(
  options: Partial<PipelineOptions>
): Promise<{ job_id: string }> {
  return req("/pipeline/run", { method: "POST", json: options });
}

export function pipelineStreamUrl(jobId: string): string {
  return `${BASE}/pipeline/stream/${jobId}`;
}

// ---------------------------------------------------------------------------
// Finder
// ---------------------------------------------------------------------------

export async function startFinder(
  options: Partial<FinderOptions>
): Promise<{ job_id: string }> {
  return req("/finder/run", { method: "POST", json: options });
}

export function finderStreamUrl(jobId: string): string {
  return `${BASE}/finder/stream/${jobId}`;
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

export async function uploadIngest(
  file: File,
  batchSize = 25,
  autoApprove = false
): Promise<IngestBatch> {
  const form = new FormData();
  form.append("file", file);
  form.append("batch_size", String(batchSize));
  form.append("auto_approve", String(autoApprove));
  return req("/ingest", { method: "POST", body: form });
}

export function approveIngestBatch(jobId: string): Promise<IngestBatch> {
  return req(`/ingest/${jobId}/approve`, { method: "POST" });
}

export function abortIngest(jobId: string): Promise<{ ok: boolean }> {
  return req(`/ingest/${jobId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// SSE helper – returns an EventSource-like async iterator
// ---------------------------------------------------------------------------

export type SseEvent = { event: string; data: unknown };

export async function* streamSSE(url: string, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  const res = await fetch(url, { signal });
  if (!res.ok || !res.body) {
    throw new Error(`SSE failed: HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let currentEvent = "message";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const chunk of parts) {
      let event = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) data = line.slice(6);
      }
      currentEvent = event;
      try {
        yield { event: currentEvent, data: JSON.parse(data) };
      } catch {
        yield { event: currentEvent, data };
      }
    }
  }
}