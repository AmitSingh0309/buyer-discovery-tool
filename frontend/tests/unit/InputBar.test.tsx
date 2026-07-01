import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import InputBar from "@/components/chat/InputBar";

describe("InputBar", () => {
  it("renders the placeholder text", () => {
    render(<InputBar onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText(/type a command/i)).toBeTruthy();
  });

  it("shows 'Processing…' placeholder when disabled", () => {
    render(<InputBar onSubmit={vi.fn()} disabled />);
    expect(screen.getByPlaceholderText(/processing/i)).toBeTruthy();
  });

  it("calls onSubmit when Enter is pressed", async () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "show leads{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("show leads");
  });

  it("does not call onSubmit on Shift+Enter", async () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "hello{Shift>}{Enter}{/Shift}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clears input after submit", async () => {
    render(<InputBar onSubmit={vi.fn()} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    await userEvent.type(textarea, "run pipeline{Enter}");
    expect(textarea.value).toBe("");
  });

  it("does not submit empty input", async () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("send button is disabled when input is empty", () => {
    render(<InputBar onSubmit={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /send/i });
    expect(btn).toBeDisabled();
  });

  it("send button triggers submit", async () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "leads");
    const btn = screen.getByRole("button", { name: /send/i });
    fireEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledWith("leads");
  });
});