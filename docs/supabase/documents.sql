-- BMIS resident documents on Supabase (NOT YET APPLIED: the app still runs on
-- browser storage; see src/services/fileStore.ts, whose StorageProvider is the
-- only part that changes when this is wired in).
--
-- File content lives in a PRIVATE Storage bucket; Postgres keeps metadata only.
-- Never store file bytes or base64 in table columns.
-- Plan storage limits change over time: check the current Supabase pricing
-- page before launch and enter the capacity in BMIS System Settings. The app
-- does not hard-code any plan quota.

-- 1. Private bucket with the same limits the app enforces (5 MB, PDF/JPG/PNG).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resident-documents', 'resident-documents', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 2. Metadata table.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid references public.residents (id) on delete restrict,
  uploaded_by uuid not null references auth.users (id),
  category text not null check (category in ('id', 'requirement', 'proof', 'authorization', 'reply')),
  original_name text not null check (original_name ~ '^[A-Za-z0-9._-]{1,80}$'),
  storage_path text not null unique,          -- <resident_id>/<category>/<id>-<name>
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  sha256 text not null,
  uploaded_at timestamptz not null default now(),
  expires_at date,                            -- IDs with a printed expiry only
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  state text not null default 'temporary' check (state in ('temporary', 'attached')),
  attached_to text
);
-- Same file uploaded twice by the same person is stored once.
create unique index if not exists documents_dedupe on public.documents (uploaded_by, resident_id, sha256);

alter table public.documents enable row level security;

-- Helper: does the signed-in user hold a permission? (permissions table maintained by the app's role manager)
create or replace function public.has_permission(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_permissions up where up.user_id = auth.uid() and up.permission = p
  );
$$;

-- Residents: their own documents. Reviewing staff: documents they need for their work.
create policy documents_select on public.documents for select using (
  uploaded_by = auth.uid()
  or resident_id = (select resident_id from public.profiles where id = auth.uid())
  or public.has_permission('residents.verify')
  or public.has_permission('documents.process')
  or public.has_permission('documents.approve')
);
create policy documents_insert on public.documents for insert with check (uploaded_by = auth.uid());
-- Residents may delete only their own unsubmitted uploads; submitted ones are kept (retention).
create policy documents_delete on public.documents for delete using (uploaded_by = auth.uid() and state = 'temporary');
-- Only verifiers change verification fields.
create policy documents_verify on public.documents for update using (public.has_permission('residents.verify'));

-- 3. Storage object policies: same rules, keyed by the first folder (resident id).
create policy objects_select on storage.objects for select using (
  bucket_id = 'resident-documents' and (
    owner = auth.uid()
    or (storage.foldername(name))[1] = (select resident_id::text from public.profiles where id = auth.uid())
    or public.has_permission('residents.verify')
    or public.has_permission('documents.process')
    or public.has_permission('documents.approve')
  )
);
create policy objects_insert on storage.objects for insert with check (
  bucket_id = 'resident-documents' and owner = auth.uid()
  and (storage.foldername(name))[1] = (select resident_id::text from public.profiles where id = auth.uid())
);
create policy objects_delete on storage.objects for delete using (
  bucket_id = 'resident-documents' and owner = auth.uid()
  and exists (select 1 from public.documents d where d.storage_path = name and d.state = 'temporary')
);
-- No update policy: files are never replaced in place.

-- 4. Viewing: the app requests short-lived signed URLs, e.g.
--    supabase.storage.from('resident-documents').createSignedUrl(path, 60)
--    and logs staff views in the audit log. No public URLs.

-- 5. Clean-up (scheduled, e.g. pg_cron daily): remove unsubmitted uploads older than 24 hours.
--    delete from public.documents where state = 'temporary' and uploaded_at < now() - interval '24 hours' returning storage_path;
--    then remove those paths from the bucket. Attached documents follow the barangay's records retention policy.
