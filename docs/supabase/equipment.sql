-- Equipment borrowing on Supabase (NOT YET APPLIED). Mirrors src/services/equipmentService.ts.
-- Stock is never decided in the browser: approve_borrowing() and release_borrowing()
-- lock the equipment rows (SELECT ... FOR UPDATE), recount overlapping holds and
-- write in one transaction, so two approvals cannot over-allocate.

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                    -- EQ-181-001
  name text not null unique,
  category text not null,
  total_qty int not null check (total_qty >= 0),
  damaged_qty int not null default 0 check (damaged_qty >= 0),
  missing_qty int not null default 0 check (missing_qty >= 0),
  maintenance_qty int not null default 0 check (maintenance_qty >= 0),
  check (damaged_qty + missing_qty + maintenance_qty <= total_qty)
);

create table public.borrowing_policy (           -- versioned; newest row applies
  version int primary key,
  period_days int not null check (period_days between 1 and 60),
  grace_days int not null check (grace_days between 0 and 30),
  return_time time not null,
  processing_days int not null,
  reminder_hours int[] not null,
  overdue_repeat_days int not null,
  confirmed_by_barangay boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create type public.borrowing_status as enum ('pending', 'approved', 'ready', 'released', 'returned', 'completed', 'rejected', 'cancelled');
create sequence public.borrowing_ref_seq;

create table public.borrowings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('BRW-' || extract(year from now())::int || '-' || lpad(nextval('public.borrowing_ref_seq')::text, 6, '0')),
  resident_id uuid,
  borrower_name text not null,
  date_of_use date not null,
  stated_return_date date check (stated_return_date is null or stated_return_date >= date_of_use),
  status public.borrowing_status not null default 'pending',
  approved_days int,
  released_at timestamptz,
  due_at timestamptz,
  grace_ends_at timestamptz,
  returned_at timestamptz,
  review jsonb,
  reminders_sent text[] not null default '{}',
  requested_at timestamptz not null default now(),
  check ((status in ('released', 'returned', 'completed')) = (released_at is not null) or status = 'cancelled' or status = 'rejected')
);
-- One open request per resident per date of use.
create unique index borrowings_one_open on public.borrowings (resident_id, date_of_use) where status in ('pending', 'approved', 'ready');

create table public.borrowing_items (
  borrowing_id uuid not null references public.borrowings (id),
  equipment_id uuid not null references public.equipment (id),
  qty int not null check (qty > 0),
  approved_qty int check (approved_qty is null or approved_qty between 1 and qty),
  returned_good int not null default 0,
  returned_damaged int not null default 0,
  missing int not null default 0,
  primary key (borrowing_id, equipment_id),
  check (returned_good + returned_damaged + missing <= coalesce(approved_qty, qty))
);

create table public.borrowing_events (            -- append-only
  id bigint generated always as identity primary key,
  borrowing_id uuid not null references public.borrowings (id),
  at timestamptz not null default now(),
  actor_id uuid,                                  -- null = system job
  action text not null,
  remarks text,
  internal boolean not null default false         -- hidden from residents
);
create trigger borrowing_events_no_update before update or delete on public.borrowing_events for each row execute function public.audit_log_immutable();

alter table public.equipment enable row level security;
alter table public.borrowings enable row level security;
alter table public.borrowing_items enable row level security;
alter table public.borrowing_events enable row level security;

create policy equipment_read on public.equipment for select using (true);
create policy equipment_write on public.equipment for update using (public.has_permission('inventory.manage'));
create policy borrowings_read on public.borrowings for select using (
  resident_id = public.my_resident_id() or public.has_permission('borrowing.approve') or public.has_permission('borrowing.release') or public.has_permission('inventory.view'));
create policy items_read on public.borrowing_items for select using (exists (select 1 from public.borrowings b where b.id = borrowing_id));
create policy events_read on public.borrowing_events for select using (
  (not internal and exists (select 1 from public.borrowings b where b.id = borrowing_id and b.resident_id = public.my_resident_id()))
  or public.has_permission('borrowing.approve') or public.has_permission('borrowing.release'));
-- No direct writes: request_borrowing, approve_borrowing, mark_ready, release_borrowing,
-- record_return, close_review, cancel_borrowing and extend_return are SECURITY DEFINER
-- functions that check the caller's permission and the current status, recount stock
-- under lock, write borrowing_events and audit_log, and queue notifications.
-- borrowing_jobs() runs from pg_cron every 15 minutes: reminders, overdue notices
-- (marked in reminders_sent in the same update, so never twice) and at-risk pickups.
