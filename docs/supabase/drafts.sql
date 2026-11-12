-- FORM DRAFTS AND ONE-TIME SUBMISSIONS (design, NOT applied)
--
-- The prototype keeps drafts in the browser (src/lib/drafts.ts) and remembers
-- submission keys in the browser (src/lib/idempotency.ts). With Supabase the
-- same interface is backed by these tables so drafts survive a device change
-- and duplicates are refused by the database itself.

create table if not exists form_drafts (
  id          uuid primary key,                 -- the draft id, also the submission key
  owner_id    uuid not null references auth.users(id) on delete cascade,
  form        text not null,                    -- e.g. 'document-request:residency'
  data        jsonb not null,                   -- never passwords, ID numbers, ID images, selfies or face data
  version     int not null default 1,           -- optimistic concurrency: update ... where version = :seen
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  unique (owner_id, form)
);
alter table form_drafts enable row level security;
-- Only the owner can read, write or delete their drafts. Nobody else (including other residents) sees them.
create policy drafts_owner_select on form_drafts for select using (owner_id = auth.uid());
create policy drafts_owner_insert on form_drafts for insert with check (owner_id = auth.uid());
create policy drafts_owner_update on form_drafts for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy drafts_owner_delete on form_drafts for delete using (owner_id = auth.uid());
-- Expired drafts are removed nightly (pg_cron): delete from form_drafts where expires_at < now();

-- Conflicting saves from two tabs/devices: the client sends the version it last saw.
--   update form_drafts set data = :data, version = version + 1, updated_at = now()
--   where id = :id and owner_id = auth.uid() and version = :seen returning version;
-- No row returned = changed elsewhere; the app shows "This form was also changed in another tab or window".

-- One submission per draft: every transaction table gets the key with a unique index.
alter table document_requests     add column if not exists client_request_id uuid;
alter table kp_cases              add column if not exists client_request_id uuid;
alter table concern_submissions   add column if not exists client_request_id uuid;
alter table borrowings            add column if not exists client_request_id uuid;
alter table resident_change_requests add column if not exists client_request_id uuid;
alter table appointments          add column if not exists client_request_id uuid;
alter table resident_registrations add column if not exists client_request_id uuid;
create unique index if not exists document_requests_once on document_requests (client_request_id) where client_request_id is not null;
create unique index if not exists kp_cases_once on kp_cases (client_request_id) where client_request_id is not null;
create unique index if not exists concern_submissions_once on concern_submissions (client_request_id) where client_request_id is not null;
create unique index if not exists borrowings_once on borrowings (client_request_id) where client_request_id is not null;
create unique index if not exists resident_change_requests_once on resident_change_requests (client_request_id) where client_request_id is not null;
create unique index if not exists appointments_once on appointments (client_request_id) where client_request_id is not null;
create unique index if not exists resident_registrations_once on resident_registrations (client_request_id) where client_request_id is not null;
-- Insert with "on conflict (client_request_id) do nothing returning *", then select the existing row:
-- a retry after a dropped connection returns the first record instead of creating a second.
-- Reference numbers are assigned inside that insert, so a draft never consumes a reference number.

-- Public registration drafts (not signed in) are NOT stored on the server; they stay on the device for 24 hours
-- and exclude the ID number, ID photo, selfie and password.
