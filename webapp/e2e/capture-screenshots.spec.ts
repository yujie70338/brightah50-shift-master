/**
 * capture-screenshots.spec.ts
 *
 * Playwright 腳本：自動截取主要頁面截圖，供操作手冊使用。
 * 截圖存至 docs/images/。
 *
 * 使用方式：
 *   cd webapp
 *   npx playwright test --config screenshot.config.ts
 *
 * 重點：必須先 signIn 再 navigate，否則 ProtectedRoute 會導向 /login。
 */

import * as path from "path";
import { fileURLToPath } from "url";
import { test, type Page } from "@playwright/test";
import { signIn, signOut } from "./fixtures";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, "../../docs/images");

async function screenshot(page: Page, filename: string) {
  await page.screenshot({
    path: path.join(OUT_DIR, filename),
    fullPage: false,
  });
  console.log(`  📸 ${filename}`);
}

/** Sign in as manager and go to /schedule, then ensure 2026-05 exists. */
async function managerScheduleSetup(page: Page) {
  await page.goto("/schedule");
  await signIn(page, "manager@brightah50.com");
  // Ensure month 2026-05
  await page.selectOption("select:first-of-type", "2026");
  await page.locator("select").nth(1).selectOption("5");
  await page.waitForTimeout(500);
  const createBtn = page.locator('button:has-text("建立新月份")');
  if (await createBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await createBtn.click();
    await page.waitForSelector("table", { timeout: 10_000 });
  } else {
    await page.waitForSelector("table", { timeout: 5_000 });
  }
}

// ────────────────────────────────────────────────────────────────
// 1. Login page (no auth needed)
// ────────────────────────────────────────────────────────────────
test("截圖 01：登入頁面", async ({ page }) => {
  await page.goto("/login");
  await page.waitForTimeout(1_500);
  await screenshot(page, "01-login.png");
});

// ────────────────────────────────────────────────────────────────
// 2. Schedule page – manager view (blank month)
// ────────────────────────────────────────────────────────────────
test("截圖 02：排班表（管理者，空白月份）", async ({ page }) => {
  await managerScheduleSetup(page);
  await screenshot(page, "02-schedule-empty.png");
});

// ────────────────────────────────────────────────────────────────
// 3. QuickAssign popover
// ────────────────────────────────────────────────────────────────
test("截圖 03：快速指派 Popover", async ({ page }) => {
  await managerScheduleSetup(page);
  // Click first shift cell (first row, morning column = td index 1)
  const firstShiftCell = page.locator("table tbody tr").first().locator("td").nth(1);
  await firstShiftCell.click();
  await page.waitForTimeout(600);
  await screenshot(page, "03-quick-assign-popover.png");
  await page.keyboard.press("Escape");
});

// ────────────────────────────────────────────────────────────────
// 4. Schedule page – with some staff assigned
// ────────────────────────────────────────────────────────────────
test("截圖 04：排班表（已指派員工）", async ({ page }) => {
  await managerScheduleSetup(page);
  // Open popover on first row morning cell
  const firstShiftCell = page.locator("table tbody tr").first().locator("td").nth(1);
  await firstShiftCell.click();
  await page.waitForTimeout(500);
  // Click first checkbox to assign
  const checkbox = page.locator('input[type="checkbox"]').first();
  if (await checkbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await checkbox.click({ force: true });
    await page.waitForTimeout(500);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await screenshot(page, "04-schedule-assigned.png");
});

// ────────────────────────────────────────────────────────────────
// 5. Paint (brush) mode — click sidebar employee name
// ────────────────────────────────────────────────────────────────
test("截圖 05：油漆桶模式", async ({ page }) => {
  await managerScheduleSetup(page);
  // The sidebar lists employees in div items. Click "王小明" to enter paint mode.
  // The sidebar header changes to "🖌 王小明" when paint mode is active.
  const staffChip = page.locator("div").filter({ hasText: /^王小明$/ }).first();
  await staffChip.click();
  await page.waitForTimeout(600);
  // Verify paint mode is active by checking for the 🖌 indicator
  await page.waitForSelector('text=🖌', { timeout: 3_000 }).catch(() => {});
  await screenshot(page, "05-paint-mode.png");
  await page.keyboard.press("Escape");
});

// ────────────────────────────────────────────────────────────────
// 6. Admin page — sign in first, THEN navigate
// ────────────────────────────────────────────────────────────────
test("截圖 06：管理後台（員工列表）", async ({ page }) => {
  await page.goto("/schedule");
  await signIn(page, "manager@brightah50.com");
  await page.goto("/admin");
  await page.waitForSelector('text=成員列表', { timeout: 8_000 });
  await page.waitForTimeout(800);
  await screenshot(page, "06-admin-page.png");
});

// ────────────────────────────────────────────────────────────────
// 7. Template page — sign in first, THEN navigate
// ────────────────────────────────────────────────────────────────
test("截圖 07：週班表模板", async ({ page }) => {
  await page.goto("/schedule");
  await signIn(page, "manager@brightah50.com");
  await page.goto("/templates");
  await page.waitForSelector('text=新增模板', { timeout: 8_000 });
  await page.waitForTimeout(800);
  await screenshot(page, "07-template-page.png");
});

// ────────────────────────────────────────────────────────────────
// 8. Apply template modal (opened from schedule page)
// ────────────────────────────────────────────────────────────────
test("截圖 08：套用模板 Modal", async ({ page }) => {
  await managerScheduleSetup(page);
  const applyBtn = page.locator('button:has-text("套用模板")');
  await applyBtn.click();
  await page.waitForSelector('text=套用週班表模板', { timeout: 5_000 });
  await page.waitForTimeout(600);
  await screenshot(page, "08-apply-template-modal.png");
  await page.keyboard.press("Escape");
});

// ────────────────────────────────────────────────────────────────
// 9. Unavailability list – manager view — sign in first, THEN navigate
// ────────────────────────────────────────────────────────────────
test("截圖 09：請假申請列表（管理者）", async ({ page }) => {
  await page.goto("/schedule");
  await signIn(page, "manager@brightah50.com");
  await page.goto("/unavailability");
  await page.waitForSelector('text=請假申請', { timeout: 8_000 });
  await page.waitForTimeout(1_000);
  await screenshot(page, "09-unavailability-manager.png");
});

// ────────────────────────────────────────────────────────────────
// 10. Schedule page – staff view (unavailability panel)
// ────────────────────────────────────────────────────────────────
test("截圖 10：排班表（員工唯讀）+ 提報面板", async ({ page }) => {
  await page.goto("/schedule");
  await signIn(page, "staff1@brightah50.com");
  await page.waitForTimeout(2_000);
  await screenshot(page, "10-schedule-staff.png");
  await signOut(page);
});

// ────────────────────────────────────────────────────────────────
// 11. Unavailability list – staff view — sign in first, THEN navigate
// ────────────────────────────────────────────────────────────────
test("截圖 11：請假申請列表（員工）", async ({ page }) => {
  await page.goto("/schedule");
  await signIn(page, "staff1@brightah50.com");
  await page.goto("/unavailability");
  await page.waitForSelector('text=請假申請', { timeout: 8_000 });
  await page.waitForTimeout(1_000);
  await screenshot(page, "11-unavailability-staff.png");
  await signOut(page);
});
