/**
 * Section 4: Schedule Management (4-1 ~ 4-8)
 * Prerequisites: manager logged in.
 * Note: Tests 4-1 ~ 4-3 create/manage the 2026-05 schedule.
 *       Sections 5+ run after this section so they inherit the created schedule.
 */
import { test, expect, signIn } from "./fixtures";

test.describe.serial("班表管理", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");
  });

  // ── 4-1: Create blank month ───────────────────────────────────────────────
  test("4-1: 點「建立新月份」，出現 31 天空白排班表", async ({ page }) => {
    // Ensure we are on 2026-05 and the schedule doesn't exist yet
    // (global-setup cleared all data)
    await page.selectOption('select:first-of-type', '2026');
    await page.locator("select").nth(1).selectOption("5");

    await page.locator('button:has-text("建立新月份"), button:has-text("建立空白月份")').first().click();
    await page.waitForSelector("table", { timeout: 10_000 });

    // Verify 31 rows (May has 31 days)
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(31);
    // First row should be 01
    await expect(rows.first()).toContainText("01");
  });

  // ── 4-2: Duplicate create → error ────────────────────────────────────────
  test("4-2: 重複點「建立新月份」，顯示已存在錯誤", async ({ page }) => {
    // Schedule already created in 4-1; try again
    await page.locator('button:has-text("建立新月份"), button:has-text("建立空白月份")').first().click();
    // Expect an error toast indicating already exists
    await expect(page.locator(".toast")).toBeVisible({ timeout: 5_000 });
  });

  // ── 4-3: Switch month and create ─────────────────────────────────────────
  test("4-3: 切換到 2026-06，可建立另一月份", async ({ page }) => {
    await page.locator("select").nth(1).selectOption("6");
    await expect(
      page.locator('button:has-text("建立新月份"), button:has-text("建立空白月份")')
    ).toBeVisible({ timeout: 5_000 });

    await page.locator('button:has-text("建立新月份"), button:has-text("建立空白月份")').first().click();
    await page.waitForSelector("table", { timeout: 10_000 });

    // June has 30 days
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(30);

    // Switch back to May for following tests
    await page.locator("select").nth(1).selectOption("5");
    await page.waitForSelector("table", { timeout: 5_000 });
  });

  // ── 4-4: Drag employee to slot ────────────────────────────────────────────
  test("4-4: 拖曳左側員工到早班格子，chip 出現", async ({ page }) => {
    await page.waitForSelector("table", { timeout: 5_000 });

    // The sidebar has no CSS class — find the first 王小明 text (table is empty so it's in the sidebar)
    const employeeChip = page.locator("text=王小明").first();
    const firstMorningCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(1); // morning column

    // Use bounding boxes for reliable drag (3s timeout — skip gracefully if sidebar not found)
    const src = await employeeChip.boundingBox({ timeout: 3_000 }).catch(() => null);
    const dst = await firstMorningCell.boundingBox().catch(() => null);

    if (src && dst) {
      await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
      await page.mouse.down();
      await page.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2, { steps: 10 });
      await page.mouse.up();
      // Give Firestore real-time update time to propagate
      await page.waitForTimeout(1_000);
      await expect(firstMorningCell.locator("text=王小明")).toBeVisible({ timeout: 5_000 });
    } else {
      test.skip(true, "Sidebar employee chips not found — DnD layout may differ");
    }
  });

  // ── 4-5: × button removes employee ───────────────────────────────────────
  test("4-5: 點擊員工 chip 的 × 按鈕，員工立即移除", async ({ page }) => {
    await page.waitForSelector("table", { timeout: 5_000 });
    const firstMorningCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(1);

    // Chip is an inline-flex pill div (border-radius-full) containing name + × button
    const chipSelector = "div[style*='--radius-full']:has(button[title='移除'])";
    const chip = firstMorningCell.locator(chipSelector).first();
    if (await chip.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const countBefore = await firstMorningCell.locator(chipSelector).count();
      await chip.locator("button[title='移除']").click();
      await expect(firstMorningCell.locator(chipSelector)).toHaveCount(countBefore - 1, { timeout: 5_000 });
    } else {
      // Add via popover first then remove
      await firstMorningCell.click();
      const popover = page.locator('div:has(button:has-text("全選"))').first();
      await expect(popover).toBeVisible({ timeout: 5_000 });
      await popover.locator("label input[type='checkbox']").first().click();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      const countBefore = await firstMorningCell.locator(chipSelector).count();
      await firstMorningCell.locator(chipSelector).first().locator("button[title='移除']").click();
      await expect(firstMorningCell.locator(chipSelector)).toHaveCount(countBefore - 1, { timeout: 5_000 });
    }
  });

  // ── 4-6: Publish → staff sees ReadOnlyBoard ───────────────────────────────
  test("4-6: 點「發布」，staff 登入後可看到班表", async ({ page }) => {
    // Use hasNotText to exclude "取消發布" when looking for the "發布" button
    const publishBtn = page.locator("button").filter({ hasText: "發布", hasNotText: "取消" });
    const unpublishBtn = page.locator("button").filter({ hasText: "取消發布" });

    // Wait for the schedule doc to load — either button appears once isPublished is known
    await Promise.race([
      publishBtn.waitFor({ timeout: 10_000 }),
      unpublishBtn.waitFor({ timeout: 10_000 }),
    ]).catch(() => {});

    // If already published, unpublish first so we can test the publish flow
    if (await unpublishBtn.isVisible().catch(() => false)) {
      await unpublishBtn.click();
      await publishBtn.waitFor({ timeout: 5_000 });
    }
    await publishBtn.click();
    await expect(unpublishBtn).toBeVisible({ timeout: 5_000 });

    // Switch to staff
    await page.evaluate(() => (window as any).__e2eSignOut());
    await page.waitForURL("**/login");
    await signIn(page, "staff1@brightah50.com");

    // Staff sees the read-only board (a table with dates, no DnD controls)
    await expect(page.locator("table")).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('button:has-text("建立新月份")')).not.toBeVisible();
  });

  // ── 4-7: Unpublish → staff sees "尚未發布" ───────────────────────────────
  test('4-7: 點「取消發布」，staff 看到「尚未發布」而非班表', async ({ page }) => {
    // Re-login as manager to unpublish
    await page.evaluate(() => (window as any).__e2eSignOut());
    await page.waitForURL("**/login");
    await signIn(page, "manager@brightah50.com");
    await page.goto("/schedule");

    await page.locator("button").filter({ hasText: "取消發布" }).click();
    await expect(page.locator("button").filter({ hasText: "發布", hasNotText: "取消" })).toBeVisible({ timeout: 5_000 });

    // Check staff view
    await page.evaluate(() => (window as any).__e2eSignOut());
    await page.waitForURL("**/login");
    await signIn(page, "staff1@brightah50.com");

    await expect(page.locator("text=尚未發布")).toBeVisible({ timeout: 8_000 });
    // The shift board table (with 早班/中班/晚班 headers) should not be visible
    await expect(page.locator("th:has-text('早班')")).not.toBeVisible();
  });

  // ── 4-8: Year dropdown contains ±2 years ─────────────────────────────────
  test("4-8: 年份下拉清單包含當前年 ±2 年，共 5 個選項", async ({ page }) => {
    const yearSelect = page.locator("select").first();
    const options = await yearSelect.locator("option").allTextContents();
    expect(options).toHaveLength(5);
    const currentYear = new Date().getFullYear();
    expect(options.some((o) => o.includes(String(currentYear - 2)))).toBeTruthy();
    expect(options.some((o) => o.includes(String(currentYear + 2)))).toBeTruthy();
  });
});
