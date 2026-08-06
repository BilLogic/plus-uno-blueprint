-- Close the tier gap the service-account migration documented, plus one
-- live hole a security review found next to it.
--
-- 1. rename_owner_tag never revoked its default PUBLIC execute grant (every
--    other authoring function did, in 20260731004000). It is SECURITY
--    DEFINER and does two unconditional UPDATEs on cells, so ANYONE holding
--    the anon key — which ships in the deployed bundle by design — could
--    rewrite owner/perceived_owner across every cell. No damage to date
--    (no cell carries an owner tag yet), destructive the moment one does.
--
-- 2. The 21 authoring RPCs are SECURITY DEFINER and owned by a role with
--    rolbypassrls, so the RESTRICTIVE policies added in
--    20260805150000 never run for them. Direct-table writes were tiered;
--    the RPCs — which is what the app actually calls — were not. A signed-in
--    viewer could delete every scenario in the database via a plain REST
--    rpc call. Each body now asserts the tier itself, which is the only
--    place it CAN be asserted for a definer function.

revoke execute on function public.rename_owner_tag(text, text) from public, anon;

-- The assert, injected at the top of every authoring function body. Done as
-- a DO block over pg_proc rather than 21 hand-edited CREATE OR REPLACEs so
-- that no function is missed and none drifts: the guard text is identical
-- everywhere by construction.
do $outer$
declare
  target record;
  guard constant text :=
    E'  if not public.is_service_account() then\n'
    E'    raise exception ''This account cannot edit the blueprint''\n'
    E'      using errcode = ''42501'';\n'
    E'  end if;\n';
  body text;
  new_def text;
begin
  for target in
    select p.oid,
           pg_get_functiondef(p.oid) as def,
           p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'create_scenario', 'create_phase', 'create_path', 'duplicate_path',
        'add_step', 'add_lane', 'reorder_steps', 'set_path_steps',
        'reorder_lanes', 'upsert_cell', 'set_cell_dependency',
        'clear_cell_dependency', 'rename_phase', 'rename_scenario',
        'rename_path', 'rename_owner_tag', 'delete_scenario', 'delete_path',
        'remove_step', 'remove_lane', 'delete_cell'
      )
  loop
    body := target.def;
    -- Idempotent: re-running must not stack guards.
    if position('is_service_account()' in body) > 0 then
      continue;
    end if;
    -- Insert immediately after the function's opening `begin`. Every one of
    -- these is plpgsql with a single top-level begin following its declare
    -- block, so the first `\nbegin\n` is the right seam.
    new_def := regexp_replace(body, E'\nbegin\n', E'\nbegin\n' || guard, 'g');
    if new_def = body then
      raise exception 'Could not place the tier guard in %', target.proname;
    end if;
    execute new_def;
  end loop;
end
$outer$;

-- 3. findings: the canvas-writes migration issued a table-level UPDATE grant,
--    which silently superseded the deliberate column-scoped one from the
--    derived-layer migration ("humans may flip STATUS only"). Restore the
--    narrow grant, widened only to the columns record_finding's
--    update-in-place actually writes.
revoke update on public.findings from authenticated;
grant update (status, note, severity, run_id, cell_ids, cell_keys, source)
  on public.findings to authenticated;

-- 4. A finding may only be INSERTED as open. The dedupe rule is
--    "dismissed stays dismissed — drop silently", so an insert that could
--    set status directly would let one forged row permanently suppress a
--    real finding from every future audit run, invisibly. Dismissing stays
--    what it always was: a human triage decision, made by UPDATE.
drop policy if exists "findings_insert_auth" on public.findings;
create policy "findings_insert_auth" on public.findings
  for insert to authenticated with check (status = 'open');

-- 5. Storage was outside the tier entirely: the slice-illustration policies
--    check only bucket and filename shape, so a viewer could upload and
--    overwrite any illustration in a public bucket.
do $$
declare
  policy_name text;
begin
  for policy_name in
    select polname from pg_policy
    where polrelid = 'storage.objects'::regclass
      and polname in ('slice_illustrations_insert', 'slice_illustrations_update')
  loop
    execute format(
      'alter policy %I on storage.objects to authenticated', policy_name);
  end loop;
end $$;

create policy "slice_illustrations_service_only"
  on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'slice-illustrations' or public.is_service_account())
  with check (bucket_id <> 'slice-illustrations' or public.is_service_account());

-- 6. The founding-admin trigger was applied straight to hosted during the
--    session; land it in a migration so a fresh environment matches.
create or replace function public.flag_founding_service_accounts()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.email in ('boyuang@andrew.cmu.edu', 'meryemm@andrew.cmu.edu') then
    new.raw_app_meta_data :=
      coalesce(new.raw_app_meta_data, '{}'::jsonb) || '{"role":"service"}'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists flag_founding_service_accounts on auth.users;
create trigger flag_founding_service_accounts
  before insert on auth.users
  for each row execute function public.flag_founding_service_accounts();
