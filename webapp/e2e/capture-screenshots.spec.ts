/**
 * capture-screenshots.ts
 *
 * Playwright 腳本：自動截取主要頁面截圖，供操作手冊使用。
 * 截圖存至 docs/images/。
 *
 * 執行前提：
 *   1. Firebase emulator 已啟動（./dev-start.sh）
 *   2. Vite dev server 已啟動（cd webapp && npm run dev）
 *      或使用 `npx playwright test e2e/capture-screenshots.ts`（會自動啟動 Vite）
 *
 * 使用方式：
 *   cd webapp
 *   npx playwright test e2e/capture-screenshots.ts --reporter=list
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

async function ensureMonth(page: Page, year: string, month: string) {
  await page.selectOption("select:first-of-type", year);
  await page.locator("select").nth(1).selectOption(month);
  await page.waitForTimeout(500);
  // Create if not exists
  const createBtn = page.locator(
    'button:has-text("建立新月份"), button:has-text("建立空白月份")'
  );
  if (await createBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await createBtn.first().click();
    await page.waitForSelector("table", { timeout: 10_000 });
  } else {
    await page.waitForSelector("table", { timeout: 5_000 });
  }
}

// ────────────────────────────────────────────────────────────────
// 1. Login page
// ────────────────────────────────────────────────────────────────
test("截圖 01：登入頁面", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await screenshot(page, "01-login.png");
});

// ────────────────────────────────────────────────────────────────
// 2. Schedule page – manager view (empty month just created)
// ────────────────────────────────────────────────────────────────
test("截圖 02：排班表（管理者，空白月份）", async ({ page }) => {
  await page.goto("/schedule");
  await signIn(page, "manager@brightah50.com");
  await ensureMonth(page, "2026", "5");
  await screenshot(page, "02-schedule-empty.png");
});

// ────────────────────────────────────────────────────────────────
// 3. QuickAssign popover
// ────────────────────────────────────────────────────────────────
test("截圖 03：快速指派 Popover", async ({ page }) => {
  await page.goto("/schedule");
  await signIn(page, "manager@brightah50.com");
  await ensureMonth(page, "2026", "5");

  // Click the first morning slot cell (+ icon)
  const plusCells = page.locator('td[style*="cursor"], td span:has-text("+")');
  const firstCell = plusCells.first();
  if (await firstCell.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await firstCell.click();
  } else {
    // Fallback: click first td in first body row that looks like a shift cell
    await page.locator("table tbody tr").first().locator("td").nth(2).click();
  }
  await page.waitForTimeout(600);
  await screenshot(page, "03-quick-assign-popover.png");
  // Close popover
  await page.keyboard.press("Escape");
});

// ────────────────────────────────────────────────────────────────
// 4. Schedule page – with staff assigned (manager view)
// ────────────────────────────────────────────────────────────────
test("截圖 04：排班表（已指派員工）", async ({ page }) => {
  await page.goto("/schedule");
  await signIn(page, "manager@brightah50.com");
  await ensureMonth(page, "2026", "5");

  // Open popover on first row first shift and assign first staff
  const firstBodyRow = page.locator("table tbody tr").first();
  await firstBodyRow.locator("td").nth(2).click();
  await page.waitForTimeout(500);

  const firstCheckbox = page
    .locator('[role="dialog"], .popover, [style*="position: absolute"]')
    .locator('input[type="checkbox"]')
    .first();
  if (await firstCheckbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await firstCheckbox.click({ force: true });
    await page.waitForTimeout(500);
  }
  // Close popover
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await screenshot(page, "04-schedule-assigned.png");
});

// ────────────────────────────────────────────────────────────────
// 5. Paint (brush) mode
// ────────────────────────────────────────────────────────────────
test("截圖 05：油漆桶模式", async ({ page }) => {
  await page.goto("/schedule");
  await signIn(page, "manager@brightah50.com");
  await ensureMonth(page, "2026", "5");

  // Click the first active staff chip in the sidebar
  const sidebarStaff = page
    .locator("aside, [data-testid='sidebar']")
    .locator("div, span")
    .filter({ hasText: "王小明" })
    .first();
  if (await sidebarStaff.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await sidebarStaff.click();
    await page.waitForTimeout(600);
  }
  await screenshot(page, "05-paint-mode.png");
  await page.keyboard.press("Escape");
});

// ────────────────────────────────────────────────────────────────
// 6. Admin page
// ────────────────────────────────────────────────────────────────
test("截圖 06：管理後台（員工列表）", async ({ page }) => {
  await page.goto("/admin");
  await signIn(page, "manager@brightah50.com");
  await page.waitForTimeout(2_000);
  await screenshot(page, "06-admin-page.png");
});

// ────────────────────────────────────────────────────────────────
// 7. Template page
// ────────────────────────────────────────────────────────────────
test("截圖 07：週班表模板", async ({ page }) => {
  await page.goto("/templates");
  await signIn(page, "manager@brightah50.com");
  await page.waitForTimeout(2_000);
  await screenshot(page, "07-template-page.png");
});

// ────────────────────────────────────────────────────────────────
// 8. Apply template modal
// ────────────────────────────────────────────────────────────────
test("截圖 08：套用模板 Modal", async ({ page }) => {
  await page.goto("/schedule");
  await signIn(page, "manager@brightah50.com");
  await ensureMonth(page, "2026", "5");

  const applyBtn = page.locator(
    'button:has-text("套用模板"), button:has-text("套用週模板")'
  );
  if (await applyBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await applyBtn.first().click();
    await page.waitForTimeout(600);
    await screenshot(page, "08-apply-template-modal.png");
    await page.keyboard.press("Escape");
  } else {
    console.log("  ⚠ 套用模板按鈕未找到，略過截圖 08");
  }
});

// ────────────────────────────────────────────────────────────────
// 9. Unavailability list – manager view (all staff)
// ────────────────────────────────────────────────────────────────
test("截圖 09：請假申請列表（管理者）", async ({ page }) => {
  await page.goto("/unavailability");
  await signIn(page, "manager@brightah50.com");
  await page.waitForTimeout(1_500);
  await screenshot(page, "09-unavailability-manager.png");
});

// ────────────────────────────────────────────────────────────────
// 10. Schedule page – staff view (read-only + unavailability panel)
// ────────────────────────────────────────────────────────────────
test("截圖 10：排班表（員工唯讀）+ 提報面板", async ({ page }) => {
  await page.goto("/schedule");
  await signIn(page, "staff1@brightah50.com");
  await page.waitForTimeout(2_000);
  await screenshot(page, "10-schedule-staff.png");
  await signOut(page);
});

// ────────────────────────────────────────────────────────────────
// 11. Unavailability list – staff view (own records only)
// ────────────────────────────────────────────────────────────────
test("截圖 11：請假申請列表（員工）", async ({ page }) => {
  await page.goto("/unavailability");
  await signIn(page, "staff1@brightah50.com");
  await page.waitForTimeout(1_500);
  await screenshot(page, "11-unavailability-staff.png");
  await signOut(page);
});
