import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DraftEmailCard from "@/components/renderers/DraftEmailCard";
import type { Lead } from "@/lib/types";

const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

const lead: Lead = {
  rank: "1",
  fit_score: "85",
  buyer_type: "Distributor",
  company_name: "ACME GmbH",
  country: "Germany",
  city: "Munich",
  contact_name: "Anna Schmidt",
  contact_title: "CEO",
  email: "anna@acme.de",
  email_status: "provided",
  email_guess: "",
  email_candidates: "",
  mx: "yes",
  phone: "+49 89 1234",
  website: "acme.de",
  website_source: "provided",
  social_url: "",
  needs_enrichment: "",
  compliance_flag: "EU/GDPR: B2B legitimate-interest basis",
  score_reason: "target market, buyer-type",
  draft_subject: "Artisan goods from India — partnership opportunity",
  draft_body: "Dear Anna,\n\nWe manufacture brass...",
  provider_used: "mock",
  source: "test.csv",
};

describe("DraftEmailCard", () => {
  beforeEach(() => { mockWriteText.mockClear(); });

  it("renders company name", () => {
    render(<DraftEmailCard lead={lead} />);
    expect(screen.getByText("ACME GmbH")).toBeTruthy();
  });

  it("renders the draft subject", () => {
    render(<DraftEmailCard lead={lead} />);
    expect(screen.getByText("Artisan goods from India — partnership opportunity")).toBeTruthy();
  });

  it("renders the draft body", () => {
    render(<DraftEmailCard lead={lead} />);
    expect(screen.getByText(/We manufacture brass/)).toBeTruthy();
  });

  it("renders compliance flag", () => {
    render(<DraftEmailCard lead={lead} />);
    expect(screen.getByText(/EU\/GDPR/)).toBeTruthy();
  });

  it("renders contact email", () => {
    render(<DraftEmailCard lead={lead} />);
    expect(screen.getByText("anna@acme.de")).toBeTruthy();
  });

  it("copies email to clipboard on click", async () => {
    render(<DraftEmailCard lead={lead} />);
    const copyBtn = screen.getByRole("button", { name: /copy email/i });
    fireEvent.click(copyBtn);
    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining("Artisan goods from India")
    );
  });

  it("toggles edit mode", () => {
    render(<DraftEmailCard lead={lead} />);
    const editBtn = screen.getByRole("button", { name: /edit draft/i });
    fireEvent.click(editBtn);
    // In edit mode, textarea appears
    const textareas = document.querySelectorAll("textarea");
    expect(textareas.length).toBeGreaterThan(0);
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(<DraftEmailCard lead={lead} onClose={onClose} />);
    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows unverified email warning badge when no confirmed email", () => {
    // Remove compliance_flag so the only ⚠ comes from the guess email row
    const guessLead = {
      ...lead,
      email: "",
      email_guess: "info@acme.de",
      email_status: "candidates_pattern" as const,
      compliance_flag: "",
    };
    render(<DraftEmailCard lead={guessLead} />);
    // The email-guess span contains "⚠ info@acme.de"
    expect(screen.getByText(/⚠\s*info@acme\.de/)).toBeTruthy();
  });
});