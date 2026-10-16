-- A path kind left out is a variant: create_path and duplicate_path stop
-- defaulting to a kind the check refuses.
--
-- Authored 2026-10-15.
--
-- `paths_kind_check` admits happy, variant and exception. Both functions that
-- create a path still default `kind` to 'alternative', a spelling the check
-- has refused since the kinds were settled, so any call that leaves `kind`
-- out is refused outright:
--
--   create_path(scenario_id, name, kind default 'alternative', …)
--   duplicate_path(source_path_id, name, kind default 'alternative', …)
--
-- The app always passes a kind, which is why neither has failed in use. An
-- agent or an RPC caller that relies on the signature's own default does not.
-- `create_path_at_status` (20261015120000) was written with 'variant' for
-- exactly this reason, and the template made the same call for
-- `duplicate_path` when it rebuilt the copy functions: a path made beside
-- another is a variant.
--
-- The rewrite edits the default and nothing else. Each function's live
-- definition is read back with `pg_get_functiondef`, the one default is
-- replaced, and the result is executed, so the bodies this database runs are
-- the bodies it keeps. `create or replace` keeps the function's oid and with
-- it every grant. No rows are read or moved.

do $rewrite$
declare
  target regprocedure;
  before text;
  after  text;
begin
  foreach target in array array[
    'public.create_path(uuid, text, text, uuid)'::regprocedure,
    'public.duplicate_path(uuid, text, text, boolean, boolean)'::regprocedure
  ]
  loop
    before := pg_get_functiondef(target);
    after := replace(before,
      'kind text DEFAULT ''alternative''::text',
      'kind text DEFAULT ''variant''::text');
    if after = before then
      raise exception '% does not default kind to alternative; nothing to rewrite', target;
    end if;
    if after ~ '''alternative''' then
      raise exception '% still names a path kind the check refuses', target;
    end if;
    execute after;
  end loop;
end
$rewrite$;

-- ---------------------------------------------------------------------------
-- The proof: both calls, with kind left out, as the app's account
-- ---------------------------------------------------------------------------
--
-- Run under `set local role authenticated` with a service-account JWT, not as
-- the owner, so the grant and the tier guard are what the calls pass through.
-- The fixture is built as owner, because building it is not what is being
-- proved. The whole block rolls itself back through the sentinel exception:
-- a migration may prove a thing, and may not leave the rows it proved it with.

do $a_kind_left_out$
declare
  svc uuid;
  phase uuid;
  scen uuid;
  pth uuid;
  made uuid;
  copied uuid;
  v_kind text;
  done boolean := false;
  msg text;
begin
  begin
    insert into public.services (name, slug)
      values ('kind-left-out fixture', 'kind-left-out-fixture') returning id into svc;
    insert into public.phases (service_id, name, position)
      values (svc, 'fixture phase', 0) returning id into phase;
    insert into public.scenarios (phase_id, name, position)
      values (phase, 'fixture scenario', 0) returning id into scen;
    insert into public.paths (scenario_id, name, kind)
      values (scen, 'fixture path', 'happy') returning id into pth;

    execute 'set local request.jwt.claims = ' ||
      quote_literal('{"role":"authenticated","app_metadata":{"role":"service"}}');
    execute 'set local role authenticated';

    made := public.create_path(scen, 'fixture made path');
    select p.kind into v_kind from public.paths p where p.id = made;
    if v_kind is distinct from 'variant' then
      raise exception 'create_path without a kind made a % path, expected variant',
        coalesce(v_kind, '<null>');
    end if;

    copied := public.duplicate_path(pth, 'fixture copied path');
    select p.kind into v_kind from public.paths p where p.id = copied;
    if v_kind is distinct from 'variant' then
      raise exception 'duplicate_path without a kind made a % path, expected variant',
        coalesce(v_kind, '<null>');
    end if;

    execute 'reset role';
    done := true;
    raise exception using errcode = 'P0001',
      message = 'kind-left-out fixture rollback';
  exception when others then
    execute 'reset role';
    get stacked diagnostics msg = message_text;
    if msg <> 'kind-left-out fixture rollback' then raise; end if;
  end;

  if not done then
    raise exception 'the kind-left-out cases never ran';
  end if;
  if exists (select 1 from public.services where slug = 'kind-left-out-fixture') then
    raise exception 'the kind-left-out fixture survived the rollback';
  end if;
end
$a_kind_left_out$;
