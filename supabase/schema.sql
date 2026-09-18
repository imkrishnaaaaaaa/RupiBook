-- ═══════════════════════════════════════════════════════════
-- RupiBook — Supabase schema v2
-- Run once in Supabase Dashboard → SQL Editor.
-- Replaces: Google Sheets (7 tabs) + Apps Script backend.
--
-- Model:
--   auth.users ─┬─ books ─┬─ categories ── sources
--               │         ├─ payment_modes
--               │         ├─ expenses → category/source/mode FKs
--               │         ├─ budgets   (category_id NULL = overall monthly limit)
--               │         ├─ autopay
--               │         ├─ ingest_keys  (iOS Shortcut access)
--               │         └─ notifications (budget alerts, digests)
-- Every table is RLS-scoped to the owning book's user.
-- ═══════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pgcrypto;

-- ── Books (replaces multi-profile Sheets URLs) ──────────────
create table public.books (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ── Categories / Sources / Payment modes (was Config + PaymentModes tabs) ──
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books(id) on delete cascade,
  name       text not null,
  icon       text,                       -- lucide icon hint, optional
  sort       int  not null default 0,
  unique (book_id, name)
);

create table public.sources (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade, -- null = valid for any category
  name        text not null,
  sort        int  not null default 0
);
create index on public.sources (book_id);

create table public.payment_modes (
  id      uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  name    text not null,
  sort    int not null default 0,
  unique (book_id, name)
);

-- ── Expenses (was Expenses tab) ─────────────────────────────
create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  book_id         uuid not null references public.books(id) on delete cascade,
  amount          numeric(12,2) not null check (amount >= 0),
  category_id     uuid not null references public.categories(id),
  source_id       uuid references public.sources(id),
  payment_mode_id uuid references public.payment_modes(id),
  notes           text not null default '',
  tags            text[] not null default '{}',
  spent_at        timestamptz not null default now(),  -- when it happened; created_at = when logged
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index expenses_book_spent_idx on public.expenses (book_id, spent_at desc);
create index expenses_tags_idx       on public.expenses using gin (tags);
create index expenses_category_idx   on public.expenses (category_id);

-- ── Budgets (was Budgets + Settings!B1/B2 tabs) ─────────────
-- One row with category_id NULL = overall monthly limit for the book.
create table public.budgets (
  id                 uuid primary key default gen_random_uuid(),
  book_id            uuid not null references public.books(id) on delete cascade,
  category_id        uuid references public.categories(id) on delete cascade,
  monthly_limit      numeric(12,2) not null check (monthly_limit >= 0),
  alert_threshold_pct int not null default 80 check (alert_threshold_pct between 1 and 100),
  unique (book_id, category_id)
);
-- NULLs are never equal in SQL, so the constraint above cannot stop duplicate
-- overall rows; this partial index does.
create unique index budgets_one_overall_per_book on public.budgets (book_id) where category_id is null;

-- ── Autopay (was Autopay tab) ───────────────────────────────
-- last_logged_ym ('2026-08') makes the daily cron dedup-safe.
create table public.autopay (
  id              uuid primary key default gen_random_uuid(),
  book_id         uuid not null references public.books(id) on delete cascade,
  name            text not null,
  amount          numeric(12,2) not null check (amount >= 0),
  category_id     uuid not null references public.categories(id),
  day_of_month    int  not null check (day_of_month between 1 and 28),
  active          boolean not null default true,
  last_logged_ym  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.autopay (book_id) where active;

-- ── Ingest keys (iOS Shortcut / external automation) ────────
create table public.ingest_keys (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books(id) on delete cascade,
  key_hash   text not null,                -- sha256 of the secret; raw key shown once
  label      text not null default 'iOS Shortcut',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- ── Notifications (budget alerts, digests — feeds push later) ──
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books(id) on delete cascade,
  type       text not null,                -- 'category_budget' | 'overall_budget' | 'monthly_digest'
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (book_id, created_at desc);

-- ═══════════════════════════ updated_at trigger ════════════
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger books_touch   before update on public.books   for each row execute function public.touch_updated_at();
create trigger exp_touch     before update on public.expenses for each row execute function public.touch_updated_at();
create trigger auto_touch    before update on public.autopay for each row execute function public.touch_updated_at();

-- ═══════════════════════════ RLS ═══════════════════════════
alter table public.books         enable row level security;
alter table public.categories    enable row level security;
alter table public.sources       enable row level security;
alter table public.payment_modes enable row level security;
alter table public.expenses      enable row level security;
alter table public.budgets       enable row level security;
alter table public.autopay       enable row level security;
alter table public.ingest_keys   enable row level security;
alter table public.notifications enable row level security;

-- Owner helper: a row belongs to the caller iff its book is theirs.
create or replace function public.owns_book(book uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.books b
    where b.id = book and b.user_id = auth.uid()
  );
$$;

-- books: full CRUD on own rows
create policy books_owner on public.books
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- child tables: full CRUD where owns_book(child.book_id)
do $$
declare t text;
begin
  foreach t in array array['categories','sources','payment_modes','expenses','budgets','autopay','ingest_keys','notifications']
  loop
    execute format($f$
      create policy %1$s_owner on public.%1$s
        for all using (public.owns_book(book_id)) with check (public.owns_book(book_id));
    $f$, t);
  end loop;
end $$;

-- ═══════════════ Display/search convenience view ═══════════
create view public.expense_details with (security_invoker = true) as
select
  e.id, e.book_id, e.amount, e.notes, e.tags, e.spent_at, e.created_at,
  c.name as category,
  s.name as source,
  m.name as payment_mode
from public.expenses e
join public.categories c        on c.id = e.category_id
left join public.sources s      on s.id = e.source_id
left join public.payment_modes m on m.id = e.payment_mode_id;

grant select on public.expense_details to authenticated;

-- ═══════════════ Cron: autopay logging (daily 05:30 IST) ════
-- Backfill-safe: logs EVERY missing month since last_logged_ym, not just today.
-- Survives Supabase free-tier project pauses (missed cron runs are caught up
-- on the next execution — including the client-triggered sync below).
create or replace function public.log_due_autopay()
returns void language plpgsql security definer set search_path = public as $$
declare
  tz    text := 'Asia/Kolkata';
  today date := (now() at time zone tz)::date;
  stop  date := date_trunc('month', today)::date;
  r     record;
  cur   date;
  d     date;
  logged boolean;
begin
  -- No auth.uid() filter: pg_cron runs without a user session, so
  -- auth.uid() is NULL and every row would be skipped. RLS does not
  -- apply inside this security definer function.
  for r in
    select a.* from autopay a where a.active
  loop
    -- resume after the last logged month; before any logging, start at creation month
    cur := coalesce(
      (r.last_logged_ym || '-01')::date + interval '1 month',
      date_trunc('month', (r.created_at at time zone tz)::date)
    )::date;

    logged := false;
    while cur <= stop loop
      d := make_date(extract(year from cur)::int, extract(month from cur)::int, r.day_of_month);
      if d <= today then
        insert into expenses (book_id, amount, category_id, notes, spent_at)
        values (r.book_id, r.amount, r.category_id,
                'Autopay: ' || r.name,
                (d::text || ' 09:00+05:30')::timestamptz);
        logged := true;
      end if;
      cur := cur + interval '1 month';
    end loop;

    -- record the last month whose day-of-month has actually passed
    if logged then
      update autopay
      set last_logged_ym = to_char(stop, 'YYYY-MM')
      where id = r.id;
    end if;
  end loop;
end $$;

-- Client also calls this RPC on app open → catch-up + keep-alive against pauses.
revoke execute on function public.log_due_autopay() from anon;
grant execute on function public.log_due_autopay() to authenticated;

select cron.schedule('rupibook-autopay', '0 0 * * *', $$select public.log_due_autopay();$$);

-- ═══════════════ Cron: budget alerts (daily 21:00 IST ≈ 15:30 UTC) ═══
create or replace function public.check_budget_alerts()
returns void language plpgsql security definer set search_path = public as $$
declare
  d text := to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM');
  r record;
  spent numeric;
begin
  -- per-category
  for r in
    select b.*, c.name as cat_name from budgets b
    join categories c on c.id = b.category_id
    where b.category_id is not null
  loop
    select coalesce(sum(amount),0) into spent
    from expenses
    where book_id = r.book_id
      and category_id = r.category_id
      and to_char(spent_at at time zone 'Asia/Kolkata', 'YYYY-MM') = d;

    if spent > (r.monthly_limit * r.alert_threshold_pct / 100.0)
      and not exists (
        select 1 from notifications
        where book_id = r.book_id and type = 'category_budget'
          and payload->>'category' = r.cat_name
          and to_char(created_at at time zone 'Asia/Kolkata', 'YYYY-MM') = d
      )
    then
      insert into notifications (book_id, type, payload) values
        (r.book_id, 'category_budget', jsonb_build_object(
          'category', r.cat_name, 'spent', spent, 'limit', r.monthly_limit));
    end if;
  end loop;

  -- overall (category_id null row)
  for r in select * from budgets where category_id is null
  loop
    select coalesce(sum(amount),0) into spent
    from expenses
    where book_id = r.book_id
      and to_char(spent_at at time zone 'Asia/Kolkata', 'YYYY-MM') = d;

    if spent > (r.monthly_limit * r.alert_threshold_pct / 100.0)
      and not exists (
        select 1 from notifications
        where book_id = r.book_id and type = 'overall_budget'
          and to_char(created_at at time zone 'Asia/Kolkata', 'YYYY-MM') = d
      )
    then
      insert into notifications (book_id, type, payload) values
        (r.book_id, 'overall_budget', jsonb_build_object('spent', spent, 'limit', r.monthly_limit));
    end if;
  end loop;
end $$;

select cron.schedule('rupibook-budget-alerts', '30 15 * * *', $$select public.check_budget_alerts();$$);
