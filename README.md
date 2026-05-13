# brightah50-shift-master

萊特動物醫院內部員工排班系統 — 9 人團隊 V1.0。管理員透過點選或拖曳介面手動排班，員工可查看班表及提報不可上班時段。

## 技術棧

| 層次     | 技術                                                                   |
| -------- | ---------------------------------------------------------------------- |
| 前端     | React 19 + TypeScript 5.8，Vite 6，`@hello-pangea/dnd`                 |
| 後端     | Firebase Cloud Functions Gen 2（Node.js 24 + TypeScript）              |
| 資料庫   | Cloud Firestore                                                        |
| 身分驗證 | Firebase Authentication（Google OAuth + Auth Blocking Trigger 白名單） |
| 測試     | Vitest 4（單元測試 + Security Rules 整合測試）、Playwright（E2E）      |
| CI/CD    | GitHub Actions（lint、unit、rules、security 四個 job）                 |

---

## 快速開始（本地開發）

### 1. 環境需求

- Node.js **24** 或以上
- Java **21** 或以上（Firestore Emulator 需要；macOS 預設 Java 17 不夠）
- Firebase CLI：`npx firebase-tools@latest --version`

### 2. 安裝相依套件

```bash
npm install --prefix functions
npm install --prefix webapp
```

### 3. 設定環境變數

```bash
cp webapp/.env.local.example webapp/.env.local
# 開啟 webapp/.env.local，填入 Firebase Console → 專案設定 → Web 應用程式的 SDK 設定值
```

### 4. 一鍵啟動（推薦）

```bash
./dev-start.sh          # 啟動 emulator + 自動 seed 測試使用者
./dev-start.sh seed     # 僅重新 seed（emulator 已在跑時使用）
./dev-start.sh kill     # 清除所有 emulator port
```

腳本會自動設定 Java 21、等待 emulator 就緒後 seed 9 個測試帳號，並列出測試帳號表。

> 若需手動啟動，請參考 [docs/dev-testing-guide.md](docs/dev-testing-guide.md)。

| 服務        | 位址                  |
| ----------- | --------------------- |
| 前端        | http://localhost:5002 |
| Emulator UI | http://localhost:4000 |
| Firestore   | localhost:8080        |
| Functions   | localhost:5001        |
| Auth        | localhost:9099        |

> **Vite dev server（不經 Firebase Hosting）：** `npm run dev --prefix webapp` → `localhost:5173`  
> E2E 測試使用此位址（`playwright.config.ts`）。

---

## 執行測試

```bash
cd functions

# Cloud Functions 單元測試（不需要 Emulator）
npm run test:unit

# Firestore Security Rules 整合測試（需先啟動 Firestore Emulator）
npm run test:rules
```

```bash
# E2E 測試（Playwright）— 需要 emulator 已在 :8080, :9099 運行，Vite dev server 會自動啟動
cd webapp
npx playwright test
npx playwright show-report
```

詳細測試流程見 [docs/dev-testing-guide.md](docs/dev-testing-guide.md)。

---

## 部署

```bash
# 建置前端
npm run build --prefix webapp

# 部署 Cloud Functions + Firestore Rules + Indexes + Hosting
npx firebase-tools@latest deploy
```

首次部署說明（Blaze 升級、Identity Platform、第一個 manager 帳號設定）見 [docs/deployment-guide.md](docs/deployment-guide.md)。

---

## 文件目錄

| 文件 | 說明 | 目標讀者 |
| ---- | ---- | -------- |
| [docs/manager-guide.md](docs/manager-guide.md) | 管理者操作手冊（排班、員工管理、模板） | 醫院管理者 |
| [docs/staff-guide.md](docs/staff-guide.md) | 員工操作手冊（查看班表、提報請假） | 醫院員工 |
| [docs/dev-testing-guide.md](docs/dev-testing-guide.md) | 本地開發與功能測試流程（含 AI agent 測試指引） | 開發者 / QA |
| [docs/deployment-guide.md](docs/deployment-guide.md) | Firebase 生產環境部署紀錄與問題排查 | DevOps |
| [docs/development-phases.md](docs/development-phases.md) | 各階段建置紀錄（Phase 1–10） | 開發者 |

---

## 專案結構

```
brightah50-shift-master/
├── .github/workflows/ci.yml   GitHub Actions CI/CD（4 jobs）
├── firebase.json              Firebase 部署設定
├── firestore.rules            Firestore 安全規則
├── firestore.indexes.json     Firestore 複合索引
├── .firebaserc                Firebase 專案指向
├── dev-start.sh               一鍵啟動 emulator + seed 腳本
├── scripts/
│   ├── seed-users.js          Firestore 測試使用者 seed
│   └── seed-auth.js           Auth emulator 測試使用者 seed
├── docs/                      專案文件
│   ├── images/                截圖（操作手冊用）
│   ├── manager-guide.md       管理者操作手冊
│   ├── staff-guide.md         員工操作手冊
│   ├── dev-testing-guide.md   開發測試指南
│   ├── deployment-guide.md    部署指南
│   └── development-phases.md  建置歷程紀錄
├── functions/                 Cloud Functions（後端）
│   ├── src/
│   │   ├── index.ts           Cloud Functions 進入點
│   │   └── types.ts           前後端共用型別定義
│   ├── test/
│   │   ├── functions.test.ts  Cloud Functions 單元測試（Vitest）
│   │   └── rules.test.ts      Security Rules 整合測試（Vitest）
│   └── vitest.config.ts
└── webapp/                    React SPA（前端）
    ├── e2e/                   Playwright E2E 測試
    │   ├── global-setup.ts    自動 seed Firestore + Auth emulator
    │   ├── fixtures.ts        signIn/signOut 工具 + managerPage/staffPage fixture
    │   ├── auth.spec.ts       認證與授權測試
    │   ├── schedule.spec.ts   班表建立與拖曳排班測試
    │   ├── popover.spec.ts    快速點選指派（QuickAssignModal）測試
    │   ├── admin.spec.ts      後台員工管理測試
    │   ├── template.spec.ts   週班表模板測試
    │   ├── paint-mode.spec.ts 油漆桶填充模式測試
    │   ├── navbar.spec.ts     Navbar 響應式佈局測試（N-1 ~ N-6）
    │   ├── unavailability.spec.ts 請假申請列表測試
    │   └── capture-screenshots.spec.ts 操作手冊截圖腳本
    ├── playwright.config.ts
    ├── screenshot.config.ts       截圖專用 Playwright config
    ├── src/
    │   ├── components/
    │   │   ├── MonthControls.tsx       月份選擇 + 建立/發布（manager only）
    │   │   ├── Navbar.tsx              統一導覽列
    │   │   ├── ProtectedRoute.tsx      角色保護路由
    │   │   ├── QuickAssignModal.tsx    快速點選指派 popover
    │   │   ├── ApplyTemplateModal.tsx  套用班表模板 modal
    │   │   ├── ShiftBoard.tsx          拖曳排班（DnD + QuickAssign 整合）
    │   │   └── UnavailabilityPanel.tsx 員工提報不可上班時間
    │   ├── contexts/AuthContext.tsx
    │   ├── hooks/useSchedule.ts
    │   ├── pages/
    │   │   ├── AdminPage.tsx           後台員工管理（manager only）
    │   │   ├── LoginPage.tsx           Google OAuth 登入
    │   │   ├── SchedulePage.tsx        主班表頁
    │   │   ├── TemplatePage.tsx        週班表模板管理（manager only）
    │   │   └── UnavailabilityListPage.tsx 請假申請列表（/unavailability）
    │   ├── styles/
    │   │   ├── tokens.css              CSS Design Token 變數
    │   │   └── global.css              全域 utility classes
    │   ├── types/index.ts              前端型別（與 functions/src/types.ts 同步）
    │   ├── App.tsx
    │   └── firebase.ts                Firebase 初始化 + Emulator 自動切換
    └── .env.local.example
```

---

## 角色權限

| 功能                        | Manager | Staff |
| --------------------------- | :-----: | :---: |
| 白名單管理（新增/停用員工） |   ✅    |   —   |
| 建立空白月份                |   ✅    |   —   |
| 拖曳排班                    |   ✅    |   —   |
| 快速點選指派（popover）     |   ✅    |   —   |
| 油漆桶填充模式              |   ✅    |   —   |
| 週班表模板管理              |   ✅    |   —   |
| 發布/取消發布班表           |   ✅    |   —   |
| 查看班表                    |   ✅    |  ✅   |
| 提報不可上班時段            |    —    |  ✅   |
| 查看/刪除自己的請假紀錄     |    —    |  ✅   |
| 查看/刪除所有人的請假紀錄   |   ✅    |   —   |

---

## Firestore Schema

| 集合                            | 文件 ID    | 核心欄位                                                           |
| ------------------------------- | ---------- | ------------------------------------------------------------------ |
| `users`                         | email      | `displayName`, `email`, `role`, `isActive`, `isDeleted?`           |
| `monthly_schedules`             | `YYYY-MM`  | `year`, `month`, `isPublished`, `managerId`                        |
| `monthly_schedules/{id}/shifts` | `DD`       | `date`, `dayOfWeek`, `slots.{morning,afternoon,evening}: string[]` |
| `unavailability`                | 自動 ID    | `userId`, `userDisplayName`, `date`, `unavailableSlots`, `reason?` |
| `weekly_templates`              | 自動 ID    | `name`, `createdBy`, `updatedAt`, `days: Record<DayOfWeek, SlotMap>` |

### 班別時段

| 代碼        | 時間          |
| ----------- | ------------- |
| `morning`   | 10:00 – 12:00 |
| `afternoon` | 13:00 – 17:00 |
| `evening`   | 18:00 – 21:30 |

---

## Cloud Functions

| 名稱                   | 類型                  | 功能                                          |
| ---------------------- | --------------------- | --------------------------------------------- |
| `beforeusersignedin`   | Auth Blocking Trigger | 白名單比對 + 設定 `role` custom claim；拒絕停用/刪除帳號 |
| `initializeBlankMonth` | Callable (onCall)     | 建立月份文件 + 當月所有空白 shifts            |
| `applyWeeklyTemplate`  | Callable (onCall)     | 按星期幾 union merge 週模板至目標月份；自動過濾停用員工 |
| `onShiftUpdated`       | Firestore Trigger     | 已發布月份異動時記錄 log（TODO: Resend 通知） |

