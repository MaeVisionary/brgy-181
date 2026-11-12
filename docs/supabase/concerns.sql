-- Community concerns on Supabase (NOT YET APPLIED). Mirrors src/services/concernService.ts.
-- Original submissions are never edited or deleted; grouping is a separate link.

create table public.concern_issues (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  title text not null,
  category text not null,
  street text,
  landmark text,
  status text not null default 'open' check (status in ('open', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed')),
  priority_override text check (priority_override in ('critical', 'high', 'normal', 'low')),
  priority_override_reason text,
  assigned_to uuid references public.profiles (id),
  expected_by date,
  first_action_at timestamptz,
  merged_into uuid references public.concern_issues (id),
  created_at timestamptz not null default now(),
  check (priority_override is null or length(trim(priority_override_reason)) >= 5)
);

create table public.concern_submissions (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  resident_id uuid not null,
  user_id uuid not null references public.profiles (id),
  category text not null,
  category_chosen text not null,
  title text not null check (length(trim(title)) >= 3),
  details text not null check (length(trim(details)) >= 10),
  street text,
  landmark text,
  started_on date,
  frequency text,
  photo_document_id uuid references public.documents (id),   -- private bucket, see documents.sql
  hazard boolean not null default false,
  submitted_at timestamptz not null default now(),
  check (street is not null or landmark is not null)
);
create index concern_submissions_user on public.concern_submissions (user_id);
create index concern_submissions_street on public.concern_submissions (street, category);

-- Link table: confirmed or suggested membership, with who decided.
create table public.concern_links (
  submission_id uuid primary key references public.concern_submissions (id),
  issue_id uuid references public.concern_issues (id),
  suggested_issue_id uuid references public.concern_issues (id),
  confidence text check (confidence in ('high', 'medium', 'low')),
  score numeric(3, 2),
  reason text,
  decided_by uuid references public.profiles (id),      -- null = automatic
  needs_review text check (needs_review in ('location', 'match')),
  updated_at timestamptz not null default now()
);
create index concern_links_issue on public.concern_links (issue_id);

create table public.concern_resolutions (
  issue_id uuid primary key references public.concern_issues (id),
  description text not null check (length(trim(description)) >= 5),
  action_taken text not null check (length(trim(action_taken)) >= 5),
  evidence_document_id uuid references public.documents (id),
  resolved_by uuid not null references public.profiles (id),
  resolved_at timestamptz not null default now()
);

create table public.concern_events (               -- append-only history
  id bigint generated always as identity primary key,
  issue_id uuid not null references public.concern_issues (id),
  at timestamptz not null default now(),
  actor_id uuid,                                    -- null = system
  action text not null,
  detail text
);
create trigger concern_events_no_update before update or delete on public.concern_events for each row execute function public.audit_log_immutable();

alter table public.concern_issues enable row level security;
alter table public.concern_submissions enable row level security;
alter table public.concern_links enable row level security;
alter table public.concern_resolutions enable row level security;
alter table public.concern_events enable row level security;

-- Residents: insert and read only their own submissions. Never other residents' rows.
create policy subs_insert_own on public.concern_submissions for insert with check (user_id = auth.uid() and public.my_role() = 'resident');
create policy subs_read on public.concern_submissions for select using (
  user_id = auth.uid() or public.has_permission('concerns.manage') or public.has_permission('concerns.view'));
-- Kagawads (concerns.view) read issues; names come from profiles, which they cannot read (profiles_read policy).

create policy issues_read on public.concern_issues for select using (public.has_permission('concerns.manage') or public.has_permission('concerns.view')
  or exists (select 1 from public.concern_links l join public.concern_submissions s on s.id = l.submission_id where l.issue_id = concern_issues.id and s.user_id = auth.uid()));
create policy links_read on public.concern_links for select using (public.has_permission('concerns.manage') or public.has_permission('concerns.view'));
create policy resolutions_read on public.concern_resolutions for select using (true);  -- the resolution text is shown to reporting residents
create policy events_read on public.concern_events for select using (public.has_permission('concerns.manage') or public.has_permission('concerns.view'));

-- All changes by staff go through SECURITY DEFINER functions that check
-- has_permission('concerns.manage'), write concern_events and audit_log in the
-- same transaction (move_submission, merge_issues, set_status, assign, set_priority).
-- Matching runs server-side in the insert function so residents cannot pick an issue.
