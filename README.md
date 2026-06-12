<div align="center">

<img src="icons/icon-512.png" alt="RupiBook" width="120" height="120" style="border-radius: 24px">

<h3>Personal Expense Tracker — Backed by Google Sheets</h3>

<p>Log expenses in seconds, track budgets, view analytics — all from your phone. Your data stays in your own Google Sheet. No sign-ups, no servers, no subscriptions.</p>

<p>
<a href="https://rupibook.imkrishna1311.workers.dev/"><strong>Open RupiBook</strong></a> •
<a href="docs/SETUP_GUIDE.md"><strong>Setup Guide</strong></a> •
<a href="https://github.com/imkrishnaaaaaaa/RupiBook/issues"><strong>Report Issue</strong></a> •
<a href="https://github.com/imkrishnaaaaaaa/RupiBook/issues"><strong>Request Feature</strong></a>
</p>

<p>
<img src="https://img.shields.io/badge/PWA-Installable-6366f1?style=flat-square&logo=pwa&logoColor=white" alt="PWA">
<img src="https://img.shields.io/badge/Google_Sheets-Backend-34A853?style=flat-square&logo=google-sheets&logoColor=white" alt="Google Sheets">
<img src="https://img.shields.io/badge/Apps_Script-Serverless-4285F4?style=flat-square&logo=google&logoColor=white" alt="Apps Script">
<img src="https://img.shields.io/badge/Cloudflare-Deployed-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare">
<img src="https://img.shields.io/badge/Cost-₹0_Forever-00C853?style=flat-square" alt="Free">
</p>

</div>

---

## Why RupiBook Exists

Most expense trackers want your data on their servers, behind a paywall, and locked into their ecosystem. RupiBook takes a different approach:

- **Your data stays yours** — Everything lives in a Google Sheet you own. No third-party databases.
- **No recurring cost** — Google Sheets + Apps Script + Cloudflare Workers = ₹0 forever.
- **Works offline** — PWA with service worker caching. Log expenses even without internet; they sync when you're back online.
- **iPhone shortcut integration** — Double-tap the back of your phone to log an expense without opening any app.

---

## How It Works

```
┌────────────────────┐
│   Your iPhone      │
│   (Back Tap /      │
│    Shortcut)       │
└────────┬───────────┘
         │ POST JSON
         ▼
┌────────────────────────────────────────┐
│    Google Apps Script (Serverless)     │
│  ┌──────────────────────────────────┐  │
│  │  doPost()                        │  │
│  │  • Writes expense row            │  │
│  │  • Checks budgets vs thresholds  │  │
│  │  • Returns budget alert message  │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │  doGet()                         │  │
│  │  • ?action=config (categories)   │  │
│  │  • ?action=dashboard (summary)   │  │
│  │  • ?action=analytics (charts)    │  │
│  │  • ?action=version (sync check)  │  │
│  └──────────────────────────────────┘  │
└────────────────┬───────────────────────┘
                 │ Read / Write
                 ▼
┌────────────────────────────────────────┐
│         Google Sheets (Database)       │
│                                        │
│  • Expenses       • Config             │
│  • Budgets        • PaymentModes       │
│  • Settings       • Dashboard          │
│  • Autopay                             │
└────────────────────────────────────────┘
         ▲
         │ Fetch data via Apps Script API
         │
┌────────────────────────────────────────┐
│       RupiBook PWA (Frontend)          │
│                                        │
│  • Log expenses     • View dashboard   │
│  • Filter analytics • Manage profiles  │
│  • View/Copy code   • In-app docs      │
│                                        │
│  Deployed: rupibook.imkrishna1311      │
│            .workers.dev                │
└────────────────────────────────────────┘
```

---

## Features

### Expense Logging
- Quick-entry form: **Amount → Category → Source → Payment Mode → Comments → Tags**
- Categories and sources auto-populated from your Google Sheet (`Config` tab)
- Tags auto-generated from your selections; add custom tags manually
- Smart comments-to-tags extraction

### Dashboard
- Real-time **monthly spending summary** with budget progress bar
- **Category pie chart** — see where your money goes at a glance
- **Monthly trend line chart** — track spending patterns over time
- **Top sources bar chart** — identify your most-used merchants
- **Recent expenses** list with full detail

### Analytics
- **Filterable expense history** — filter by category, source, tags, date range, or free-text search
- Full breakdown: category totals, source totals, monthly trend
- One-tap reset and refresh

### Budget Alerts
- Set per-category limits in the `Budgets` sheet (e.g., Food = ₹2,000/month)
- Set an overall monthly limit in the `Settings` sheet
- Configurable threshold (default 75%) — get warned before you overspend
- Alerts delivered as push notifications when logging an expense

### Autopay Tracking
- Define recurring bills in the `Autopay` sheet (name, amount, category, day-of-month)
- Checkbox toggle to pause/resume
- Daily trigger auto-logs due items as normal expenses — they flow into budgets and charts

### Email Digest
- Daily or weekly spending summary emailed to your Google account
- Total spent, percentage of budget, per-category breakdown
- Configured via an Apps Script time-driven trigger

### Multi-Profile Support
- Manage separate expense sheets for different contexts (Personal, Family, Friend)
- Each profile connects to a different Google Sheet via its own Web App URL
- Switch profiles from the top bar

### iPhone Shortcut Integration
- Log expenses directly via an iOS Shortcut — no need to open the app
- Assign to **Back Tap** (double-tap the back of your phone)
- Receives budget alert notification after each log
- Opens your UPI app to scan and pay immediately after logging

### Additional
- **Version management** — in-app banner alerts you when your Apps Script needs updating
- **Dark mode / Light mode / System theme** — toggle from Settings
- **PWA installable** — add to home screen for a native app experience
- **Offline support** — service worker with cache-first strategy for static assets
- **Undo** — remove the last logged expense with one API call

---

## Technology Stack

<table>
  <tr>
    <th>Layer</th>
    <th>Technology</th>
    <th>Purpose</th>
  </tr>
  <tr>
    <td><strong>Frontend</strong></td>
    <td>HTML5, CSS3, Vanilla JavaScript</td>
    <td>PWA shell with responsive mobile-first UI</td>
  </tr>
  <tr>
    <td><strong>Charting</strong></td>
    <td>Chart.js 4.4</td>
    <td>Pie, line, and bar charts for dashboard & analytics</td>
  </tr>
  <tr>
    <td><strong>Typography</strong></td>
    <td>Inter (Google Fonts)</td>
    <td>Clean, modern typeface across the app</td>
  </tr>
  <tr>
    <td><strong>Backend</strong></td>
    <td>Google Apps Script</td>
    <td>Serverless API — handles reads, writes, budget checks, email digests</td>
  </tr>
  <tr>
    <td><strong>Database</strong></td>
    <td>Google Sheets</td>
    <td>Structured storage with 7 auto-created tabs</td>
  </tr>
  <tr>
    <td><strong>Offline</strong></td>
    <td>Service Worker</td>
    <td>Cache-first for static assets, network-first for API calls</td>
  </tr>
  <tr>
    <td><strong>Mobile Trigger</strong></td>
    <td>iOS Shortcuts + Back Tap</td>
    <td>Log expenses without opening any app</td>
  </tr>
  <tr>
    <td><strong>Hosting</strong></td>
    <td>Cloudflare Workers</td>
    <td>Free global edge deployment</td>
  </tr>
</table>

---

## API Reference

The Apps Script Web App exposes these endpoints. All requests go to your deployed `/exec` URL.

### GET Endpoints

| Parameter | Response | Description |
|-----------|----------|-------------|
| *(none)* | `{ status, message, version }` | Health check — confirms the API is running |
| `?action=version` | `{ version }` | Returns deployed AppScript version for sync checks |
| `?action=config` | `{ categories, mapping, paymentModes }` | Category → Source mapping and payment modes |
| `?action=dashboard` | `{ month, totalSpent, monthlyLimit, remaining, budgetPercent, categoryTotals }` | Current month summary for dashboard |
| `?action=recent` | `[{ timestamp, amount, category, source, paymentMode, tags, comments }]` | Last 20 expenses |
| `?action=analytics` | `{ categoryBreakdown, sourceBreakdown, monthlyTrend, recentExpenses }` | Full analytics data |
| `?action=filters` | `{ categories, sources, tags }` | Distinct filter values from expense history |

### POST Endpoints

| Payload | Response | Description |
|---------|----------|-------------|
| `{ amount, category, source, paymentMode, tags, comments }` | `{ status, message }` | Log a new expense. Message contains budget alert if threshold is crossed. |
| `{ action: "undo" }` | `{ status, message }` | Remove the last logged expense row |

---

## Google Sheets Structure

Running `setupSheets()` in the Apps Script editor creates these tabs automatically:

| Sheet | Purpose | Key Columns |
|-------|---------|-------------|
| **Dashboard** | Auto-generated summary with KPI cards, budget table, pie chart, column chart | Formulas linked to all other sheets |
| **Expenses** | Every logged transaction | Timestamp · Amount · Category · Source · Payment Mode · Tags · Comments · Month |
| **Budgets** | Per-category monthly spending limits | Category · Monthly Limit |
| **Settings** | Global configuration | Monthly Total Limit (`B1`) · Alert Threshold % (`B2`) |
| **Autopay** | Recurring bills auto-logged on their due day | Name · Amount · Category · Day of Month · Active (checkbox) |
| **Config** | Category-to-Source mapping (drives the dropdowns in the app) | Category · Source |
| **PaymentModes** | Payment method options | Payment Mode |

---

## Project Structure

```
RupiBook/
├── index.html              # Main PWA shell — all 5 pages in a single SPA
├── manifest.json           # PWA manifest (name, icons, shortcuts)
├── service-worker.js       # Offline caching (cache-first + network-first)
├── appscript-source.txt    # Full Google Apps Script source (served to the in-app code viewer)
│
├── css/
│   └── styles.css          # Complete design system — theming, components, responsive layout
│
├── js/
│   ├── config.js           # App name, defaults, preset profiles
│   ├── static-data.js      # Bundled static fallback data
│   ├── storage.js          # localStorage abstraction (profiles, settings, cache)
│   ├── api.js              # Google Apps Script API layer (all network calls)
│   ├── dashboard.js        # Dashboard page — charts, budget progress, recent expenses
│   ├── analytics.js        # Analytics page — filters, search, breakdown
│   ├── version.js          # Version check, code viewer, docs renderer, markdown parser
│   └── app.js              # Main app — routing, form handling, navigation, PWA install
│
├── icons/
│   ├── icon-192.png        # App icon (192×192)
│   ├── icon-512.png        # App icon (512×512)
│   └── favicon-32.png      # Browser tab favicon
│
└── docs/
    ├── SETUP_GUIDE.md      # User-facing setup guide (rendered in-app)
    └── Expense-Tracker-Complete-Setup-Guide.md  # Extended reference guide
```

---

## Setup

Setting up RupiBook takes about **15 minutes**, once. There are three parts:

### Part 1 — Google Sheet + Apps Script

1. Create a blank spreadsheet at [sheets.google.com](https://sheets.google.com).
2. Open **Extensions → Apps Script** inside the sheet.
3. Delete all existing code. Paste the RupiBook AppScript code (copy it from **Settings → View AppScript Code** in the app, or from [`appscript-source.txt`](appscript-source.txt)).
4. Select `setupSheets` from the function dropdown and click **▶ Run**. Grant permissions when prompted.
5. Go to **Deploy → New deployment** → select **Web app** → set **Execute as: Me**, **Who has access: Anyone** → click **Deploy**.
6. Copy the Web App URL (ends in `/exec`).

> Not familiar with Apps Script? Follow the visual step-by-step PDF guide: **<PDF_LINK>**

### Part 2 — Connect the App

1. Open [RupiBook](https://rupibook.imkrishna1311.workers.dev/) and go to **Settings**.
2. Paste your Web App URL and tap **Save URL**.
3. Categories, sources, and payment modes will load automatically.

### Part 3 — iPhone Shortcut (Optional)

Install the iOS Shortcut to log expenses with a back-tap, without opening the app.

1. Download and install the shortcut: **<ICLOUD>**
2. On your iPhone, go to **Settings → Accessibility → Touch → Back Tap → Double Tap** and select the RupiBook shortcut.

> The shortcut logs the expense to your sheet, shows a budget alert notification, and opens your UPI app to scan and pay.

📖 For the full detailed guide, see [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md).

---

## Updating the AppScript

When a new RupiBook version requires a backend update, the app shows an **"AppScript Update Required"** banner.

1. Go to **Settings → View AppScript Code** in the app and tap **Copy**.
2. In the Apps Script editor, replace all code and save.
3. Go to **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
4. Back in the app, tap **✅ Yes, I've updated**.

> The Web App URL stays the same — no need to update it anywhere.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Categories not loading | Verify the Web App URL is saved correctly in Settings. Ensure access is set to **Anyone**. |
| Budget alerts never fire | Check that category names in the `Budgets` sheet match exactly (case-sensitive). Verify `Settings!B1` has a number. |
| `Failed to fetch` errors | If running locally as a file, serve via HTTP: `python3 -m http.server 8080`. |
| Wrong timestamp on entries | Update `TIMEZONE` at the top of the Apps Script (`Asia/Kolkata` by default), then re-deploy. |
| Shortcut runs but no row appears | The URL in the Shortcut is wrong or outdated. Re-copy from **Deploy → Manage deployments**. After editing code, always deploy as a **New version**. |
| Back Tap not triggering | Requires iPhone 8+ / iOS 14+. Thick cases can block it — try Triple Tap or a thinner case. |
| Autopay / digest didn't run | Open Apps Script → ⏰ Triggers and confirm the trigger exists. Check **Executions** for errors. |

---

## Project Information

**Author:** [Murali Krishna Sana](https://github.com/imkrishnaaaaaaa)

**Live Application:** [rupibook.imkrishna1311.workers.dev](https://rupibook.imkrishna1311.workers.dev/)

**Repository:** [github.com/imkrishnaaaaaaa/RupiBook](https://github.com/imkrishnaaaaaaa/RupiBook)

---

<div align="center">

### Found a bug or have an idea?

[Open an issue](https://github.com/imkrishnaaaaaaa/RupiBook/issues)

---

**Built with Vanilla JS • Powered by Google Sheets • Deployed on Cloudflare**

₹0 forever. Your data, your sheet, your rules.

</div>
