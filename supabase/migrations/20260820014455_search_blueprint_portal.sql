-- Superseded 45 seconds later by 20260820014607, kept because the hosted
-- migration history records it (repo replay must match production).
--
-- This version renamed the RETURN columns (scenario_name/phase_name) to dodge
-- the plpgsql rule that a RETURNS TABLE column and a parameter cannot share a
-- name. Wrong trade — the row shape is the consumer contract (uno-bot maps
-- rows.scenario / rows.phase). The follow-up renames the FILTER PARAMS instead
-- and restores the row shape. See 20260820014607 for the real portal.
drop function if exists public.search_blueprint(text);

create or replace function public.search_blueprint(
  q               text default null,
  query_embedding extensions.vector(768) default null,
  match_count     int  default 15,
  embed_model     text default null,
  rrf_k           int  default 60,
  phase           text default null,
  scenario        text default null,
  path_type       text default null,
  layer_role      text default null
)
returns table (
  kind text, id uuid, title text, snippet text, description text,
  layer text, step text, scenario_name text, phase_name text, path text,
  links jsonb, updated_at timestamptz,
  similarity double precision, rrf_score double precision,
  matched_by text, total_matched bigint
)
language plpgsql stable security definer
set search_path = public, extensions, semantic_search, pg_temp
as $function$
begin
  -- Body identical in structure to 20260820014607 apart from the column/param
  -- names; superseded before any consumer called it. Raise if ever invoked on
  -- a replayed database, so nobody builds on the wrong shape.
  raise exception 'superseded by 20260820014607_search_blueprint_portal_param_names';
end;
$function$;
