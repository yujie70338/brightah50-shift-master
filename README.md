# brightah50-shift-master

輕量內部員工排班系統 — 9 人團隊 V1.0。管理員透過點選或拖曳介面手動排班，員工可查看班表及提報不可上班時段。

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

### 4. 啟動 Emulator Suite

```bash
# macOS 需指定 Java 21
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home

npx firebase-tools@latest emulators:start
```

> 若出現 Port 佔用錯誤：
>
> ```bash
> for port in 8080 9099 5002 4000 4400 4500 5001; do
>   lsof -ti :$port | xargs kill -9 2>/dev/null
> done
> ```

| 服務        | 位址                  |
| ----------- | --------------------- |
| 前端        | http://localhost:5002 |
| Emulator UI | http://localhost:4000 |
| Firestore   | localhost:8080        |
| Functions   | localhost:5001        |
| Auth        | localhost:9099        |

> **Vite dev server（不經 Firebase Hosting）：** `npm run dev --prefix webapp` → `localhost:5173`  
> E2E 測試使用此位址（`playwright.config.ts`）。

### 5. 新增第一個管理員帳號

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node -e "
const admin = require('./functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'brightah50-shift-master' });
admin.firestore().collection('users').doc('you@example.com').set({
  displayName: 'Admin', email: 'you@example.com', role: 'manager', isActive: true
}).then(() => { console.log('done'); process.exit(0); });
"
```

詳細測試流程見 [DEV_TESTING.md](DEV_TESTING.md)。

---

## 執行測試

```bash
cd functions

# Cloud Functions 單元測試（不需要 Emulator）
npm run test:unit

# Firestore Security Rules 整合測試（需先啟動 Firestore Emulator）
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home
npm run test:rules
```

```bash
# E2E 測試（Playwright）— 需要 emulator 已在 :8080, :9099 運行，Vite dev server 會自動啟動
cd webapp
npx playwright test
# 查看 HTML 報告
npx playwright show-report
```

---

## 部署

```bash
# 建置前端
npm run build --prefix webapp

# 部署 Cloud Functions + Firestore Rules + Indexes + Hosting
npx firebase-tools@latest deploy
```

---

## 專案結構

```
brightah50-shift-master/
├── .github/workflows/ci.yml  GitHub Actions CI/CD（4 jobs）
├── firebase.json              Firebase 部署設定
├── firestore.rules            Firestore 安全規則
├── firestore.indexes.json     Firestore 複合索引
├── .firebaserc                Firebase 專案指向
├── DEV_TESTING.md             本地開發與測試完整流程
├── PLAN.md                    各階段建置紀錄
├── functions/                 Cloud Functions（後端）
│   ├── src/
│   │   ├── index.ts           3 個 Functions 進入點
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
    │   └── unavailability.spec.ts 請假申請列表測試
    ├── playwright.config.ts
    ├── src/
    │   ├── components/
    │   │   ├── MonthControls.tsx       月份選擇 + 建立/發布（manager only）
    │   │   ├── ProtectedRoute.tsx      角色保護路由
    │   │   ├── QuickAssignModal.tsx    快速點選指派 popover
    │   │   ├── ShiftBoard.tsx          拖曳排班（DnD + QuickAssign 整合）
    │   │   └── UnavailabilityPanel.tsx 員工提報不可上班時間
    │   ├── contexts/AuthContext.tsx
    │   ├── hooks/useSchedule.ts
    │   ├── pages/
    │   │   ├── AdminPage.tsx           後台員工管理（manager only）
    │   │   ├── LoginPage.tsx           Google OAuth 登入
    │   │   ├── SchedulePage.tsx        主班表頁
    │   │   └── UnavailabilityListPage.tsx 請假申請列表（/unavailability）
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
| 發布/取消發布班表           |   ✅    |   —   |
| 查看班表                    |   ✅    |  ✅   |
| 提報不可上班時段            |    —    |  ✅   |
| 查看/刪除自己的請假紀錄     |    —    |  ✅   |
| 查看/刪除所有人的請假紀錄   |   ✅    |   —   |

---

## Firestore Schema

| 集合                            | 文件 ID   | 核心欄位                                                           |
| ------------------------------- | --------- | ------------------------------------------------------------------ |
| `users`                         | email     | `displayName`, `email`, `role`, `isActive`                         |
| `monthly_schedules`             | `YYYY-MM` | `year`, `month`, `isPublished`, `managerId`                        |
| `monthly_schedules/{id}/shifts` | `DD`      | `date`, `dayOfWeek`, `slots.{morning,afternoon,evening}: string[]` |
| `unavailability`                | 自動 ID   | `userId`, `userDisplayName`, `date`, `unavailableSlots`, `reason?` |

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
| `beforeusersignedin`   | Auth Blocking Trigger | 白名單比對 + 設定 `role` custom claim         |
| `initializeBlankMonth` | Callable (onCall)     | 建立月份文件 + 當月所有空白 shifts            |
| `onShiftUpdated`       | Firestore Trigger     | 已發布月份異動時記錄 log（TODO: Resend 通知） |
