-- Announcements on Supabase (NOT YET APPLIED). Mirrors src/services/announcementService.ts.
create type public.announcement_status as enum ('draft', 'pending', 'returned', 'scheduled', 'published', 'rejected', 'archived', 'cancelled');
create sequence public.announcement_ref_seq;
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('ANN-' || extract(year from now())::int || '-' || lpad(nextval('public.announcement_ref_seq')::text, 6, '0')),
  status public.announcement_status not null default 'draft',
  content jsonb not null,                 -- title, category, summary, body, event, bring, contact, audience, urgent
  publish_at timestamptz not null,
  expires_on date,
  revision jsonb,                         -- proposed change to an approved or published announcement
  created_by uuid not null references public.profiles (id),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  published_at timestamptz,
  notified_at timestamptz,                -- residents notified once
  review_note text,
  check (approved_by is null or approved_by <> created_by)   -- no self-approval
);
create table public.announcement_events (id bigint generated always as identity primary key, announcement_id uuid not null references public.announcements (id), at timestamptz not null default now(), actor_id uuid, action text not null, note text);
create table public.announcement_reads (announcement_id uuid references public.announcements (id), user_id uuid references public.profiles (id), read_at timestamptz not null default now(), primary key (announcement_id, user_id));
alter table public.announcements enable row level security;
alter table public.announcement_events enable row level security;
alter table public.announcement_reads enable row level security;
-- Residents (and everyone) read only published or archived ones; never drafts, pending changes or review notes.
create view public.published_announcements with (security_invoker = true) as
  select id, ref, content, published_at, status from public.announcements where status in ('published', 'archived');
create policy ann_staff_read on public.announcements for select using (public.has_permission('announcements.manage') or public.has_permission('announcements.approve'));
create policy reads_own on public.announcement_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Writes only through SECURITY DEFINER functions: save_draft, submit (manage), approve, request_revision,
-- reject (approve; caller must differ from created_by), cancel, archive. Each writes announcement_events and audit_log.
-- A pg_cron job publishes scheduled rows and archives expired ones; notifications are queued once (notified_at).
