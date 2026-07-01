interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "error" | "info" | "muted";
  size?: "sm" | "md";
}

const VARIANT_STYLES: Record<NonNullable<BadgeProps["variant"]>, React.CSSProperties> = {
  default: { background: "#27272a", color: "#a1a1aa", border: "1px solid #3f3f46" },
  success: { background: "#052e16", color: "#22c55e", border: "1px solid #166534" },
  warning: { background: "#1c1400", color: "#eab308", border: "1px solid #713f12" },
  error:   { background: "#1f0f0f", color: "#ef4444", border: "1px solid #7f1d1d" },
  info:    { background: "#0f1f3f", color: "#93c5fd", border: "1px solid #1e3a5f" },
  muted:   { background: "transparent", color: "#71717a", border: "1px solid #27272a" },
};

export function Badge({ label, variant = "default", size = "sm" }: BadgeProps) {
  const style: React.CSSProperties = {
    ...VARIANT_STYLES[variant],
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: size === "sm" ? "1px 8px" : "3px 10px",
    fontSize: size === "sm" ? 11 : 12,
    fontWeight: 500,
    lineHeight: 1.6,
    whiteSpace: "nowrap",
  };
  return <span style={style}>{label}</span>;
}

// Semantic convenience wrappers
export function ScoreBadge({ score }: { score: number }) {
  const variant =
    score >= 70 ? "success" : score >= 45 ? "warning" : score >= 20 ? "error" : "muted";
  return <Badge label={`${score}`} variant={variant} size="md" />;
}

export function EmailStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
    provided:                  { label: "Provided",    variant: "success" },
    found_on_site:             { label: "Scraped",     variant: "success" },
    found_api:                 { label: "API",         variant: "success" },
    candidates_pattern:        { label: "Guess",       variant: "warning" },
    found_on_site_unverified:  { label: "Unverified",  variant: "warning" },
    no_domain:                 { label: "No domain",   variant: "error" },
    unresolved:                { label: "Unresolved",  variant: "error" },
  };
  const info = map[status] || { label: status || "—", variant: "muted" as const };
  return <Badge label={info.label} variant={info.variant} />;
}

export function NeedsEnrichmentBadge({ value }: { value: string }) {
  if (!value) return <Badge label="Ready" variant="success" />;
  if (value === "VERIFY") return <Badge label="Verify" variant="warning" />;
  return <Badge label="Needs email" variant="error" />;
}

export function WebsiteSourceBadge({ source }: { source: string }) {
  const map: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
    provided: { label: "Provided", variant: "success" },
    slug:     { label: "Guessed",  variant: "warning" },
    search:   { label: "Found",    variant: "info" },
    cache:    { label: "Cached",   variant: "info" },
    none:     { label: "None",     variant: "muted" },
  };
  const info = map[source] || { label: source || "—", variant: "muted" as const };
  return <Badge label={info.label} variant={info.variant} />;
}

export function BandBadge({ band }: { band: string }) {
  const map: Record<string, BadgeProps["variant"]> = {
    A: "success", B: "info", C: "warning", D: "error",
  };
  return <Badge label={`Band ${band}`} variant={map[band] || "muted"} />;
}