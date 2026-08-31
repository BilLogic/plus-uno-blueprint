-- Enough of a Supabase project for the repository's migrations to run.
-- Only what they actually reference: measured, not guessed.
-- Roles are CLUSTER-wide, not database-wide, so a second replay finds them
-- already there. Created only if absent, so the prelude is re-runnable.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login;
  end if;
end
$$;
grant anon, authenticated, service_role to authenticator;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
create schema if not exists supabase_migrations;

grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;

-- MODELLED, and it took a recovery to get here (2026-08-31, #148).
--
-- A Supabase project sets default privileges on `public` for the role that
-- applies migrations, so every relation a migration creates arrives already
-- granted to the API roles. This repository knows it —
-- `20260830240000_anon_picked_up_two_more_tables.sql` ("they arrive with the
-- table: the platform grants the API roles on relations created in `public`")
-- and `20260830290000` both say so in their headers.
--
-- The prelude did NOT do it, and that was the honest position at the time.
-- Turning it on fixed `20260828120000_agent_history_gets_an_owner.sql`, which
-- exercises its own policies under `set role authenticated`, and turned THREE
-- green files red — `20260830240000`, `20260830250000` and `20260830290000`,
-- all of which audit the grant catalog. Two of those three were in
-- production's ledger and passed there, so the divergence was never in this
-- line. It was that `20260830210000 the_grants_that_arrived_with_the_object`
-- was applied in production and HAD NO FILE HERE — one of 38 such rows. The
-- revoke that makes those audits pass existed only in the ledger's
-- `statements` column.
--
-- That file has since been recovered and is in the series. So the condition
-- this note named as the blocker is met, and the measurement was re-run rather
-- than assumed: with the platform grant modelled, `20260828120000` replays,
-- the three grant audits stay green, and the structure column reaches zero.
--
-- The lesson is worth more than the two lines. A replay prelude that models
-- the host loosely makes migrations pass that production would fail, and one
-- that models it not at all makes migrations fail that production passes.
-- This one was wrong in the second direction for as long as a file was
-- missing, and the only way to tell which was by measuring both ways.


alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists vector with schema extensions;

-- GoTrue's surface, reduced to what the migrations touch.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.jwt() returns jsonb
  language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

create or replace function auth.role() returns text
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;

-- The real column list, not a guess: a thin `buckets` made
-- `20260729120000_derived_layer.sql` fail on `file_size_limit`, and that one
-- failure cascaded into every later migration that touches evidence, findings,
-- slices or slides.
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  owner_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  path_tokens text[],
  version text
);
alter table storage.objects enable row level security;

create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
