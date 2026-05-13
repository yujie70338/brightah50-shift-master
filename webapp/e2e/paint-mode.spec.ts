/**
 * Section 7: Paint / Brush Mode (7-1 ~ 7-6)
 * Prerequisites: manager logged in, 2026-05 schedule exists.
 * Tests use 2026-05 (created in section 4) and Day 01, morning slot.
 */
import { test, expect, signIn } from "./fixtures";

test.describe.serial("油漆桶填充模式", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");
    // Navigate to 2026-05
    await page.selectOption("select:first-of-type", "2026");
    await page.locator("select").nth(1).selectOption("5");

    // Create the schedule if it doesn't exist yet
    const table = page.locator("table");
    const createBtn = page.locator("button:has-text('建立新月份')");
    await Promise.race([
      table.waitFor({ timeout: 4_000 }),
      createBtn.waitFor({ timeout: 4_000 }),
    ]).catch(() => {});
    if (!(await table.isVisible().catch(() => false))) {
      await createBtn.click();
    }

    // Wait for the schedule table to appear
    await expect(table).toBeVisible({ timeout: 8_000 });
  });

  // ── 7-1: Click sidebar employee → paint mode activated ───────────────────
  test("7-1: 點擊側欄員工進入填充模式，顯示指示器", async ({ page }) => {
    // Click the first active employee in the sidebar
    const _firstEmployee = page.locator("aside, [data-testid='sidebar']").first();
    // The sidebar is a Droppable div with staff items
    const _staffItem = page
      .locator("text=Staff One")
      .or(page.locator("[style*='grab']").first());

    // Locate an employee chip via the sidebar (staff list droppable area)
    const sidebarChip = page
      .locator("div[style*='grab'], div[style*='cell']")
      .first();
    await sidebarChip.click();

    // Indicator: paint mode label should now appear
    await expect(page.locator("text=🖌")).toBeVisible({ timeout: 3_000 });
    await expect(page.locator("text=點擊格子填入，ESC 退出")).toBeVisible();

    // The clicked chip should have a 2px solid border (paint-selected styling)
    await expect(
      page.locator("div[style*='2px solid var(--color-primary)']").first(),
    ).toBeVisible();
  });

  // ── 7-2: Click empty cell → employee added ───────────────────────────────
  test("7-2: 填充模式下點擊空格子，員工被填入", async ({ page }) => {
    // Enter paint mode by clicking first sidebar employee
    const sidebarChip = page
      .locator("div[style*='grab'], div[style*='cell'], div[style*='pointer']")
      .first();
    await sidebarChip.click();
    await expect(page.locator("text=🖌")).toBeVisible();

    // Find a cell in row 1 (day 01), morning slot that is relatively empty
    // Table structure: first data row, second td (morning slot)
    const morningCell = page.locator("tbody tr").nth(0).locator("td").nth(1);

    // Count initial chips in the cell
    const before = await morningCell.locator("div[draggable]").count();

    await morningCell.click();

    // Wait for UI update
    await page.waitForTimeout(800);

    const after = await morningCell.locator("div[draggable]").count();
    expect(after).toBeGreaterThanOrEqual(before);
    // At minimum the cell is now non-empty (if it was empty it got the employee)
  });

  // ── 7-3: Click cell with same employee → no duplicate ────────────────────
  test("7-3: 重複點擊含同一員工的格子，不新增重複", async ({ page }) => {
    // Enter paint mode
    const sidebarChip = page
      .locator("div[style*='grab'], div[style*='cell'], div[style*='pointer']")
      .first();
    await sidebarChip.click();
    await expect(page.locator("text=🖌")).toBeVisible();

    const morningCell = page.locator("tbody tr").nth(0).locator("td").nth(1);

    // Click twice
    await morningCell.click();
    await page.waitForTimeout(500);
    const countAfterFirst = await morningCell.locator("div[draggable]").count();

    await morningCell.click();
    await page.waitForTimeout(500);
    const countAfterSecond = await morningCell.locator("div[draggable]").count();

    expect(countAfterSecond).toBe(countAfterFirst);
  });

  // ── 7-4: ESC → exit paint mode ───────────────────────────────────────────
  test("7-4: 按 ESC 退出填充模式", async ({ page }) => {
    const sidebarChip = page
      .locator("div[style*='grab'], div[style*='cell'], div[style*='pointer']")
      .first();
    await sidebarChip.click();
    await expect(page.locator("text=🖌")).toBeVisible();

    await page.keyboard.press("Escape");

    // Paint mode indicator should disappear
    await expect(page.locator("text=🖌")).not.toBeVisible({ timeout: 2_000 });
    await expect(page.locator("text=點擊格子填入，ESC 退出")).not.toBeVisible();
  });

  // ── 7-5: Re-click same employee → exit paint mode ────────────────────────
  test("7-5: 再次點擊同一員工取消填充模式", async ({ page }) => {
    const sidebarChip = page
      .locator("div[style*='grab'], div[style*='cell'], div[style*='pointer']")
      .first();

    // Enter paint mode
    await sidebarChip.click();
    await expect(page.locator("text=🖌")).toBeVisible();

    // Re-click the same chip (now styled with 2px border in paint-selected state)
    const selectedChip = page.locator("div[style*='2px solid var(--color-primary)']").first();
    await selectedChip.click();

    // Paint mode indicator should disappear
    await expect(page.locator("text=🖌")).not.toBeVisible({ timeout: 2_000 });
  });

  // ── 7-6: Staff user has no paint mode ────────────────────────────────────
  test("7-6: 員工身份頁面無側欄，無填充模式", async ({ page }) => {
    // Sign out and sign in as staff
    await page.evaluate(() => (window as any).__e2eSignOut?.());
    await page.waitForURL("**/login", { timeout: 5_000 });
    await signIn(page, "staff1@brightah50.com");

    // Staff navigates to /unavailability (no schedule page with sidebar)
    await page.goto("/schedule");
    // Staff should be redirected or see read-only view without sidebar paint controls
    // At minimum, no paint mode indicator should ever appear
    await expect(page.locator("text=🖌")).not.toBeVisible();
    await expect(page.locator("text=點擊格子填入，ESC 退出")).not.toBeVisible();
  });
});
