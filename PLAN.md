# 專案建置紀錄：brightah50-shift-master

所有建置工作均已完成。本文件記錄各階段已完成的內容，供回溯參考。

---

## Phase 1：共用型別與後端 Cloud Functions ✅

- `functions/src/types.ts` — `User`, `MonthlySchedule`, `ShiftDocument`, `ShiftSlots`, `Unavailability`, `SlotType`
- `beforeUserSignedIn`（Auth Blocking Trigger）— email 白名單比對 + `role` custom claim
- `initializeBlankMonth`（onCall Callable）— manager 驗證 + 批次建立當月空白 shifts（writeBatch）
- `onShiftUpdated`（Firestore Trigger）— 已發布月份異動時 log（TODO: Resend 通知）

---

## Phase 2：前端 React SPA 骨架 ✅

- Vite + React 19 + TypeScript 5.8
- Firebase SDK 初始化 + Emulator 自動切換（`import.meta.env.DEV`）
- `AuthContext` — Google OAuth + `beforeUserSignedIn` 攔截
- `ProtectedRoute` — 支援 `requireRole="manager"` 角色保護
- 路由：`/login`, `/schedule`, `/admin`, `/unavailability`

---

## Phase 3：排班核心介面 ✅

- `ShiftBoard` — 拖曳排班（`@hello-pangea/dnd`），`×` 移除，unavailability 衝突標記（⚠）
- `MonthControls` — 月份選擇（動態 ±2 年）、建立/發布（僅 manager 可見）
- `UnavailabilityPanel` — 員工提報不可上班時間（動態年月選擇器）
- `UnavailabilityListPage`（`/unavailability`）— 員工查自己、manager 看全員，可刪除
- `AdminPage`（`/admin`）— 新增/停用員工，僅 manager 可訪問

---

## Phase 4：安全規則與測試 ✅

- `firestore.rules` — users/schedules/shifts（登入可讀、manager 可寫）、unavailability（本人 CRUD）
- `functions/test/functions.test.ts` — 20 個 Cloud Functions 單元測試（Vitest）
- `functions/test/rules.test.ts` — 25 個 Security Rules 整合測試（`@firebase/rules-unit-testing`）

---

## Phase 5：功能強化與 DevOps ✅

- **快速點選指派**（`QuickAssignModal`）— 點擊格子開啟 checkbox popover，全選/清除，⚠ 衝突提示，Escape/外點關閉；拖曳保留
- **Playwright E2E 測試**（`webapp/e2e/`）— auth、schedule、admin、popover、unavailability 五個 spec，`global-setup.ts` 自動 seed + Auth emulator 初始化
- **CI/CD**（`.github/workflows/ci.yml`）— 4 jobs：lint-typecheck、unit-tests、rules-tests（Java 21）、security；含 `node_modules` cache、JUnit 測試報告、dependency-review（PR）、gitleaks、job timeout
- **DEV_TESTING.md** — 11 個章節完整測試流程文件，含 AI agent 測試指引

---

## 關鍵決策記錄

| 決策                  | 說明                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------- |
| 型別同步採複製        | `functions/src/types.ts` 手動同步至 `webapp/src/types/index.ts`，不建 monorepo shared package |
| V1.0 通知僅 log       | `onShiftUpdated` 記錄差異，不接 Resend email API                                              |
| 拖曳 + Popover 並存   | `ShiftBoard` 保留 DnD，新增 `QuickAssignModal` 作為批量指派的主要方式                         |
| Emulator hosting port | Firebase Emulator Hosting 跑在 `:5002`；Vite dev server 跑在 `:5173`                          |
| Java 版本             | macOS 系統預設 Java 17 無法啟動 Firestore Emulator，需指定 `JAVA_HOME` 至 Temurin 21          |
