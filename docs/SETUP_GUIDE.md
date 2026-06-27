# RupiBook — Setup Guide

Get RupiBook running in about 15 minutes. Once set up, it works forever — no recurring costs, no maintenance.

**You need:** A Google account (free) and optionally an iPhone (iOS 14+) for the shortcut.

---

## Step 1 — Create a Google Sheet

1. Open [sheets.google.com](https://sheets.google.com).
2. Click **Blank spreadsheet**.
3. Rename it to something like **RupiBook Expenses** (click the title at the top-left).

That's it — leave the sheet empty. The script in the next step will create all the tabs for you.

---

## Step 2 — Add the Apps Script Code

Google Apps Script is a free tool by Google that lets you add custom backend logic to a Google Sheet. It's what powers RupiBook — receiving data from your phone, writing it to the sheet, and checking your budgets.

> **New to Apps Script?** Follow the visual step-by-step PDF guide with screenshots: **<PDF_LINK>**

1. In your Google Sheet, go to **Extensions → Apps Script**. A new browser tab opens with a code editor.
2. You'll see some default code — **select all of it and delete it**.
3. Open [RupiBook](https://rupibook.imkrishna1311.workers.dev/), go to **Settings → View AppScript Code**, and tap **📋 Copy**.
4. Go back to the Apps Script editor tab and **paste** the code.
5. Click the **💾 Save** button (or press `Ctrl+S` / `Cmd+S`).

---

## Step 3 — Run the Setup Function

This step creates all the required sheets inside your spreadsheet and formats them.

1. In the Apps Script editor, find the **function dropdown** near the top toolbar (it might say `myFunction` or `doPost`).
2. Click the dropdown and select **`setupSheets`**.
3. Click the **▶ Run** button.
4. A permissions dialog will appear:
   - Click **Review Permissions**.
   - Choose your Google account.
   - You'll see **"Google hasn't verified this app"** — this is normal for personal scripts.
   - Click **Advanced → Go to [your project name] (unsafe) → Allow**.
5. Wait a few seconds. Go back to your spreadsheet tab.

You should now see these tabs at the bottom: **Dashboard**, **Expenses**, **Budgets**, **Settings**, **Autopay**, **Config**, **PaymentModes**.

> **Important:** `setupSheets` is a one-time setup function. Re-running it will overwrite your sheet headers and formatting. It will not delete your existing expense data rows, but avoid running it again unless you are resetting a fresh sheet.

---

## Step 4 — Deploy as a Web App

Deploying creates a URL that RupiBook uses to talk to your Google Sheet.

1. In the Apps Script editor, click **Deploy → New deployment** (top-right).
2. Click the **⚙️ gear icon** next to "Select type" and choose **Web app**.
3. Fill in:
   - **Description:** `RupiBook API` (or anything you like)
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
4. Click **Deploy**.
5. You'll see a **Web app URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```
6. **Copy this URL.** You'll need it in the next step.

> **Quick test:** Paste the URL in any browser. You should see `{"status":"ok","message":"RupiBook API Running","version":"1.3.1"}`. If you do, the backend is working.

---

## Step 5 — Connect RupiBook to Your Sheet

1. Open [RupiBook](https://rupibook.imkrishna1311.workers.dev/) on your phone or browser.
2. Go to **Settings** (bottom navigation bar).
3. Under **Google Apps Script URL**, paste the Web App URL you copied.
4. Tap **Save URL**.

Categories, sources, and payment modes will load automatically from your sheet. You're ready to start logging expenses.

---

## Step 6 — iPhone Shortcut (Optional)

The iOS Shortcut lets you log expenses by double-tapping the back of your phone — without opening any app. It sends the expense to your sheet, shows a budget alert, and opens your UPI app to scan and pay.

**Install the shortcut:** <ICLOUD>

After installing:

1. Open the shortcut once from the **Shortcuts** app and run it to grant network permissions.
2. Paste your Web App URL when prompted (same URL from Step 4).
3. On your iPhone, go to **Settings → Accessibility → Touch → Back Tap → Double Tap**.
4. Select the **RupiBook** shortcut.

Done. Double-tap the back of your phone → the logging flow starts.

> Requires iPhone 8 or newer running iOS 14+. A thick phone case can dampen the tap — try Triple Tap if Double Tap is unreliable.

---

## Customising Your Data

All customisation is done directly in your Google Sheet. No code changes needed.

### Categories & Sources → `Config` sheet

| Column A | Column B |
|----------|----------|
| Category name (e.g. `Food`) | Source name (e.g. `Zomato/Swiggy`) |

Add or remove rows as needed. RupiBook picks up changes on the next refresh.

### Payment Modes → `PaymentModes` sheet

| Column A |
|----------|
| Payment mode name (e.g. `UPI`, `Cash`, `CreditCard`) |

After editing, go to **Settings → ↻ Refresh from Sheets** in the app.

### Budgets → `Budgets` sheet

| Column A | Column B |
|----------|----------|
| Category name | Monthly limit in ₹ |

When your spending in a category crosses the alert threshold (configured in `Settings!B2`, default 80%), you'll get a warning notification. If a budget is fully exceeded (100%), an email alert is also sent — once per event, then every 10 days with updated status.

### Autopay → `Autopay` sheet

| Name | Amount | Category | Day of Month | Active |
|------|--------|----------|--------------|--------|
| Netflix | 199 | Entertainment | 1 | ✅ |
| Rent | 12000 | Bills | 1 | ✅ |

Items with **Active** checked are auto-logged on their specified day each month. Untick to pause. Autopay includes built-in duplicate detection — if a subscription has already been logged for the current month, it will not be logged again even if the trigger fires multiple times.

> To enable autopay and automated emails, set up a daily trigger in Apps Script: **⏰ Triggers → + Add Trigger → Function: `dailyTrigger` → Time-driven → Day timer → Pick a time → Save**.
>
> `dailyTrigger` handles both autopay logging and the first-of-month email summary in a single scheduled run.

---

## Updating the AppScript

When a new version of RupiBook is released, you may see an **"AppScript Update Required"** banner in the app.

1. Go to **Settings → View AppScript Code** and tap **📋 Copy**.
2. Open the Apps Script editor and replace all existing code with the new code.
3. Click **💾 Save**.
4. Go to **Deploy → Manage deployments**.
5. Click the **✏️ edit icon** on your existing deployment.
6. Set **Version** to **New version** and click **Deploy**.
7. Back in RupiBook, tap **✅ Yes, I've updated**.

> The Web App URL stays the same. You don't need to change it in Settings or in the Shortcut.

---

## Troubleshooting

**Categories not loading?**
- Verify the Web App URL is pasted correctly in Settings (no extra spaces).
- Ensure the Apps Script is deployed with **Who has access: Anyone**.

**Budget alerts not working?**
- Category names in the `Budgets` sheet must match exactly (they are case-sensitive).
- Make sure `Settings!B1` contains a number (your overall monthly limit).
- Check that `Settings!B2` has your threshold percentage (e.g. `80` for 80%). If blank, the default 80% is used.

**Budget emails not arriving?**
- Confirm a time-driven trigger exists for `dailyTrigger` in Apps Script → ⏰ Triggers.
- Check **Apps Script → Executions** for any errors on recent runs.
- Duplicate-prevention is built in: alerts only re-send every 10 days. To reset, go to **Apps Script → Project Settings → Script Properties** and delete keys prefixed with `alert_`.

**Autopay logged twice?**
- Built-in deduplication prevents this in v1.3.1+. If you still see a duplicate, manually delete the extra row from the `Expenses` sheet, or use **Undo** from the app.

**"Failed to fetch" errors?**
- If you're running RupiBook from a local file (`file://`), browsers block network requests. Serve it via HTTP instead:
  ```
  python3 -m http.server 8080
  ```
  Then open `http://localhost:8080`.

**Shortcut not working?**
- Run the shortcut once manually from the Shortcuts app to grant network permissions.
- Ensure the Web App URL inside the shortcut is correct and up to date.
- After updating the AppScript code, always deploy as a **New version** — the URL stays the same but Apps Script must be re-versioned to serve the latest code.

**Wrong time on logged expenses?**
- The `TIMEZONE` variable at the top of the Apps Script defaults to `Asia/Kolkata`. Change it to your timezone and re-deploy.

**Dashboard shows stale data?**
- The dashboard reads directly from your live sheet. If it looks outdated, try refreshing the app. If you ran `refreshDashboard` from the Apps Script editor, it will prompt for confirmation first — this is expected behaviour.

---

## Sheet Reference

| Sheet | Purpose | Key Columns |
|-------|---------|-------------|
| **Dashboard** | Auto-generated summary with KPI cards, budget table, pie chart, column chart | Formulas linked to all other sheets |
| **Expenses** | Every logged transaction | Timestamp · Amount · Category · Source · Payment Mode · Tags · Comments · Month |
| **Budgets** | Per-category monthly spending limits | Category (A) · Monthly Limit ₹ (B) |
| **Settings** | Global configuration | Monthly Total Limit (`B1`) · Alert Threshold % (`B2`) |
| **Autopay** | Recurring bills auto-logged on their due day | Name · Amount · Category · Day of Month · Active (checkbox) |
| **Config** | Category-to-Source mapping (drives the dropdowns in the app) | Category (A) · Source (B) |
| **PaymentModes** | Available payment method options | Payment Mode (A) |