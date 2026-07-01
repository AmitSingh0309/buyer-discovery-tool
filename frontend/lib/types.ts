// ---------------------------------------------------------------------------
// Domain types mirroring the Python backend schema
// ---------------------------------------------------------------------------

export type EmailStatus =
  | "provided"
  | "found_on_site"
  | "found_api"
  | "candidates_pattern"
  | "found_on_site_unverified"
  | "no_domain"
  | "unresolved"
  | "";

export type NeedsEnrichment = "YES" | "VERIFY" | "";

export type WebsiteSource = "provided" | "slug" | "search" | "cache" | "none" | "";

export interface Lead {
  rank: string;
  fit_score: string;
  buyer_type: string;
  company_name: string;
  country: string;
  city: string;
  contact_name: string;
  contact_title: string;
  email: string;
  email_status: EmailStatus;
  email_guess: string;
  email_candidates: string;
  mx: string;
  phone: string;
  website: string;
  website_source: WebsiteSource;
  social_url: string;
  needs_enrichment: NeedsEnrichment;
  compliance_flag: string;
  score_reason: string;
  draft_subject: string;
  draft_body: string;
  provider_used: string;
  source: string;
}

export interface ApiStatus {
  keys: Record<string, boolean>;
  key_labels: Record<string, string>;
  leads_count: number;
  data_files: string[];
  cache_entries: number;
  leads_file_exists: boolean;
}

export interface PipelineResult {
  total: number;
  flagged: number;
  needs_email: number;
  needs_verify: number;
  provider_used: string;
}

export interface FinderResult {
  new_buyers: number;
  out_file: string;
}

export interface IngestBatch {
  job_id: string;
  filename: string;
  fmt: string;
  mapping: Record<string, string>;
  total_rows: number;
  n_batches: number;
  current_batch: number;
  batch: IngestRow[];
  done: boolean;
  out_path: string;
}

export interface IngestRow {
  company_name: string;
  country: string;
  city: string;
  email: string;
  website: string;
  contact_name: string;
  score: string;
  band: "A" | "B" | "C" | "D";
  reason: string;
  needs_enrichment: string;
  [key: string]: string;
}

export interface DataFile {
  name: string;
  size: number;
  rows: number;
  mtime: number;
}

// ---------------------------------------------------------------------------
// Chat message types
// ---------------------------------------------------------------------------

export type MessageRole = "user" | "assistant" | "system";

export type MessagePayloadType =
  | "text"
  | "leads_table"
  | "draft_email"
  | "pipeline_progress"
  | "finder_progress"
  | "ingest_batch"
  | "status_panel"
  | "config_panel"
  | "file_list"
  | "help"
  | "error";

export interface MessagePayload {
  type: MessagePayloadType;
  text?: string;
  leads?: Lead[];
  lead?: Lead;
  result?: PipelineResult | FinderResult;
  status?: ApiStatus;
  batch?: IngestBatch;
  files?: DataFile[];
  jobId?: string;
  streamUrl?: string;
  finderStreamUrl?: string;
  onComplete?: (result: PipelineResult | FinderResult) => void;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  timestamp: Date;
  payload: MessagePayload;
}

// ---------------------------------------------------------------------------
// Command types
// ---------------------------------------------------------------------------

export type CommandType =
  | "RUN_PIPELINE"
  | "FIND_BUYERS"
  | "INGEST"
  | "SHOW_LEADS"
  | "STATUS"
  | "CONFIG"
  | "HELP"
  | "CLEAR"
  | "UNKNOWN";

export interface ParsedCommand {
  type: CommandType;
  raw: string;
  args: Record<string, string | number | boolean>;
}

// ---------------------------------------------------------------------------
// Pipeline options
// ---------------------------------------------------------------------------

export interface PipelineOptions {
  provider: "mock" | "groq" | "ollama";
  limit: number;
  no_scrape: boolean;
  no_discover: boolean;
}

export interface FinderOptions {
  provider: "osm" | "google" | "cascade";
  limit_cities: number | null;
}