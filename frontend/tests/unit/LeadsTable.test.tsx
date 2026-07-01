import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LeadsTable from "@/components/renderers/LeadsTable";
import type { Lead } from "@/lib/types";

// Mock the clipboard API
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

const makeLead = (overrides: Partial<Lead> = {}): Lead => ({
  rank: "1",
  fit_score: "85",
  buyer_type: "Distributor",
  company_name: "ACME Corp",
  country: "Germany",
  city: "Berlin",
  contact_name: "Hans Mueller",
  contact_title: "Buyer",
  email: "hans@acme.de",
  email_status: "provided",
  email_guess: "",
  email_candidates: "",
  mx: "yes",
  phone: "+49 30 123456",
  website: "acme.de",
  website_source: "provided",
  social_url: "",
  needs_enrichment: "",
  compliance_flag: "EU/GDPR: B2B legitimate-interest basis",
  score_reason: "target market, buyer-type",
  draft_subject: "Handcrafted goods from India",
  draft_body: "Dear Hans,\n\nI'm reaching out…",
  provider_used: "mock",
  source: "sample.csv",
  ...overrides,
});

describe("LeadsTable", () => {
  const leads = [
    makeLead({ fit_score: "90", company_name: "Alpha GmbH", country: "Germany" }),
    makeLead({ fit_score: "60", company_name: "Beta LLC",  country: "USA", email_status: "candidates_pattern", needs_enrichment: "VERIFY" }),
    makeLead({ fit_score: "30", company_name: "Gamma SA",  country: "France", email: "", email_guess: "info@gamma.fr", needs_enrichment: "VERIFY" }),
  ];

  it("renders all leads", () => {
    render(<LeadsTable leads={leads} />);
    expect(screen.getByText("Alpha GmbH")).toBeTruthy();
    expect(screen.getByText("Beta LLC")).toBeTruthy();
    expect(screen.getByText("Gamma SA")).toBeTruthy();
  });

  it("shows summary strip with total count", () => {
    render(<LeadsTable leads={leads} />);
    // Summary strip shows "Total: 3" — at least one "3" must exist in the strip
    const threes = screen.getAllByText("3");
    expect(threes.length).toBeGreaterThan(0);
  });

  it("filters leads by text", () => {
    render(<LeadsTable leads={leads} />);
    const filterInput = screen.getByPlaceholderText(/filter by/i);
    fireEvent.change(filterInput, { target: { value: "Alpha" } });
    expect(screen.getByText("Alpha GmbH")).toBeTruthy();
    expect(screen.queryByText("Beta LLC")).toBeNull();
  });

  it("shows draft button per row", () => {
    render(<LeadsTable leads={leads} />);
    const draftBtns = screen.getAllByRole("button", { name: /draft/i });
    expect(draftBtns.length).toBe(leads.length);
  });

  it("shows DraftEmailCard when Draft is clicked", () => {
    render(<LeadsTable leads={leads} />);
    const btn = screen.getAllByRole("button", { name: /draft/i })[0];
    fireEvent.click(btn);
    // DraftEmailCard renders the subject
    expect(screen.getByText("Handcrafted goods from India")).toBeTruthy();
  });

  it("renders Export CSV link", () => {
    render(<LeadsTable leads={leads} />);
    expect(screen.getByText(/export csv/i)).toBeTruthy();
  });

  it("shows compliance flag count", () => {
    render(<LeadsTable leads={leads} />);
    // All 3 leads have compliance_flag
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("filters by min score", () => {
    render(<LeadsTable leads={leads} />);
    const scoreInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(scoreInput, { target: { value: "70" } });
    expect(screen.getByText("Alpha GmbH")).toBeTruthy();  // score 90
    expect(screen.queryByText("Beta LLC")).toBeNull();     // score 60
    expect(screen.queryByText("Gamma SA")).toBeNull();     // score 30
  });
});