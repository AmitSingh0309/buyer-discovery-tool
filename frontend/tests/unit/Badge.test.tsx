import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  Badge,
  ScoreBadge,
  EmailStatusBadge,
  NeedsEnrichmentBadge,
  BandBadge,
} from "@/components/renderers/Badge";

describe("Badge", () => {
  it("renders label text", () => {
    render(<Badge label="Hello" />);
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("applies success variant styles", () => {
    const { container } = render(<Badge label="OK" variant="success" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toBeTruthy();
  });
});

describe("ScoreBadge", () => {
  it("renders the numeric score", () => {
    render(<ScoreBadge score={85} />);
    expect(screen.getByText("85")).toBeTruthy();
  });

  it("applies success variant for score >= 70", () => {
    const { container } = render(<ScoreBadge score={75} />);
    const el = container.firstChild as HTMLElement;
    // success variant uses #22c55e text color
    expect(el.style.color).toBe("rgb(34, 197, 94)");
  });

  it("applies error variant for score < 20", () => {
    const { container } = render(<ScoreBadge score={10} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toBe("rgb(113, 113, 122)"); // muted
  });
});

describe("EmailStatusBadge", () => {
  const cases: Array<[string, string]> = [
    ["provided", "Provided"],
    ["found_on_site", "Scraped"],
    ["found_api", "API"],
    ["candidates_pattern", "Guess"],
    ["found_on_site_unverified", "Unverified"],
    ["no_domain", "No domain"],
    ["unresolved", "Unresolved"],
  ];

  it.each(cases)("renders '%s' as '%s'", (status, expected) => {
    render(<EmailStatusBadge status={status} />);
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it("renders unknown status as-is", () => {
    render(<EmailStatusBadge status="weird_status" />);
    expect(screen.getByText("weird_status")).toBeTruthy();
  });
});

describe("NeedsEnrichmentBadge", () => {
  it("renders Ready for empty string", () => {
    render(<NeedsEnrichmentBadge value="" />);
    expect(screen.getByText("Ready")).toBeTruthy();
  });

  it("renders Verify for VERIFY", () => {
    render(<NeedsEnrichmentBadge value="VERIFY" />);
    expect(screen.getByText("Verify")).toBeTruthy();
  });

  it("renders Needs email for YES", () => {
    render(<NeedsEnrichmentBadge value="YES" />);
    expect(screen.getByText("Needs email")).toBeTruthy();
  });
});

describe("BandBadge", () => {
  it.each(["A", "B", "C", "D"])("renders Band %s", (band) => {
    render(<BandBadge band={band} />);
    expect(screen.getByText(`Band ${band}`)).toBeTruthy();
  });
});