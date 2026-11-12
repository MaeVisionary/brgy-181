-- BMIS access control on Supabase: roles, permissions, two-person approval,
-- append-only audit log. NOT YET APPLIED (the app is frontend-only; see
-- src/services/userService.ts and src/services/stepUp.ts for the same rules
-- as they run in the prototype). Review with the barangay before use.
--
-- Principles
--  * Deny by default: RLS on every table; no table grants to anon.
--  * Identity comes from auth.uid(); role and permissions are read from the
--    database, never from the request.
--  * Privileged changes only through SECURITY DEFINER functions below.
--  * Staff MFA: Supabase Auth TOTP. A session that completed MFA carries
--    aal = 'aal2' in its JWT; privileged functions require it. Email OTP is
--    not used for administrators.
--  * The service-role key is used only by server-side jobs (never shipped to
--    the browser, never in VITE_ variables, never committed).

create type public.role_id as enum ('system_admin', 'chairman', 'secretary', 'kagawad', 'property_custodian', 'resident');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null,
  role public.role_id not null default 'resident',
  status text not null default 'active' check (status in ('active', 'inactive')),
  resident_id uuid,                 -- residents only
  updated_at timestamptz not null default now()
);

create table public.role_permissions (
  role public.role_id not null,
  permission text not null,
  primary key (role, permission)
);

create table public.user_extra_permissions (
  user_id uuid not null references public.profiles (id),
  permission text not null,
  primary key (user_id, permission)
);

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  kind text not null check (kind in ('role-permissions', 'account-role', 'account-permissions')),
  payload jsonb not null,
  affected_user_ids uuid[] not null,
  reason text not null check (length(trim(reason)) >= 5),
  initiator_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_reason text,
  check (decided_by is null or decided_by <> initiator_id)
);
create index access_requests_pending on public.access_requests (status) where status = 'pending';

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  affected_id uuid,
  action text not null,
  detail jsonb,                      -- before/after, request ref; never passwords, codes or tokens
  outcome text not null check (outcome in ('success', 'failure'))
);

-- Append-only: nobody (including administrators) may change or delete audit rows.
create function public.audit_log_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
create trigger audit_log_no_update before update or delete on public.audit_log for each row execute function public.audit_log_immutable();
revoke update, delete, truncate on public.audit_log from public, anon, authenticated;

-- Helpers ------------------------------------------------------------------
create function public.my_role() returns public.role_id language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'active'
$$;

create function public.has_permission(p text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles pr join public.role_permissions rp on rp.role = pr.role
                 where pr.id = auth.uid() and pr.status = 'active' and rp.permission = p)
      or exists (select 1 from public.user_extra_permissions x join public.profiles pr on pr.id = x.user_id
                 where x.user_id = auth.uid() and pr.status = 'active' and x.permission = p)
$$;

create function public.mfa_verified() returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

create function public.log(actor uuid, affected uuid, action text, detail jsonb, outcome text) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, affected_id, action, detail, outcome) values (actor, affected, action, detail, outcome)
$$;

-- RLS ----------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_extra_permissions enable row level security;
alter table public.access_requests enable row level security;
alter table public.audit_log enable row level security;

-- Read own profile; administrators read all. No direct writes to role/status.
create policy profiles_read on public.profiles for select using (id = auth.uid() or public.has_permission('users.manage'));
create policy profiles_self_name on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()) and status = 'active');

create policy role_permissions_read on public.role_permissions for select using (auth.uid() is not null);
create policy extra_read on public.user_extra_permissions for select using (user_id = auth.uid() or public.has_permission('users.manage'));
-- No insert/update/delete policies on role_permissions / user_extra_permissions:
-- they change only inside approve_access_change().

create policy requests_read on public.access_requests for select
  using (initiator_id = auth.uid() or public.has_permission('security.approve') or auth.uid() = any (affected_user_ids));
-- No direct insert/update: only through the functions below.

create policy audit_read on public.audit_log for select using (public.has_permission('audit_logs.view'));
-- Reading the log is itself logged by the API layer.

-- Two-person approval ------------------------------------------------------
create function public.request_access_change(p_kind text, p_payload jsonb, p_affected uuid[], p_reason text)
returns public.access_requests language plpgsql security definer set search_path = public as $$
declare r public.access_requests;
begin
  if public.my_role() is distinct from 'system_admin' then
    perform public.log(auth.uid(), null, 'access request denied: not admin', jsonb_build_object('kind', p_kind), 'failure');
    raise exception 'forbidden';
  end if;
  if not public.mfa_verified() then raise exception 'mfa_required'; end if;
  if auth.uid() = any (p_affected) then raise exception 'self_change_not_allowed'; end if;
  if exists (select 1 from public.access_requests where status = 'pending' and payload ->> 'subject' = p_payload ->> 'subject') then
    raise exception 'pending_request_exists';
  end if;
  insert into public.access_requests (ref, kind, payload, affected_user_ids, reason, initiator_id)
  values ('SEC-' || to_char(now(), 'YYYY') || '-' || lpad((select count(*) + 1 from public.access_requests)::text, 4, '0'),
          p_kind, p_payload, p_affected, p_reason, auth.uid())
  returning * into r;
  perform public.log(auth.uid(), null, 'access change requested', jsonb_build_object('ref', r.ref, 'kind', p_kind), 'success');
  return r;
end $$;

create function public.approve_access_change(p_id uuid) returns public.access_requests
language plpgsql security definer set search_path = public as $$
declare r public.access_requests;
begin
  select * into r from public.access_requests where id = p_id for update;   -- serialises concurrent approvals
  if not found then raise exception 'not_found'; end if;
  if public.my_role() not in ('system_admin', 'chairman') then
    perform public.log(auth.uid(), null, 'approval denied: not an approver', jsonb_build_object('ref', r.ref), 'failure');
    raise exception 'forbidden';
  end if;
  if not public.mfa_verified() then raise exception 'mfa_required'; end if;
  if r.initiator_id = auth.uid() or auth.uid() = any (r.affected_user_ids) then
    perform public.log(auth.uid(), null, 'self-approval blocked', jsonb_build_object('ref', r.ref), 'failure');
    raise exception 'self_approval_not_allowed';
  end if;
  if r.status <> 'pending' then raise exception 'not_pending'; end if;
  if r.expires_at < now() then
    update public.access_requests set status = 'expired', decided_at = now() where id = p_id;
    raise exception 'expired';
  end if;

  -- Apply (same transaction: any error rolls everything back).
  if r.kind = 'account-role' then
    update public.profiles set role = (r.payload ->> 'roleId')::public.role_id, updated_at = now()
     where id = (r.payload ->> 'id')::uuid;
  elsif r.kind = 'account-permissions' then
    delete from public.user_extra_permissions where user_id = (r.payload ->> 'id')::uuid;
    insert into public.user_extra_permissions (user_id, permission)
      select (r.payload ->> 'id')::uuid, jsonb_array_elements_text(r.payload -> 'perms');
  elsif r.kind = 'role-permissions' then
    delete from public.role_permissions rp using jsonb_to_recordset(r.payload -> 'changes') c(role_id text, permission text, "on" boolean)
     where rp.role = c.role_id::public.role_id and rp.permission = c.permission and not c."on";
    insert into public.role_permissions (role, permission)
      select c.role_id::public.role_id, c.permission from jsonb_to_recordset(r.payload -> 'changes') c(role_id text, permission text, "on" boolean)
      where c."on" on conflict do nothing;
  end if;

  update public.access_requests set status = 'approved', decided_by = auth.uid(), decided_at = now() where id = p_id returning * into r;
  perform public.log(auth.uid(), null, 'access change approved', jsonb_build_object('ref', r.ref, 'initiator', r.initiator_id), 'success');
  -- Sign affected users out everywhere so the new access applies on next sign-in
  -- (done by a server function with the service role: auth.admin.signOut per user).
  return r;
end $$;

create function public.reject_access_change(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.access_requests;
begin
  select * into r from public.access_requests where id = p_id for update;
  if public.my_role() not in ('system_admin', 'chairman') or r.initiator_id = auth.uid() then raise exception 'forbidden'; end if;
  if r.status <> 'pending' then raise exception 'not_pending'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  update public.access_requests set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_reason = p_reason where id = p_id;
  perform public.log(auth.uid(), null, 'access change rejected', jsonb_build_object('ref', r.ref), 'success');
end $$;

create function public.cancel_access_change(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.access_requests set status = 'cancelled', decided_at = now()
   where id = p_id and initiator_id = auth.uid() and status = 'pending';
  if not found then raise exception 'not_allowed'; end if;
  perform public.log(auth.uid(), null, 'access change cancelled', jsonb_build_object('id', p_id), 'success');
end $$;

revoke all on function public.request_access_change, public.approve_access_change, public.reject_access_change, public.cancel_access_change from public, anon;
grant execute on function public.request_access_change, public.approve_access_change, public.reject_access_change, public.cancel_access_change to authenticated;

-- Last-admin protection: the admin role is not assignable through requests
-- (the app only reassigns personnel positions), and this trigger refuses to
-- deactivate or demote the last active System Administrator by any route.
create function public.keep_one_admin() returns trigger language plpgsql as $$
begin
  if old.role = 'system_admin' and (new.role <> 'system_admin' or new.status <> 'active')
     and (select count(*) from public.profiles where role = 'system_admin' and status = 'active' and id <> old.id) = 0 then
    raise exception 'last_admin';
  end if;
  return new;
end $$;
create trigger profiles_keep_one_admin before update on public.profiles for each row execute function public.keep_one_admin();

-- Break-glass: a sealed, offline procedure (two officials present, documented
-- reason, Supabase dashboard access with the project owner's hardware key,
-- immediate audit entry and post-incident review). Not exposed in the app.
