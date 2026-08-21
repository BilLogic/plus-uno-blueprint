-- Two writes this branch shipped cannot succeed, for the same reason twice:
-- the column and the table arrived, and the permission to write them did not.
--
-- 1. cells.status has no UPDATE grant.
--    20260821240000 added the column. `authenticated` holds column-level
--    UPDATE on exactly eight columns of public.cells — content, form,
--    function, links, owner, perceived_owner, summary, value_props — and
--    status is not among them.
--
--    This is worse than "status silently does not save". Postgres rejects the
--    WHOLE statement with 42501 when any SET column lacks a grant, and
--    updateCellContent puts `status` in every update it builds. So the missing
--    grant does not break the status field — it breaks EVERY cell content
--    save: the panel editor, revertChange, and the agent's update_cell alike.
--
--    (`anon` does hold UPDATE on status, along with id, path_id and
--    search_tsv — the old table-level grant, which is a separate pre-existing
--    concern and is left alone here. It is why the column list below is
--    explicit rather than a table-level grant.)
--
-- 2. public.services has no write policy of any kind.
--    RLS is enabled and the only policy is service_lifecycles_select
--    (SELECT, to public). RLS enabled plus zero applicable policy is
--    deny-all — for every role, service account included. The service panel's
--    updateServiceSummary can therefore never write, and it will fail
--    requireRowsWritten rather than erroring, so it reads as "nothing
--    changed".
--
--    The policy below is RESTRICTIVE on purpose. business_model pairs a
--    permissive `true` policy with a restrictive is_service_account() one and
--    is safe because the restrictive half does the real gating. services
--    still carries the old table-level INSERT/UPDATE/DELETE grant to `anon`,
--    so a naive PERMISSIVE policy with `with check (true)` would hand anon a
--    public write hole on the service row. Restrictive cannot do that: it can
--    only ever subtract.

grant update (status) on public.cells to authenticated;

alter table public.services enable row level security;

drop policy if exists services_update_auth on public.services;
create policy services_update_auth
  on public.services
  as permissive
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists services_update_service_only on public.services;
create policy services_update_service_only
  on public.services
  as restrictive
  for update
  to authenticated
  using (public.is_service_account())
  with check (public.is_service_account());

do $do$
declare n int;
begin
  -- The status column is writable by the role the app authenticates as.
  select count(*) into n
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'cells'
    and grantee = 'authenticated' and privilege_type = 'UPDATE'
    and column_name = 'status';
  if n <> 1 then raise exception 'authenticated still cannot update cells.status'; end if;

  -- Every column updateCellContent names is writable. A save is all-or-nothing,
  -- so one missing grant fails the whole statement — check them as a set.
  select count(*) into n
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'cells'
    and grantee = 'authenticated' and privilege_type = 'UPDATE'
    and column_name in ('content', 'summary', 'owner', 'perceived_owner',
                        'function', 'form', 'value_props', 'status');
  if n <> 8 then
    raise exception 'updateCellContent needs 8 updatable columns, authenticated has %', n;
  end if;

  -- services can be written, and only by the service account.
  select count(*) into n from pg_policies
  where schemaname = 'public' and tablename = 'services' and cmd = 'UPDATE';
  if n < 2 then
    raise exception 'services still lacks a permissive+restrictive UPDATE pair (found %)', n;
  end if;

  select count(*) into n from pg_policies
  where schemaname = 'public' and tablename = 'services' and cmd = 'UPDATE'
    and permissive = 'RESTRICTIVE' and qual like '%is_service_account%';
  if n <> 1 then
    raise exception 'services UPDATE is not gated by a restrictive is_service_account policy';
  end if;
end
$do$;
