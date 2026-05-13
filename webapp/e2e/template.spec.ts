/**
 * Section 8: Weekly Template Management (8-1 ~ 8-5)
 * Prerequisites: manager logged in.
 */
import { test, expect, signIn } from "./fixtures";

test.describe.serial("週班表模板管理", () => {
  // ── 8-1: Manager can navigate to template page ─────────────────────────
  test("8-1: 管理員可進入模板管理頁面", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");

    await page.locator("a:has-text('班表模板')").click();
    await page.waitForURL("**/templates", { timeout: 8_000 });

    await expect(
      page.locator("button:has-text('＋ 新增模板')"),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── 8-2: Manager can create a template ────────────────────────────────
  test("8-2: 管理員可建立新模板並儲存", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");
    await page.goto("/templates");

    // Fill in template name
    await page
      .locator("input[placeholder*='模板名稱']")
      .fill("E2E 測試模板");

    // Save the template
    await page.locator("button:has-text('儲存')").click();

    // Template should appear in the sidebar list
    await expect(
      page.locator("div:has-text('E2E 測試模板')").first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── 8-3: Manager can assign staff to a template cell ──────────────────
  test("8-3: 管理員可在模板格子中指派員工", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");
    await page.goto("/templates");

    // Click the template we just created
    await page.locator("div:has-text('E2E 測試模板')").first().click();

    // Click on the 週一 morning cell (second column, first data row)
    const morningRow = page.locator("table tbody tr").first();
    const mondayCell = morningRow.locator("td").nth(2); // 日=1, 一=2 (0-indexed)
    await mondayCell.click();

    // Wait for the popover to appear and check a staff checkbox
    const popover = page.locator("div.popover").first();
    await expect(popover).toBeVisible({ timeout: 3_000 });

    // Check the first available staff member
    const firstCheckbox = popover.locator("input[type='checkbox']").first();
    if (await firstCheckbox.isVisible()) {
      await firstCheckbox.check();
    }

    // Close popover and save
    await page.keyboard.press("Escape");
    await page.locator("button:has-text('儲存')").click();

    // Expect the cell to now show a name chip
    await expect(
      mondayCell.locator("div[style*='var(--color-primary-light)']").first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── 8-4: Manager can apply template to a month ────────────────────────
  test("8-4: 管理員可從排班頁套用模板", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");

    // Ensure 2026-05 exists (may already exist from earlier tests)
    await page.selectOption("select:first-of-type", "2026");
    await page.locator("select").nth(1).selectOption("5");

    // Click "套用模板" button
    await page.locator("button:has-text('套用模板')").click();

    // Modal should appear
    await expect(
      page.locator("h3:has-text('套用週班表模板')"),
    ).toBeVisible({ timeout: 5_000 });

    // Wait for templates to load in the modal select
    await expect(
      page.locator("option:has-text('E2E 測試模板')")
    ).toBeAttached({ timeout: 8_000 });

    // Select the template we created
    await page.locator("select").last().selectOption({ label: "E2E 測試模板" });

    // Confirm apply
    await page.locator("button:has-text('確認套用')").click();

    // Modal closes; success message should be visible in MonthControls
    await expect(
      page.locator("span:has-text('模板套用完成')"),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── 8-5: Staff cannot access template page ────────────────────────────
  test("8-5: 一般員工無法訪問模板管理頁面", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");

    // Staff should not see the "班表模板" nav link
    await expect(
      page.locator("a:has-text('班表模板')"),
    ).not.toBeVisible();

    // Navigating directly should redirect away (ProtectedRoute)
    await page.goto("/templates");
    // Should be redirected to /schedule or /login
    await expect(page).not.toHaveURL(/\/templates/, { timeout: 5_000 });
  });
});
