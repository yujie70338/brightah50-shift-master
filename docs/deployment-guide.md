# Firebase 生產環境部署紀錄

專案：`brightah50-shift-master`  
部署日期：2026-05-13  
Firebase 帳號：`brightahshiftmaster@gmail.com`

---

## 部署架構

| 元件 | 規格 |
|---|---|
| Frontend | React 19 + TypeScript 5.8 + Vite |
| Backend | Cloud Functions (Node.js 24, 2nd Gen) |
| 資料庫 | Cloud Firestore (Standard, asia-northeast1) |
| 認證 | Firebase Auth + Identity Platform |
| 主機 | Firebase Hosting |
| 方案 | Blaze (pay-as-you-go) |

---

## 部署步驟

### 1. 啟用 Google Sign-in

在 Firebase Console → Authentication → Sign-in method 啟用 Google，並填入支援信箱 `brightahshiftmaster@gmail.com`。

### 2. 建立 Firestore 資料庫

在 Firebase Console → Firestore Database 建立資料庫：
- 版本：Standard edition
- 地區：`asia-northeast1`（東京）
- 模式：Production mode（之後由 `firestore.rules` 控管）

### 3. 修正 ESLint 錯誤（部署前必須通過）

#### 問題一：`functions/.eslintrc.js` — quote-props 錯誤

ESLint 規則物件中的 `quotes` 和 `indent` key 未加引號，被自身的 `quote-props: ["error", "as-needed"]` 規則判定為違規。

```js
// 修復前（會報錯）
rules: {
  quotes: ["error", "double"],
  indent: ["error", 2],
}

// 修復後
rules: {
  "quotes": ["error", "double"],
  "indent": ["error", 2],
}
```

#### 問題二：`functions/src/index.ts` — max-len 超過 100 字元

**Import 行過長**：將多個 import 拆成多行。

```ts
// 修復前（單行超過 100 字元）
import { User, MonthlySchedule, ShiftDocument, ShiftSlots, WeeklyTemplate, DayOfWeek } from "./types.js";

// 修復後
import {
  User, MonthlySchedule, ShiftDocument, ShiftSlots, WeeklyTemplate, DayOfWeek,
} from "./types.js";
```

**Template literal 行過長**：將計算結果提取為變數。

```ts
// 修復前
logger.info(`Staff filtered out: ${[...filteredOut].join(", ")}`);

// 修復後
const filteredStaff = [...filteredOut].join(", ");
logger.info(`Staff filtered out: ${filteredStaff}`);
```

### 4. 升級到 Blaze 方案

**問題**：部署 Cloud Functions 時出現以下錯誤：

```
Error: Build failed: Cloud Build API not enabled or Artifact Registry quota exceeded.
Functions require the Blaze (pay-as-you-go) plan.
```

**解決**：在 Firebase Console → 左下角「升級」按鈕，手動升級至 Blaze 方案。

### 5. 升級 Firebase Auth 至 Identity Platform

**問題**：部署 `beforeusersignedin` blocking function 時出現：

```
Error: Blocking Functions may only be configured for GCIP projects.
```

**解決**：在 Firebase Console → Authentication → 右上角「升級至 Identity Platform」。  
此操作免費，但需要 Blaze 方案才能使用。

### 6. 部署 Cloud Functions

```bash
npx -y firebase-tools@latest deploy --only functions
```

部署了 4 個 functions：

| Function | 觸發器 | 功能 |
|---|---|---|
| `beforeusersignedin` | Auth blocking | 驗證用戶是否在 Firestore 中存在且 `isActive: true` |
| `initializeBlankMonth` | HTTPS Callable | 初始化空白月份班表 |
| `applyWeeklyTemplate` | HTTPS Callable | 套用每週班表範本 |
| `onShiftUpdated` | Firestore trigger | 班表更新時同步相關資料 |

#### 問題：onShiftUpdated — Eventarc IAM 傳播延遲

首次部署 `onShiftUpdated`（Firestore trigger）失敗：

```
Error: Permission denied while using the Eventarc Service Agent.
The service account may not have been fully propagated yet.
```

**解決**：等待約 90 秒讓 IAM 權限傳播完成後重新部署，成功。

### 7. 部署 Firestore Rules、Indexes、Hosting

```bash
npx -y firebase-tools@latest deploy --only firestore,hosting
```

- Firestore security rules 套用
- Firestore indexes 建立
- Webapp 打包並部署至 `https://brightah50-shift-master.web.app`

**已授權網域**：`brightah50-shift-master.web.app` 預設已在 Auth 授權網域清單中，無需額外設定。

### 8. 建立第一個 Manager 用戶

在 Firestore Console → Database → 手動建立 collection `users`，並新增第一筆 document：

| 路徑 | `users/brightahshiftmaster@gmail.com` |
|---|---|
| `displayName` | `"管理員"` (string) |
| `email` | `"brightahshiftmaster@gmail.com"` (string) |
| `role` | `"manager"` (string) |
| `isActive` | `true` (boolean) |

> 此步驟必須在第一次登入前完成，否則 `beforeusersignedin` 會因找不到用戶資料而拒絕登入。

---

## 最終部署結果

| 項目 | 狀態 | 網址/位置 |
|---|---|---|
| Firebase Hosting | ✓ | https://brightah50-shift-master.web.app |
| Cloud Functions | ✓ | asia-northeast1（4 個） |
| Firestore Rules | ✓ | 生產模式規則 |
| Firestore Indexes | ✓ | asia-northeast1 |
| Firebase Auth + Identity Platform | ✓ | Google Sign-in 啟用 |
| Manager 用戶 | ✓ | `brightahshiftmaster@gmail.com` |

---

## 問題排查速查

| 錯誤訊息 | 原因 | 解決方法 |
|---|---|---|
| `quote-props` ESLint error | `.eslintrc.js` 中的規則 key 未加引號 | 將 `quotes`、`indent` 等 key 加上引號 |
| `max-len` ESLint error | 單行超過 100 字元限制 | 拆行或提取變數 |
| `Cloud Build API not enabled` | 未升級 Blaze 方案 | 升級至 Blaze 方案 |
| `Blocking Functions may only be configured for GCIP projects` | Auth 未升級至 Identity Platform | 在 Console 升級至 Identity Platform |
| `Permission denied while using the Eventarc Service Agent` | IAM 權限尚未傳播 | 等待 90 秒後重新部署 |
| 用戶登入被拒絕 | `users` collection 中無對應文件 | 手動在 Firestore 建立用戶文件 |
