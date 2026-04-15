# Factorial Design Survey Template

彰化師範大學人力資源管理研究所
故事情境法（Scenario-based Method）問卷模板

---

## 檔案說明

| 檔案 | 說明 |
|---|---|
| `index.html` | 問卷主頁面（不需要修改） |
| `config.json` | ★ 研究設定檔（每次新研究只改這個）|
| `apps-script.gs` | Google 試算表接收腳本 |
| `ai_guide.md` | 不熟悉設定時，把此檔連同 config.json 丟給 AI，AI 會引導你完成設定 |
| `後輩使用指南.md` | 學弟妹第一次使用的操作步驟說明 |
| `README.md` | 本說明文件 |

---

## 每次新研究（學弟妹使用流程）

### Step 1：Fork 或 Use template
先辦 GitHub 帳號，然後在此頁面右上點「Fork」（或「Use this template」），建立自己的副本。

Fork 完成後，你的問卷網址格式已確定為：
```
https://你的GitHub帳號.github.io/你的repo名稱/
```
先記下來，Step 2 會用到。

---

### Step 2：建立 Google 試算表 + 部署接收腳本

1. 建立新的 Google 試算表（空白即可）
2. 點「擴充功能」→「Apps Script」
3. 把 `apps-script.gs` 的內容全部貼上
4. 在程式碼**最頂部**找到以下這行，填入你的問卷網址：
```javascript
var SURVEY_URL = 'https://你的GitHub帳號.github.io/你的repo名稱';
```
5. 點「部署」→「新增部署作業」
6. 類型選「**Web 應用程式**」
7. 執行身分：「我」；存取權限：「**所有人**」
8. 點「部署」→ 複製產生的 URL，長得像這樣：
```
https://script.google.com/macros/s/AKfycb.../exec
```

**把這串 URL 複製起來，Step 3 會用到。**

---

### Step 3：修改 config.json
1. 在你 fork 後的 repo 頁面，點 `config.json`
2. 點右上角鉛筆圖示「**Edit**」
3. 修改以下欄位：

```json
{
  "study": {
    "name": "你的研究題目",
    "researcher": "你的名字",
    "advisor": "指導教授",
    "institution": "學校系所",
    "contact_email": "你的信箱",
    "google_sheet_endpoint": "貼上 Step 2 複製的 URL"
  },
  "quota_per_cell": 30,
  ...
}
```

4. 修改 `factors` 裡的情境文字、`scales` 裡的量表題目（依你的研究設計調整）
5. 點「**Commit changes**」儲存

> **不知道怎麼填？** 打開 `ai_guide.md`，把裡面的內容連同你的 `config.json` 一起貼給 AI，AI 會逐步問你研究架構、情境文字、量表題目，最後幫你產出完整的 config.json

---

### Step 4：開啟 GitHub Pages
1. 進入你的 repo → 上方點「**Settings**」
2. 左側選單點「**Pages**」
3. Source 選「**Deploy from a branch**」
4. Branch 選「**main**」，資料夾選「**/ (root)**」
5. 點「**Save**」
6. 等約 1 分鐘，頁面上會出現你的問卷網址：

```
https://你的GitHub帳號.github.io/你的repo名稱/
```

---

### Step 5：啟用配額控制（選用）

若你在 config.json 設定了 `quota_per_cell`（大於 0），需要執行一次以下步驟讓系統預先產生隨機分派佇列：

1. 回到 Apps Script 編輯器（試算表 →「擴充功能」→「Apps Script」）
2. 在函式下拉選單選「**generateAssignmentQueue**」
3. 點「**執行**」
4. 確認試算表中出現「**Queue**」工作表，即完成設定

> 若 `quota_per_cell` 設為 `0`，系統改用簡單隨機法分派，不需要執行此步驟。

---

### Step 6：分享問卷連結
你的 GitHub Pages URL 就是問卷連結，可以直接貼到 LINE / Facebook 發放。

---

## config.json 說明

### 配額控制（`quota_per_cell`）

| 值 | 行為 |
|---|---|
| `0` | 關閉配額控制，使用簡單隨機分派 |
| 正整數（如 `30`） | 每個情境組合預計收取的份數，需搭配執行 `generateAssignmentQueue()` |

配額啟用時，試算表會多一個「**Queue**」工作表，記錄每筆分派的狀態（pending / in_progress / completed）。中途放棄的受測者所佔的名額，30 分鐘後會自動回收重新開放。

---

### Factor 類型

**一般情境型**（`manipulation_type: "scale"`）：
- 顯示情境文字
- 接著 Likert 量表操弄確認題

**任務型**（`manipulation_type: "task_then_scale"`）：
- 顯示共享情境文字（`scenario_shared`）
- 顯示任務（開放式填答欄位）
- 接著 Likert 量表操弄確認題

---

### Scale 類型（`scales` 陣列）

每個量表是獨立一頁，可與 factor 頁交叉排列。每個量表需設定：

| 欄位 | 說明 |
|---|---|
| `id` | 英文縮寫，如 `HP`、`MC`，也作為資料欄位前綴 |
| `role` | 變項角色：`x` / `mediator` / `moderator` / `y` |
| `name` | 量表名稱 |
| `items` | 量表題目陣列 |
| `scale` | `{ "points": 7, "labels": [...] }` |

---

### 頁面順序（`survey_order`）

`survey_order` 陣列決定問卷頁面順序，可讓 factor 頁和 scale 頁任意交叉。

```json
"survey_order": ["JA", "MC", "IP", "HP"]
```

---

### 支援的設計

| 設計 | 支援 |
|---|---|
| 單因子 1×2 | ✅ |
| 雙因子 2×2 | ✅ |
| 三因子 2×2×2 | ✅ |
| 每因子 3 個 level | ✅（在 levels 陣列加第三個） |
| 多量表（mediator、moderator、Y）| ✅ |
| 配額控制（區組隨機化）| ✅ |

---

### 隨機分派說明

| 模式 | 條件 | 說明 |
|---|---|---|
| 配額模式 | `quota_per_cell > 0` | 預先產生各組平衡的分派佇列，確保各組人數符合預期 |
| 簡單隨機 | `quota_per_cell = 0` | 每位受測者各自獨立隨機抽取，大樣本下趨於平衡 |

---

## 資料欄位說明

每筆資料包含以下欄位：

| 欄位 | 說明 |
|---|---|
| timestamp | 填答時間 |
| assignment_id | 配額佇列流水號（簡單隨機模式下為空） |
| scenario_code | 情境代碼，如 JAH+IPH+ERE |
| scenario_JA / _IP / _ER | 各 factor 被分派的 level |
| mc_JA_1~3 | JA 操弄確認題 1-3 |
| mc_IP_1~3 | IP 操弄確認題 1-3 |
| task_ER_1~N | 開放式任務填答 |
| mc_ER_1 | ER 難易度評分 |
| hp_1~14 | 和諧式熱情量表 |
| age / gender / education... | 基本資料 |

---

## 問題排除

**問卷載入空白？**
→ 確認 `config.json` 與 `index.html` 在同一個資料夾

**資料沒有進試算表？**
→ 確認 Apps Script 部署時「存取權限」設為「所有人」
→ 可先在 config.json 把 endpoint 留空，開 Console 確認 payload 格式正確

**受測者看到「問卷已達收件上限」？**
→ 配額已用完，這是正常現象
→ 若要追加名額，修改 config.json 的 `quota_per_cell` 後重新執行 `generateAssignmentQueue()`（注意：這會清空並重建佇列，建議在正式收集前設定好）

**Queue 工作表沒有出現？**
→ 確認已執行 `generateAssignmentQueue()`
→ 確認 `apps-script.gs` 頂部的 `SURVEY_URL` 已正確填入

**測試模式**
把 `google_sheet_endpoint` 設為空白或 `YOUR_APPS_SCRIPT_URL_HERE`，
送出時會把資料印到瀏覽器 Console（按 F12 查看），方便測試。

---

## 聯絡

如有問題請聯絡實驗室研究生或參考 `config.json` 內的聯絡資訊。
