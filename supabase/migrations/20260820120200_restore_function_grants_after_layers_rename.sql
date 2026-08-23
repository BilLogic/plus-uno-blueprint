-- layers → lanes, part 3 of 3: repair the ACLs part 2 widened.
--
-- Dropping and recreating a function restores Postgres's DEFAULT grant of
-- EXECUTE to PUBLIC. Part 2's loop re-granted the roles it had captured but
-- never revoked that default, so every recreated function came back executable
-- by PUBLIC — and add_lane and upsert_cell, never granted to anon before, came
-- back reachable by anon as well.
--
-- Both are SECURITY DEFINER writes. AGENTS.md is explicit: "Never widen RLS;
-- the deployed site stays read-only."
--
-- ACLs captured before the rename, restored exactly by this migration:
--   add_lane         postgres, authenticated, service_role
--   mint_cell_key    PUBLIC, postgres, anon, authenticated, service_role
--   search_blueprint postgres, anon, authenticated, service_role
--   upsert_cell      postgres, authenticated, service_role
--
-- mint_cell_key is untouched: it genuinely carried PUBLIC and anon before.
--
-- LESSON, worth carrying into any future drop-and-recreate: capturing an ACL
-- is not enough. The recreate starts from Postgres's default, so the repair has
-- to REVOKE what the original had revoked, not only grant what it had granted.

revoke execute on function
  public.add_lane(scenario_id uuid, name text, lane_role text, at_row integer)
  from public, anon;

revoke execute on function
  public.upsert_cell(path_id uuid, lane_id uuid, step_id uuid, content text)
  from public, anon;

revoke execute on function
  public.search_blueprint(
    q text, query_embedding extensions.vector, match_count integer, embed_model text,
    rrf_k integer, filter_phase text, filter_scenario text, filter_path_type text,
    filter_lane_role text, granularity text[], include text[])
  from public;
