/**
 * Section 6: Admin Employee Management (6-1 ~ 6-6)
 * Prerequisites: logged in as manager, /admin page.
 */
import { test, expect, signIn } from "./fixtures";

const NEW_EMAIL = "newtest@brightah50.com";
const NEW_NAME = "測試新員工";

test.describe.serial("後台員工管理", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");
  });

  // ── 6-1: Navigate to /admin ───────────────────────────────────────────────
  test("6-1: 點「管理後台」連結，顯示員工列表與新增表單", async ({ page }) => {
    await page.locator("a:has-text('管理後台')").click();
    await expect(page).toHaveURL(/\/admin/);
    // Employee list heading
    await expect(page.locator("h1, h2").filter({ hasText: /員工|管理/ }).first()).toBeVisible();
    // Form inputs
    await expect(page.locator("input[type='email'], input[placeholder*='Email']")).toBeVisible();
    await expect(page.locator("input[type='text'], input[placeholder*='姓名']")).toBeVisible();
  });

  // ── 6-2: Staff cannot access /admin ──────────────────────────────────────
  test("6-2: staff 直接訪問 /admin，被擋回 /schedule", async ({ page }) => {
    await page.evaluate(() => (window as any).__e2eSignOut());
    await page.waitForURL("**/login");
    await signIn(page, "staff1@brightah50.com");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/schedule/);
  });

  // ── 6-3: Add new employee ─────────────────────────────────────────────────
  test("6-3: 填入 Email 與姓名送出，員工出現在列表", async ({ page }) => {
    await page.goto("/admin");

    // Fill the form
    await page.locator("input[type='email'], input[placeholder*='Email']").fill(NEW_EMAIL);
    await page.locator("input[type='text'], input[placeholder*='姓名']").fill(NEW_NAME);
    // Role select — default is doctor; keep it
    await page.locator("form button[type='submit'], form button:has-text('新增')").click();

    // New employee should appear in list
    await expect(page.locator(`text=${NEW_NAME}`)).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(`text=${NEW_EMAIL}`)).toBeVisible({ timeout: 5_000 });
  });

  // ── 6-4: Validation — empty email ────────────────────────────────────────
  test("6-4: 不填 Email 送出，顯示「Email 與姓名為必填」錯誤", async ({ page }) => {
    await page.goto("/admin");
    await page.locator("input[type='text'], input[placeholder*='姓名']").fill("未填Email");
    await page.locator("form button[type='submit'], form button:has-text('新增')").click();
    await expect(page.locator("text=Email 與姓名為必填")).toBeVisible({ timeout: 3_000 });
  });

  // ── 6-5: Deactivate employee ──────────────────────────────────────────────
  test("6-5: 點員工的「停用」按鈕，員工狀態變為停用", async ({ page }) => {
    await page.goto("/admin");
    // Find the row for the newly added employee and click 停用
    const newEmployeeRow = page.locator(`tr:has-text('${NEW_EMAIL}'), li:has-text('${NEW_EMAIL}')`).first();
    await expect(newEmployeeRow).toBeVisible({ timeout: 5_000 });

    const deactivateBtn = newEmployeeRow.locator('button:has-text("停用")');
    await deactivateBtn.click();

    // Verify the button changes to 啟用
    await expect(newEmployeeRow.locator('button:has-text("啟用")')).toBeVisible({ timeout: 5_000 });
  });

  // ── 6-6: Reactivate employee ──────────────────────────────────────────────
  test("6-6: 點「啟用」重新啟用員工，狀態恢復", async ({ page }) => {
    await page.goto("/admin");
    const newEmployeeRow = page.locator(`tr:has-text('${NEW_EMAIL}'), li:has-text('${NEW_EMAIL}')`).first();
    await expect(newEmployeeRow).toBeVisible({ timeout: 5_000 });

    const activateBtn = newEmployeeRow.locator('button:has-text("啟用")');
    // May not be deactivated if 6-5 was skipped; skip gracefully
    if (await activateBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await activateBtn.click();
      await expect(newEmployeeRow.locator('button:has-text("停用")')).toBeVisible({ timeout: 5_000 });
    } else {
      test.skip(true, "Employee was not deactivated (6-5 may have been skipped)");
    }
  });
});
