import { test as base, expect, type Page } from "@playwright/test";

export { expect };

// ── Auth helpers ─────────────────────────────────────────────────────────────

/** Sign in programmatically (bypasses Google popup). */
export async function signIn(
  page: Page,
  email: string,
  password = "test1234"
) {
  // Ensure the page is loaded and firebase.ts has run
  if (!page.url().includes("localhost:5173")) {
    await page.goto("/");
  }
  await page.waitForFunction(
    () => typeof (window as any).__e2eSignIn === "function",
    { timeout: 10_000 }
  );
  await page.evaluate(
    ([e, pw]) => (window as any).__e2eSignIn(e, pw),
    [email, password] as [string, string]
  );
  // Wait for AuthContext to load the user profile
  await expect(page.locator("button:has-text('登出')")).toBeVisible({
    timeout: 8_000,
  });
}

/** Sign out and return to login page. */
export async function signOut(page: Page) {
  await page.waitForFunction(
    () => typeof (window as any).__e2eSignOut === "function"
  );
  await page.evaluate(() => (window as any).__e2eSignOut());
  await page.waitForURL("**/login");
}

// ── Convenience fixture – pre-authenticated pages ────────────────────────────

type AuthFixtures = {
  /** Page already signed in as manager@brightah50.com */
  managerPage: Page;
  /** Page already signed in as staff1@brightah50.com */
  staffPage: Page;
};

export const test = base.extend<AuthFixtures>({
  managerPage: async ({ page }, use) => {
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");
    await use(page);
  },
  staffPage: async ({ page }, use) => {
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");
    await use(page);
  },
});

// ── Schedule helpers (used by multiple spec files) ────────────────────────────

const SCHEDULE_ID = "2026-05";

/**
 * Ensure the 2026-05 schedule exists and is published.
 * Safe to call multiple times — skips creation if already present.
 */
export async function ensurePublishedSchedule(managerPage: Page) {
  await managerPage.goto("/schedule");

  const createBtn = managerPage.locator('button:has-text("建立新月份"), button:has-text("建立空白月份")');
  const cancelPublishBtn = managerPage.locator('button:has-text("取消發布")');
  const table = managerPage.locator("table");

  // Wait up to 15s for the page to settle into one of three known states:
  // (a) schedule exists + published → "取消發布" visible
  // (b) schedule exists + unpublished → table visible
  // (c) no schedule → "建立新月份" visible
  await Promise.race([
    cancelPublishBtn.waitFor({ timeout: 15_000 }),
    table.waitFor({ timeout: 15_000 }),
    createBtn.first().waitFor({ timeout: 15_000 }),
  ]).catch(() => {});

  // If already published, nothing left to do
  if (await cancelPublishBtn.isVisible().catch(() => false)) return;

  // Create schedule only if the table is not yet visible
  // Note: "建立新月份" button is always shown for managers — check table presence instead
  const tableVisible = await table.isVisible().catch(() => false);
  if (!tableVisible) {
    const hasCreate = await createBtn.first().isVisible().catch(() => false);
    if (hasCreate) {
      await createBtn.first().click();
      await table.waitFor({ timeout: 15_000 });
    }
  }

  // Publish — hasNotText excludes "取消發布" which also contains "發布"
  const publishBtn = managerPage.locator("button").filter({ hasText: "發布", hasNotText: "取消" });
  const hasPublish = await publishBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  if (hasPublish) await publishBtn.click();

  await cancelPublishBtn.waitFor({ timeout: 10_000 });
}

export { SCHEDULE_ID };
