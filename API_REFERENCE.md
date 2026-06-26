# RupiBook — API Reference

> Base URL: `https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`

---

## `GET ?action=version`

Returns the current AppScript version.

```json
{
  "version": "1.2.4"
}
```

---

## `GET ?action=config`

Returns categories, their source mappings (from the Config sheet), and available payment modes (from the PaymentModes sheet).

```json
{
  "categories": ["Food", "Transport", "Shopping", "Bills"],
  "mapping": {
    "Food": ["Swiggy", "Zomato"],
    "Transport": ["Rapido", "Uber"],
    "Shopping": ["Amazon", "Flipkart"],
    "Bills": ["Electricity", "Rent"]
  },
  "paymentModes": ["Cash", "UPI", "PhonePe", "GPay", "Paytm",
                   "Amazon Wallet", "CreditCard", "DebitCard", "NetBanking"]
}
```

---

## `GET ?action=dashboard`

Returns current month spending summary. Also includes per-category budget limits from the Budgets sheet.

> If the Settings sheet is missing, `monthlyLimit` defaults to `0` (no crash).

```json
{
  "month": "2026-06",
  "totalSpent": 332.58,
  "monthlyLimit": 4000,
  "remaining": 3667.42,
  "budgetPercent": 8,
  "categoryTotals": {
    "Food": 332.58
  },
  "categoryBudgets": {
    "Food": 5000,
    "Transport": 2000,
    "Bills": 4000,
    "Shopping": 3000,
    "Entertainment": 1500,
    "Health": 2000,
    "Groceries": 5000,
    "Others": 1000
  }
}
```

---

## `GET ?action=recent`

Returns the 20 most recent expenses (newest first).

> **Timestamp format:** All timestamps are returned as local-timezone strings (`"yyyy-MM-dd HH:mm:ss"`), not UTC ISO 8601 strings. Blank rows are skipped.

```json
[
  {
    "timestamp": "2026-06-06 11:45:22",
    "amount": 332.58,
    "category": "Food",
    "source": "Zomato / Swiggy",
    "paymentMode": "Super Money",
    "tags": "",
    "comments": ""
  }
]
```

---

## `GET ?action=analytics`

Returns analytics data: category breakdown, source breakdown, monthly trend, and recent expenses.

> `recentExpenses` returns up to **200** rows (increased from 20). The Dashboard page
> uses this array for its Recent list (sliced to 20 for display), eliminating a redundant
> `fetchRecent()` API call. Timestamps are in local-timezone string format.

```json
{
  "categoryBreakdown": { "Food": 332.58 },
  "sourceBreakdown":   { "Zomato / Swiggy": 332.58 },
  "monthlyTrend":      { "2026-06": 332.58 },
  "recentExpenses": [
    {
      "timestamp": "2026-06-06 11:45:22",
      "amount": 332.58,
      "category": "Food",
      "source": "Zomato / Swiggy",
      "paymentMode": "Super Money",
      "tags": "",
      "comments": ""
    }
  ]
}
```

---

## `GET ?action=filters`

Returns all unique filter values for the analytics filter panel.

```json
{
  "categories": ["Food"],
  "sources": ["Zomato / Swiggy"],
  "tags": []
}
```

---

## `POST` — Save Expense

Send a JSON body to log a new expense.

**Request body:**
```json
{
  "amount": 250,
  "category": "Food",
  "source": "Swiggy",
  "paymentMode": "UPI",
  "tags": "#food #swiggy",
  "comments": "Lunch order"
}
```

**Response:**
```json
{
  "status": "ok",
  "message": "✅ Logged · Food. Month so far: ₹582 / ₹4,000."
}
```

---

## `POST` — Undo Last

Send `{ "action": "undo" }` to remove the last logged expense.

**Request body:**
```json
{
  "action": "undo"
}
```

**Response:**
```json
{
  "status": "ok",
  "message": "↩️ Removed: ₹250 · Food"
}
```
