# Grand Strand VIP — Data Flow & Sync Reference
Version 3.9 | February 22, 2026

---

## Overview

There are two separate Google Sheets workbooks in this system:

- **Grand Strand VIP - Master** — the central database. All customer data, visits, spend, config, and redemptions live here. Only Grand Strand admins see this.
- **[Owner Name] - VIP Dashboard** — a per-owner read-only view of their own data. Bar owners log into this to see their customers and activity. One workbook per owner.

These two workbooks are NOT connected in real time. The owner dashboard is a snapshot that gets updated on a schedule or triggered by specific events described below.

---

## Master Workbook Tabs — What Updates Each One

---

### Customer_Signups
**What it stores:** One row per registered customer. Phone, name, VIP code, which bar they registered at, total scan count, last scan date.

**What triggers an update:**
- A new customer scans a QR code and completes the registration form → backend appends a new row immediately
- A returning customer scans a QR code → their Total_Scans and Last_Scan columns update immediately
- A customer registers at a bar they've never been to before → new row added for that bar

**What does NOT update it:**
- CSV uploads from the owner portal do not change Customer_Signups
- The 7am daily sync does not change Customer_Signups
- Redemptions do not change Customer_Signups

**Why Bar_ID shows the registration bar only:**
The Bar_ID column in Customer_Signups reflects where the customer first registered. It is a registration record, not a visit tracker. All subsequent bar visits are recorded in Visit_Log instead.

---

### Visit_Log
**What it stores:** One row per visit/scan event. Every time a customer scans a QR code, a new row is added regardless of which bar they scan at.

**What triggers an update:**
- Customer scans a QR code at any bar → new row appended immediately with timestamp, phone, code, bar ID, owner ID, and visit type (SCAN or REGISTRATION)
- New customer registration → also logs a REGISTRATION row at the same time as the signup

**What does NOT update it:**
- CSV uploads do not write to Visit_Log
- The 7am daily sync does not write to Visit_Log
- Redemptions do not write to Visit_Log

**Important:** Visit_Log is the source of truth for punch card counts. The backend reads this tab to calculate how many visits a customer has at each owner's bars, not Customer_Signups.

**Duplicate protection:** The backend checks Visit_Log before adding a new row. If the same customer already has a SCAN entry for the same bar on the same calendar day, the scan is rejected as a duplicate. This is per-bar — scanning at a second bar on the same day is allowed and logged.

---

### Customer_Total_Spend
**What it stores:** One row per customer per owner. Running total of matched POS transaction spend and visit count.

**What triggers an update:**
- Owner uploads a CSV through the owner portal → backend matches VIP codes in the Notes field to registered customers and updates or creates rows here immediately after upload

**What does NOT update it:**
- Customer scans do not update spend — spend only comes from POS data
- The 7am daily sync does not recalculate spend
- Registrations and redemptions do not touch this tab

**Why spend and visits can look out of sync:**
Spend totals only reflect transactions where the customer gave their VIP code at the POS. If a customer visits but doesn't give their code, that visit appears in Visit_Log but not in Customer_Total_Spend. This is by design — the two numbers measure different things.

---

### Redemptions
**What it stores:** One row per reward redemption. Timestamp, customer phone, code, tier redeemed, visit count at time of redemption, bar ID, owner ID.

**What triggers an update:**
- Customer taps a reward badge on their VIP pass and a bartender enters the correct PIN → backend appends a new row immediately

**What does NOT update it:**
- CSV uploads, daily sync, scans, and registrations do not touch this tab

---

### Config
**What it stores:** One row per bar. Expiration hours, daily limit, tier reward thresholds and descriptions, redemption PIN.

**What triggers an update:**
- Manual edit by Grand Strand admin directly in the sheet
- Future: Config Admin UI in owner portal (Phase 2) will write to this tab via SAVE_CONFIG

**What does NOT update it:**
- Customer activity of any kind does not touch Config
- The 7am sync does not touch Config

**Critical:** Column L (Redemption_PIN) must be set manually for each bar. If blank, the PIN defaults to 0000.

---

### Bar_Sync_Log
**What it stores:** One row per bar per owner. Tracks the last time a CSV was successfully uploaded for each specific bar location.

**What triggers an update:**
- Owner uploads a CSV through the owner portal → after processing, backend updates the LastSync timestamp for each bar that appeared in that CSV

**What it is used for:**
- Stale data detection in the owner portal — if an owner tries to upload a CSV that is older than the last sync for a given bar, the portal shows a warning before allowing the upload

---

### Owners
**What it stores:** One row per owner. Owner ID, password, name, bar IDs, dashboard workbook URL, status, last CSV sync date.

**What triggers an update:**
- Manual setup by Grand Strand admin when adding a new owner
- Last_CSV_Sync column updates automatically after every successful CSV upload

**What does NOT update it:**
- Customer activity does not touch this tab
- The 7am sync does not modify Owners

---

## Owner Dashboard Workbook — When It Updates

The owner dashboard is a filtered copy of the master workbook. It only shows data belonging to that owner. It is NOT a live connection — it is a snapshot that gets refreshed at specific trigger points.

---

### What triggers a dashboard sync:

| Trigger | When it happens |
|---|---|
| CSV upload | Immediately after a successful POS upload — dashboard syncs automatically |
| 7am daily sync | Every morning between 6am-7am — all ACTIVE owners synced one by one |
| Manual sync | Grand Strand admin runs manualSyncOwner() in Apps Script |

---

### What the sync copies to the owner dashboard:

| Tab | What gets copied |
|---|---|
| Customer_Signups | All customers where Owner_ID matches |
| Visit_Log | All visits where Owner_ID matches |
| Config | All config rows where Bar_OwnerID matches |
| Redemptions | All redemptions where Owner_ID matches |
| Customer_Total_Spend | All spend rows where Owner_ID matches |

---

### What the sync does NOT copy:
- Bar_Sync_Log — this is internal to Grand Strand only
- Owners tab — never shared with owner dashboards
- Other owners' data — the filter ensures each owner only sees their own rows

---

### Why the owner dashboard can be behind:

If a customer registers or scans at 9pm, that data is in the Master workbook immediately. But the owner dashboard won't reflect it until the next morning's 7am sync — unless the owner uploads a CSV in the meantime which triggers an immediate sync.

This is intentional. Syncing the dashboard after every single scan would exceed Google Apps Script's daily execution quotas, especially as the customer base grows.

**Owner expectation to set:** Tell owners their dashboard reflects activity as of the last CSV upload or 7am that morning. For real-time visit data they should check the VIP pass directly or wait for morning.

---

## Data Flow Diagram (Text Version)

```
CUSTOMER SCANS QR CODE
        |
        v
  VIP Pass (HTML)
        |
        v
  Apps Script Backend
        |
        +---> Customer_Signups (update Total_Scans)
        |
        +---> Visit_Log (new row)
        |
        (owner dashboard NOT updated yet)


OWNER UPLOADS CSV
        |
        v
  Owner Portal (HTML)
        |
        v
  Apps Script Backend
        |
        +---> Customer_Total_Spend (update spend totals)
        |
        +---> Owners tab (update Last_CSV_Sync)
        |
        +---> Bar_Sync_Log (update per-bar timestamps)
        |
        +---> Owner Dashboard Sync (push all tabs immediately)


CUSTOMER REDEEMS REWARD
        |
        v
  VIP Pass PIN keypad
        |
        v
  Apps Script Backend
        |
        +---> Redemptions (new row)
        |
        (owner dashboard NOT updated until next sync)


7AM DAILY SYNC (automated)
        |
        v
  Apps Script Backend
        |
        +---> Loops all ACTIVE owners
        |
        +---> Pushes Customer_Signups, Visit_Log, Config,
              Redemptions, Customer_Total_Spend
              to each owner's dashboard workbook
```

---

## Quick Reference — "Why isn't X showing up?"

| Symptom | Likely reason | Fix |
|---|---|---|
| New customer not in owner dashboard | Dashboard hasn't synced since registration | Upload a CSV or wait for 7am |
| Visit count looks low in dashboard | Visits logged after last sync | Upload a CSV or wait for 7am |
| Spend totals not showing | No CSV uploaded yet | Owner needs to upload POS CSV |
| Redemption not in owner dashboard | Happened after last sync | Will appear after next CSV upload or 7am |
| Bar_Sync_Log not updating | Old backend (pre-3.9) deployed | Redeploy vip-backend-v3.9.js |
| PIN not working after config change | saveConfig wiped column L | Redeploy vip-backend-v3.8+ and re-enter PIN manually |
| Owner dashboard shows wrong data | Owner sorted/edited their dashboard sheet | Pre-3.8 bug — fixed in 3.9, re-upload CSV |

---

*Last updated: February 22, 2026 — Version 3.9*
