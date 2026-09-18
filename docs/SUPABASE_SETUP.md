# Supabase Setup Guide (RupiBook v2 backend)

One-time setup, ~15 minutes. Replaces Google Apps Script + Sheets entirely.

## 1. Create the project
1. Sign up at [supabase.com](https://supabase.com) (free tier — no card needed).
2. **New project** → name it `rupibook` → pick a region near you → set a DB password (save it somewhere).

## 2. Create the schema
1. Dashboard → **SQL Editor** → New query.
2. Paste all of [`supabase/schema.sql`](../supabase/schema.sql) → **Run**.
3. You should see `Success`. This creates all tables, RLS policies, views, and the two cron jobs
   (autopay logging daily 05:30 IST, budget alerts daily 21:00 IST).

> If pg_cron isn't available on your plan region, the two `cron.schedule` lines will warn —
> everything else still works; alerts then run client-side only until enabled.

## 3. Enable Google login
1. [Google Cloud Console](https://console.cloud.google.com) → create/select a project.
2. **APIs & Services → OAuth consent screen** → External → fill app name + your email → publish.
3. **Credentials → Create credentials → OAuth client ID** → Web application:
   - Authorized JavaScript origins: `https://YOURPROJECT.supabase.co`
   - Authorized redirect URI: `https://YOURPROJECT.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client secret**.
5. Supabase Dashboard → **Authentication → Providers → Google** → enable → paste both → Save.

## 4. Point the app at it
```bash
cd app
cp .env.example .env.local    # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

Get both values from Dashboard → Project Settings → API. The anon key is safe to ship
(RLS protects the data); the service-role key must stay server-side/secret.

## 5. Migrate your existing Sheet data
1. Open your RupiBook Google Sheet → **File → Download → Comma-separated values (.csv)**.
2. Get your user UUID: Supabase → Authentication → Users → log in once via the app, copy your id.
3. Dry-run first (no writes):
```bash
node app/scripts/import-sheet-csv.mjs --csv ~/Downloads/<sheet>.csv \
  --url https://YOURPROJECT.supabase.co --key $SUPABASE_SERVICE_ROLE_KEY \
  --user <your-user-uuid> --book Personal --dry-run
```
4. Remove `--dry-run` to import. Spot-check counts against your Sheet rows.

## 6. Verify
- Log into the app with Google → you land on an empty book.
- Add one expense → check Supabase **Table Editor → expenses** shows the row with your user scope.
- Try opening another user's book id via the API — RLS should return zero rows.

## Architecture notes
| Legacy | Now |
|---|---|
| Apps Script `/exec` (public URL = password) | Supabase PostgREST + JWT (Google OAuth), RLS per user |
| Config / PaymentModes tabs | `categories`, `sources`, `payment_modes` tables |
| Budgets + Settings!B1/B2 tabs | `budgets` table (row with NULL category = overall limit) |
| Autopay tab + trigger dedup | `autopay` table + `pg_cron` (`last_logged_ym`) |
| Alert emails via MailApp | `notifications` table → push (web push now, FCM on Android) |
| iOS Shortcut → public POST | Ingest Edge Function keyed by `ingest_keys` (Phase 2 remaining item) |
