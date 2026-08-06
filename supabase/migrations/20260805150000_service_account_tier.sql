-- Service-account tier: authenticated splits into service (edit-everything)
-- and regular (view + agent chat/navigation only). RESTRICTIVE policies AND
-- with the existing permissive ones, so a non-service session keeps its
-- reads and its agent chat but loses every blueprint/derived-layer write.
-- anon is untouched. agent_sessions/agent_messages stay open to all
-- authenticated — chatting is exactly what a non-service account is for.
--
-- ⚠ KNOWN GAP (must close before ANY non-service account is created): the
-- authoring RPCs (add_step, upsert_cell, …) are SECURITY DEFINER and bypass
-- RLS — they need an internal is_service_account() assert. Today every
-- account is a service account and public sign-ups are disabled, so the
-- gap is unreachable; the assert pass is the gate for minting viewers.

create or replace function public.is_service_account()
returns boolean
language sql
stable
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'service',
    false
  )
$$;

comment on function public.is_service_account() is
  'True when the JWT app_metadata.role is service. Set via auth.users.raw_app_meta_data — users cannot self-assign (user_metadata is ignored on purpose).';

do $$
declare
  t text;
begin
  foreach t in array array[
    'phases', 'service_scenarios', 'paths', 'steps', 'path_steps',
    'layers', 'cells', 'cell_triggers', 'slices', 'slice_items',
    'evidence', 'propositions', 'findings'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check (public.is_service_account())',
      t || '_insert_service_only', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (public.is_service_account()) with check (public.is_service_account())',
      t || '_update_service_only', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (public.is_service_account())',
      t || '_delete_service_only', t);
  end loop;
end $$;

-- Existing accounts are all service accounts (there is no viewer tier yet).
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"service"}'::jsonb
where email in (
  'dev-authoring@uno-blueprint.local',
  'boyuang@andrew.cmu.edu',
  'meryemm@andrew.cmu.edu'
);
