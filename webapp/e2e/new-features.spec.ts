/**
 * Section 9: Toast notifications, batch unavailability, 全天 checkbox, export PNG
 */
import { test, expect, signIn, ensurePublishedSchedule } from "./fixtures";

test.describe.serial("Toast + Batch Unavailability + Export", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("http://localhost:5173/schedule");
    await signIn(page, "manager@brightah50.com");
    await ensurePublishedSchedule(page);
    await page.close();
  });

  // ── 9-1: Toast appears on schedule actions ─────────────────────────────────
  test("9-1: Toast 顯示「班表已發布 / 取消發布」", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");
    // Wait for schedule to load
    await page.locator('button:has-text("取消發布")').waitFor({ timeout: 10_000 });
    // Unpublish
    await page.locator('button:has-text("取消發布")').click();
    await expect(page.locator(".toast")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(".toast")).toContainText("取消發布");
    // Re-publish
    await page.locator("button").filter({ hasText: "發布", hasNotText: "取消" }).click();
    await expect(page.locator(".toast").last()).toContainText("已發布");
  });

  // ── 9-2: Toast appears on admin actions ────────────────────────────────────
  test("9-2: Admin 新增員工顯示 Toast", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");
    await page.goto("/admin");
    // Fill add form
    await page.locator('input[placeholder="Email"]').fill("toast-test@brightah50.com");
    await page.locator('input[placeholder="姓名"]').fill("Toast 測試");
    await page.locator('button[type="submit"]:has-text("新增")').click();
    await expect(page.locator(".toast")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(".toast")).toContainText("已新增員工");
    // Clean up — delete the user
    const row = page.locator("tr", { hasText: "toast-test@brightah50.com" });
    await row.locator('button:has-text("刪除")').click();
    page.once("dialog", (d) => d.accept());
    await row.locator('button:has-text("刪除")').click();
  });

  // ── 9-3: Batch unavailability — date range ─────────────────────────────────
  test("9-3: 批次提報不可上班（起始+結束日期）", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");
    await page.locator("text=提報不可上班時間").scrollIntoViewIfNeeded();
    const panel = page.locator("text=提報不可上班時間").locator("..");

    // Select start date (15th)
    const selects = panel.locator("select");
    // selects: year, month, start date, end date
    await selects.nth(2).selectOption("2026-05-20");
    // Select end date (22nd) — 3 days
    await selects.nth(3).selectOption("2026-05-22");
    // Check morning slot
    await panel.locator("label:has-text('早班') input[type='checkbox']").check();
    // Submit
    await panel.locator('button:has-text("提交")').click();
    // Toast should say 3 days
    await expect(page.locator(".toast")).toContainText("3 天");
  });

  // ── 9-4: 全天 checkbox selects all slots ───────────────────────────────────
  test("9-4: 全天 checkbox 勾選所有時段", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");
    await page.locator("text=提報不可上班時間").scrollIntoViewIfNeeded();
    const panel = page.locator("text=提報不可上班時間").locator("..");

    // Check 全天
    await panel.locator("label:has-text('全天') input[type='checkbox']").check();
    // All 3 slots should be checked
    const morning = panel.locator("label:has-text('早班') input[type='checkbox']");
    const afternoon = panel.locator("label:has-text('中班') input[type='checkbox']");
    const evening = panel.locator("label:has-text('晚班') input[type='checkbox']");
    await expect(morning).toBeChecked();
    await expect(afternoon).toBeChecked();
    await expect(evening).toBeChecked();

    // Uncheck 全天 should uncheck all
    await panel.locator("label:has-text('全天') input[type='checkbox']").uncheck();
    await expect(morning).not.toBeChecked();
    await expect(afternoon).not.toBeChecked();
    await expect(evening).not.toBeChecked();
  });

  // ── 9-5: 全天 display in table ─────────────────────────────────────────────
  test("9-5: 已提報全天顯示「全天」文字", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");
    // The entries created in 9-3 were morning only, but check table for 全天
    // Create a full-day entry
    await page.locator("text=提報不可上班時間").scrollIntoViewIfNeeded();
    const panel = page.locator("text=提報不可上班時間").locator("..");
    const selects = panel.locator("select");
    await selects.nth(2).selectOption("2026-05-25");
    await panel.locator("label:has-text('全天') input[type='checkbox']").check();
    await panel.locator('button:has-text("提交")').click();
    await expect(page.locator(".toast")).toBeVisible({ timeout: 5_000 });
    // Check the table shows 全天
    await expect(panel.locator("td:has-text('全天')")).toBeVisible({ timeout: 5_000 });
  });

  // ── 9-6: Export PNG button visible ─────────────────────────────────────────
  test("9-6: 匯出 PNG 按鈕可見", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");
    await page.locator("table").waitFor({ timeout: 10_000 });
    await expect(page.locator('button:has-text("匯出 PNG")')).toBeVisible();
  });
});
