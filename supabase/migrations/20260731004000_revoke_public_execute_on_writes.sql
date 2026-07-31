-- Close the write surface to anonymous callers.
--
-- `20260731001000` ended with `grant execute on function … to authenticated`
-- for all sixteen operations, which reads like a gate and is not one:
-- **Postgres grants EXECUTE to PUBLIC by default** when a function is created.
-- Granting to `authenticated` on top of that adds a role which already had it
-- through PUBLIC, and takes nothing away. Every one of these is
-- `security definer`, so they run as the owner and bypass RLS entirely.
--
-- Net effect before this migration: anyone holding the anon key — which ships
-- in the client bundle by design, and is on the public site — could call
-- `delete_scenario` and destroy a blueprint, or `create_scenario` and add one.
-- Verified directly rather than assumed:
--
--   select has_function_privilege('anon', p.oid, 'EXECUTE') …
--   → true for all thirteen write functions
--
-- This is the one rule the deployment has always claimed: the deployed app is
-- read-only, every write policy is `to authenticated`, and there is no sign-in.
-- The table policies held that line. The functions quietly did not.
--
-- REVOKE FROM PUBLIC is the operative statement. Revoking from `anon` alone
-- would leave the PUBLIC grant in place and change nothing.

-- Writes: structure ---------------------------------------------------------
revoke execute on function public.create_scenario(uuid, text, text, uuid, jsonb, int, text) from public, anon;
revoke execute on function public.create_phase(uuid, text, text) from public, anon;
revoke execute on function public.create_path(uuid, text, text, uuid) from public, anon;
revoke execute on function public.duplicate_path(uuid, text, text, boolean, boolean) from public, anon;
revoke execute on function public.add_step(uuid, text, int) from public, anon;
revoke execute on function public.add_lane(uuid, text, text, int) from public, anon;
revoke execute on function public.reorder_steps(uuid, uuid[]) from public, anon;
revoke execute on function public.set_path_steps(uuid, uuid[]) from public, anon;
revoke execute on function public.reorder_lanes(uuid, text[]) from public, anon;
revoke execute on function public.upsert_cell(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.set_cell_dependency(uuid, uuid, text, text, text) from public, anon;
revoke execute on function public.clear_cell_dependency(uuid) from public, anon;

-- Writes: deletion ----------------------------------------------------------
revoke execute on function public.delete_scenario(uuid) from public, anon;
revoke execute on function public.delete_path(uuid) from public, anon;
revoke execute on function public.remove_step(uuid, uuid) from public, anon;
revoke execute on function public.remove_lane(uuid, text) from public, anon;
revoke execute on function public.delete_cell(uuid) from public, anon;

-- Re-grant to the role that is supposed to have them. The revokes above strip
-- PUBLIC, which `authenticated` inherited from; this puts it back explicitly
-- for that role only.
grant execute on function public.create_scenario(uuid, text, text, uuid, jsonb, int, text) to authenticated;
grant execute on function public.create_phase(uuid, text, text) to authenticated;
grant execute on function public.create_path(uuid, text, text, uuid) to authenticated;
grant execute on function public.duplicate_path(uuid, text, text, boolean, boolean) to authenticated;
grant execute on function public.add_step(uuid, text, int) to authenticated;
grant execute on function public.add_lane(uuid, text, text, int) to authenticated;
grant execute on function public.reorder_steps(uuid, uuid[]) to authenticated;
grant execute on function public.set_path_steps(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_lanes(uuid, text[]) to authenticated;
grant execute on function public.upsert_cell(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.set_cell_dependency(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.clear_cell_dependency(uuid) to authenticated;
grant execute on function public.delete_scenario(uuid) to authenticated;
grant execute on function public.delete_path(uuid) to authenticated;
grant execute on function public.remove_step(uuid, uuid) to authenticated;
grant execute on function public.remove_lane(uuid, text) to authenticated;
grant execute on function public.delete_cell(uuid) to authenticated;

-- The read-only helpers stay open to anon on purpose. They are `stable` or
-- `immutable`, they write nothing, and they only describe data that is already
-- readable through the SELECT policies:
--   key_slug, cell_natural_key, mint_cell_key, slices_referencing,
--   deletion_impact
-- `deletion_impact` in particular is what the confirm dialog reads *before*
-- anything is destroyed, so a reader being able to ask "what would this cost"
-- is the intended behaviour.
