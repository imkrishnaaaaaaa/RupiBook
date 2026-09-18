# RupiBook Revamp — Work Checklist

> Master tracker. Tick on completion. Session-level detail lives in the agent todo list.
> Decisions frozen in `revamp.md §7`.

## Phase 1 — Foundation
- [x] Scaffold `app/` — Vite + React 19 + TypeScript
- [x] Tailwind CSS v4 via `@tailwindcss/vite` plugin
- [x] Design tokens: dark-first palette, type scale (Space Grotesk + Inter), radii, motion tokens
- [x] ESLint (oxlint) + path aliases (`@/`) — Prettier skipped, template defaults fine
- [x] React Router: Log / Dashboard / Analytics / Settings wired with lazy pages + animated shell
- [x] Build + typecheck + lint + preview verified clean

## Phase 2 — Backend (Supabase)
- [x] `supabase/schema.sql` — books, categories, sources, payment_modes, expenses, budgets (NULL cat = overall), autopay, ingest_keys, notifications
- [x] Row Level Security policies (`owns_book()` helper, all 9 tables locked)
- [x] `expense_details` view (security_invoker) for display + search
- [x] `pg_cron` jobs: autopay logging (dedup via last_logged_ym) + budget alerts → notifications
- [x] Setup guide: docs/SUPABASE_SETUP.md (+ .env.example)
- [x] Migration script app/scripts/import-sheet-csv.mjs (--selftest passing)
- [ ] Ingest Edge Function (iOS Shortcut endpoint, key-authed)
- [x] Typed API client + TanStack Query hooks (books/catalog/expenses/dashboard/budgets/autopay)

## Phase 3 — App Shell & Design System
- [x] Theme provider module + no-flash boot script (Settings wiring pending)
- [x] Bottom nav with animated active pill (top bar merges into pages)
- [x] UI kit: Button, Card, Sheet, Skeleton, Toast host, ProgressRing, EmptyState, ListSkeleton
- [x] Page transitions + tap/haptic micro-interactions (Framer Motion)

## Phase 4 — Feature Parity (rebuilt properly)
- [x] Auth: Google sign-in, route gate, auto-bootstrap of Personal book (sign-out lands in Settings task)
- [x] Books: switcher + creator in Settings
- [x] Add Expense: keypad, category→source cascade rails, paid-via rail, note→tags pipeline, undo toast, haptics
- [x] Dashboard: KPI hero + budget ring, per-category bars, doughnut, 6-month trend, recent list (tap → edit/delete sheet)
- [x] Analytics: preset ranges, category chips, search, summary stats, results (tap → edit/delete)
- [x] Edit + delete any expense (ExpenseSheet); undo last via toast action
- [x] Budgets manager UI (overall limit, threshold slider, per-category editor)
- [x] Autopay manager UI (add, pause/resume toggle, delete)
- [x] Categories / sources / payment modes manager UI (CatalogSheet, FK-safe deletes)
- [x] Settings page v1: account, books, appearance, budgets, autopay (ingest key pending Phase 6)
- [x] Offline queue: localStorage-backed, auto-flush on reconnect, offline-save toasts

## Phase 5 — Polish & Quality
- [ ] Loading skeletons everywhere; empty + error states with retry
- [x] PWA: manifest + SVG icon + autoUpdate SW + NetworkFirst API cache (vite-plugin-pwa)
- [ ] A11y pass: labels, focus rings, contrast, touch targets
- [ ] Lighthouse ≥ 95 perf/a11y/best-practices
- [x] New app icon: custom R+₹ monogram with wallet/notes motif, SVG master (2.6 MB PNG gone)
- [ ] Docs rewrite: README + SETUP guide for new stack

## Phase 6 — Android (Capacitor)
- [ ] Capacitor init + Android project scaffolding
- [ ] Configure capacitor.config.ts (appId, webDir, plugins)
- [ ] Sync web build → android/
- [ ] Verify debug APK builds (gradlew assembleDebug)
- [ ] Install on device/emulator, verify PWA parity
- [ ] SMS receiver plugin (bank/UPI parsing → offline queue)
- [ ] Biometric app lock (Capacitor Native Biometrics)
- [ ] Local notifications + FCM push (budget alerts, digests)
- [ ] Home-screen widget (quick-add + budget glance)
- [ ] Quick Settings tile + App shortcuts
- [ ] Share-sheet target (screenshot → OCR → prefill)
- [ ] Build signed release APK (keystore, signing config)
- [ ] Test on device, iterate
- [ ] Capacitor init, icons/splash
- [ ] SMS receiver plugin + bank/UPI message parser
- [ ] Local notifications + FCM push
- [ ] Biometric lock
- [ ] Widgets + Quick Settings tile + app shortcuts
- [ ] Release build pipeline (see todo.md tiers for follow-ons)

## Phase 7 — Cutover
- [ ] Import real Sheet data; verify totals match legacy app exactly
- [ ] Legacy app parked at `/legacy`; root serves new app
- [ ] Post-cutover bugfix window
