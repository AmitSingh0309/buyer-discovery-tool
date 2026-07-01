import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import CollapsibleSection from "@/components/renderers/CollapsibleSection";

describe("CollapsibleSection", () => {
  it("renders title", () => {
    render(<CollapsibleSection title="Test Section">Content</CollapsibleSection>);
    expect(screen.getByText("Test Section")).toBeTruthy();
  });

  it("is closed by default", () => {
    render(<CollapsibleSection title="Section">Hidden content</CollapsibleSection>);
    expect(screen.queryByText("Hidden content")).toBeNull();
  });

  it("opens when clicked", () => {
    render(<CollapsibleSection title="Section">Hidden content</CollapsibleSection>);
    fireEvent.click(screen.getByText("Section"));
    expect(screen.getByText("Hidden content")).toBeTruthy();
  });

  it("closes after second click", () => {
    render(<CollapsibleSection title="Section">Content</CollapsibleSection>);
    const btn = screen.getByText("Section");
    fireEvent.click(btn);
    expect(screen.getByText("Content")).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.queryByText("Content")).toBeNull();
  });

  it("can start open with defaultOpen", () => {
    render(
      <CollapsibleSection title="Open Section" defaultOpen>
        Visible content
      </CollapsibleSection>
    );
    expect(screen.getByText("Visible content")).toBeTruthy();
  });

  it("sets aria-expanded correctly", () => {
    render(<CollapsibleSection title="Section">Content</CollapsibleSection>);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });
});