# RupiBook Setup Guide

Welcome to **RupiBook** — your personal expense tracker backed by Google Sheets. Follow these steps to get everything up and running in under 10 minutes.

---

## Step 1: Create a Google Sheet

1. Open [Google Sheets](https://sheets.google.com) and create a **new blank spreadsheet**.
2. Give it a name like **"RupiBook Expenses"**.

---

## Step 2: Open Apps Script

1. Inside your Google Sheet, click **Extensions → Apps Script**.
2. A new Apps Script editor tab will open.
3. Delete all the existing code in the editor.

---

## Step 3: Paste the AppScript Code

1. In the RupiBook app, go to **Settings → View AppScript Code**.
2. Tap **Copy** to copy the entire code to your clipboard.
3. Go back to the Apps Script editor and **paste** the code.
4. Click the **💾 Save** icon (or press `Ctrl+S` / `Cmd+S`).

---

## Step 4: Run Setup

1. In the Apps Script editor, select the function `setupSheets` from the dropdown at the top.
2. Click **▶ Run**.
3. You may be asked to grant permissions — click **Review Permissions**, choose your Google account, and click **Allow**.
4. Once it runs, go back to your Google Sheet. You should see new tabs: **Expenses**, **Budgets**, **Settings**, **Autopay**, **Config**, and **PaymentModes**.

---

## Step 5: Deploy as a Web App

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the ⚙️ gear icon next to "Select type" and choose **Web app**.
3. Set the following:
   - **Description**: `RupiBook API`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Click **Deploy**.
5. Copy the **Web App URL** shown — it looks like `https://script.google.com/macros/s/…/exec`.

---

## Step 6: Configure RupiBook

1. Open the RupiBook app and go to **Settings**.
2. Paste your Web App URL into the **Apps Script Web App URL** field.
3. Tap **Save URL**.
4. Categories and payment modes will load automatically from your sheet.

---

## Customising Your Data

### Categories & Sources (`Config` sheet)
- Column **A** = Category name (e.g., `Food`, `Transport`)
- Column **B** = Source name (e.g., `Zomato/Swiggy`, `Rapido/Uber`)
- Add as many rows as you need. The app will pick them up on the next config refresh.

### Payment Modes (`PaymentModes` sheet)
- Column **A** = Payment mode name (e.g., `UPI`, `Cash`, `CreditCard`)
- In Settings → tap **↻ Refresh from Sheets** to sync latest payment modes to the app.

### Budgets (`Budgets` sheet)
- Column **A** = Category name
- Column **B** = Monthly limit (in ₹)
- You will get budget alerts when spending crosses the threshold set in the `Settings` sheet.

### Autopay (`Autopay` sheet)
- Logs recurring bills automatically on the day of the month you specify.
- Columns: `Name`, `Amount`, `Category`, `Day of Month`, `Active` (checkbox)

---

## Updating the AppScript

Whenever a new version of RupiBook is released, you will see an **"AppScript Update Required"** banner. To update:

1. Go to **Settings → View AppScript Code** and copy the latest code.
2. In Apps Script, paste and save the new code.
3. Click **Deploy → Manage deployments**.
4. Click the ✏️ edit icon on your existing deployment.
5. Set **Version** to **New version**, then click **Deploy**.
6. Back in RupiBook, tap **✅ Yes, I've updated** on the banner.

> The Web App URL stays the same — no need to change it in Settings.

---

## Troubleshooting

**Categories not loading?**
- Make sure the Web App URL is saved correctly in Settings.
- Ensure the Apps Script is deployed with **Who has access: Anyone**.

**Budget alerts not working?**
- Check that your `Budgets` sheet has the correct category names (they are case-sensitive).
- Verify the `Settings` sheet has a monthly limit in cell `B1`.

**"Failed to fetch" errors?**
- If you're opening the app directly as a file (`file://`), some browsers block fetch requests. Use a local HTTP server instead:
  ```
  python3 -m http.server 8080
  ```
  Then open `http://localhost:8080` in your browser.

---

## Sheet Structure Reference

| Sheet | Purpose |
|-------|---------|
| `Expenses` | All logged expenses |
| `Budgets` | Per-category monthly limits |
| `Settings` | Monthly total limit & alert threshold |
| `Autopay` | Recurring auto-logged entries |
| `Config` | Category → Source mapping |
| `PaymentModes` | Payment method options |