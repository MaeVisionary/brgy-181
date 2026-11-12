-- Appointments and scheduling on Supabase (NOT YET APPLIED).
-- Mirrors src/services/schedulingService.ts and src/services/appointmentService.ts.
-- The browser shows free times as a preview only; every booking goes through
-- book_appointment(), which re-checks inside one transaction, and the exclusion
-- constraint below makes double booking of a staff member impossible even
-- when two requests arrive at the same moment.

create extension if not exists btree_gist;

-- Versioned rules; only system.settings may insert. The newest row is in force.
create table public.scheduling_rules (
  version int primary key,
  rules jsonb not null,             -- office hours, break, step, buffer, limits, item and service lengths, reminders
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.staff_schedules (
  staff_id uuid primary key references public.profiles (id),
  days smallint[] not null,         -- 0 = Sunday … 6 = Saturday
  starts time not null,
  ends time not null check (ends > starts)
);

create table public.staff_leave (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id),
  during daterange not null,
  reason text not null check (length(trim(reason)) >= 3),
  created_by uuid not null references public.profiles (id)
);

create type public.appointment_kind as enum ('correction_verification', 'document_claim', 'complaint_consult', 'equipment_pickup', 'equipment_return');
create type public.appointment_status as enum ('awaiting_schedule', 'pending_confirmation', 'confirmed', 'reschedule_requested', 'rescheduled', 'completed', 'cancelled', 'no_show');

create sequence public.appointment_ref_seq;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('APT-' || extract(year from now())::int || '-' || lpad(nextval('public.appointment_ref_seq')::text, 6, '0')),
  kind public.appointment_kind not null,
  subject_id uuid not null,             -- change request, document request, case or borrowing
  resident_id uuid,
  user_id uuid references public.profiles (id),
  reason text not null,
  documents text[] not null,
  starts_at timestamptz,                -- null until a time is chosen (awaiting_schedule)
  duration_min int not null check (duration_min between 5 and 240),
  duration_estimate int not null,
  duration_override jsonb,              -- {original, adjusted, reason, by, at}; reason required by check below
  assigned_to uuid references public.profiles (id),
  status public.appointment_status not null,
  checked_in_at timestamptz,
  outcome jsonb,
  reminders_sent text[] not null default '{}',
  created_at timestamptz not null default now(),
  check (duration_override is null or length(trim(duration_override ->> 'reason')) >= 5),
  check ((status = 'awaiting_schedule') = (starts_at is null))
);
-- One open appointment per record and service.
create unique index appointments_one_open on public.appointments (kind, subject_id)
  where status in ('awaiting_schedule', 'pending_confirmation', 'confirmed', 'reschedule_requested', 'rescheduled');
-- No overlapping booked time for the same staff member (buffer added by book_appointment).
alter table public.appointments add constraint appointments_no_overlap exclude using gist (
  assigned_to with =,
  tstzrange(starts_at, starts_at + make_interval(mins => duration_min), '[)') with &&
) where (status in ('pending_confirmation', 'confirmed', 'reschedule_requested', 'rescheduled'));

create table public.appointment_events (       -- append-only history
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments (id),
  at timestamptz not null default now(),
  actor_id uuid,                                -- null = system job
  action text not null
);
create trigger appointment_events_no_update before update or delete on public.appointment_events for each row execute function public.audit_log_immutable();

alter table public.appointments enable row level security;
alter table public.appointment_events enable row level security;
alter table public.scheduling_rules enable row level security;
alter table public.staff_schedules enable row level security;
alter table public.staff_leave enable row level security;

-- Residents read only their own; staff read only the services their permission covers.
create policy appt_read on public.appointments for select using (
  user_id = auth.uid()
  or (kind = 'correction_verification' and public.has_permission('residents.approve'))
  or (kind = 'document_claim' and public.has_permission('documents.release'))
  or (kind = 'complaint_consult' and public.has_permission('cases.manage'))
  or (kind in ('equipment_pickup', 'equipment_return') and public.has_permission('borrowing.release')));
-- No direct insert/update/delete: every change goes through SECURITY DEFINER
-- functions (book_appointment, confirm, request_reschedule, reschedule,
-- override_duration, check_in, record_verification, complete, no_show, cancel)
-- that check the caller, re-check the slot against rules, leave and holidays,
-- write appointment_events and audit_log, and queue notifications.
create policy rules_read on public.scheduling_rules for select using (true);
create policy rules_write on public.scheduling_rules for insert with check (public.has_permission('system.settings'));
create policy leave_rw on public.staff_leave for all using (public.has_permission('system.settings')) with check (public.has_permission('system.settings'));
create policy sched_rw on public.staff_schedules for all using (public.has_permission('system.settings')) with check (public.has_permission('system.settings'));

-- Reminders and no-shows: a pg_cron job every 5 minutes runs
-- appointment_jobs(), which marks reminders sent in the same update that
-- queues them (no duplicates) and sets no_show after the grace time.
