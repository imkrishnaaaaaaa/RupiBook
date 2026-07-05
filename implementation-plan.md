# RupiBook — Bug Fix Plan: 5 Issues

---

## Issue Inventory

| # | Severity | File(s) | Description |
|---|---|---|---|
| B-1 | 🔴 High | `appscript-source.txt` | `getDashboardData()` reads Column H (Month) but the ARRAYFORMULA in H2 computes `TEXT(A,"yyyy-MM")` only for rows where column A is a Date. However **the blank-row guard** `if(!rows[i][0] || rows[i][1] === "")` in getDashboardData skips rows where amount is literally `""` — but if the Month formula returns `""` for new rows (before flush), the whole sum is 0. **Root cause: `rowMonth` is compared as `String(rowMonth)` but it might actually be a number or empty cell after ARRAYFORMULA computation.** Need to verify by also checking: does the ARRAYFORMULA in H produce the right string for `new Date()` appended rows? |
| B-2 | 🔴 High | `appscript-source.txt` | `checkBudgets()` notification message shows `0` count — it prints `totalSpent` formatted via `fmt()` but the log already shows `totalSpent=0`. This is the **same root cause as B-1** — the Month filter mismatches so no rows accumulate. Fix B-1 fixes B-2. |
| B-3 | 🟡 Medium | `js/dashboard.js`, `index.html` | Top Sources chart shows **all-time** data (`analytics.sourceBreakdown` is ALL time) but is displayed on the Dashboard without scope indication. Need to add "(All Time)" or "(This Month)" label to the chart title depending on data source. |
| B-4a | 🟡 Medium | `js/api.js` | TTL is 60 minutes but user said it should be **6 hours**. Change `DASHBOARD_TTL`, `ANALYTICS_TTL`, `FILTERS_TTL` to `6 * 60 * 60 * 1000`. |
| B-4b | 🟡 Medium | `js/dashboard.js`, `js/analytics.js` | **Cache bar age label is wrong** — `updateCacheBar(ageMs)` uses the age snapshotted *before* the fetch, but after a fresh network fetch the age is always 0 (just stored). The bar should show the age of what was actually served. **Current logic**: `const dashAge = ApiCache.getAge('dashboard')` before fetch → then fetch replaces it → bar shows `null` for fresh fetch (correct) OR old age for cache hit (also correct). However the **time format** is broken for large values: `180 mins` should be `3 hrs`. Need to convert mins → hrs when ≥ 60. |
| B-4c | 🟡 Medium | `js/analytics.js` | **Analytics always re-fetches** because `load()` always calls `API.fetchSearch()` (never cached) and then shows the bar based on `filtersAge + analyticsAge`. But the analytics bar condition `(filtersAge !== null && analyticsAge !== null)` means **both** must have a prior entry to show the bar. Since `fetchSearch` isn't cached, every Analytics load calls `API.fetchSearch` which is fine — but the bar hides because after a fresh `fetchAnalytics` the `analyticsAge` check is the *post-store* age which is ~0ms. Fix: snapshot ages correctly — **before** calling `fetchFilters`/`fetchAnalytics` but use `ApiCache.getAge()` correctly. Actually looking at it — the snapshotting is done correctly. The real issue is the `filtersAge !== null && analyticsAge !== null` guard: if either is null (cold start), bar is hidden. But the **reported issue** is analytics fetches every time — this is correct behavior because `fetchSearch` is called every time (uncached, by design). The **bar should show** only if we served from cache, which it does. So the real issue may just be B-4b (time format). |
| B-5 | 🟡 Medium | `css/styles.css`, `js/dashboard.js`, `js/analytics.js` | **Nav bar jumps during load.** When Dashboard/Analytics pages load, `setLoading(true)` hides `#dashContent` and shows spinner. This causes a layout reflow that shifts the nav bar up temporarily. Root cause: `dashContent` is `display:none` during load, removing its height contribution from the scroll area — the nav then repositions. **Fix**: keep a minimum height on the content area during loading so the layout doesn't collapse. |

---

## Root Cause Analysis — B-1 / B-2 (Most Critical)

The ARRAYFORMULA in column H was set to:
```
=ARRAYFORMULA(IF(A2:A="","",TEXT(A2:A,"yyyy-MM")))
```

When `doPost()` calls `sheet.appendRow([now, amount, ...])`, the row lands in the sheet and `flush()` is called. **However**, `checkBudgets()` reads `data[i][7]` (column H). If the ARRAYFORMULA has not yet propagated (or if Apps Script reads before the formula evaluates), H will be empty — causing `rowMonth === ""` which fails the `rowMonth !== month` check and the row is skipped.

**The clean fix:** In `checkBudgets()`, instead of relying on column H, derive the month directly from the Timestamp in column A (same way `searchExpenses` does it):
```javascript
var rowDate = (rowTs instanceof Date) ? rowTs : new Date(rowTs);
var rowMonth = Utilities.formatDate(rowDate, TIMEZONE, "yyyy-MM");
```

The same fix should also be applied in `getDashboardData()` for robustness.

---

## Proposed Changes

---

### B-1 + B-2 — `appscript-source.txt`

#### [MODIFY] `getDashboardData()` — derive month from column A, not H
Stop relying on the ARRAYFORMULA column. Compute month directly from the timestamp.

#### [MODIFY] `checkBudgets()` — same fix
Derive `rowMonth` from column A timestamp instead of column H.

---

### B-3 — Top Sources chart scope label

#### [MODIFY] `index.html`
Add "(All Time)" suffix to the "Top Sources" card title element.

#### [MODIFY] `js/dashboard.js` `renderSourcesChart()`
Accept `scopeLabel` parameter and pass it to the chart title, or simply update the card heading text. The `analytics.sourceBreakdown` from `getAnalyticsData()` is ALL-TIME. This should be clearly labelled.

---

### B-4a — TTL change

#### [MODIFY] `js/api.js`
Change `DASHBOARD_TTL`, `ANALYTICS_TTL`, and `FILTERS_TTL` from 60 min → **6 hours**.

---

### B-4b — Time format fix (mins → hrs when ≥ 60)

#### [MODIFY] `js/dashboard.js` + `js/analytics.js` — `updateCacheBar()`
Replace the minutes-only display with a smarter formatter:
```javascript
function fmtAge(ms) {
  const mins = Math.round(ms / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return mins + ' min' + (mins === 1 ? '' : 's') + ' ago';
  const hrs = Math.round(mins / 60);
  return hrs + ' hr' + (hrs === 1 ? '' : 's') + ' ago';
}
```

---

### B-4c — Analytics cache bar condition fix

#### [MODIFY] `js/analytics.js` `load()`
The current condition `(filtersAge !== null && analyticsAge !== null)` hides the bar on cold start even when one is cached. Change to show if **either** is cached (use `Math.max` with null handling):
```javascript
const ageMs = filtersAge !== null || analyticsAge !== null
  ? Math.max(filtersAge ?? 0, analyticsAge ?? 0)
  : null;
```

---

### B-5 — Nav bar layout jump

#### [MODIFY] `css/styles.css`
Add `min-height` to `#dashContent` and `#anaContent` containers so that hiding the content block during loading doesn't collapse the page height and trigger a nav reflow.

#### [MODIFY] `js/dashboard.js` + `js/analytics.js`
Instead of `display:none` on the content div during loading, use `visibility:hidden` + `pointer-events:none` — this preserves layout space so the page height doesn't change and the nav stays put.

---

## Execution Order

1. **B-1+B-2** — AppScript fix (most critical, fixes ₹0 totals and notification)
2. **B-4a** — TTL to 6h in api.js
3. **B-4b** — Time format fix in both JS files
4. **B-4c** — Analytics cache bar condition
5. **B-3** — Top Sources scope label
6. **B-5** — Nav jump fix (CSS + JS)

---

## Verification Checklist

- [ ] B-1: Log a new expense → toast shows real total, not ₹0
- [ ] B-2: Notification budget message shows real total amount
- [ ] B-3: Top Sources chart shows "(All Time)" in title
- [ ] B-4a: Cache lasts 6 hours (inspect localStorage → check `ts` value)
- [ ] B-4b: 180-minute-old cache shows "3 hrs ago", not "180 mins ago"
- [ ] B-4c: Analytics cache bar appears correctly when returning within 6h
- [ ] B-5: Nav bar stays fixed during Dashboard/Analytics load — no jump
