---
name: capture-screenshots
description: 'Recapture documentation screenshots after UI changes. Use when: UI components changed and screenshots need updating; user says "recapture screenshots", "update screenshots", "重拍截圖", "更新截圖". Analyzes git diff to determine which screenshots are affected and only recaptures those.'
argument-hint: 'Optionally specify "all" to recapture all 11 screenshots, or a list of screenshot numbers (e.g., "01 03 06")'
---

# Recapture Documentation Screenshots

## When to Use
- After modifying React components, pages, or CSS styles that affect the UI
- After changing navigation structure (Navbar, routes)
- When screenshots in `docs/images/` look outdated or incorrect
- When `update-docs` skill reports screenshots need recapture

## Prerequisites

**Both must be running before executing this skill:**
1. Firebase Emulators — `./dev-start.sh` (ports: Auth :9099, Firestore :8080, Functions :5001)
2. Vite dev server — `cd webapp && npm run dev` (port :5173)

If not running, instruct the user to start them first. Do NOT proceed without both running.

## Screenshot Inventory

| # | File | Page | Role | Key UI Elements |
|---|---|---|---|---|
| 01 | `01-login.png` | `/login` | None | Google OAuth button |
| 02 | `02-schedule-empty.png` | `/schedule` | Manager | MonthControls, empty ShiftBoard table |
| 03 | `03-quick-assign-popover.png` | `/schedule` | Manager | QuickAssignModal popover with checkboxes |
| 04 | `04-schedule-assigned.png` | `/schedule` | Manager | ShiftBoard with assigned staff chips |
| 05 | `05-paint-mode.png` | `/schedule` | Manager | Paint mode active (🖌 indicator in sidebar) |
| 06 | `06-admin-page.png` | `/admin` | Manager | 新增員工 form, 成員列表 table |
| 07 | `07-template-page.png` | `/templates` | Manager | 7×3 weekly template grid |
| 08 | `08-apply-template-modal.png` | `/schedule` | Manager | ApplyTemplateModal dialog |
| 09 | `09-unavailability-manager.png` | `/unavailability` | Manager | Unavailability list (all staff) |
| 10 | `10-schedule-staff.png` | `/schedule` | Staff | Read-only board or 尚未發布 + 提報 panel |
| 11 | `11-unavailability-staff.png` | `/unavailability` | Staff | Unavailability list (own records) |

## Procedure

### Step 1: Determine Which Screenshots to Recapture

If the user specifies "all" or specific numbers, use that. Otherwise, analyze git diff:

```bash
git diff HEAD --name-only
git diff --cached --name-only
```

Map changed files to affected screenshots:

| Changed file pattern | Affected screenshots |
|---|---|
| `LoginPage.tsx` | 01 |
| `ShiftBoard.tsx`, `MonthControls.tsx` | 02, 03, 04, 05 |
| `QuickAssignModal.tsx` | 03 |
| `AdminPage.tsx` | 06 |
| `TemplatePage.tsx`, `ApplyTemplateModal.tsx` | 07, 08 |
| `UnavailabilityPanel.tsx`, `UnavailabilityListPage.tsx` | 09, 10, 11 |
| `Navbar.tsx` | ALL (navbar appears on every page) |
| `SchedulePage.tsx` | 02, 03, 04, 05, 10 |
| `styles/tokens.css`, `styles/global.css` | ALL (global style changes) |
| `AuthContext.tsx`, `ProtectedRoute.tsx` | Likely none, but verify login flow screenshots |

If no UI files changed, report "No UI changes detected, no screenshots need recapture" and stop.

### Step 2: Verify Environment

Check that emulators and dev server are running:

```bash
curl -s http://localhost:5173 > /dev/null 2>&1 && echo "Vite: OK" || echo "Vite: NOT RUNNING"
curl -s http://localhost:8080 > /dev/null 2>&1 && echo "Firestore: OK" || echo "Firestore: NOT RUNNING"
curl -s http://localhost:9099 > /dev/null 2>&1 && echo "Auth: OK" || echo "Auth: NOT RUNNING"
```

If any are not running, tell the user and stop.

### Step 3: Execute Screenshot Capture

**To recapture ALL screenshots:**
```bash
cd webapp && npx playwright test --config screenshot.config.ts --reporter=list
```

**To recapture specific screenshots only:**
The spec file `webapp/e2e/capture-screenshots.spec.ts` has test names like `截圖 01：登入頁面`, `截圖 02：排班表（管理者，空白月份）`, etc. Use grep filter:

```bash
# Single screenshot:
cd webapp && npx playwright test --config screenshot.config.ts --grep "截圖 03" --reporter=list

# Multiple screenshots:
cd webapp && npx playwright test --config screenshot.config.ts --grep "截圖 01|截圖 03|截圖 06" --reporter=list
```

### Step 4: Verify Results

1. Check the command exit code — 0 means all tests passed
2. List the output files to confirm they were updated:
   ```bash
   ls -la docs/images/
   ```
3. If any test failed, read the error output and diagnose:
   - **Timeout**: UI element selector changed — update `capture-screenshots.spec.ts`
   - **Navigation error**: Route changed — update the spec
   - **Element not found**: Component renamed or restructured — update the spec

### Step 5: Update Screenshot Spec if Needed

If the UI structure changed such that selectors in `webapp/e2e/capture-screenshots.spec.ts` are broken:

1. Read the changed component to understand the new DOM structure
2. Update the selectors in the spec file
3. Re-run the capture command
4. Verify all tests pass

Key patterns in the spec:
- `signIn(page, "manager@brightah50.com")` / `signIn(page, "staff1@brightah50.com")` for auth
- `managerScheduleSetup(page)` sets up 2026-05 schedule month
- `screenshot(page, "XX-name.png")` saves to `docs/images/`

### Step 6: Report

Tell the user:
- Which screenshots were recaptured (list filenames)
- Whether the spec file needed updates
- If any screenshots failed and why

## Technical Details

- **Config**: `webapp/screenshot.config.ts` — Chromium only, 1280×800 viewport, serial execution
- **Spec**: `webapp/e2e/capture-screenshots.spec.ts` — 11 tests, each captures one screenshot
- **Output**: `docs/images/` — PNG files used by `docs/manager-guide.md` and `docs/staff-guide.md`
- **Global setup**: `webapp/e2e/global-setup.ts` — seeds 9 test users before all tests
- **Excluded from normal E2E**: `playwright.config.ts` has `testIgnore` for this spec
