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
- **`docs/dev-testing-guide.md`** — 11 個章節完整測試流程文件，含 AI agent 測試指引

---

## Phase 6：週班表模板系統

大幅減少管理者手動排班負擔：建立可重複使用的「週班表模板」，一鍵套用至任意月份。

### 設計決策

| 決策 | 說明 |
|------|------|
| 合併策略 | Union — 模板人員加入現有，不移除 |
| 日期對應 | 按**星期幾**（日/一/二/三/四/五/六），不按日期數字 |
| 停用員工 | 套用時自動過濾 `isActive=false` 的員工 |
| 月份不存在 | 目標月份不存在時自動建立（reuse `initializeBlankMonth` 邏輯） |
| 模板範圍 | 全域共用（所有 manager 共享） |
| Firestore 路徑 | `weekly_templates/{templateId}` |

### Phase 6-A：資料層與後端

- `WeeklyTemplate` 型別 — `name`, `createdBy`, `updatedAt`, `days: Record<DayOfWeek, ShiftSlots>`；新增至 `functions/src/types.ts` 及 `webapp/src/types/index.ts`
- `firestore.rules` — `weekly_templates/{docId}`：Manager 可 CRUD、登入者可 Read
- `applyWeeklyTemplate`（onCall Callable）— Manager 驗證 → 取模板 → 自動建月 → 按星期幾 union merge → 過濾停用員工 → batch commit

### Phase 6-B：前端 UI

- `useTemplates.ts` hook — real-time listener on `weekly_templates` collection
- `TemplatePage.tsx`（`/templates`，manager only）— 左側模板列表、主區 7 欄 × 3 列格子、checkbox popover 指派員工、名稱輸入 + 儲存/刪除
- `ApplyTemplateModal.tsx` — 選擇模板下拉、預覽摘要、Union merge 提示、呼叫 Cloud Function
- `MonthControls.tsx` — 新增「套用模板」按鈕開啟 Modal
- `App.tsx` / `SchedulePage.tsx` — 新增 `/templates` route 與導航連結

### Phase 6-C：測試

- `functions/test/functions.test.ts` — `applyWeeklyTemplate`：空月份、union merge、停用員工過濾、無效 templateId、非 manager 呼叫
- `functions/test/rules.test.ts` — `weekly_templates`：Manager CRUD、Staff 只讀、未登入拒絕
- `webapp/e2e/template.spec.ts` — 建立模板、套用月份、Staff 無法訪問

### 驗收條件

1. `cd functions && npm test` — 所有 `applyWeeklyTemplate` 及 `weekly_templates` rules 測試通過
2. 手動：建立模板（週一早班 3 人）→ 套用到某月 → 所有週一早班均出現這 3 人
3. 邊界：目標月不存在 → 自動建立並套用
4. 邊界：月份已有排班 → 既有人員保留，模板人員合併加入
5. 邊界：模板含停用員工 → 套用結果中已過濾
6. `cd webapp && npx playwright test e2e/template.spec.ts`

---

## Phase 7：油漆桶填充模式 (Paint / Brush Mode)

大幅減少手動拖拉疲勞：管理員在側欄「點選」員工後，直接在格子上逐格「單擊」即可填入，操作速度提升三倍以上。**純前端變更，不需要後端或 Firestore 規則修改。**

### 設計決策

| 決策 | 說明 |
|------|------|
| 填充動作 | 僅加入 — 格子已有該員工則 no-op，不做 toggle 也不移除 |
| 拖刷 | 不支援 — 每格個別點擊，簡化且避免誤操作 |
| 退出方式 | 再次點擊同一員工取消選取，或按 Escape 退出 |
| 與 DnD | 互斥 — 油漆桶啟用時停用 Drag-and-Drop |
| 衝突處理 | 允許填入但顯示 ⚠ 標記（與現有行為一致） |
| 目標限制 | 非 active 員工不可被選為填充目標 |

### 變更範圍

- **`webapp/src/components/ShiftBoard.tsx`** — 唯一修改的程式碼檔案
  - 新增 `paintEmail: string | null` state
  - Escape 鍵監聽 → 退出模式
  - 側欄員工 `onClick`：active 員工選取/取消，非 active 無效
  - 選中視覺：邊框 `border: 2px solid #2563eb` + 背景 `#dbeafe`
  - 側欄標題動態：正常顯示「員工」；油漆桶顯示「🖌 填充模式：{displayName}」+ 提示
  - `isDragDisabled={paintEmail !== null}` 互斥 DnD
  - 格子 `onClick`：`paintEmail != null` 時直接 `arrayUnion`，不開啟 QuickAssignModal
  - 格子 hover：`cursor: cell` + 背景 `#e8f0fe`
- **`webapp/e2e/paint-mode.spec.ts`** — 新建 E2E 測試 (7-1 ~ 7-6)

### 驗收條件

1. 點擊側欄員工 → 進入油漆桶模式（高亮 + 指示器）
2. 點擊格子 → 員工被加入；重複點擊 → no-op
3. ESC 或再次點擊員工 → 退出模式
4. 油漆桶模式下 DnD 停用
5. 衝突格子允許填入但顯示 ⚠
6. 非 active 員工不可選取
7. `webapp tsc --noEmit` 無錯誤
8. `npx playwright test e2e/paint-mode.spec.ts`

---

## Phase 8：UI 體驗修正

三項前端改善，純 UI 變更，不影響後端邏輯。

### Phase 8-A：TemplatePage CellPopover 自動翻轉

**問題**：晚班 18–21:30 位於表格最後一列，popover 固定向下展開會超出視窗底部，需捲動才看到選項。

**修改**：`CellPopover` mount 後以 `getBoundingClientRect()` 偵測底部是否超出 `window.innerHeight`，若超出則 `flipUp = true`，改為 `bottom: "100%"` 向上展開。

- **`webapp/src/pages/TemplatePage.tsx`** — `CellPopover` 加 `flipUp` state 與偵測 `useEffect`；`activeUsers` 過濾同時加入 `!u.isDeleted`

### Phase 8-B：統一 Navbar 組件

**問題**：四個頁面導覽列各不相同（SchedulePage 有完整連結、AdminPage 只有「回班表」、TemplatePage 完全沒有導覽、UnavailabilityListPage 只有「← 返回排班」）。

**修改**：新建共用 `<Navbar title="..." />` 組件，四個頁面的舊 header 全部替換。

- **`webapp/src/components/Navbar.tsx`**（新建）— 左側標題；右側連結：班表 / 管理後台（manager）/ 班表模板（manager）/ 請假申請 / 使用者名稱 / 登出；`useLocation()` 高亮當前頁面
- **`webapp/src/pages/SchedulePage.tsx`** — 移除舊 header，改用 `<Navbar title="排班系統" />`
- **`webapp/src/pages/AdminPage.tsx`** — 移除舊 header，改用 `<Navbar title="管理後台" />`
- **`webapp/src/pages/TemplatePage.tsx`** — 加入 `<Navbar title="週班表模板管理" />`
- **`webapp/src/pages/UnavailabilityListPage.tsx`** — 移除舊 header，改用 `<Navbar title="請假申請" />`

### Phase 8-C：成員列表加「刪除」按鈕（軟刪除）

**問題**：管理後台只有停用按鈕；停用員工仍顯示於列表（半透明）。管理員需要能把離職員工從列表完全移除。

**設計**：軟刪除（`isDeleted: true`）— 刪除後員工從所有列表消失（管理員也看不到），但歷史班表仍顯示其名字。不支援復原（需重新新增）。不修改 Firestore `allow delete` 規則，只用 `updateDoc`。

- **`webapp/src/types/index.ts`** — `User` interface 加 `isDeleted?: boolean`
- **`functions/src/types.ts`** — 同步加 `isDeleted?: boolean`
- **`firestore.rules`** — `userFieldsOnly()` 加入 `isDeleted` 欄位
- **`webapp/src/pages/AdminPage.tsx`** — `fetchUsers` 過濾 `isDeleted`；新增 `handleDeleteUser`（`window.confirm` → `updateDoc { isDeleted: true }`）；操作欄加紅色「刪除」按鈕
- **`webapp/src/components/ShiftBoard.tsx`** — sidebar 渲染過濾 `!u.isDeleted`（`userMap` 保留已刪除 user，讓歷史班表仍可解析名字）
- **`functions/src/index.ts`** — `beforeusersignedin` 加 `isDeleted` 檢查，阻止已刪除使用者登入

### 驗收條件

1. TemplatePage 點擊晚班儲存格 → popover 完整顯示，不超出視窗
2. 四個頁面頂部顯示一致導覽列，當前頁面連結藍色高亮
3. 管理後台成員列表每行有「停用/啟用」與「刪除」兩個按鈕
4. 刪除後員工從列表消失；歷史班表仍顯示其名字
5. `cd webapp && npx tsc --noEmit` 無錯誤

---

## Phase 9：UI 全面品牌化重設計

以萊特動物醫院品牌 Logo 色系（金黃 + 暖棕）取代原有藍色系，建立 CSS Design Token 系統，將全站 inline styles 統一替換為 CSS utility classes。**純前端變更，不影響後端邏輯。**

### 設計決策

| 決策 | 說明 |
|------|------|
| 架構 | Pure CSS custom properties（CSS variables）+ global utility classes；不使用 Tailwind、CSS Modules、CSS-in-JS |
| 品牌主色 | `#D4A843`（金黃，取自 Logo）／ secondary `#9B8B7A`（暖棕） |
| 背景色 | `#FDFBF7`（暖白），邊框 `#DDD5CA` |
| Logo 來源 | `brightah50-logo.jpg`（1536×1438px，四格動物圖示 + Bright 字樣） |
| 圖片處理工具 | macOS `sips` — 轉換 JPG→PNG、裁切、縮放 |

### 新增檔案

- **`webapp/src/styles/tokens.css`** — 單一 source-of-truth CSS custom properties：主色系（`--color-primary`、`--color-primary-light`、`--color-primary-subtle`）、secondary、semantic（success/warning/danger）、neutral grays、背景、字型、間距、圓角、陰影
- **`webapp/src/styles/global.css`** — Global reset + utility classes：`.page-wrapper`、`.card`、`.btn` 系列（primary/secondary/ghost/danger/success + sm/xs/lg）、`.form-input`/`.form-select`、`.table`/`.table-wrapper`、`.toolbar-bar`、`.badge` 系列、`.staff-chip`、`.popover`/`.popover-header`/`.popover-item`、`.section-title`、`.alert` 系列、`.spinner`/`.loading-center`
- **`webapp/public/logo.png`** — 240px 寬，用於 Navbar + LoginPage
- **`webapp/public/favicon.png`** — 32×32px（裁切至四格動物區域）
- **`webapp/public/apple-touch-icon.png`** — 180×180px
- **`webapp/public/logo-192.png`** — 192×192px（PWA manifest）

### 修改範圍

| 檔案 | 說明 |
|------|------|
| `webapp/index.html` | 標題 → 「萊特動物醫院 - 內部排班」、favicon、apple-touch-icon、`meta theme-color=#D4A843` |
| `webapp/src/main.tsx` | import `tokens.css` + `global.css` |
| `webapp/src/pages/LoginPage.tsx` | 暖漸層背景、白卡、Logo 120px、金黃按鈕、spinner 替換載入文字 |
| `webapp/src/components/Navbar.tsx` | sticky header、左側 logo+標題、中間導覽（金黃底線高亮）、右側 badge+登出 |
| `webapp/src/components/MonthControls.tsx` | `.toolbar-bar`、`.form-select`、`.btn` 系列 |
| `webapp/src/components/ShiftBoard.tsx` | 所有 inline styles 替換為 token 值；移除未使用的 `getEmailColor` |
| `webapp/src/components/QuickAssignModal.tsx` | `.popover`/`.popover-header`/`.popover-item`；移除 `bulkBtnStyle` |
| `webapp/src/pages/SchedulePage.tsx` | `.page-wrapper`；ReadOnlyBoard 表頭使用 `--color-primary-light` + `--color-primary` 底線；staff chip 使用 token |
| `webapp/src/pages/AdminPage.tsx` | `.page-wrapper`、`.card`、`.table`/`.table-wrapper`、`.badge` 顯示角色/狀態、`.btn-danger`/`.btn-ghost` |
| `webapp/src/pages/TemplatePage.tsx` | CellPopover → `.popover`/`.popover-item`；左側列表用 secondary-subtle + primary 選取；表格用 primary-light 表頭；刪除重複說明段落 |
| `webapp/src/pages/UnavailabilityListPage.tsx` | `.toolbar-bar`、`.table`/`.table-wrapper`、`.btn-danger btn-xs`；移除未使用的 `tdStyle` |
| `webapp/src/components/UnavailabilityPanel.tsx` | `--color-warning-bg`/`--color-warning-border` 面板；`.form-select`/`.form-input`；`.table`/`.table-wrapper`；UnavailabilityRow 使用 `.btn` 類 |
| `webapp/src/components/ApplyTemplateModal.tsx` | `.card` 彈窗、`--shadow-xl`、`.form-select`、預覽表格用 token、`.alert-warning`、`.btn-primary`/`.btn-ghost` |

### 驗收結果

1. `cd webapp && npm run build` — ✅ tsc 零錯誤，vite build 成功（88 modules）
2. `cd webapp && npm run lint` — ✅ 無新增 ESLint 錯誤（原有 e2e 測試檔案 2 個 unused vars 警告為既有問題）


| 決策                  | 說明                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------- |
| 型別同步採複製        | `functions/src/types.ts` 手動同步至 `webapp/src/types/index.ts`，不建 monorepo shared package |
| V1.0 通知僅 log       | `onShiftUpdated` 記錄差異，不接 Resend email API                                              |
| 拖曳 + Popover 並存   | `ShiftBoard` 保留 DnD，新增 `QuickAssignModal` 作為批量指派的主要方式                         |
| Emulator hosting port | Firebase Emulator Hosting 跑在 `:5002`；Vite dev server 跑在 `:5173`                          |
| Java 版本             | macOS 系統預設 Java 17 無法啟動 Firestore Emulator，需指定 `JAVA_HOME` 至 Temurin 21          |
| CellPopover 翻轉      | 偵測 `getBoundingClientRect().bottom > window.innerHeight`，超出則改為 `bottom: 100%` 向上展開 |
| 統一 Navbar           | 抽出 `Navbar.tsx` 共用組件，`useLocation()` 高亮當前頁面；四個頁面舊 header 全部替換           |
| 員工刪除採軟刪除      | `isDeleted` 欄位 + `updateDoc`，不改 `allow delete: if false` 規則；`userMap` 保留刪除記錄讓歷史班表可查名字 |

---

## Phase 10：Navbar 手機響應式佈局 ✅

手機瀏覽時，原本的 Navbar 把 logo、標題、導覽連結、用戶資訊和登出按鈕全擠在一條 56px 的 flex 行裡，導致元素重疊、難以點擊。本次改為兩行佈局並同步建立測試。**純前端變更，不影響後端邏輯。**

### 設計決策

| 決策 | 說明 |
|------|------|
| 佈局策略 | 兩行佈局而非漢堡選單 — 內部工具不需多一次點擊才能看到所有導覽項目 |
| 實作方式 | CSS media query，不使用 JS `useMediaQuery` — 更簡單，無 layout flash |
| Breakpoints | `768px`（平板/手機分界）、`480px`（小螢幕手機隱藏標題） |
| Inline styles 抽離 | 原本 `Navbar.tsx` 100% inline styles → 全改為 CSS class，media query 才能生效 |

### 變更範圍

| 檔案 | 說明 |
|------|------|
| `webapp/src/styles/global.css` | 新增 `.navbar`、`.navbar-brand`、`.navbar-brand-title`、`.navbar-nav`、`.navbar-user`、`.navbar-user-info`、`.navbar-user-name`、`.nav-link`、`.nav-link.active` class；`@media (max-width: 768px)`：nav 移至第二行（`order: 3; width: 100%; justify-content: space-around`）、隱藏角色 badge；`@media (max-width: 480px)`：品牌標題 `display: none`、用戶名截斷（`text-overflow: ellipsis`） |
| `webapp/src/components/Navbar.tsx` | 全部 inline styles 替換為 className；`navLinkStyle()` 函數改為 `navLinkClass()` 回傳 `"nav-link active"` / `"nav-link"` |
| `webapp/e2e/navbar.spec.ts`（新建）| 6 個 E2E 測試（N-1 ~ N-6）：桌面三區塊同行、手機 nav 換第二行、所有連結在 viewport 內、manager/staff 連結數量、active class 驗證、480px 以下標題隱藏 |

### 驗收結果

1. `cd webapp && npm run build` — ✅ tsc 零錯誤，vite build 成功（88 modules）
2. `cd webapp && npm run lint` — ✅ 無新增錯誤（原有 AuthContext warning 為既有問題）
3. 手機 390px：第一行 logo + 用戶，第二行全寬導覽 tab bar
4. 桌面 1280px：三區塊維持同一行，視覺無 regression
