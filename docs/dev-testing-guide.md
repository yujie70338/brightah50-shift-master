# 本地開發測試流程

> **AI Agent 測試**：本文件已為 AI subagent 自動測試而設計。  
> 每個測試章節都標明了前提條件、測試步驟與預期結果，  
> AI agent 可直接依照步驟逐一驗證。  
> 啟動 AI 測試的方式見最後一節「[AI Agent 測試指引](#ai-agent-測試指引)」。

---

## 目錄

- [本地開發測試流程](#本地開發測試流程)
  - [目錄](#目錄)
  - [1. 啟動環境](#1-啟動環境)
    - [服務位址](#服務位址)
    - [已知問題與解決方法](#已知問題與解決方法)
  - [2. 建立測試使用者（Seed）](#2-建立測試使用者seed)
  - [3. 功能測試：認證與授權](#3-功能測試認證與授權)
  - [4. 功能測試：管理者 — 班表管理](#4-功能測試管理者--班表管理)
  - [5. 功能測試：管理者 — 快速點選指派](#5-功能測試管理者--快速點選指派)
  - [6. 功能測試：管理者 — 後台管理員工](#6-功能測試管理者--後台管理員工)
  - [7. 功能測試：員工 — 提報不可上班](#7-功能測試員工--提報不可上班)
  - [8. 功能測試：員工 — 請假申請列表](#8-功能測試員工--請假申請列表)
  - [9. 功能測試：週班表模板管理](#9-功能測試週班表模板管理)
  - [10. 功能測試：油漆桶填充模式](#10-功能測試油漆桶填充模式)
  - [11. 功能測試：導覽列與 UI 優化](#11-功能測試導覽列與-ui-優化)
  - [12. 功能測試：Firestore 安全規則](#12-功能測試firestore-安全規則)
  - [13. 自動化測試指令](#13-自動化測試指令)
  - [14. AI Agent 測試指引](#14-ai-agent-測試指引)
    - [方式 A：在 GitHub Copilot Chat 啟動 subagent](#方式-a在-github-copilot-chat-啟動-subagent)
    - [方式 B：自動化測試腳本（AI agent 可執行）](#方式-b自動化測試腳本ai-agent-可執行)
    - [測試回報格式（AI agent 請依此格式回報）](#測試回報格式ai-agent-請依此格式回報)

---

## 1. 啟動環境

使用專案根目錄的一鍵腳本（推薦）：

```bash
cd /Users/yujiezheng/brightah50-shift-master
./dev-start.sh          # 啟動 emulator + seed 測試使用者
./dev-start.sh seed     # 僅重新 seed（emulator 已在跑）
./dev-start.sh kill     # 清除所有 port
```

腳本會自動處理 Java 21 環境變數、等待 emulator 就緒、執行 seed，並在最後列出所有服務位址與測試帳號。詳細說明見專案根目錄的 `README.md`。

### 服務位址

| 服務        | URL                   |
| ----------- | --------------------- |
| 前端        | http://localhost:5002 |
| Emulator UI | http://127.0.0.1:4000 |
| Auth        | 127.0.0.1:9099        |
| Firestore   | 127.0.0.1:8080        |
| Functions   | 127.0.0.1:5001        |

## 2. 建立測試使用者（Seed）

> **每次重啟 emulator 後 Firestore 資料會清空，需重新執行。**

**方式 A（建議）：使用 `./dev-start.sh`**

`./dev-start.sh` 會在啟動 emulator 後自動 seed 測試使用者。若 emulator 已在跑，僅需重新 seed：

```bash
cd /Users/yujiezheng/brightah50-shift-master
./dev-start.sh seed
```

**方式 B：使用 seed 腳本**

```bash
# 在另一個 terminal（emulator 需已啟動）
cd /Users/yujiezheng/brightah50-shift-master
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-users.js
```

預期輸出：`done: 9 users seeded`

**方式 B：inline 指令（與 seed-users.js 等效）**

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node -e "
const admin = require('/Users/yujiezheng/brightah50-shift-master/functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'brightah50-shift-master' });
const db = admin.firestore();
const users = [
  { email: 'manager@brightah50.com', displayName: '陳經理', role: 'manager', isActive: true },
  { email: 'staff1@brightah50.com',  displayName: '王小明', role: 'staff',   isActive: true },
  { email: 'staff2@brightah50.com',  displayName: '李小華', role: 'staff',   isActive: true },
  { email: 'staff3@brightah50.com',  displayName: '張小美', role: 'staff',   isActive: true },
  { email: 'staff4@brightah50.com',  displayName: '吳大山', role: 'staff',   isActive: true },
  { email: 'staff5@brightah50.com',  displayName: '林小雨', role: 'staff',   isActive: true },
  { email: 'staff6@brightah50.com',  displayName: '趙志明', role: 'staff',   isActive: true },
  { email: 'staff7@brightah50.com',  displayName: '黃美玲', role: 'staff',   isActive: true },
  { email: 'staff8@brightah50.com',  displayName: '周大偉', role: 'staff',   isActive: false },
];
Promise.all(users.map(u => db.collection('users').doc(u.email).set(u)))
  .then(() => { console.log('done'); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
"
```

> **白名單邏輯**：`beforeUserSignedIn` 會比對 Firestore `users/{email}`。  
> 若文件不存在，登入將被拒絕。Google 帳號的 email 必須與 `email` 欄位一致。  
> `staff8` 設為 `isActive: false`，用於測試停用員工不出現在排班列表。

**驗證 Seed 是否成功（可用 AI agent 執行）：**

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node -e "
const admin = require('/Users/yujiezheng/brightah50-shift-master/functions/node_modules/firebase-admin');
try { admin.app(); } catch { admin.initializeApp({ projectId: 'brightah50-shift-master' }); }
admin.firestore().collection('users').get()
  .then(s => { console.log('users count:', s.size); s.docs.forEach(d => console.log(' -', d.id, d.data().role, d.data().isActive)); process.exit(0); });
"
```

預期輸出：`users count: 9`，列出 1 manager + 7 active staff + 1 inactive staff。

---

## 3. 功能測試：認證與授權

**前提**：emulator 已啟動，Seed 已執行。

| #   | 測試步驟                                         | 預期結果                                                      |
| --- | ------------------------------------------------ | ------------------------------------------------------------- |
| 3-1 | 開啟 http://localhost:5002，未登入               | 自動導向 `/login`                                             |
| 3-2 | 直接訪問 http://localhost:5002/schedule          | 導向 `/login`                                                 |
| 3-3 | 直接訪問 http://localhost:5002/admin             | 導向 `/login`                                                 |
| 3-4 | 以 **不在白名單的 Google 帳號**登入              | 出現紅色錯誤框「帳號未授權，請確認帳密，或請洽管理員」        |
| 3-5 | 以 `staff1@brightah50.com` 登入後，訪問 `/admin` | 導向 `/schedule`（角色不符被擋）                              |
| 3-6 | 以 `manager@brightah50.com` 登入                 | 成功進入 `/schedule`，header 顯示「建立新月份」、「發布」按鈕 |
| 3-7 | 以 `staff1@brightah50.com` 登入                  | 成功進入 `/schedule`，**不顯示**「建立新月份」、「發布」按鈕  |

---

## 4. 功能測試：管理者 — 班表管理

**前提**：已以 `manager@brightah50.com` 登入。

| #   | 測試步驟                         | 預期結果                                     |
| --- | -------------------------------- | -------------------------------------------- |
| 4-1 | 選擇當前年月，點「建立新月份」   | 出現當月所有日期的空白排班表                 |
| 4-2 | 重複點「建立新月份」             | 顯示錯誤（already-exists），不建立重複月份   |
| 4-3 | 切換到不同月份再建立             | 可建立，月份選擇器可切換瀏覽                 |
| 4-4 | 將員工從左側欄**拖曳**到某日早班 | 員工姓名 chip 出現在目標格子，移除後消失     |
| 4-5 | 點擊員工 chip 上的 `×` 按鈕      | 員工立即從班別格子移除                       |
| 4-6 | 點「發布」                       | 員工登入後可看到班表（ReadOnlyBoard）        |
| 4-7 | 點「取消發布」                   | 員工重新登入後看不到班表內容（顯示尚未發布） |
| 4-8 | 切換月份選擇器到 5 年前/後的年份 | 年份下拉清單包含當前年 ±2 年，共 5 個選項    |

---

## 5. 功能測試：管理者 — 快速點選指派

**前提**：已以 `manager@brightah50.com` 登入，且已建立當月班表。

| #    | 測試步驟                                                                                          | 預期結果                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 5-1  | 點擊任一**空的**班別格子                                                                          | 出現浮動 popover，顯示「DD日 早/中/晚班 指派」標題與員工 checkbox 清單                               |
| 5-2  | 空格子未指派時                                                                                    | 格子中顯示灰色 `+` 圖示                                                                              |
| 5-3  | Popover 員工清單中，所有 `isActive: true` 的員工都顯示（包括 staff1–8，**不含** staff8 停用員工） | active 員工顯示，inactive（周大偉）不出現                                                            |
| 5-4  | 勾選一位員工                                                                                      | 該員工 chip 立即出現在格子中（Firestore real-time 更新）；再次開啟同格子的 popover，該員工顯示為勾選 |
| 5-5  | 取消勾選已指派員工                                                                                | 員工 chip 立即從格子移除                                                                             |
| 5-6  | 點「全選」                                                                                        | 所有 active 員工全部被指派到該格子                                                                   |
| 5-7  | 點「清除」                                                                                        | 所有員工從該格子移除                                                                                 |
| 5-8  | 點擊 popover **外部**                                                                             | Popover 關閉                                                                                         |
| 5-9  | Popover 開啟時按 **Escape**                                                                       | Popover 關閉                                                                                         |
| 5-10 | 點擊**已有員工**的格子                                                                            | Popover 開啟，已指派員工顯示為勾選狀態                                                               |
| 5-11 | 同時在另一個 terminal 插入 unavailability 紀錄（見下方指令），再點擊同一格子開啟 popover          | 有請假衝突的員工顯示 ⚠ 圖示                                                                          |
| 5-12 | 有 ⚠ 的員工仍可被勾選指派                                                                         | 允許管理者強制覆蓋                                                                                   |
| 5-13 | 拖拉員工仍可正常指派（與 popover 並存）                                                           | 拖拉後員工 chip 出現，且下次開啟 popover 顯示為勾選                                                  |

**插入 unavailability 測試資料（測試 5-11 用）：**

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node -e "
const admin = require('/Users/yujiezheng/brightah50-shift-master/functions/node_modules/firebase-admin');
try { admin.app(); } catch { admin.initializeApp({ projectId: 'brightah50-shift-master' }); }
const db = admin.firestore();
// 讓 staff1 在當月第 1 日早班提報不可上班
const today = new Date();
const dateStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-01';
db.collection('unavailability').add({
  userId: 'staff1@brightah50.com',
  userDisplayName: '王小明',
  date: dateStr,
  unavailableSlots: ['morning'],
  reason: '測試請假'
}).then(() => { console.log('unavailability added for', dateStr); process.exit(0); });
"
```

---

## 6. 功能測試：管理者 — 後台管理員工

**前提**：已以 `manager@brightah50.com` 登入。

| #   | 測試步驟                                         | 預期結果                                                    |
| --- | ------------------------------------------------ | ----------------------------------------------------------- |
| 6-1 | 點擊頂部導覽列「管理後台」連結，進入 `/admin`    | 顯示員工列表與新增員工表單                                  |
| 6-2 | 以 `staff` 角色登入後，直接訪問 `/admin`         | 被擋回 `/schedule`                                          |
| 6-3 | 在新增表單填入 Email、姓名，選角色「員工」，送出 | 員工出現在列表中；排班頁面的員工欄位同步出現                |
| 6-4 | 新增時不填 Email                                 | 顯示「Email 與姓名為必填」錯誤                              |
| 6-5 | 點某員工的「停用」按鈕                           | 員工狀態變為停用（列表中顯示半透明）；排班頁的 popover 與側欄不再顯示該員工 |
| 6-6 | 點「啟用」重新啟用                               | 員工重新出現在排班頁員工清單                                |
| 6-7 | 點某員工的「刪除」按鈕                           | 出現確認視窗「確定要刪除員工…？刪除後此員工將無法登入且從列表消失…」 |
| 6-8 | 確認刪除後                                       | 該員工立即從成員列表消失（管理員也看不到）；排班側欄與模板指派列表均不再出現 |
| 6-9 | 查看歷史班表（刪除前已排班的月份）               | 歷史班表仍顯示該員工的名字（軟刪除保留 Firestore 文件）     |

---

## 7. 功能測試：員工 — 提報不可上班

**前提**：已以任一 `staff*.@brightah50.com` 登入。

| #   | 測試步驟                                                      | 預期結果                                  |
| --- | ------------------------------------------------------------- | ----------------------------------------- |
| 7-1 | 班表頁下方顯示「提報不可上班時間」面板                        | 面板出現，有年/月/日/班別選擇器           |
| 7-2 | 選擇年月（年份下拉顯示當前年 ±2 年）                          | 選擇後日期選擇器更新為對應月份的天數      |
| 7-3 | 選擇日期與班別，點「提交」                                    | 成功送出，面板重置                        |
| 7-4 | 重複提交相同日期+班別                                         | 系統允許（各為獨立 document）或依規則拒絕 |
| 7-5 | 班表中對應日期+班別的員工 chip，出現 ⚠ 圖示（若管理者已指派） | amber 色邊框 + ⚠ 圖示                     |
| 7-6 | 管理者角色**看不到**提報面板                                  | 面板僅顯示給 `staff` 角色                 |

---

## 8. 功能測試：員工 — 請假申請列表

**前提**：已以任一 `staff*.@brightah50.com` 登入，且已提交至少一筆不可上班紀錄。

| #   | 測試步驟                                                 | 預期結果                                             |
| --- | -------------------------------------------------------- | ---------------------------------------------------- |
| 8-1 | 點擊 header「請假申請」連結，進入 `/unavailability`      | 顯示當月自己的不可上班紀錄，**無姓名欄**（只看自己） |
| 8-2 | 切換月份                                                 | 列表更新為所選月份的紀錄                             |
| 8-3 | 點「刪除」                                               | 紀錄立即消失，Firestore 已刪除                       |
| 8-4 | 以 `manager@brightah50.com` 登入後進入 `/unavailability` | 顯示**所有員工**的紀錄，有「姓名」欄位               |
| 8-5 | 管理者可刪除任意員工的紀錄                               | 刪除成功                                             |
| 8-6 | 員工無法看到其他人的紀錄                                 | 僅顯示自己提交的                                     |

---

## 9. 功能測試：週班表模板管理

**前提**：已以 `manager@brightah50.com` 登入。

| #    | 測試步驟                                                              | 預期結果                                                                     |
| ---- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 9-1  | 點擊頂部導覽列「班表模板」連結，進入 `/templates`                     | 頁面顯示左側模板列表與右側 7×3 格子編輯區                                   |
| 9-2  | 以 `staff` 角色登入後，直接訪問 `/templates`                          | 被擋回 `/schedule`                                                           |
| 9-3  | 點「＋ 新增模板」，填入模板名稱，點「儲存」                           | 模板出現在左側列表中                                                         |
| 9-4  | 點擊「早班 10–12」列的任一格子                                        | popover 向下展開，顯示員工 checkbox 清單                                     |
| 9-5  | 點擊「晚班 18–21:30」列的任一格子                                     | popover **向上展開**（不超出視窗底部），員工清單完整可見，不需捲動            |
| 9-6  | 勾選員工後關閉 popover，點「儲存」                                    | 指派資料儲存至 Firestore `weekly_templates` collection                       |
| 9-7  | 切換到排班頁，點「套用模板」                                          | 出現 ApplyTemplateModal，可選擇模板並套用至當前月份                          |
| 9-8  | 套用後，被指派的週幾的對應班別格子均出現模板中的員工                  | Union merge：現有員工保留，模板員工加入                                      |
| 9-9  | 模板中含已停用員工（`isActive: false`）或已刪除員工（`isDeleted: true`） | 套用時自動過濾，這些員工不會出現在排班中                                   |
| 9-10 | 點「刪除」刪除模板                                                    | 確認對話框 → 模板從列表移除，`weekly_templates` document 已刪除              |

---

## 10. 功能測試：油漆桶填充模式

**前提**：已以 `manager@brightah50.com` 登入，且已建立並發布當月班表。

| #    | 測試步驟                                                    | 預期結果                                                                    |
| ---- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| 10-1 | 點擊排班側欄中任一**啟用中**的員工                          | 側欄標題變為「🖌 {員工姓名}」，員工 chip 顯示藍色邊框高亮，側欄出現「點擊格子填入，ESC 退出」提示 |
| 10-2 | 點擊班表中任一空格子                                        | 該員工立即被加入格子（`arrayUnion`）；無需開啟 QuickAssignModal              |
| 10-3 | 再次點擊同一格子（員工已在其中）                            | No-op，不重複加入                                                           |
| 10-4 | 油漆桶模式下嘗試**拖曳**員工                                | 拖曳功能停用（`isDragDisabled`），無法拖動                                  |
| 10-5 | 按 **Escape**                                               | 退出油漆桶模式，側欄恢復正常「員工」標題，高亮消失                          |
| 10-6 | 再次點擊同一員工（已選取狀態）                              | 退出油漆桶模式                                                              |
| 10-7 | 點擊**停用中**的員工                                        | 無反應（不進入油漆桶模式）                                                  |
| 10-8 | 填入有請假衝突的格子                                        | 員工被加入，格子顯示 ⚠ 衝突標記（允許強制覆蓋）                            |

---

## 11. 功能測試：導覽列與 UI 優化

**前提**：emulator 已啟動，已登入。

| #    | 測試步驟                                          | 預期結果                                                                             |
| ---- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 11-1 | 以 manager 登入，檢查 `/schedule` 頁面頂部        | 顯示統一導覽列：班表 / 管理後台 / 班表模板 / 請假申請 / 使用者名稱 / 登出           |
| 11-2 | 檢查 `/admin` 頁面頂部                            | 顯示相同導覽列，「管理後台」連結以藍色粗體高亮                                      |
| 11-3 | 檢查 `/templates` 頁面頂部                        | 顯示相同導覽列，「班表模板」連結以藍色粗體高亮；頁面**有**導覽（舊版完全沒有）      |
| 11-4 | 檢查 `/unavailability` 頁面頂部                   | 顯示相同導覽列，「請假申請」連結以藍色粗體高亮                                      |
| 11-5 | 以 staff 登入，檢查導覽列                         | 不顯示「管理後台」和「班表模板」連結（manager only）                                |
| 11-6 | 在任一頁面點擊導覽列中的其他連結                  | 正確導向對應路由，無需用瀏覽器上下頁                                                |
| 11-7 | 在 `/templates` 點擊「晚班 18–21:30」任一格子    | popover 自動向上展開，員工清單完整顯示，**不**被視窗截斷                            |
| 11-8 | 在 `/templates` 點擊「早班 10–12」任一格子       | popover 向下展開（空間足夠時維持向下）                                               |

---

## 12. 功能測試：Firestore 安全規則

以下用 AI agent 或手動 curl 驗證 Firestore rules（需 emulator 在 `:8080`）：

| #     | 操作                              | 角色           | 預期    |
| ----- | --------------------------------- | -------------- | ------- |
| 12-1  | 讀取 `users` collection           | 已登入任何角色 | ✅ 允許 |
| 12-2  | 寫入 `users` collection           | 已登入 staff   | ❌ 拒絕 |
| 12-3  | 寫入 `users` collection           | 已登入 manager | ✅ 允許 |
| 12-4  | 讀取 `monthly_schedules`          | 已登入任何角色 | ✅ 允許 |
| 12-5  | 寫入 `monthly_schedules`          | 已登入 staff   | ❌ 拒絕 |
| 12-6  | 寫入 `monthly_schedules/shifts`   | 已登入 manager | ✅ 允許 |
| 12-7  | 建立自己的 `unavailability`       | 已登入 staff   | ✅ 允許 |
| 12-8  | 刪除他人的 `unavailability`       | 已登入 staff   | ❌ 拒絕 |
| 12-9  | 未登入讀取任何資料                | 未認證         | ❌ 拒絕 |
| 12-10 | 更新 user `isDeleted: true`       | 已登入 manager | ✅ 允許 |
| 12-11 | 更新 user `isDeleted: true`       | 已登入 staff   | ❌ 拒絕 |
| 12-12 | 讀取 `weekly_templates`           | 已登入任何角色 | ✅ 允許 |
| 12-13 | 寫入 `weekly_templates`           | 已登入 staff   | ❌ 拒絕 |
| 12-14 | 寫入 `weekly_templates`           | 已登入 manager | ✅ 允許 |

> 上述規則測試已包含在自動化 rules test 中，見 [functions/test/rules.test.ts](functions/test/rules.test.ts)。

---

## 13. 自動化測試指令

```bash
# Functions 單元測試（不需要 emulator，測試 Cloud Functions 邏輯）
cd /Users/yujiezheng/brightah50-shift-master/functions && npm run test:unit

# Firestore Security Rules 整合測試（需要 Firestore emulator 在 :8080）
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home
cd /Users/yujiezheng/brightah50-shift-master/functions && npm run test:rules

# Webapp TypeScript 型別檢查 + 建置
cd /Users/yujiezheng/brightah50-shift-master/webapp && npm run build

# Lint（兩個 workspace）
cd /Users/yujiezheng/brightah50-shift-master/functions && npm run lint
cd /Users/yujiezheng/brightah50-shift-master/webapp && npm run lint
```

**全部一次跑（CI 等效）：**

```bash
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home
cd /Users/yujiezheng/brightah50-shift-master

# lint + build
(cd functions && npm run lint && npm run build) && \
(cd webapp && npm run lint && npm run build) && \

# unit tests
(cd functions && npm run test:unit) && \

# rules tests（需要 emulator 已啟動或用 emulators:exec）
(cd functions && npm run test:rules)
```

---

## 14. AI Agent 測試指引

本文件可直接作為 AI subagent 的測試任務描述。啟動方式：

### 方式 A：在 GitHub Copilot Chat 啟動 subagent

在 VS Code 的 Copilot Chat 輸入：

```
請開啟一個 subagent，根據 docs/dev-testing-guide.md 的章節 3–8 逐一執行手動功能測試。
emulator 已在 localhost:5002 運行，Firestore 在 127.0.0.1:8080。
請使用 playwright 或 fetch 驗證每個測試項目，並回報哪些通過、哪些失敗。
```

### 方式 B：自動化測試腳本（AI agent 可執行）

AI agent 可執行以下指令進行非 UI 的功能驗證：

**1. 驗證 Firestore seed 是否正確：**

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node -e "
const admin = require('/Users/yujiezheng/brightah50-shift-master/functions/node_modules/firebase-admin');
try { admin.app(); } catch { admin.initializeApp({ projectId: 'brightah50-shift-master' }); }
const db = admin.firestore();
db.collection('users').get().then(s => {
  console.log('PASS: users count =', s.size);
  const roles = s.docs.map(d => d.data().role);
  console.log(roles.filter(r => r === 'manager').length === 1 ? 'PASS: 1 manager' : 'FAIL: manager count');
  console.log(roles.filter(r => r === 'staff').length === 8 ? 'PASS: 8 staff' : 'FAIL: staff count');
  process.exit(0);
});
"
```

**2. 建立班表並驗證 shift documents：**

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node -e "
const admin = require('/Users/yujiezheng/brightah50-shift-master/functions/node_modules/firebase-admin');
try { admin.app(); } catch { admin.initializeApp({ projectId: 'brightah50-shift-master' }); }
const db = admin.firestore();
const scheduleId = '2026-05';
db.collection('monthly_schedules').doc(scheduleId).collection('shifts').get().then(s => {
  if (s.size === 0) { console.log('INFO: No shifts yet, call initializeBlankMonth first'); process.exit(0); }
  console.log('PASS: shifts count =', s.size, '(should be 31 for May)');
  const first = s.docs[0].data();
  console.log(first.slots && Array.isArray(first.slots.morning) ? 'PASS: slots structure valid' : 'FAIL: slots structure');
  process.exit(0);
});
"
```

**3. 驗證快速指派寫入：**

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node -e "
const admin = require('/Users/yujiezheng/brightah50-shift-master/functions/node_modules/firebase-admin');
const { FieldValue } = admin.firestore;
try { admin.app(); } catch { admin.initializeApp({ projectId: 'brightah50-shift-master' }); }
const db = admin.firestore();
const ref = db.collection('monthly_schedules').doc('2026-05').collection('shifts').doc('01');
ref.update({ 'slots.morning': FieldValue.arrayUnion('staff1@brightah50.com') })
  .then(() => ref.get())
  .then(d => {
    const assigned = d.data().slots.morning;
    console.log(assigned.includes('staff1@brightah50.com') ? 'PASS: arrayUnion works' : 'FAIL: not found');
    return ref.update({ 'slots.morning': FieldValue.arrayRemove('staff1@brightah50.com') });
  })
  .then(() => { console.log('PASS: arrayRemove works'); process.exit(0); })
  .catch(e => { console.error('FAIL:', e.message); process.exit(1); });
"
```

**4. 執行完整自動化測試套件：**

```bash
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home
cd /Users/yujiezheng/brightah50-shift-master/functions
npm run test:unit 2>&1 | tail -5
npm run test:rules 2>&1 | tail -5
```

### 測試回報格式（AI agent 請依此格式回報）

```
## 測試結果摘要

| 章節 | 測試項目 | 結果 | 備註 |
|------|---------|------|------|
| 3    | 認證與授權 (3-1 ~ 3-7)         | ✅ 全部通過 / ❌ N 項失敗 | ... |
| 4    | 班表管理 (4-1 ~ 4-8)           | ✅ 全部通過 / ❌ N 項失敗 | ... |
| 5    | 快速點選指派 (5-1 ~ 5-13)      | ✅ 全部通過 / ❌ N 項失敗 | ... |
| 6    | 後台員工管理 (6-1 ~ 6-9)       | ✅ 全部通過 / ❌ N 項失敗 | ... |
| 7    | 員工提報不可上班 (7-1 ~ 7-6)   | ✅ 全部通過 / ❌ N 項失敗 | ... |
| 8    | 請假申請列表 (8-1 ~ 8-6)       | ✅ 全部通過 / ❌ N 項失敗 | ... |
| 9    | 週班表模板管理 (9-1 ~ 9-10)    | ✅ 全部通過 / ❌ N 項失敗 | ... |
| 10   | 油漆桶填充模式 (10-1 ~ 10-8)   | ✅ 全部通過 / ❌ N 項失敗 | ... |
| 11   | 導覽列與 UI 優化 (11-1 ~ 11-8) | ✅ 全部通過 / ❌ N 項失敗 | ... |
| 12   | Firestore 安全規則             | ✅ 自動化測試通過 | ... |
| 13   | 單元測試 + Build               | ✅ 全部通過 | ... |

**失敗項目詳情：**（若有）
- 6-7：刪除按鈕未顯示 — 原因：...
- 9-5：晚班 popover 仍被截斷 — 原因：...
```
