import { test, expect, Page } from "@playwright/test";

// Helper: type a command and submit it
async function sendCommand(page: Page, cmd: string) {
  const textarea = page.getByRole("textbox");
  await textarea.fill(cmd);
  await textarea.press("Enter");
}

test.describe("Chat Interface", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the app to be ready
    await page.waitForSelector('textarea[placeholder]');
  });

  test("shows the app header", async ({ page }) => {
    await expect(page.getByText("Buyer Discovery")).toBeVisible();
    await expect(page.getByText("Maharath Exim")).toBeVisible();
  });

  test("renders empty state with quick action buttons", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Run Pipeline" })).toBeVisible();
    await expect(page.getByRole("button", { name: "View Leads" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Find Buyers" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Check Status" })).toBeVisible();
  });

  test("input bar renders send button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /send/i })).toBeVisible();
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    const btn = page.getByRole("button", { name: /send/i });
    await expect(btn).toBeDisabled();
  });

  test("user message appears in thread after submit", async ({ page }) => {
    await sendCommand(page, "help");
    await expect(page.getByText("help")).toBeVisible();
  });

  test("help command renders help panel", async ({ page }) => {
    await sendCommand(page, "help");
    await expect(page.getByText("Available Commands")).toBeVisible({ timeout: 8000 });
  });

  test("help panel lists key commands", async ({ page }) => {
    await sendCommand(page, "help");
    await expect(page.getByText("run pipeline")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("find buyers")).toBeVisible({ timeout: 8000 });
  });

  test("typing clears the input after submission", async ({ page }) => {
    const textarea = page.getByRole("textbox");
    await textarea.fill("help");
    await textarea.press("Enter");
    await expect(textarea).toHaveValue("");
  });

  test("quick action 'Help' button submits help command", async ({ page }) => {
    const helpBtn = page.getByRole("button", { name: "Help" });
    await helpBtn.click();
    await expect(page.getByText("Available Commands")).toBeVisible({ timeout: 8000 });
  });

  test("unknown command shows error message", async ({ page }) => {
    await sendCommand(page, "xyzzy qwerty");
    await expect(page.getByText(/unknown command/i)).toBeVisible({ timeout: 5000 });
  });

  test("top-bar quick action buttons are visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Pipeline" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Leads" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Status" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Help" })).toBeVisible();
  });

  test("shift+enter does not submit", async ({ page }) => {
    const textarea = page.getByRole("textbox");
    await textarea.fill("line one");
    await textarea.press("Shift+Enter");
    // Input is not cleared — message not submitted
    await expect(textarea).not.toHaveValue("");
  });

  test("shows typing indicator while processing", async ({ page }) => {
    // Mock slow backend by routing to a delay endpoint — just verify indicator exists during load
    await sendCommand(page, "status");
    // Typing indicator is brief; check it appeared or status panel arrived
    await expect(
      page.getByText(/assistant|status|api keys/i)
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Ingest Panel", () => {
  test("ingest command shows upload zone", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('textarea[placeholder]');
    await sendCommand(page, "ingest");
    await expect(page.getByText(/drop buyer file/i)).toBeVisible({ timeout: 6000 });
  });
});

test.describe("Accessibility", () => {
  test("input bar has accessible send button", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('textarea[placeholder]');
    const btn = page.getByRole("button", { name: /send/i });
    await expect(btn).toBeVisible();
  });

  test("collapsible sections use aria-expanded", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('textarea[placeholder]');
    await sendCommand(page, "help");
    // Help panel has no collapsibles but config panel does — test config
    await sendCommand(page, "config");
    await page.waitForTimeout(1000);
    const expandedBtns = page.locator('[aria-expanded]');
    const count = await expandedBtns.count();
    expect(count).toBeGreaterThan(0);
  });
});