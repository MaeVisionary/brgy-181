-- Official barangay calendar on Supabase (NOT YET APPLIED). Mirrors src/services/calendarData.ts and calendarService.ts.
create type public.holiday_type as enum ('regular', 'special_non_working', 'special_working', 'local');
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  name text not null,
  type public.holiday_type not null,
  source text not null check (length(trim(source)) >= 5),   -- e.g. Proclamation No. 1006, s. 2025
  hall_closed boolean not null,
  open_from time, open_until time,                          -- special hours when the hall opens
  check (open_from is null or (not hall_closed and open_until > open_from))
);
create table public.office_closures (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null, ends_on date not null check (ends_on >= starts_on),
  from_time time, until_time time,                          -- part of the day; null = whole day
  services text[] not null default '{}',                    -- empty = all in-person services
  reason text not null check (length(trim(reason)) >= 5),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  announcement_id uuid references public.announcements (id),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check ((from_time is null) = (until_time is null) and (until_time is null or until_time > from_time))
);
alter table public.holidays enable row level security;
alter table public.office_closures enable row level security;
create policy holidays_read on public.holidays for select using (true);                 -- public information
create policy closures_read on public.office_closures for select using (status = 'active' or public.has_permission('calendar.manage'));
create policy holidays_write on public.holidays for all using (public.has_permission('system.settings')) with check (public.has_permission('system.settings'));
-- Closures are written only by add_closure()/cancel_closure() (SECURITY DEFINER, calendar.manage):
-- in one transaction they insert the row, move overlapping booked appointments to awaiting_schedule
-- (never delete), move return deadlines that fall on a closed day, write audit_log and queue notices.
-- is_working_day(d) = not weekend and not a closed holiday and no full-day all-services closure; it is
-- used by book_appointment() and by every deadline calculation, so the browser cannot bypass it.
