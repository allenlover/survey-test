// ================================================================
//  Google Apps Script — 問卷資料接收 + 區組隨機化配額控制
// ================================================================
//
//  【首次設定步驟】
//  1. 開啟你的 Google 試算表
//  2. 點選「擴充功能」→「Apps Script」
//  3. 把這段程式碼全部貼上（取代原有內容）
//  4. 在下方填入你的 GitHub Pages 網址（SURVEY_URL）
//  5. 點「部署」→「新增部署作業」→ 類型選「Web 應用程式」
//  6. 執行身分：「我」；存取權限：「所有人」
//  7. 複製部署後的 URL，貼到 config.json 的 google_sheet_endpoint
//
//  【啟用配額控制的額外步驟】
//  8. 在 config.json 設定 quota_per_cell（每組預計份數）
//  9. 回到 Apps Script 編輯器，執行 generateAssignmentQueue()
//  10. 確認試算表中出現「Queue」工作表，即完成設定
// ================================================================

// ★ 請填入你的 GitHub Pages 問卷網址（結尾不用加斜線）
// 範例：'https://allenlover.github.io/survey-template'
var SURVEY_URL = 'YOUR_GITHUB_PAGES_URL_HERE';

// 中途放棄逾時（分鐘）：超過此時間未送出視為放棄，該筆重新開放
var TIMEOUT_MINUTES = 30;


// ================================================================
//  GET 端點：分派組別給受測者
// ================================================================
function doGet(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return jsonResponse({ status: 'error', message: '伺服器忙碌，請稍後再試' });
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var queueSheet = ss.getSheetByName('Queue');

    if (!queueSheet) {
      return jsonResponse({
        status: 'error',
        message: '佇列尚未產生，請先在 Apps Script 執行 generateAssignmentQueue()'
      });
    }

    var data = queueSheet.getDataRange().getValues();
    // 欄位順序：[0]assignment_id [1]condition_code [2]status [3]assigned_at [4]completed_at
    var now = new Date();
    var timeoutMs = TIMEOUT_MINUTES * 60 * 1000;

    // 第一輪：回收逾時的 in_progress 筆數
    for (var i = 1; i < data.length; i++) {
      if (data[i][2] === 'in_progress' && data[i][3]) {
        var assignedAt = new Date(data[i][3]);
        if (now - assignedAt > timeoutMs) {
          queueSheet.getRange(i + 1, 3).setValue('pending');
          queueSheet.getRange(i + 1, 4).setValue('');
          data[i][2] = 'pending';
        }
      }
    }

    // 第二輪：找第一筆 pending
    for (var j = 1; j < data.length; j++) {
      if (data[j][2] === 'pending') {
        var assignmentId = data[j][0];
        var conditionCode = data[j][1];
        var timestamp = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

        queueSheet.getRange(j + 1, 3).setValue('in_progress');
        queueSheet.getRange(j + 1, 4).setValue(timestamp);

        return jsonResponse({
          status: 'ok',
          assignment_id: assignmentId,
          condition_code: conditionCode
        });
      }
    }

    // 佇列已滿
    return jsonResponse({ status: 'full', message: '問卷已達收件上限，感謝您的支持！' });

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  } finally {
    lock.releaseLock();
  }
}


// ================================================================
//  POST 端點：接收問卷資料
// ================================================================
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);

    // 若有 assignment_id，標記 Queue 中對應筆數為 completed
    if (data.assignment_id) {
      var queueSheet = ss.getSheetByName('Queue');
      if (queueSheet) {
        var queueData = queueSheet.getDataRange().getValues();
        for (var i = 1; i < queueData.length; i++) {
          if (String(queueData[i][0]) === String(data.assignment_id)) {
            var completedAt = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
            queueSheet.getRange(i + 1, 3).setValue('completed');
            queueSheet.getRange(i + 1, 5).setValue(completedAt);
            break;
          }
        }
      }
    }

    // 寫入 Responses 工作表
    var sheet = ss.getSheetByName('Responses');
    if (!sheet) {
      sheet = ss.insertSheet('Responses');
    }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(Object.keys(data));
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, Object.keys(data).length)
           .setFontWeight('bold')
           .setBackground('#d9ead3');
    }

    sheet.appendRow(Object.values(data));

    return jsonResponse({ status: 'success' });

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}


// ================================================================
//  產生隨機分派佇列（研究者在 Apps Script 編輯器手動執行一次）
// ================================================================
function generateAssignmentQueue() {
  if (SURVEY_URL === 'YOUR_GITHUB_PAGES_URL_HERE') {
    throw new Error('請先在程式碼頂部填入你的 SURVEY_URL，再執行此函式。');
  }

  // 從 GitHub Pages 取得 config.json
  var configUrl = SURVEY_URL + '/config.json';
  var response = UrlFetchApp.fetch(configUrl);
  var cfg = JSON.parse(response.getContentText());

  var quotaPerCell = cfg.quota_per_cell;
  if (!quotaPerCell || quotaPerCell <= 0) {
    throw new Error('config.json 中未設定 quota_per_cell，或數值無效。');
  }

  // 產生所有 factor 組合
  var combinations = buildCombinations(cfg.factors);
  Logger.log('組合數量：' + combinations.length + '，每組份數：' + quotaPerCell +
             '，總佇列筆數：' + combinations.length * quotaPerCell);

  // 每個組合複製 quotaPerCell 次
  var queue = [];
  combinations.forEach(function(code) {
    for (var i = 0; i < quotaPerCell; i++) {
      queue.push(code);
    }
  });

  // Fisher-Yates 洗牌
  for (var i = queue.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = queue[i];
    queue[i] = queue[j];
    queue[j] = tmp;
  }

  // 寫入 Queue 工作表（若已存在則清空重建）
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var queueSheet = ss.getSheetByName('Queue');
  if (queueSheet) {
    queueSheet.clear();
  } else {
    queueSheet = ss.insertSheet('Queue');
  }

  // 標題列
  queueSheet.appendRow(['assignment_id', 'condition_code', 'status', 'assigned_at', 'completed_at']);
  queueSheet.setFrozenRows(1);
  queueSheet.getRange(1, 1, 1, 5)
            .setFontWeight('bold')
            .setBackground('#cfe2f3');

  // 寫入所有分派筆數
  var rows = queue.map(function(code, idx) {
    return [idx + 1, code, 'pending', '', ''];
  });
  queueSheet.getRange(2, 1, rows.length, 5).setValues(rows);

  // 凍結欄寬（方便閱讀）
  queueSheet.setColumnWidth(1, 100);
  queueSheet.setColumnWidth(2, 180);
  queueSheet.setColumnWidth(3, 100);
  queueSheet.setColumnWidth(4, 160);
  queueSheet.setColumnWidth(5, 160);

  Logger.log('✅ 佇列產生完成，共 ' + queue.length + ' 筆，已寫入「Queue」工作表。');
  SpreadsheetApp.getUi().alert(
    '佇列產生完成！\n共 ' + queue.length + ' 筆（' +
    combinations.length + ' 個組合 × ' + quotaPerCell + ' 份）\n\n' +
    '請確認試算表的「Queue」工作表已正確顯示資料。'
  );
}

// 遞迴產生所有 factor 組合代碼，例如 ['JAH+IPH+ERE', 'JAH+IPH+ERD', ...]
function buildCombinations(factors) {
  var combinations = [''];
  factors.forEach(function(f) {
    var next = [];
    combinations.forEach(function(prefix) {
      f.levels.forEach(function(level) {
        var code = prefix ? (prefix + '+' + f.id + level.id) : (f.id + level.id);
        next.push(code);
      });
    });
    combinations = next;
  });
  return combinations;
}


// ================================================================
//  查看目前配額進度（研究者可隨時執行）
// ================================================================
function checkQuotaProgress() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var queueSheet = ss.getSheetByName('Queue');

  if (!queueSheet) {
    Logger.log('Queue 工作表不存在，請先執行 generateAssignmentQueue()');
    return;
  }

  var data = queueSheet.getDataRange().getValues();
  var counts = { pending: 0, in_progress: 0, completed: 0 };
  var byCond = {};

  for (var i = 1; i < data.length; i++) {
    var cond = data[i][1];
    var status = data[i][2];
    counts[status] = (counts[status] || 0) + 1;
    if (!byCond[cond]) byCond[cond] = { pending: 0, in_progress: 0, completed: 0 };
    byCond[cond][status] = (byCond[cond][status] || 0) + 1;
  }

  Logger.log('═══ 整體進度 ═══');
  Logger.log('已完成：' + counts.completed + ' 筆');
  Logger.log('進行中：' + counts.in_progress + ' 筆');
  Logger.log('待分派：' + counts.pending + ' 筆');
  Logger.log('');
  Logger.log('═══ 各組進度 ═══');
  Object.keys(byCond).sort().forEach(function(cond) {
    var c = byCond[cond];
    Logger.log(cond + ' → 完成 ' + c.completed + ' / 進行中 ' + c.in_progress + ' / 待分派 ' + c.pending);
  });
}


// ================================================================
//  工具函式
// ================================================================
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// 舊版相容測試（不使用配額時的測試寫入）
function testWrite() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Responses');
  if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  var sample = {
    timestamp: new Date().toLocaleString('zh-TW'),
    assignment_id: '',
    scenario_code: 'JAH+IPH+ERE',
    scenario_JA: 'H', scenario_IP: 'H', scenario_ER: 'E',
    mc_JA_1: '5', mc_JA_2: '6', mc_JA_3: '5',
    mc_IP_1: '2', mc_IP_2: '3', mc_IP_3: '2',
    task_ER_1: '聆聽需求', task_ER_2: '建立信任', task_ER_3: '',
    mc_ER_1: '2',
    hp_1: '5', hp_2: '6', hp_3: '5', hp_4: '4',
    hp_5: '5', hp_6: '6', hp_7: '5', hp_8: '3',
    hp_9: '2', hp_10: '3', hp_11: '2', hp_12: '2',
    hp_13: '2', hp_14: '3',
    age: '28', gender: '生理男', education: '大學',
    work_years: '3', work_months: '6',
    marital: '未婚', department: '業務銷售'
  };

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(Object.keys(sample));
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, Object.keys(sample).length)
         .setFontWeight('bold')
         .setBackground('#d9ead3');
  }
  sheet.appendRow(Object.values(sample));
  Logger.log('測試資料寫入成功');
}
