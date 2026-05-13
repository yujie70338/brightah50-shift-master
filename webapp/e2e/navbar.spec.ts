/**
 * Section N: Navbar responsive layout (N-1 ~ N-6)
 */
import { test, expect, signIn } from "./fixtures";

test.describe("Navbar 響應式佈局", () => {
  // ── N-1: Desktop: all sections in one row ────────────────────────────────
  test("N-1: 桌面寬度 (1280px)，品牌、導覽、用戶在同一行", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");

    const brand = page.locator(".navbar-brand");
    const nav = page.locator(".navbar-nav");
    const user = page.locator(".navbar-user");

    const brandBox = await brand.boundingBox();
    const navBox = await nav.boundingBox();
    const userBox = await user.boundingBox();

    expect(brandBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(userBox).not.toBeNull();

    // All three sections should have overlapping vertical ranges (same row)
    const brandMidY = brandBox!.y + brandBox!.height / 2;
    const navMidY = navBox!.y + navBox!.height / 2;
    const userMidY = userBox!.y + userBox!.height / 2;
    expect(Math.abs(brandMidY - navMidY)).toBeLessThan(20);
    expect(Math.abs(brandMidY - userMidY)).toBeLessThan(20);
  });

  // ── N-2: Mobile: nav links wrap to second row ────────────────────────────
  test("N-2: 手機寬度 (390px)，導覽列換到第二行 (y 座標低於品牌區)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");

    const brand = page.locator(".navbar-brand");
    const nav = page.locator(".navbar-nav");

    const brandBox = await brand.boundingBox();
    const navBox = await nav.boundingBox();

    expect(brandBox).not.toBeNull();
    expect(navBox).not.toBeNull();

    // Nav should be below brand (second row)
    expect(navBox!.y).toBeGreaterThan(brandBox!.y + brandBox!.height - 5);
  });

  // ── N-3: Mobile: all nav links still visible and accessible ─────────────
  test("N-3: 手機寬度，所有導覽連結都可見且在 viewport 內", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");

    const scheduleLink = page.locator(".navbar-nav a:has-text('班表')");
    const unavailabilityLink = page.locator(".navbar-nav a:has-text('請假申請')");

    await expect(scheduleLink).toBeVisible();
    await expect(unavailabilityLink).toBeVisible();

    // Links should be within horizontal viewport bounds
    const scheduleBox = await scheduleLink.boundingBox();
    const unavailabilityBox = await unavailabilityLink.boundingBox();
    expect(scheduleBox!.x).toBeGreaterThanOrEqual(0);
    expect(unavailabilityBox!.x + unavailabilityBox!.width).toBeLessThanOrEqual(400);
  });

  // ── N-4: Manager sees 4 links; staff sees 2 ─────────────────────────────
  test("N-4: manager 看到 4 個導覽連結，staff 只看到 2 個", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // Manager: 4 links
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");
    const managerLinks = page.locator(".navbar-nav a");
    await expect(managerLinks).toHaveCount(4);

    // Sign out and sign in as staff
    await page.evaluate(() => (window as any).__e2eSignOut());
    await page.waitForURL("**/login");

    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");
    const staffLinks = page.locator(".navbar-nav a");
    await expect(staffLinks).toHaveCount(2);
  });

  // ── N-5: Active nav link has `active` class ──────────────────────────────
  test("N-5: 目前頁面的導覽連結有 `active` class", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");

    const scheduleLink = page.locator(".navbar-nav a:has-text('班表')");
    await expect(scheduleLink).toHaveClass(/active/);

    await page.goto("/unavailability");
    const unavailabilityLink = page.locator(".navbar-nav a:has-text('請假申請')");
    await expect(unavailabilityLink).toHaveClass(/active/);
  });

  // ── N-6: ≤480px: brand title is hidden, user name present ───────────────
  test("N-6: 小螢幕 (400px)，品牌標題文字隱藏，但用戶名稱仍在", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 844 });
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");

    const brandTitle = page.locator(".navbar-brand-title");
    // Hidden via CSS display:none — not visible but element exists
    await expect(brandTitle).toBeHidden();

    // User name should still be present (screen-reader / semantic)
    const userName = page.locator(".navbar-user-name");
    await expect(userName).not.toHaveCount(0);
  });
});
