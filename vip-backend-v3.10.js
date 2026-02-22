// ============================================
// VIP BACKEND
// Version 3.10
// Account: vipgrandstrand@gmail.com
// Date: February 22, 2026
// ============================================
// FIXES IN 3.8:
// FIX 1: Customer_Total_Spend uses phone lookup at write time
//         instead of stored rowIndex — prevents data corruption
//         if owner sorts/edits their dashboard sheet
// FIX 2: saveConfig now writes all 12 columns including
//         Redemption_PIN (column L) — prevents PIN being wiped
//         when config is saved via admin UI
// FIX 3: Added GET_BAR_SYNCS handler so owner portal can
//         refresh per-bar stale detection after a CSV upload
// FIXES IN 3.9:
// FIX 4: uploadPosData now writes to Bar_Sync_Log after each
//         CSV upload — updates LastSync timestamp per bar so
//         stale detection actually reflects real upload times
// FIXES IN 3.10:
// FIX 5: uploadPosData now returns unmatchedCodes array so
//         owner portal can display exactly which codes came
//         through POS but didn't match any registered customer
// ============================================

// ============================================
// GET HANDLER (health check)
// ============================================

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'OK',
      service: 'Grand Strand VIP Backend',
      version: '3.10',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// POST HANDLER
// ============================================

function doPost(e) {
  try {
    var params = e.parameter;
    var type = params.type;

    Logger.log('doPost called, type:', type);

    if (type === 'GET_CONFIG') return getConfig(params);
    if (type === 'VALIDATE_OWNER') return validateOwner(params);
    if (type === 'LOOKUP_BY_PHONE') return lookupByPhone(params);
    if (type === 'NEW_REGISTRATION') return newRegistration(params);
    if (type === 'LOG_VISIT') return logVisit(params);
    if (type === 'REDEEM_REWARD') return redeemReward(params);
    if (type === 'SAVE_CONFIG') return saveConfig(params);
    if (type === 'UPLOAD_POS_DATA') return uploadPosData(params);
    if (type === 'SYNC_OWNER_DASHBOARD') return syncOwnerDashboard(params);
    if (type === 'GET_BAR_SYNCS') return getBarSyncs(params); // FIX 3

    return jsonResponse({ status: 'ERROR', message: 'Unknown request type: ' + type });

  } catch (err) {
    Logger.log('doPost error:', err.toString());
    return jsonResponse({ status: 'ERROR', message: err.toString() });
  }
}

// ============================================
// GET CONFIG
// ============================================

function getConfig(params) {
  try {
    var barOwnerID = params.bar_owner;
    var barID = params.bar_id;

    var configSheet = getSheet('Config');
    var data = configSheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === barOwnerID && data[i][1] === barID) {
        return jsonResponse({
          status: 'SUCCESS',
          config: {
            expirationHours: data[i][2],
            dailyLimit: data[i][3],
            tier1Visits: data[i][4],
            tier1Reward: data[i][5],
            tier2Visits: data[i][6],
            tier2Reward: data[i][7],
            tier3Visits: data[i][8],
            tier3Reward: data[i][9],
            redemptionPin: data[i][11] ? String(data[i][11]) : '0000'
          }
        });
      }
    }

    return jsonResponse({
      status: 'SUCCESS',
      config: {
        expirationHours: 12,
        dailyLimit: 1,
        tier1Visits: 5,
        tier1Reward: 'Free Appetizer (up to $12)',
        tier2Visits: 10,
        tier2Reward: 'Free Well Drink',
        tier3Visits: 20,
        tier3Reward: '10% Off Entire Check',
        redemptionPin: '0000'
      }
    });

  } catch (err) {
    Logger.log('getConfig error:', err.toString());
    return jsonResponse({ status: 'ERROR', message: err.toString() });
  }
}

// ============================================
// VALIDATE OWNER
// ============================================

function validateOwner(params) {
  try {
    var ownerID = params.ownerID;
    var password = params.password;

    var ownersSheet = getSheet('Owners');
    var data = ownersSheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === ownerID && data[i][1] === password && data[i][6] === 'ACTIVE') {
        return jsonResponse({
          status: 'SUCCESS',
          owner: {
            ownerID: data[i][0],
            ownerName: data[i][2],
            barIDs: data[i][3],
            lastCSVSync: data[i][7] || ''
          }
        });
      }
    }

    return jsonResponse({ status: 'ERROR', message: 'Invalid Owner ID or Password' });

  } catch (err) {
    Logger.log('validateOwner error:', err.toString());
    return jsonResponse({ status: 'ERROR', message: err.toString() });
  }
}

// ============================================
// LOOKUP BY PHONE
// ============================================

function lookupByPhone(params) {
  try {
    var phone = params.phone.replace(/\D/g, '');
    var barOwnerID = params.bar_owner;
    var barID = params.bar_id;

    var signupsSheet = getSheet('Customer_Signups');
    var visitLogSheet = getSheet('Visit_Log');

    var signupsData = signupsSheet.getDataRange().getValues();
    var visitLogData = visitLogSheet.getDataRange().getValues();

    var customer = null;
    for (var i = 1; i < signupsData.length; i++) {
      var rowPhone = String(signupsData[i][0]).replace(/\D/g, '');
      if (rowPhone === phone) {
        customer = {
          phone: signupsData[i][0],
          firstName: signupsData[i][1],
          lastName: signupsData[i][2],
          code: signupsData[i][3],
          barID: signupsData[i][4],
          ownerID: signupsData[i][5],
          totalScans: signupsData[i][6],
          lastScan: signupsData[i][7]
        };
        break;
      }
    }

    if (!customer) {
      return jsonResponse({ status: 'NOT_FOUND' });
    }

    var visitsAtThisBar = 0;
    for (var j = 1; j < visitLogData.length; j++) {
      var vPhone = String(visitLogData[j][1]).replace(/\D/g, '');
      if (vPhone === phone && visitLogData[j][3] === barID) {
        visitsAtThisBar++;
      }
    }

    customer.visitsAtThisBar = visitsAtThisBar;

    return jsonResponse({ status: 'SUCCESS', customer: customer });

  } catch (err) {
    Logger.log('lookupByPhone error:', err.toString());
    return jsonResponse({ status: 'ERROR', message: err.toString() });
  }
}

// ============================================
// NEW REGISTRATION
// ============================================

function newRegistration(params) {
  try {
    var phone = params.phone.replace(/\D/g, '');
    var firstName = params.firstName;
    var lastName = params.lastName;
    var code = params.code;
    var barID = params.barID;
    var ownerID = params.ownerID;

    var signupsSheet = getSheet('Customer_Signups');
    var visitLogSheet = getSheet('Visit_Log');

    var data = signupsSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var rowPhone = String(data[i][0]).replace(/\D/g, '');
      if (rowPhone === phone) {
        return jsonResponse({ status: 'ALREADY_EXISTS', code: data[i][3], ownerID: data[i][5] });
      }
    }

    var now = new Date();

    signupsSheet.appendRow([
      phone, firstName, lastName, code,
      barID, ownerID, 1, now, now
    ]);

    visitLogSheet.appendRow([
      now, phone, code, barID, ownerID, 'REGISTRATION'
    ]);

    Logger.log('New registration:', phone, code);

    return jsonResponse({ status: 'SUCCESS', code: code });

  } catch (err) {
    Logger.log('newRegistration error:', err.toString());
    return jsonResponse({ status: 'ERROR', message: err.toString() });
  }
}

// ============================================
// LOG VISIT
// ============================================

function logVisit(params) {
  try {
    var phone = params.phone.replace(/\D/g, '');
    var code = params.code;
    var barID = params.barID;
    var ownerID = params.ownerID;

    var signupsSheet = getSheet('Customer_Signups');
    var visitLogSheet = getSheet('Visit_Log');

    var now = new Date();
    var today = now.toDateString();

    var visitData = visitLogSheet.getDataRange().getValues();
    for (var i = 1; i < visitData.length; i++) {
      var rowPhone = String(visitData[i][1]).replace(/\D/g, '');
      var rowDate = new Date(visitData[i][0]).toDateString();
      if (rowPhone === phone && visitData[i][3] === barID && rowDate === today) {
        return jsonResponse({ status: 'DUPLICATE', message: 'Already visited today' });
      }
    }

    var signupsData = signupsSheet.getDataRange().getValues();
    for (var j = 1; j < signupsData.length; j++) {
      var sPhone = String(signupsData[j][0]).replace(/\D/g, '');
      if (sPhone === phone) {
        var currentScans = signupsData[j][6] || 0;
        signupsSheet.getRange(j + 1, 7).setValue(currentScans + 1);
        signupsSheet.getRange(j + 1, 8).setValue(now);
        break;
      }
    }

    visitLogSheet.appendRow([
      now, phone, code, barID, ownerID, 'SCAN'
    ]);

    Logger.log('Visit logged:', phone, barID);

    return jsonResponse({ status: 'SUCCESS' });

  } catch (err) {
    Logger.log('logVisit error:', err.toString());
    return jsonResponse({ status: 'ERROR', message: err.toString() });
  }
}

// ============================================
// REDEEM REWARD
// ============================================

function redeemReward(params) {
  try {
    var phone = params.phone.replace(/\D/g, '');
    var code = params.code;
    var tier = params.tier;
    var barID = params.barID;
    var ownerID = params.ownerID;
    var visitsAtRedemption = params.visitsAtRedemption;

    var redemptionSheet = getSheet('Redemptions');
    var now = new Date();

    redemptionSheet.appendRow([
      now, phone, code, tier, visitsAtRedemption, barID, ownerID
    ]);

    Logger.log('Reward redeemed:', phone, tier);

    return jsonResponse({ status: 'SUCCESS' });

  } catch (err) {
    Logger.log('redeemReward error:', err.toString());
    return jsonResponse({ status: 'ERROR', message: err.toString() });
  }
}

// ============================================
// SAVE CONFIG
// FIX 2: Now writes all 12 columns including
// Redemption_PIN (column L) to prevent PIN being
// wiped when config is saved
// ============================================

function saveConfig(params) {
  try {
    var barOwnerID = params.barOwnerID;
    var barID = params.barID;
    var now = new Date();

    var configSheet = getSheet('Config');
    var data = configSheet.getDataRange().getValues();

    // Read existing PIN first so we don't overwrite it if not provided
    var existingPin = '0000';
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === barOwnerID && data[i][1] === barID) {
        existingPin = data[i][11] ? String(data[i][11]) : '0000';
        break;
      }
    }

    // FIX 2: Write all 12 columns — column L (index 11) is Redemption_PIN
    var configRow = [
      barOwnerID, barID,
      params.expirationHours, params.dailyLimit,
      params.tier1Visits, params.tier1Reward,
      params.tier2Visits, params.tier2Reward,
      params.tier3Visits, params.tier3Reward,
      now,
      params.redemptionPin || existingPin  // preserve existing PIN if not passed
    ];

    var rowIndex = -1;
    for (var j = 1; j < data.length; j++) {
      if (data[j][0] === barOwnerID && data[j][1] === barID) {
        rowIndex = j + 1;
        break;
      }
    }

    if (rowIndex > 0) {
      configSheet.getRange(rowIndex, 1, 1, 12).setValues([configRow]);
    } else {
      configSheet.appendRow(configRow);
    }

    Logger.log('Config saved:', barOwnerID, barID);

    return jsonResponse({ status: 'SUCCESS' });

  } catch (err) {
    Logger.log('saveConfig error:', err.toString());
    return jsonResponse({ status: 'ERROR', message: err.toString() });
  }
}

// ============================================
// UPLOAD POS DATA
// FIX 1: Customer_Total_Spend now uses phone
// number lookup at write time instead of stored
// rowIndex — safe against owner sorting/editing
// their dashboard sheet
// ============================================

function uploadPosData(params) {
  try {
    var ownerID = params.ownerID;
    var transactions = JSON.parse(params.transactions);

    Logger.log('POS upload for owner:', ownerID, '| Transactions:', transactions.length);

    var signupsSheet = getSheet('Customer_Signups');
    var signupsData = signupsSheet.getDataRange().getValues();

    var spendSheet = getSheet('Customer_Total_Spend');
    var spendData = spendSheet.getDataRange().getValues();

    // Build code->phone lookup map from signups (hash map for speed)
    var codeToPhone = {};
    var codeToName = {};
    for (var s = 1; s < signupsData.length; s++) {
      if (String(signupsData[s][5]) === ownerID) {
        var sCode = String(signupsData[s][3]);
        var sPhone = String(signupsData[s][0]).replace(/\D/g, '');
        codeToPhone[sCode] = sPhone;
        codeToName[sCode] = signupsData[s][1] + ' ' + signupsData[s][2];
      }
    }

    // Build customerMap keyed by phone — no rowIndex stored
    var customerMap = {};
    for (var i = 1; i < spendData.length; i++) {
      if (String(spendData[i][4]) === ownerID) {
        var p = String(spendData[i][0]).replace(/\D/g, '');
        customerMap[p] = {
          name: spendData[i][1],
          totalVisits: spendData[i][2] || 0,
          totalSpend: parseFloat(spendData[i][3]) || 0
          // NOTE: rowIndex intentionally NOT stored — FIX 1
        };
      }
    }

    var matched = 0;
    var unmatched = 0;
    var unmatchedCodes = []; // FIX 5: collect unmatched codes for reporting

    for (var t = 0; t < transactions.length; t++) {
      var txn = transactions[t];
      var txnPhone = codeToPhone[txn.code];
      var txnName = codeToName[txn.code];

      if (!txnPhone) {
        unmatched++;
        unmatchedCodes.push({ code: txn.code, locationID: txn.locationID, transactionID: txn.transactionID }); // FIX 5
        continue;
      }

      matched++;

      if (!customerMap[txnPhone]) {
        customerMap[txnPhone] = {
          name: txnName,
          totalVisits: 0,
          totalSpend: 0
        };
      }

      customerMap[txnPhone].totalSpend += parseFloat(txn.transactionTotal) || 0;
    }

    // Recalculate visit counts from Visit_Log
    var visitSheet = getSheet('Visit_Log');
    var visitData = visitSheet.getDataRange().getValues();

    for (var ph in customerMap) {
      customerMap[ph].totalVisits = 0;
    }

    for (var v = 1; v < visitData.length; v++) {
      if (String(visitData[v][4]) === ownerID) {
        var vp = String(visitData[v][1]).replace(/\D/g, '');
        if (customerMap[vp]) {
          customerMap[vp].totalVisits++;
        }
      }
    }

    var now = new Date();

    // FIX 1: Reload spend sheet fresh and do phone lookup at write time
    // This prevents row corruption if owner sorted their dashboard
    var freshSpendData = spendSheet.getDataRange().getValues();

    for (var cp in customerMap) {
      var customer = customerMap[cp];

      var row = [
        cp,
        customer.name,
        customer.totalVisits,
        customer.totalSpend.toFixed(2),
        ownerID,
        now
      ];

      // Find the correct row by phone + ownerID at write time
      var writeRowIndex = -1;
      for (var wr = 1; wr < freshSpendData.length; wr++) {
        var wrPhone = String(freshSpendData[wr][0]).replace(/\D/g, '');
        if (wrPhone === cp && String(freshSpendData[wr][4]) === ownerID) {
          writeRowIndex = wr + 1; // +1 because Sheets is 1-indexed
          break;
        }
      }

      if (writeRowIndex > 0) {
        spendSheet.getRange(writeRowIndex, 1, 1, 6).setValues([row]);
      } else {
        spendSheet.appendRow(row);
      }
    }

    updateLastCSVSync(ownerID, now);

    // FIX 4: Write per-bar sync timestamps to Bar_Sync_Log
    var barsUploaded = {};
    for (var bu = 0; bu < transactions.length; bu++) {
      var bid = String(transactions[bu].locationID || '').trim().toLowerCase();
      if (bid) barsUploaded[bid] = true;
    }
    updateBarSyncLog(ownerID, barsUploaded, now);

    syncOwnerDashboardInternal(ownerID);

    Logger.log('POS upload complete. Matched:', matched, '| Unmatched:', unmatched);

    return jsonResponse({
      status: 'SUCCESS',
      matched: matched,
      unmatched: unmatched,
      unmatchedCodes: unmatchedCodes, // FIX 5: list of unmatched codes for portal display
      lastSync: now.toISOString()
    });

  } catch (err) {
    Logger.log('uploadPosData error:', err.toString());
    return jsonResponse({ status: 'ERROR', message: err.toString() });
  }
}

// ============================================
// GET BAR SYNCS
// FIX 3: Returns per-bar last sync timestamps
// so owner portal stale detection stays accurate
// after a CSV upload
// ============================================

function getBarSyncs(params) {
  try {
    var ownerID = params.ownerID;

    var barSyncSheet;
    try {
      barSyncSheet = getSheet('Bar_Sync_Log');
    } catch (e) {
      // Sheet doesn't exist yet — return empty map, not an error
      return jsonResponse({ status: 'SUCCESS', barSyncs: {} });
    }

    var data = barSyncSheet.getDataRange().getValues();
    var barSyncs = {};

    // Bar_Sync_Log columns: OwnerID, BarID, LastSync
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === ownerID) {
        var barID = String(data[i][1]);
        barSyncs[barID] = data[i][2] ? new Date(data[i][2]).toISOString() : null;
      }
    }

    return jsonResponse({ status: 'SUCCESS', barSyncs: barSyncs });

  } catch (err) {
    Logger.log('getBarSyncs error:', err.toString());
    return jsonResponse({ status: 'ERROR', message: err.toString() });
  }
}

// ============================================
// SYNC OWNER DASHBOARD
// ============================================

function syncOwnerDashboard(params) {
  try {
    var ownerID = params.ownerID;
    syncOwnerDashboardInternal(ownerID);
    return jsonResponse({ status: 'SUCCESS' });
  } catch (err) {
    Logger.log('syncOwnerDashboard error:', err.toString());
    return jsonResponse({ status: 'ERROR', message: err.toString() });
  }
}

function syncOwnerDashboardInternal(ownerID) {
  Logger.log('=== SYNCING OWNER DASHBOARD:', ownerID, '===');

  try {
    var ownersSheet = getSheet('Owners');
    var ownersData = ownersSheet.getDataRange().getValues();

    var workbookURL = null;
    for (var i = 1; i < ownersData.length; i++) {
      if (ownersData[i][0] === ownerID) {
        workbookURL = ownersData[i][4];
        break;
      }
    }

    if (!workbookURL) {
      Logger.log('No workbook URL found for owner:', ownerID);
      return;
    }

    var sheetID = extractSheetID(workbookURL);
    if (!sheetID) {
      Logger.log('Could not extract sheet ID from URL:', workbookURL);
      return;
    }

    Logger.log('Writing to sheet ID:', sheetID);

    var ownerSS = SpreadsheetApp.openById(sheetID);

    syncTabToOwner(ownerSS, 'Customer_Signups', getSheet('Customer_Signups'), ownerID, 5);
    syncTabToOwner(ownerSS, 'Visit_Log', getSheet('Visit_Log'), ownerID, 4);
    syncTabToOwner(ownerSS, 'Config', getSheet('Config'), ownerID, 0);
    syncTabToOwner(ownerSS, 'Redemptions', getSheet('Redemptions'), ownerID, 6);
    syncTabToOwner(ownerSS, 'Customer_Total_Spend', getSheet('Customer_Total_Spend'), ownerID, 4);

    Logger.log('=== OWNER DASHBOARD SYNC COMPLETE ===');

  } catch (err) {
    Logger.log('syncOwnerDashboardInternal error:', err.toString());
  }
}

function syncTabToOwner(ownerSS, tabName, masterSheet, ownerID, ownerIDColumn) {
  try {
    var ownerSheet = ownerSS.getSheetByName(tabName);
    if (!ownerSheet) {
      ownerSheet = ownerSS.insertSheet(tabName);
    }

    var masterData = masterSheet.getDataRange().getValues();
    var headers = masterData[0];

    var ownerRows = [headers];
    for (var i = 1; i < masterData.length; i++) {
      if (String(masterData[i][ownerIDColumn]) === ownerID) {
        ownerRows.push(masterData[i]);
      }
    }

    ownerSheet.clearContents();

    if (ownerRows.length > 0) {
      ownerSheet.getRange(1, 1, ownerRows.length, ownerRows[0].length).setValues(ownerRows);
    }

    ownerSheet.getRange(1, 1, 1, headers.length)
      .setBackground('#0077b6')
      .setFontColor('white')
      .setFontWeight('bold');

    Logger.log(tabName + ' synced:', ownerRows.length - 1, 'rows');

  } catch (err) {
    Logger.log('syncTabToOwner error for', tabName, ':', err.toString());
  }
}

// ============================================
// UPDATE LAST CSV SYNC
// ============================================

function updateLastCSVSync(ownerID, timestamp) {
  try {
    var ownersSheet = getSheet('Owners');
    var data = ownersSheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === ownerID) {
        ownersSheet.getRange(i + 1, 8).setValue(timestamp);
        Logger.log('Last_CSV_Sync updated for:', ownerID);
        return;
      }
    }
  } catch (err) {
    Logger.log('updateLastCSVSync error:', err.toString());
  }
}

// ============================================
// UPDATE BAR SYNC LOG
// FIX 4: Writes LastSync timestamp per bar into
// Bar_Sync_Log tab after each CSV upload so the
// owner portal stale detection stays accurate
// ============================================

function updateBarSyncLog(ownerID, barsUploaded, timestamp) {
  try {
    var barSyncSheet = getSheet('Bar_Sync_Log');
    var data = barSyncSheet.getDataRange().getValues();

    for (var barID in barsUploaded) {
      var rowIndex = -1;

      // Find existing row for this owner+bar
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === ownerID && String(data[i][1]).toLowerCase() === barID) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex > 0) {
        // Update existing row
        barSyncSheet.getRange(rowIndex, 3).setValue(timestamp);
      } else {
        // New bar — append row
        barSyncSheet.appendRow([ownerID, barID, timestamp]);
      }

      Logger.log('Bar_Sync_Log updated:', ownerID, barID);
    }
  } catch (err) {
    Logger.log('updateBarSyncLog error:', err.toString());
  }
}

// ============================================
// MANUAL SYNC TRIGGER
// Change ownerID to sync any specific owner
// ============================================

function manualSyncOwner() {
  var ownerID = 'johns-bars'; // Change this to the owner you want to sync
  Logger.log('Manual sync triggered for:', ownerID);
  syncOwnerDashboardInternal(ownerID);
}

// ============================================
// SCHEDULED DAILY SYNC — runs at 7am every day
// Set this up once in Apps Script:
// Triggers > Add Trigger > dailySyncAllOwners
// Time-based > Day timer > 6am-7am
// ============================================

function dailySyncAllOwners() {
  Logger.log('=== DAILY SYNC STARTED:', new Date().toISOString(), '===');

  try {
    var ownersSheet = getSheet('Owners');
    var data = ownersSheet.getDataRange().getValues();

    var synced = 0;
    var skipped = 0;

    for (var i = 1; i < data.length; i++) {
      var ownerID = data[i][0];
      var status = data[i][6];

      if (!ownerID || status !== 'ACTIVE') {
        skipped++;
        continue;
      }

      Logger.log('Syncing owner:', ownerID);
      syncOwnerDashboardInternal(ownerID);
      synced++;

      // Small pause between owners to avoid hitting API limits
      Utilities.sleep(2000);
    }

    Logger.log('=== DAILY SYNC COMPLETE. Synced:', synced, '| Skipped:', skipped, '===');

  } catch (err) {
    Logger.log('dailySyncAllOwners error:', err.toString());
  }
}

// ============================================
// SEED TEST DATA
// ============================================

function seedTestData() {
  Logger.log('=== SEEDING TEST DATA ===');

  var ownerID = 'johns-bars';
  var barIDs = ['marshwalk', 'murphys', 'tikibar'];

  var fakeCustomers = [
    { phone: '8431110001', first: 'James',    last: 'Carter',  code: 'J8695' },
    { phone: '8431110002', first: 'Maria',    last: 'Lopez',   code: 'M2341' },
    { phone: '8431110003', first: 'Tyler',    last: 'Simmons', code: 'T5782' },
    { phone: '8431110004', first: 'Ashley',   last: 'Brooks',  code: 'A9134' },
    { phone: '8431110005', first: 'Derek',    last: 'Nguyen',  code: 'D3367' },
    { phone: '8431110006', first: 'Samantha', last: 'Patel',   code: 'S6621' },
    { phone: '8431110007', first: 'Kevin',    last: 'Walsh',   code: 'K4490' },
    { phone: '8431110008', first: 'Brittany', last: 'Moore',   code: 'B7753' },
    { phone: '8431110009', first: 'Carlos',   last: 'Rivera',  code: 'C1128' },
    { phone: '8431110010', first: 'Nicole',   last: 'Hunt',    code: 'N8844' }
  ];

  var signupsSheet = getSheet('Customer_Signups');
  if (signupsSheet.getLastRow() > 1) {
    signupsSheet.getRange(2, 1, signupsSheet.getLastRow() - 1, signupsSheet.getLastColumn()).clearContent();
  }

  var today = new Date();

  for (var ci = 0; ci < fakeCustomers.length; ci++) {
    var c = fakeCustomers[ci];
    var barID = barIDs[ci % barIDs.length];
    var regDate = new Date(today);
    regDate.setDate(today.getDate() - (14 - ci));
    signupsSheet.appendRow([
      c.phone, c.first, c.last,
      c.code, barID, ownerID, 0, '', regDate
    ]);
  }

  Logger.log('Customer_Signups seeded: 10 customers');

  var visitSheet = getSheet('Visit_Log');
  if (visitSheet.getLastRow() > 1) {
    visitSheet.getRange(2, 1, visitSheet.getLastRow() - 1, visitSheet.getLastColumn()).clearContent();
  }

  var visitCounts = [8, 12, 3, 6, 15, 2, 9, 4, 11, 7];

  for (var vi = 0; vi < fakeCustomers.length; vi++) {
    var vc = fakeCustomers[vi];
    var numVisits = visitCounts[vi];
    var vBarID = barIDs[vi % barIDs.length];

    for (var vv = 0; vv < numVisits; vv++) {
      var visitDate = new Date(today);
      visitDate.setDate(today.getDate() - vv);
      visitDate.setHours(19 + (vv % 4), 0, 0);
      visitSheet.appendRow([visitDate, vc.phone, vc.code, vBarID, ownerID, 'SCAN']);
    }

    var signupsData = signupsSheet.getDataRange().getValues();
    for (var sr = 1; sr < signupsData.length; sr++) {
      if (signupsData[sr][3] === vc.code) {
        signupsSheet.getRange(sr + 1, 7).setValue(numVisits);
        signupsSheet.getRange(sr + 1, 8).setValue(new Date());
        break;
      }
    }
  }

  Logger.log('Visit_Log seeded: 77 visits');

  var spendSheet = getSheet('Customer_Total_Spend');
  if (spendSheet.getLastRow() > 1) {
    spendSheet.getRange(2, 1, spendSheet.getLastRow() - 1, spendSheet.getLastColumn()).clearContent();
  }

  var spendAmounts = [178.75, 264.75, 28.50, 108.25, 439.25, 15.00, 197.75, 61.50, 279.00, 134.50];

  for (var si = 0; si < fakeCustomers.length; si++) {
    var sc = fakeCustomers[si];
    spendSheet.appendRow([
      sc.phone,
      sc.first + ' ' + sc.last,
      visitCounts[si],
      spendAmounts[si].toFixed(2),
      ownerID,
      new Date()
    ]);
  }

  Logger.log('Customer_Total_Spend seeded: 10 customers');
  Logger.log('=== SEED COMPLETE ===');
  Logger.log('Run manualSyncOwner() to push data to owner dashboard');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function extractSheetID(url) {
  var match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function initializeSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  Logger.log('Sheets found:');
  for (var i = 0; i < sheets.length; i++) {
    Logger.log('-', sheets[i].getName(), '| Rows:', sheets[i].getLastRow());
  }
}

function testSheetConnection() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('Spreadsheet name: ' + ss.getName());
  Logger.log('Spreadsheet ID: ' + ss.getId());

  var owners = ss.getSheetByName('Owners');
  Logger.log('Owners sheet found: ' + (owners ? 'YES' : 'NO'));

  if (owners) {
    var a2 = owners.getRange('A2').getValue();
    var e2 = owners.getRange('E2').getValue();
    Logger.log('A2 (Owner_ID): ' + a2);
    Logger.log('E2 (Workbook_URL): ' + e2);
  }
}
