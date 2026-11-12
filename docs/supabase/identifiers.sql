-- BARANGAY 181 IDENTIFIERS AND HOUSEHOLD RECORDS (design, NOT applied)
--
-- Human-readable numbers:
--   Resident   RES-181-YYYY-NNNNNN   Household HH-181-NNNNNN   Family FAM-181-NNNNNN
--   Account    ACC-181-NNNNNN        Personnel EMP-181-NNNNNN
-- Primary keys are UUIDs; the numbers above are separate, unique, never reused,
-- never derived from row counts, and never changed when details change.
-- Transaction references (CLR-, APT-, BRW-, ANN-, KP- ...) stay on their own tables.

create extension if not exists pgcrypto;

-- One sequence per series. nextval() is atomic, so two registrations at the
-- same moment cannot receive the same number, and a rolled-back insert simply
-- leaves a gap (numbers are never handed out twice).
create sequence if not exists seq_resident_no  start 1;
create sequence if not exists seq_household_no start 1;
create sequence if not exists seq_family_no    start 1;
create sequence if not exists seq_account_no   start 1;
create sequence if not exists seq_personnel_no start 1;

create or replace function next_resident_no() returns text language sql volatile as $$
  select 'RES-181-' || to_char(now() at time zone 'Asia/Manila', 'YYYY') || '-' || lpad(nextval('seq_resident_no')::text, 6, '0')
$$;
create or replace function next_household_no() returns text language sql volatile as $$
  select 'HH-181-' || lpad(nextval('seq_household_no')::text, 6, '0') $$;
create or replace function next_family_no() returns text language sql volatile as $$
  select 'FAM-181-' || lpad(nextval('seq_family_no')::text, 6, '0') $$;
create or replace function next_account_no() returns text language sql volatile as $$
  select 'ACC-181-' || lpad(nextval('seq_account_no')::text, 6, '0') $$;
create or replace function next_personnel_no() returns text language sql volatile as $$
  select 'EMP-181-' || lpad(nextval('seq_personnel_no')::text, 6, '0') $$;

create table if not exists households (
  id            uuid primary key default gen_random_uuid(),
  household_no  text not null unique default next_household_no() check (household_no ~ '^HH-181-[0-9]{6}$'),
  house_no      text not null,
  street        text not null,
  address       text not null,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  -- one active household per address
  address_key   text generated always as (upper(regexp_replace(house_no || '|' || street, '[^A-Za-z0-9|]', '', 'g'))) stored
);
create unique index if not exists households_one_per_address on households (address_key) where archived_at is null;

create table if not exists families (
  id                uuid primary key default gen_random_uuid(),
  family_no         text not null unique default next_family_no() check (family_no ~ '^FAM-181-[0-9]{6}$'),
  household_id      uuid not null references households(id),
  name              text not null,
  head_resident_id  uuid,  -- FK added after residents exists
  created_at        timestamptz not null default now(),
  unique (household_id, name)
);

create table if not exists residents (
  id            uuid primary key default gen_random_uuid(),
  resident_no   text not null unique default next_resident_no() check (resident_no ~ '^RES-181-[0-9]{4}-[0-9]{6}$'),
  household_id  uuid not null references households(id),
  family_id     uuid not null references families(id),
  relationship  text not null,
  first_name    text not null,
  middle_name   text,
  last_name     text not null,
  suffix        text,
  birth_date    date not null,
  contact_no    text unique,          -- one resident per mobile number
  archived_at   timestamptz,          -- residents are archived, never deleted
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table families add constraint families_head_fk foreign key (head_resident_id) references residents(id);
-- resident_no is permanent
create or replace function keep_resident_no() returns trigger language plpgsql as $$
begin
  if new.resident_no <> old.resident_no then raise exception 'Resident Number cannot be changed'; end if;
  return new;
end $$;
create trigger residents_keep_no before update on residents for each row execute function keep_resident_no();

-- Household moves (the resident keeps the same number; history is kept).
create table if not exists resident_moves (
  id            uuid primary key default gen_random_uuid(),
  resident_id   uuid not null references residents(id),
  from_family   uuid references families(id),
  to_family     uuid not null references families(id),
  reason        text not null check (length(trim(reason)) >= 5),
  moved_by      uuid not null,
  moved_at      timestamptz not null default now()
);

-- Accounts: a login linked to one resident record, or a personnel record.
create table if not exists accounts (
  id            uuid primary key references auth.users(id),
  account_no    text unique check (account_no ~ '^ACC-181-[0-9]{6}$'),
  personnel_no  text unique check (personnel_no ~ '^EMP-181-[0-9]{6}$'),
  resident_id   uuid unique references residents(id),
  role_id       text not null,
  check ((role_id = 'resident' and account_no is not null and personnel_no is null)
      or (role_id <> 'resident' and personnel_no is not null and account_no is null))
);

-- MIGRATION: every earlier number stays searchable and traceable.
create table if not exists legacy_identifiers (
  id           uuid primary key default gen_random_uuid(),
  entity       text not null check (entity in ('resident','household','family','account')),
  entity_id    uuid not null,
  legacy_no    text not null,
  new_no       text not null,
  migrated_at  timestamptz not null default now(),
  unique (entity, legacy_no)
);
-- Migration steps (run once, in a transaction, after a backup):
--   1. Insert households/families/residents keeping their UUIDs; let the defaults issue new numbers
--      in the order of the old numbers (order by legacy_no) so the sequence follows the old order.
--   2. Insert one legacy_identifiers row per record (old -> new).
--   3. setval() each sequence to the highest number issued.
--   4. Verify: counts match, no duplicate numbers, every legacy number resolves to exactly one record.
--   5. Search: residents/households are found by new number, legacy number, name, address or contact.

-- Possible duplicates (shown to Barangay Personnel, never merged automatically).
create or replace view possible_duplicate_residents as
select a.id as resident_id, b.id as possible_duplicate_id,
       case when a.birth_date = b.birth_date then 'same name and birthdate' else 'same name and street' end as reason
from residents a
join residents b on a.id < b.id
 and upper(a.first_name) = upper(b.first_name) and upper(a.last_name) = upper(b.last_name)
join households ha on ha.id = a.household_id
join households hb on hb.id = b.household_id
where a.birth_date = b.birth_date or upper(ha.street) = upper(hb.street);

-- RLS: residents read their own row and their household; only roles with residents.update
-- insert/update households, families, residents and resident_moves (see security.sql).
