# RupiBook — AppScript Refactor Implementation Plan

## Goal

Refactor the Google Apps Script backend to eliminate all hardcoded ranges, make the Dashboard fully data-driven, fix the timestamp storage format, and split the monolithic `setupSheets()` into two focused functions.

**Scope: AppScript only. No frontend (`js/`) changes required.**

---

## Architecture After This Refactor

```
Config sheet  (manual — source of truth for categories & sources)
      │
      ▼
Budgets sheet  (auto-synced from Config, limits preserved)
      │
      ▼
Dashboard sheet  (fully dynamic — grows/shrinks with Budgets)
      ├── KPI Cards        (dynamic formulas)
      ├── Category Table   (dynamic rows — no hardcoded A11:E18)
      ├── Pivot: Category  (QUERY with open range)
      ├── Pivot: Monthly   (QUERY with open range)
      ├── Pie Chart        (dynamic range)
      ├── Budget Bar Chart (dynamic range)
      └── Combo Chart      (dynamic range)
```

---

## Improvement 1 — Store Timestamp as a Date Object

### Current code (`doPost`, line 35–47)

```javascript
var timestamp = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
var month     = Utilities.formatDate(now, TIMEZONE, "yyyy-MM");
sheet.appendRow([timestamp, amount, category, source, paymentMode, tags, comments, month]);
```

**Problem:** `timestamp` is stored as a **plain string** (e.g., `"2026-06-26 14:30:00"`). When Apps Script reads it back with `getValues()`, Google Sheets may or may not auto-convert it to a Date object depending on the Sheet's locale. This causes inconsistent parsing in `searchExpenses()` and `checkBudgets()`.

### Expected new behaviour

```javascript
var now = new Date();
sheet.appendRow([now, amount, category, source, paymentMode, tags, comments]);
// Month column (H) is now derived from an ARRAYFORMULA — see Improvement 2.
```

The Timestamp column A is formatted once in `setupSheets()`:
```javascript
exp.getRange("A:A").setNumberFormat("dd-MM-yyyy HH:mm:ss");
```

**Benefits:**
- Sheets stores a real Date value — sorting, filtering, and charting work correctly.
- `getValues()` always returns a Date object — no parsing ambiguity in any API function.
- Timezone issues in `searchExpenses()` are eliminated because `Utilities.formatDate(rowTs, TIMEZONE, ...)` receives a proper Date.

---

## Improvement 2 — Month Column (H) via ARRAYFORMULA

### Current code (`doPost`, line 36)

```javascript
var month = Utilities.formatDate(now, TIMEZONE, "yyyy-MM");
sheet.appendRow([..., month]);  // Column H written manually on every expense
```

**Problem:** The Month value is written once at logging time. If the timestamp is ever edited manually in the sheet, the Month column does not update.

### Expected new behaviour

Column H is **not written by `doPost()` anymore.** Instead, `setupSheets()` writes a single ARRAYFORMULA into H2 once:

```
=ARRAYFORMULA(IF(A2:A="", "", TEXT(A2:A, "yyyy-MM")))
```

**Benefits:**
- Month always matches the Timestamp automatically.
- Editing a timestamp manually causes Month to update instantly.
- No code path in `doPost()` needs to know about the Month column.
- All existing APIs (`getDashboardData`, `searchExpenses`, etc.) already read Column H — they continue to work unchanged.

> **Note:** `doPost()` must be updated to stop writing the Month value (remove the 8th element from `appendRow`).

---

## Improvement 3 — Sync Budgets from Config (Non-destructive)

### Current code (`setupSheets`, line 758–772)

```javascript
var bud = ss.getSheetByName("Budgets") || ss.insertSheet("Budgets");
if(bud.getLastRow() === 0) {
    bud.appendRow(["Category", "Monthly Limit"]);
    bud.getRange(2, 1, 8, 2).setValues([
        ["Food", 2000], ["Groceries", 5000], ...
    ]);
}
```

**Problem:** Budgets are only written when the sheet is empty. Adding a new category to Config does not automatically add it to Budgets.

### Expected new behaviour

Every time `setupSheets()` runs:

1. Read all unique categories from the **Config** sheet (Column A, deduplicated).
2. Read existing categories already in **Budgets** (preserve their limits).
3. For every Config category that does **not** exist in Budgets → append it with a default limit of `1000`.
4. Do **not** delete or overwrite any existing Budgets rows.

```
Before:
  Config     → Transport, Food, Bills, Health, Donate, Entertainment
  Budgets    → Food (2000), Transport (2000), Bills (4000)

After setupSheets():
  Budgets    → Food (2000), Transport (2000), Bills (4000),
               Health (1000) ← NEW, Donate (1000) ← NEW, Entertainment (1000) ← NEW
```

Existing limits are **never touched**.

---

## Improvement 4 — Dynamic Dashboard Table (no more hardcoded A11:E18)

### Current code (`setupSheets`, line 912–920)

```javascript
for(var i = 11; i <= 18; i++) {
    var budgetRow = i - 9;
    dash.getRange("A" + i).setFormula("=Budgets!A" + budgetRow);
    dash.getRange("B" + i).setFormula("=Budgets!B" + budgetRow);
    dash.getRange("C" + i).setFormula("=SUMIFS(...)");
    dash.getRange("D" + i).setFormula("=B" + i + "-C" + i);
    dash.getRange("E" + i).setFormula("=IF(...)");
}
dash.getRange("A11:E18").setBorder(...);
```

**Problem:** The loop is hardcoded to rows 11–18 (exactly 8 categories). Adding a 9th category in Budgets means it is never shown on the Dashboard until someone edits the script.

### Expected new behaviour

Before building the table, read Budgets to determine the number of categories:

```javascript
var budgetData = bud.getDataRange().getValues();
var numCategories = budgetData.length - 1;  // subtract header row
var lastTableRow = 10 + numCategories;       // row 10 is the header
```

Then build formulas for rows 11 through `lastTableRow` dynamically:

```javascript
for(var i = 11; i <= lastTableRow; i++) {
    var budgetRow = i - 9;
    // same formula logic — loop now goes to lastTableRow
}
dash.getRange("A11:E" + lastTableRow).setBorder(...);
```

**Result:**
- 8 categories → rows 11–18 (same as today)
- 12 categories → rows 11–22 (automatic)
- 5 categories → rows 11–15 (automatic)

No script change ever needed when adding/removing a category.

---

## Improvement 5 — Dynamic KPI Formulas

### Current code (`setupSheets`, line 890)

```javascript
dash.getRange("B4").setFormula("=SUM(C11:C18)");
```

**Problem:** Hardcoded to row 18. If the table grows, `Total Spent` is wrong.

### Expected new behaviour

After computing `lastTableRow`:

```javascript
dash.getRange("B4").setFormula("=SUM(C11:C" + lastTableRow + ")");
```

| Cell | Current | New |
|------|---------|-----|
| B4 (Total Spent) | `=SUM(C11:C18)` | `=SUM(C11:C<lastTableRow>)` |
| B6 (Remaining) | `=B5-B4` | unchanged |
| B7 (% Used) | `=B4/B5` | unchanged |

---

## Improvement 6 — Dynamic Chart Ranges

### Current code (lines 986, 1002, 1023–1025)

```javascript
// Pie chart
.addRange(dash.getRange("G10:H18"))

// Combo chart
.addRange(dash.getRange("J10:L50"))

// Budget bar chart
.addRange(dash.getRange("A10:A18"))
.addRange(dash.getRange("B10:B18"))
.addRange(dash.getRange("C10:C18"))
```

**Problem:** All three charts have hardcoded row numbers. Adding categories breaks the Pie and Bar charts.

### Expected new behaviour

```javascript
// Pie chart
.addRange(dash.getRange("G10:H" + lastTableRow))

// Combo chart — dynamic last month row
.addRange(dash.getRange("J10:L" + lastMonthRow))

// Budget bar chart
.addRange(dash.getRange("A10:A" + lastTableRow))
.addRange(dash.getRange("B10:B" + lastTableRow))
.addRange(dash.getRange("C10:C" + lastTableRow))
```

`lastMonthRow` is computed by reading the last non-empty row in column J.

---

## Improvement 7 — Dynamic Conditional Formatting Range

### Current code (line 930)

```javascript
var rangeE = dash.getRange("E11:E18");
```

**Problem:** Green/red formatting only applies to 8 rows.

### Expected new behaviour

```javascript
var rangeE = dash.getRange("E11:E" + lastTableRow);
```

---

## Improvement 8 — Split into `setupSheets()` + `refreshDashboard()`

### Current code

`setupSheets()` is a single ~300-line function that creates all sheets AND rebuilds the entire Dashboard.

**Problem:** Running `setupSheets()` to update the Dashboard after adding a budget category also re-runs all sheet-creation logic unnecessarily.

### Expected new behaviour

#### `setupSheets()` — creates sheets, syncs data, then delegates
- Creates Expenses, Budgets, Settings, Config, Autopay, PaymentModes if **missing**.
- Syncs Budgets from Config (Improvement 3).
- Writes ARRAYFORMULA into Expenses H2 (Improvement 2).
- Formats Expenses column A as `dd-MM-yyyy HH:mm:ss`.
- Calls `refreshDashboard()` at the end.

#### `refreshDashboard()` — new standalone function
- Clears Dashboard contents, formats, conditional formatting, and charts.
- Reads Budgets to determine `numCategories` and `lastTableRow`.
- Writes KPI cards, category table, pivot queries, all 3 charts.
- Applies conditional formatting over the dynamic range.
- Can be triggered independently from the menu without touching any data sheets.

#### `onOpen()` menu — add new item

```javascript
.addItem("🔄 Refresh Dashboard only", "refreshDashboard")
```

---

## Summary Table

| # | Change | Affected Function | Impact |
|---|--------|-------------------|--------|
| 1 | Timestamp stored as `new Date()` | `doPost()` | Fixes date parsing consistency |
| 2 | Month column → ARRAYFORMULA, removed from `doPost()` | `doPost()` + `setupSheets()` | Month always correct |
| 3 | Budgets synced non-destructively from Config | `setupSheets()` | Adding category is one-step |
| 4 | Dashboard table rows dynamic | `refreshDashboard()` | No hardcoded A11:E18 |
| 5 | KPI formulas use `lastTableRow` | `refreshDashboard()` | Total Spent always accurate |
| 6 | All 3 chart ranges dynamic | `refreshDashboard()` | Charts always cover all categories |
| 7 | Conditional formatting uses `lastTableRow` | `refreshDashboard()` | Color coding covers all rows |
| 8 | Split into `setupSheets()` + `refreshDashboard()` | New function | Cleaner, faster, safer |

## What Does NOT Change

- `doGet()` router
- `getDashboardData()` — reads Month column H (still works)
- `getAnalyticsData()` — no change
- `searchExpenses()` — no change
- `checkBudgets()` — reads Month column H (still works)
- `getRecentExpenses()` — no change
- `getFilterValues()` — no change
- `logAutopay()` — no change
- All sheet names and column layouts — unchanged
- All API response shapes — unchanged

---

## Open Questions

> [!IMPORTANT]
> **Existing string timestamps:** All current rows in Expenses have timestamps stored as strings (e.g., `"2026-06-26 14:30:00"`). New rows will store a real Date object. The two formats will coexist. Do you want a one-time migration script to convert existing strings to Date objects?

> [!IMPORTANT]
> **ARRAYFORMULA overwriting existing Month data:** Placing the ARRAYFORMULA in H2 will override all current values in column H. The formula derives Month from Timestamp, so values will be equivalent — but only if existing timestamps are parseable by Sheets. Confirm before we proceed.

> [!NOTE]
> **Default limit for new synced categories:** The plan uses `1000` as the default limit when a new category from Config is added to Budgets. Is `1000` the right default, or do you want a different value?
