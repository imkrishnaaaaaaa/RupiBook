# RupiBook Revamp — Analysis & Plan

> Status: ANALYSIS COMPLETE · Awaiting answers on stack questions (bottom of file).
> This document records everything found while auditing the repo, plus the proposed
> target architecture. Work chunks will be tracked in `checklist.md` once work starts.

---

## 1. Current State (what exists today)

| Layer | Tech | Notes |
|---|---|---|
| Frontend | Vanilla JS SPA (`index.html` + 7 JS modules) | 5 pages toggled via `classList`, no router |
| Styling | Single `styles.css` (1,951 lines), CSS custom props | Light/dark/system themes, Inter font |
| Charts | Chart.js 4.4 from jsDelivr CDN | Doughnut, bar, combo charts |
| Backend | Google Apps Script (`appscript-source.txt`, 1,746 lines) | doGet/doPost REST-ish API |
| Database | Google Sheets (7 tabs) | Expenses, Budgets, Settings, Autopay, Config, PaymentModes, Dashboard |
| Hosting | Cloudflare Workers (static) | Free |
| Mobile | PWA + service worker + iOS Shortcut (back-tap) | No real Android app |

### Feature inventory (current)
- Expense logging: amount → category → source → payment mode → comments → auto-tags
- Dashboard: month total, budget %, category budgets bars, doughnut, overshoot chart, 6-month trend, top sources, recent list
- Analytics: filter chips (category/source/tag), date range, free-text server search, summary stats
- Budget alerts (inline message on save + emails), monthly summary emails
- Autopay: daily trigger logs recurring bills, dedup-safe
- Undo last expense, multi-profile (= multiple Sheets URLs), theme switcher
- Version-sync banner (UI ↔ Apps Script), in-app code viewer + docs renderer
- PWA install, offline static caching, 6h localStorage API cache

---

## 2. What Is Good — Keep the Ideas

These are worth preserving regardless of stack:

1. **Offline-first mindset** — cache layer, service worker, optimistic UX.
2. **Undo last entry** — great UX pattern.
3. **Autopay dedup logic** (Apps Script) — careful edge-case handling.
4. **Version handshake** between frontend and backend — rare and smart for a solo project.
5. **₹0 cost philosophy** — every stack choice below keeps this.
6. **Auto-tagging pipeline** (selections → hashtags, comment words → tags).
7. **safeGet wrapper** returning JSON errors instead of HTML error pages.
8. **Cache-age transparency bar** ("Updated 12 mins ago").

---

## 3. Problems Found (full audit)

### Critical
| # | Issue | Where |
|---|---|---|
| C1 | **Zero authentication.** Apps Script deployed as "Anyone" → anyone with the `/exec` URL can read AND write your expenses. The URL *is* the password. Also blocks any public repo sharing of URLs. | README setup Part 1.5 |
| C2 | **No edit/delete of an individual expense** — only "undo last". One typo = permanent wrong data until manually fixed in Sheets. | API surface |
| C3 | **No real database** — Sheets as DB caps concurrency, validation, queries; analytics capped at 200 rows server-side so totals can silently be wrong for heavy months. | `searchExpenses()` limit |

### UI / UX ("looks AI-generated" — why it does)
| # | Issue | Where |
|---|---|---|
| U1 | **Emoji as the entire icon system** (🍔🏠📊⚙️🔍💾📋⚠️). Emojis render differently on every device and scream prototype. This is the #1 reason it reads as AI-generated. | `index.html`, `app.js` CAT_ICONS |
| U2 | **No motion language** — pages swap instantly via classList, no transitions, no micro-interactions, no skeleton loaders (only a generic spinner). | `navigateTo()` |
| U3 | **No router** — refresh loses your page, browser back quits the app, no deep links. | `app.js` |
| U4 | Flat information hierarchy — home page is just one form; dashboard is a stack of equal cards; no visual anchor or focal point. | `index.html` |
| U5 | Inline styles scattered across HTML/JS (~40 occurrences). | throughout |
| U6 | Inline `onclick` handlers built by string interpolation — fragile, CSP-hostile. | `app.js:442` |
| U7 | Generic system selects (native `<select>`) for category/source/payment — no custom pickers, chips, or keypad-first amount input. | `index.html:80-99` |
| U8 | Empty/error states are emoji + text only; no illustrations, no retry affordance pattern. | `dashboard.js:474` |
| U9 | Accessibility gaps: emoji-only nav buttons lack visible labels, focus states minimal. | bottom nav |

### Engineering
| # | Issue | Where |
|---|---|---|
| E1 | Chart.js loaded synchronously from CDN, render-blocking, no SRI hash. | `index.html:23` |
| E2 | `icons/icon-512.png` is **2.6 MB** — should be <50 KB. Hurts install/startup. | `icons/` |
| E3 | Duplicate `escapeHtml` — analytics.js copy misses `&quot;` (weaker than app.js version). | `analytics.js:339` vs `app.js:51` |
| E4 | `fmtMoney` rounds paise away — display-only, but amounts like ₹199.50 show as ₹200 next to a full-format total that says otherwise. | `app.js:32` |
| E5 | Hand-rolled markdown parser (~14 KB in `version.js`) just to render docs — reinventing a solved problem. | `version.js` |
| E6 | 6-hour TTL cache means dashboard/analytics show stale numbers with no stale-while-revalidate refresh. | `api.js` |
| E7 | Timestamps parsed with `new Date(string)` — timezone-fragile between Sheet text and JS. | multiple |
| E8 | No tests, no linter, no formatter, no CI. | repo |
| E9 | Global mutable singletons (`App`, `Home`, `Settings`) with direct DOM strings — fine at this size, but every new feature raises the blast radius. | all JS |
| E10 | Search requires pressing a button; no debounced live search. | `analytics.js` |
| E11 | Autopay/budgets/config editable ONLY inside the Sheet — no app UI at all. | feature gap |
| E12 | Multi-profile = pasting different Apps Script URLs; confusing and insecure. | Settings page |
| E13 | Email digests + autopay depend on Apps Script time-driven triggers — must be re-designed when backend moves. | backend |

---

## 4. Revamp Goals (from you)

1. Complete UI/UX rebuild — professional, industry-level, minimal, purposeful animation, distinctive identity.
2. Upgrade tech stack where genuinely better (your call via questions below).
3. Kill Apps Script → proper database + Google OAuth login.
4. Ship a real Android app with native superpowers (SMS detection, notifications, widgets…).
5. Stay free/₹0 wherever honestly possible.

---

## 5. Proposed Target Architecture

```
┌──────────────────────────────────────────────────────┐
│                ONE CODEBASE (TypeScript)             │
│   React + Vite SPA ── styled with Tailwind CSS v4    │
│   Framer Motion animations · Recharts/Chart.js       │
│   PWA (vite-plugin-pwa)                              │
│                                                      │
│   ┌──────────────┐     ┌───────────────────────┐     │
│   │ Browser/PWA  │     │ Android via Capacitor │     │
│   └──────────────┘     │ + native plugins      │     │
│                        │  • SMS receiver       │     │
│                        │  • Local notifs/FCM   │     │
│                        │  • Widgets            │     │
│                        │  • Biometric lock     │     │
│                        └───────────────────────┘     │
└───────────────────┬──────────────────────────────────┘
                    │ HTTPS · JWT (Google OAuth)
┌───────────────────▼──────────────────────────────────┐
│                  BACKEND (managed)                   │
│  Auth: Google Sign-In (OAuth 2.0)                    │
│  DB : Postgres (Supabase) or Firestore (Firebase)    │
│       RLS → every row scoped to user id              │
│  Cron: budget checks, autopay, monthly digest        │
│  Push: FCM for alerts                                │
└──────────────────────────────────────────────────────┘
Hosting stays Cloudflare Pages (free, already familiar).
```

### Why this shape
- **One codebase** for web PWA + Android (Capacitor wraps the same build). Native plugins only where web can't reach: SMS, notifications, widgets, biometrics.
- **Managed backend** replaces both Apps Script AND Sheets. No servers to babysit, free tier covers personal use forever.
- **Google OAuth** kills the "anyone with URL" hole; every request carries a JWT; DB row-level security scopes data per user.
- **SQL database** doubles as your SQL learning ground (per your learning goals).

### Design direction proposal (details after your answer)
- **Identity:** minimal fintech — generous whitespace, strong type scale, ONE accent color, neutral surfaces, soft depth. No gradients-everywhere, no emoji icons — a proper icon set (Lucide).
- **Motion:** 150–300ms ease-out micro-interactions, shared-element page transitions, count-up numbers, skeleton loaders, springy bottom sheets. Motion informs, never decorates.
- **Signature moments:** big tactile numeric keypad for logging, animated budget rings, pull-to-refresh with haptics (Android).

---

## 6. Phased Execution Plan (each phase fully working before next)

- **Phase 0 — Decisions:** you answer stack questions below → freeze choices.
- **Phase 1 — Foundation:** scaffold new app (Vite+TS+Tailwind+router), CI/lint/format, deploy pipeline to Cloudflare Pages.
- **Phase 2 — Backend:** set up DB schema + Google OAuth + RLS; seed/migration script from existing Sheet export; thin typed API client.
- **Phase 3 — Core app shell:** navigation, theming (light/dark/system), design tokens, motion primitives.
- **Phase 4 — Feature parity, rebuilt properly:** log expense (keypad UX), dashboard, analytics/filters/search, budgets UI, settings, profile→book model, edit/delete expense, undo.
- **Phase 5 — Polish pass:** skeletons, transitions, empty/error states, a11y audit, Lighthouse ≥95, icon redesign, PWA manifest/SW via plugin.
- **Phase 6 — Android:** Capacitor wrap, app icon/splash, then native features from `todo.md` (SMS parsing first).
- **Phase 7 — Cutover:** one-time import of old Sheet data, old app kept at legacy URL until verified.

Every phase lands as small checklist chunks in `checklist.md`, ticked as completed.

---

## 7. Decisions — FROZEN (Phase 0 complete)

| Decision | Choice |
|---|---|
| Frontend | **React 19 + Vite + TypeScript + Tailwind CSS v4** |
| Animation | **Framer Motion** |
| Server state | **TanStack Query v5** (replaces hand-rolled ApiCache) |
| Charts | **Recharts** (idiomatic React) |
| Icons | **Lucide** (kills the emoji system) |
| Backend | **Supabase** — Postgres + Google OAuth + RLS |
| Cron | Supabase `pg_cron` (autopay, budget alerts, digests) |
| Android | **Capacitor** wrap + custom native plugins |
| Visual | **Dark-first premium** — near-black surfaces, mint accent, Space Grotesk display type |
| Data | Full migration from Google Sheets (CSV export → import script) |
| Feature parity | Autopay (DB cron) · digests (push/in-app, not email) · iOS shortcut (key-authed ingest endpoint) |
| Layout | New codebase in `app/`; legacy vanilla app stays untouched until Phase 7 cutover |

### Email note (per your "all three" answer)
Monthly summary emails are replaced by: in-app monthly recap + push notifications
(web-push where supported, FCM on Android). If you ever want real email back,
Supabase Edge Functions + Resend free tier slots in cleanly.

### iOS shortcut note
The shortcut gets a dedicated ingest endpoint (Supabase Edge Function) authorized by
a per-book secret key generated in Settings — no OAuth dance possible inside Shortcuts.
