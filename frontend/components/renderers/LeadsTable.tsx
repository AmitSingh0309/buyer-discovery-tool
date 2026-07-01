"use client";
import { useMemo, useState } from "react";
import type { Lead } from "@/lib/types";
import { ScoreBadge, EmailStatusBadge, NeedsEnrichmentBadge } from "./Badge";
import DraftEmailCard from "./DraftEmailCard";
import { exportLeadsCsvUrl } from "@/lib/api";

interface Props {
  leads: Lead[];
}

type SortKey = "fit_score" | "company_name" | "country" | "buyer_type";

export default function LeadsTable({ leads }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("fit_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterText, setFilterText] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const sorted = useMemo(() => {
    let arr = leads.filter((l) => {
      if (minScore && Number(l.fit_score) < minScore) return false;
      if (filterText) {
        const t = filterText.toLowerCase();
        return (
          l.company_name.toLowerCase().includes(t) ||
          l.country.toLowerCase().includes(t) ||
          l.buyer_type.toLowerCase().includes(t)
        );
      }
      return true;
    });
    arr = [...arr].sort((a, b) => {
      let av: string | number = a[sortKey];
      let bv: string | number = b[sortKey];
      if (sortKey === "fit_score") { av = Number(av); bv = Number(bv); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [leads, sortKey, sortDir, filterText, minScore]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageSlice = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const flagged = leads.filter((l) => l.compliance_flag).length;
  const verifiable = leads.filter((l) => l.needs_enrichment === "VERIFY").length;
  const noEmail = leads.filter((l) => l.needs_enrichment === "YES").length;

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setPage(0), setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); setPage(0); }
  };

  const SortArrow = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      <span style={{ marginLeft: 3 }}>{sortDir === "asc" ? "↑" : "↓"}</span>
    ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Summary strip */}
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "10px 14px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 12,
          flexWrap: "wrap",
        }}
      >
        <Stat label="Total" value={leads.length} />
        <Stat label="Shown" value={sorted.length} />
        <Stat label="Compliance flags" value={flagged} color={flagged > 0 ? "var(--warning)" : undefined} />
        <Stat label="Verify email" value={verifiable} color={verifiable > 0 ? "var(--warning)" : undefined} />
        <Stat label="Need email" value={noEmail} color={noEmail > 0 ? "var(--error)" : undefined} />
        <div style={{ marginLeft: "auto" }}>
          <a
            href={exportLeadsCsvUrl()}
            download="qualified_leads.csv"
            style={{
              fontSize: 12,
              color: "var(--accent)",
              textDecoration: "none",
              padding: "4px 10px",
              border: "1px solid var(--accent)",
              borderRadius: 6,
            }}
          >
            ↓ Export CSV
          </a>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          placeholder="Filter by company, country, type…"
          value={filterText}
          onChange={(e) => { setFilterText(e.target.value); setPage(0); }}
          style={{
            flex: 1,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "6px 10px",
            color: "var(--text-primary)",
            fontSize: 13,
            outline: "none",
          }}
        />
        <label style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          Min score:&nbsp;
          <input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => { setMinScore(Number(e.target.value)); setPage(0); }}
            style={{
              width: 52,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "4px 6px",
              color: "var(--text-primary)",
              fontSize: 12,
              outline: "none",
            }}
          />
        </label>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
        <table>
          <thead>
            <tr>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("fit_score")}>
                Score <SortArrow k="fit_score" />
              </th>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("company_name")}>
                Company <SortArrow k="company_name" />
              </th>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("country")}>
                Country <SortArrow k="country" />
              </th>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("buyer_type")}>
                Type <SortArrow k="buyer_type" />
              </th>
              <th>Email</th>
              <th>Status</th>
              <th>Enrichment</th>
              <th>Draft</th>
            </tr>
          </thead>
          <tbody>
            {pageSlice.map((lead, i) => (
              <LeadRow
                key={`${lead.company_name}-${i}`}
                lead={lead}
                onClick={() => setSelectedLead(lead === selectedLead ? null : lead)}
                selected={selectedLead === lead}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
          <PaginationBtn disabled={page === 0} onClick={() => setPage(0)}>«</PaginationBtn>
          <PaginationBtn disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</PaginationBtn>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Page {page + 1} of {pages}
          </span>
          <PaginationBtn disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>›</PaginationBtn>
          <PaginationBtn disabled={page >= pages - 1} onClick={() => setPage(pages - 1)}>»</PaginationBtn>
        </div>
      )}

      {/* Draft email slide-out */}
      {selectedLead && (
        <div className="animate-fade-in">
          <DraftEmailCard lead={selectedLead} onClose={() => setSelectedLead(null)} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <span>
      <span style={{ color: "var(--text-muted)" }}>{label}: </span>
      <span style={{ fontWeight: 600, color: color || "var(--text-primary)" }}>{value}</span>
    </span>
  );
}

function LeadRow({
  lead,
  onClick,
  selected,
}: {
  lead: Lead;
  onClick: () => void;
  selected: boolean;
}) {
  const score = Number(lead.fit_score);
  const hasFlag = Boolean(lead.compliance_flag);

  return (
    <tr
      onClick={onClick}
      style={{
        cursor: "pointer",
        background: selected ? "var(--surface-2)" : undefined,
        outline: selected ? "1px inset var(--accent)" : undefined,
      }}
    >
      <td style={{ width: 60 }}>
        <ScoreBadge score={score} />
      </td>
      <td>
        <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>
          {lead.company_name}
        </div>
        {lead.contact_name && (
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{lead.contact_name}</div>
        )}
      </td>
      <td style={{ color: "var(--text-secondary)" }}>
        {lead.country}
        {lead.city ? ` · ${lead.city}` : ""}
      </td>
      <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{lead.buyer_type}</td>
      <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
        {lead.email ? (
          <a
            href={`mailto:${lead.email}`}
            onClick={(e) => e.stopPropagation()}
            style={{ color: "var(--accent)", fontSize: 12 }}
          >
            {lead.email}
          </a>
        ) : lead.email_guess ? (
          <span style={{ color: "var(--warning)", fontSize: 12 }} title="Unverified guess">
            ⚠ {lead.email_guess}
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
        )}
      </td>
      <td><EmailStatusBadge status={lead.email_status} /></td>
      <td><NeedsEnrichmentBadge value={lead.needs_enrichment} /></td>
      <td>
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          style={{
            fontSize: 11,
            color: "var(--accent)",
            background: "transparent",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: "2px 8px",
            cursor: "pointer",
          }}
        >
          {selected ? "Hide" : "Draft"}
        </button>
      </td>
    </tr>
  );
}

function PaginationBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        color: disabled ? "var(--text-muted)" : "var(--text-primary)",
        borderRadius: 4,
        padding: "3px 9px",
        cursor: disabled ? "default" : "pointer",
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}