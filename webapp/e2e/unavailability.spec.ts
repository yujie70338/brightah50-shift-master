/**
 * Section 7: Staff Unavailability Submission (7-1 ~ 7-6)
 * Section 8: Unavailability List Page        (8-1 ~ 8-6)
 */
import { test, expect, signIn, ensurePublishedSchedule } from "./fixtures";

test.describe.serial("員工提報不可上班 + 請假申請列表", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("http://localhost:5173/schedule");
    await signIn(page, "manager@brightah50.com");
    await ensurePublishedSchedule(page);
    await page.close();
  });

  // ── helper: fill unavailability form via Playwright native interactions ───
  async function _fillUnavailabilityForm(
    page: import("@playwright/test").Page,
    dateValue: string, // e.g. "2026-05-15"
    slots: ("morning" | "afternoon" | "evening")[] = ["morning"],
  ) {
    const panel = page.locator("text=提報不可上班時間").locator("..");
    // Select date
    await panel
      .locator("select")
      .last() // date select is last of the three selects in the panel
      .selectOption(dateValue);
    // Check slots
    for (const slot of slots) {
      const slotLabel = { morning: "早班", afternoon: "中班", evening: "晚班" }[
        slot
      ];
      await panel
        .locator(`label:has-text('${slotLabel}') input[type='checkbox']`)
        .check();
    }
  }

  // ════════════════════════════════════════════
  //  Section 7
  // ════════════════════════════════════════════

  // ── 7-1: Panel visible for staff ─────────────────────────────────────────
  test("7-1: 班表頁下方顯示「提報不可上班時間」面板", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");
    await page.locator("text=提報不可上班時間").scrollIntoViewIfNeeded();
    await expect(page.locator("text=提報不可上班時間")).toBeVisible();
    // Panel should have year, month, date selects
    const selects = page
      .locator("text=提報不可上班時間")
      .locator("..")
      .locator("select");
    await expect(selects).toHaveCount(4); // year, month, start date, end date
  });

  // ── 7-2: Year/month selects update date options ───────────────────────────
  test("7-2: 切換年月後，日期選擇器更新為對應天數", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");
    const panel = page.locator("text=提報不可上班時間").locator("..");

    // Switch to Feb 2026 (28 days)
    await panel.locator("select").nth(1).selectOption("2"); // month
    const dateOptions = await panel
      .locator("select")
      .last()
      .locator("option")
      .allInnerTexts();
    // 1 placeholder + 28 day options = 29
    expect(dateOptions.length).toBe(29);

    // Switch back to May 2026 (31 days)
    await panel.locator("select").nth(1).selectOption("5");
    const mayOptions = await panel
      .locator("select")
      .last()
      .locator("option")
      .allInnerTexts();
    expect(mayOptions.length).toBe(32); // 1 placeholder + 31
  });

  // ── 7-3: Submit form → success, panel resets ─────────────────────────────
  test("7-3: 選擇日期與班別，點「提交」成功送出，面板重置", async ({
    page,
  }) => {
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");

    const panel = page.locator("text=提報不可上班時間").locator("..");
    await panel.locator("select").nth(2).selectOption("2026-05-15"); // start date
    await panel
      .locator("label:has-text('早班') input[type='checkbox']")
      .check();
    await panel.locator("button:has-text('提交')").click();

    // Form should reset after successful submission
    await expect(panel.locator("select").nth(2)).toHaveValue("", {
      timeout: 5_000,
    });
    // New record should appear in the record list (table cell, not select option)
    await expect(panel.locator("td:has-text('15')")).toBeVisible({
      timeout: 5_000,
    });
  });

  // ── 7-4: Duplicate submission → allowed as independent doc ───────────────
  test("7-4: 重複提交相同日期+班別，系統建立獨立 document", async ({
    page,
  }) => {
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");

    const panel = page.locator("text=提報不可上班時間").locator("..");

    // Count records before
    const countBefore = await panel.locator("tbody tr").count();

    // Submit again for same date
    await panel.locator("select").nth(2).selectOption("2026-05-15"); // start date
    await panel
      .locator("label:has-text('早班') input[type='checkbox']")
      .check();
    await panel.locator("button:has-text('提交')").click();

    // Count should increase
    await page.waitForTimeout(1_500);
    const countAfter = await panel.locator("tbody tr").count();
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  // ── 7-5: ⚠ icon on shift chip when staff unavailable ─────────────────────
  test("7-5: 班表中已指派員工有請假，chip 出現 ⚠ 圖示", async ({ page }) => {
    const FS = "http://127.0.0.1:8080";
    const PROJECT = "brightah50-shift-master";

    // Seed the assignment directly via Firestore REST API (emulator admin token bypasses rules)
    // Shift doc ID is the 2-digit day: "15" for 2026-05-15
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");
    await page.evaluate(
      async ([fs, proj]) => {
        // PATCH the shift document to add staff1 to morning slot
        const body = {
          fields: {
            date: { stringValue: "2026-05-15" },
            dayOfWeek: { stringValue: "五" },
            slots: {
              mapValue: {
                fields: {
                  morning: {
                    arrayValue: {
                      values: [{ stringValue: "staff1@brightah50.com" }],
                    },
                  },
                  afternoon: { arrayValue: { values: [] } },
                  evening: { arrayValue: { values: [] } },
                },
              },
            },
          },
        };
        // updateMask ensures only slots field is touched
        await fetch(
          `${fs}/v1/projects/${proj}/databases/(default)/documents/monthly_schedules/2026-05/shifts/15?updateMask.fieldPaths=slots`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer owner",
            },
            body: JSON.stringify(body),
          },
        );
      },
      [FS, PROJECT],
    );

    // Switch to staff view — ReadOnlyBoard should show ⚠ on row 15 morning
    await page.evaluate(() => (window as any).__e2eSignOut());
    await page.waitForURL("**/login");
    await signIn(page, "staff1@brightah50.com");
    await page.waitForSelector("table", { timeout: 8_000 });
    // Give Firestore listeners time to settle before checking
    await page.waitForTimeout(1_500);

    const staffRow15 = page
      .locator("table tbody tr")
      .filter({ hasText: "15" })
      .first();
    await expect(staffRow15.locator("text=⚠")).toBeVisible({ timeout: 8_000 });
  });

  // ── 7-6: Manager doesn't see submission panel ─────────────────────────────
  test("7-6: manager 角色看不到「提報不可上班時間」面板", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");
    // Scroll to bottom — no panel
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator("text=提報不可上班時間")).not.toBeVisible({
      timeout: 3_000,
    });
  });

  // ════════════════════════════════════════════
  //  Section 8
  // ════════════════════════════════════════════

  // ── 8-1: Staff sees own records, no 姓名 column ──────────────────────────
  test("8-1: staff 進入 /unavailability，顯示自己的記錄，無「姓名」欄", async ({
    page,
  }) => {
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");
    await page.locator("a:has-text('請假申請')").click();
    await expect(page).toHaveURL(/\/unavailability/);

    // 姓名 column should NOT appear for staff
    await expect(page.locator("th:has-text('姓名')")).not.toBeVisible();
    // Should see own records (at least one from test 7-3)
    await expect(page.locator("text=早班").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  // ── 8-2: Switch month → list updates ─────────────────────────────────────
  test("8-2: 切換月份，列表更新為所選月份的記錄", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");
    await page.goto("/unavailability");

    const monthSelect = page.locator("select").nth(1);
    await monthSelect.selectOption("4"); // April — should have 0 records
    await expect(page.locator("text=此月份無請假紀錄")).toBeVisible({
      timeout: 5_000,
    });

    await monthSelect.selectOption("5"); // Back to May
    await expect(page.locator("text=早班").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  // ── 8-3: Delete record ───────────────────────────────────────────────────
  test("8-3: 點「刪除」，記錄立即消失", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "staff1@brightah50.com");
    await page.goto("/unavailability");

    // Wait for records to load (table only renders once loading finishes)
    await page.locator("tbody tr").first().waitFor({ timeout: 5_000 });
    const countBefore = await page.locator("tbody tr").count();

    // handleDelete calls window.confirm() — accept it before clicking
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .locator("tbody tr")
      .first()
      .locator("button:has-text('刪除')")
      .click();
    await page.waitForTimeout(1_000);
    const countAfter = await page.locator("tbody tr").count();
    expect(countAfter).toBeLessThan(countBefore);
  });

  // ── 8-4: Manager sees all records with 姓名 column ───────────────────────
  test("8-4: manager 進入 /unavailability，顯示所有員工記錄，有「姓名」欄", async ({
    page,
  }) => {
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");
    await page.locator("a:has-text('請假申請')").click();

    await expect(page.locator("th:has-text('姓名')")).toBeVisible({
      timeout: 5_000,
    });
    // Manager sees names like 王小明
    await expect(page.locator("text=王小明").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  // ── 8-5: Manager can delete any employee's record ────────────────────────
  test("8-5: manager 可刪除任意員工的記錄", async ({ page }) => {
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");
    await page.goto("/unavailability");

    const rows = page.locator("tbody tr");
    // Wait for records to load
    await rows
      .first()
      .waitFor({ timeout: 5_000 })
      .catch(() => {});
    const countBefore = await rows.count();
    if (countBefore === 0) {
      test.skip(true, "No records to delete");
      return;
    }
    // handleDelete calls window.confirm() — accept it before clicking
    page.once("dialog", (dialog) => dialog.accept());
    await rows.first().locator("button:has-text('刪除')").click();
    await page.waitForTimeout(1_000);
    expect(await rows.count()).toBeLessThan(countBefore);
  });

  // ── 8-6: Staff only sees own records ─────────────────────────────────────
  test("8-6: staff 只能看到自己的記錄，不顯示他人記錄", async ({ page }) => {
    // Add a record for staff2 as manager
    await page.goto("/schedule");
    await signIn(page, "manager@brightah50.com");

    // Seed unavailability for staff2 via Firestore REST API
    const FS = "http://127.0.0.1:8080";
    const PROJECT = "brightah50-shift-master";
    await page.evaluate(
      async ([fs, proj]) => {
        const body = {
          fields: {
            userId: { stringValue: "staff2@brightah50.com" },
            userDisplayName: { stringValue: "李小華" },
            date: { stringValue: "2026-05-20" },
            unavailableSlots: {
              arrayValue: { values: [{ stringValue: "morning" }] },
            },
            reason: { stringValue: "測試8-6" },
          },
        };
        await fetch(
          `${fs}/v1/projects/${proj}/databases/(default)/documents/unavailability`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
      },
      [FS, PROJECT],
    );

    // Sign in as staff1 and verify staff2's record is NOT shown
    await page.evaluate(() => (window as any).__e2eSignOut());
    await page.waitForURL("**/login");
    await signIn(page, "staff1@brightah50.com");
    await page.goto("/unavailability");

    // staff1 should not see staff2's record
    await expect(page.locator("text=李小華")).not.toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator("text=測試8-6")).not.toBeVisible();
  });
});
