# GRAND STRAND VIP
## Production Ready — Phase 2 Complete
Last Updated: February 22, 2026

---

## REPOSITORY FILES

1. `vip-pass-v3.7.html` — Customer VIP pass page (WordPress)
2. `owner-portal-v3.7.html` — Owner POS upload portal (contains v3.8 code)
3. `vip-backend-v3.10.js` — Grand Strand master backend (Google Apps Script)
4. `wordpress-redirect.html` — WordPress redirect handler
5. `docs/GrandStrandVIP-DataFlow-v3.9.md` — Data flow and sync reference
6. `README.md` — This file

---

## GOOGLE ACCOUNT

All sheets and scripts: vipgrandstrand@gmail.com

---

## BACKEND URL

https://script.google.com/macros/s/AKfycbx5A_LYlaGPiXsHuBxEWpsB5pF9_GCB8xrEclxpm2ieoK6zf_VRm9EzbnIZNJz8hmpVsQ/exec

Health check: visit URL in browser — should return `"version": "3.10"`

---

## OWNER PORTAL URL

https://vipgrandstrand-cpu.github.io/grandstrand-vip/owner-portal-v3.7.html

---

## VIP PASS URL

https://thestrandvip.com/vip-2

---

## GOOGLE DRIVE STRUCTURE

```
vipgrandstrand@gmail.com
    My Drive
        Grand Strand VIP
            Grand Strand VIP - Master (workbook)
            Owner Workbooks
                Johns Bars - VIP Dashboard
```

---

## GRAND STRAND MASTER WORKBOOK TABS

1. `Customer_Signups` — Phone, First_Name, Last_Name, Code, Bar_ID, Owner_ID, Total_Scans, Last_Scan, Registration_Date
2. `Visit_Log` — Timestamp, Phone, Code, Bar_ID, Owner_ID, Visit_Type
3. `Config` — Bar_OwnerID, BarID, Expiration_Hours, Daily_Limit, Tier1_Visits, Tier1_Reward, Tier2_Visits, Tier2_Reward, Tier3_Visits, Tier3_Reward, Updated_At, Redemption_PIN
4. `Redemptions` — Timestamp, Phone, Code, Tier, Visits_At_Redemption, Bar_ID, Owner_ID
5. `Owners` — Owner_ID, Password, Owner_Name, Bar_IDs, Workbook_URL, Created_Date, Status, Last_CSV_Sync, Notes
6. `Customer_Total_Spend` — Phone, Customer_Name, Total_Visits, Total_Spend, Owner_ID, Last_Updated
7. `Bar_Sync_Log` — OwnerID, BarID, LastSync

---

## OWNERS TAB IMPORTANT NOTES

- No trailing spaces in any cell especially Owner_ID, Password, Status
- Status must be exactly: ACTIVE
- Workbook_URL must be full Google Sheets URL
- Bar_IDs must be comma separated with no spaces e.g. marshwalk,murphys,tikibar

---

## CONFIG TAB IMPORTANT NOTES

- Column L (Redemption_PIN) must be set manually per bar
- If blank defaults to 0000
- Do not delete or reorder columns — backend reads by index
- All config changes take effect immediately on next customer scan

---

## WORDPRESS SETUP

VIP Pass Page:
- URL slug: /vip-2
- Paste vip-pass-v3.7.html content into Custom HTML block
- Owner Login button fixed bottom right corner links to owner portal

Owner Portal:
- Hosted on GitHub Pages
- Access via direct URL above
- Link on VIP pass page bottom right corner

---

## ADDING A NEW OWNER

1. Create new Google Sheet in Owner Workbooks folder
2. Name it: `[Owner Name] - VIP Dashboard`
3. Share with vipgrandstrand@gmail.com as Editor
4. Add row to Owners tab:
   - Owner_ID: no spaces, no trailing spaces, lowercase with hyphens e.g. johns-bars
   - Password: secure password
   - Owner_Name: display name
   - Bar_IDs: comma separated, no spaces
   - Workbook_URL: full Google Sheets URL
   - Created_Date: today
   - Status: ACTIVE (no trailing space)
   - Last_CSV_Sync: leave blank
   - Notes: optional
5. Add Config row for each bar location
6. Set Redemption_PIN in column L of Config for each bar

---

## QR CODE FORMAT

```
https://thestrandvip.com/vip-2?bar_owner=OWNER_ID&bar_id=BAR_ID
```

Example:
```
https://thestrandvip.com/vip-2?bar_owner=johns-bars&bar_id=marshwalk
```

---

## POS CSV FORMAT

Required columns (column names can vary, backend auto-detects):
- `Notes` — contains VIP code e.g. J8695
- `Transaction ID`
- `Location ID` — must match Bar_ID in Config tab exactly
- `Transaction Total`
- `Date` — optional but required for stale upload detection

VIP code format: one letter followed by exactly 4 digits e.g. B4521

---

## DASHBOARD SYNC SCHEDULE

| Trigger | What happens |
|---|---|
| Customer scans QR | Customer_Signups and Visit_Log update instantly |
| Owner uploads CSV | Customer_Total_Spend updates, Bar_Sync_Log updates, owner dashboard syncs immediately |
| Customer redeems reward | Redemptions tab updates instantly |
| 7am daily | All ACTIVE owner dashboards sync automatically |

See `docs/GrandStrandVIP-DataFlow-v3.9.md` for full data flow reference.

---

## MANUAL SYNC

To manually sync any owner dashboard:
1. Open Grand Strand Apps Script at script.google.com
2. Find `manualSyncOwner()` function
3. Change ownerID to target owner
4. Run the function

---

## APPS SCRIPT FUNCTIONS

- `seedTestData()` — populate master workbook with test data
- `manualSyncOwner()` — manually push data to owner dashboard
- `testSheetConnection()` — verify script is connected to correct sheet
- `testValidateOwner()` — debug owner login issues
- `initializeSheets()` — list all sheets and row counts

---

## VERSION HISTORY

| Version | Date | Notes |
|---|---|---|
| V1 | Feb 18 | Single workbook, manual POS matching |
| V2 | Feb 19 | Multi-workbook, owner portal, auto aggregation |
| V3 | Feb 19 | Dedicated Google account, direct sheet sync, CORS fixed |
| V3.6 | Feb 20 | Staff PIN redemption, 4-digit keypad, 3-attempt lockout |
| V3.7 | Feb 21 | Viewport fix, GitHub Pages hosting, hash map CSV matching, per-bar sync tracking, double submission fix, fetch timeout 25s |
| V3.8 backend | Feb 22 | Row corruption fix, PIN preservation fix, GET_BAR_SYNCS handler |
| V3.9 backend | Feb 22 | Bar_Sync_Log writes after CSV upload |
| V3.10 backend | Feb 22 | Unmatched VIP codes returned in upload response |
| V3.8 portal | Feb 22 | Compact layout, unmatched codes report display |

---

## PHASE 3 ROADMAP

- Analytics dashboard — visit trends, top customers, spend by bar
- Email/SMS integration — notify owners of activity
- Real-time notifications
