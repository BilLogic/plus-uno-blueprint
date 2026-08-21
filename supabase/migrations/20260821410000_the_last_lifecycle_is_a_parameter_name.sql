-- The last place "lifecycle" names a level of the model.
--
-- 20260821340000 retired the word: service_lifecycles became services,
-- service_lifecycle_id became service_id. 20260821370000 swept it out of the
-- function bodies. What survives is create_phase's own PARAMETER:
--
--   create_phase(lifecycle_id uuid, name text, summary text)
--
-- A parameter name is a wire contract, not an internal detail. PostgREST
-- matches RPC arguments by name, so `authoringRpc.ts` sends
-- `{ lifecycle_id: ... }` and the agent registry mirrors it. Rename one side
-- alone and every "add phase" call fails with "function does not exist" —
-- which is why this could not ride along with the body sweep.
--
-- Postgres cannot rename a parameter in place: the name is part of the
-- function's identity for named-argument calls, so this drops and recreates.
-- The body is taken from the live definition rather than retyped, so the
-- 370000 sweep is preserved rather than reverted.
--
-- The client change lands in the same commit. Applying this migration without
-- it, or shipping that without this, breaks phase creation in exactly the way
-- the two-sided rename exists to avoid.
--
-- Acceptance, run after: zero rows.
--   select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and pg_get_function_identity_arguments(p.oid) like '%lifecycle%';

do $do$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_phase';
  if d is null then raise exception 'create_phase not found'; end if;

  -- 370000 must have run first. Recreating a body that still names the dead
  -- table would reintroduce the break this series just closed.
  if d ~ 'service_lifecycles' then
    raise exception
      'create_phase still names service_lifecycles — apply 20260821370000 first';
  end if;

  -- The signature, then every reference in the body. `lifecycle_id` appears as
  -- a bare identifier only; there is no other token containing it, so a
  -- word-boundary replace is safe here — unlike the constraint name in
  -- 370000, where the word sat inside a longer identifier.
  d := regexp_replace(d, '\mlifecycle_id\M', 'service_id', 'g');
  if d ~ 'lifecycle' then
    raise exception 'create_phase: a lifecycle fragment survived the rename';
  end if;

  drop function if exists public.create_phase(uuid, text, text);
  execute d;
end
$do$;

do $do$
declare sig text;
begin
  select pg_get_function_identity_arguments(p.oid) into sig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_phase';

  if sig is null then
    raise exception 'create_phase did not survive the recreate';
  end if;
  if sig not like '%service_id%' then
    raise exception 'create_phase still does not take service_id (got %)', sig;
  end if;
  if sig like '%lifecycle%' then
    raise exception 'create_phase still takes a lifecycle parameter (got %)', sig;
  end if;

  -- The drop takes the grants with it. Without this the RPC exists and every
  -- caller gets 42501 instead — a different failure wearing the same clothes.
  grant execute on function public.create_phase(uuid, text, text) to authenticated;

  -- Nothing anywhere in either schema still names the retired level.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'semantic_search')
      and (p.prosrc like '%lifecycle%'
        or pg_get_function_identity_arguments(p.oid) like '%lifecycle%')
  ) then
    raise exception 'lifecycle survives somewhere in the function catalogue';
  end if;
end
$do$;
