-- cells.description → cells.summary.
--
-- The codebase already wrote down that the name was wrong and worked around
-- it: CellPanelEditor rendered <Field label="Summary"> above a comment reading
-- '"Summary", not "Description" … the column stays `description` — a label
-- rename is not a migration', and getCell relabelled it on the way out as
-- ['summary', data.description]. Documented debt, not opinion. Both are gone.
--
-- THE TRAP: `alter table ... rename column` does NOT touch plpgsql function
-- bodies. Five fragments across three functions reference cells' description;
-- each is replaced by name, because `description` is also a column on paths,
-- phases, service_scenarios and slices inside these same bodies.
--
-- CHECKED RATHER THAN ASSUMED:
--   * `search_tsv` is a GENERATED column whose expression names description
--     four times. Generated expressions are stored as parse trees and DO
--     follow a rename — asserted after applying, not trusted.
--   * Column-level GRANTs are keyed by attnum and survive (16 privileges).
--   * search_blueprint's RETURNS TABLE keeps its `description` OUTPUT column.
--     That is uno-bot's wire format (blueprintContract.searchBlueprintColumns),
--     a separate decision from the table's column name.
--
-- Acceptance, run after: zero functions still name a cells description.
--   select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname in ('public','semantic_search') and p.prokind='f'
--     and pg_get_functiondef(p.oid) ~ '\mc\.description\M';

alter table public.cells rename column description to summary;

do $do$
declare d text; before_len int;
begin
  -- duplicate_path -----------------------------------------------------------
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'duplicate_path';
  if d is null then raise exception 'duplicate_path not found'; end if;
  before_len := length(d);
  d := replace(d, '(path_id, layer_id, step_id, slot_position, content, description,',
                  '(path_id, layer_id, step_id, slot_position, content, summary,');
  d := replace(d, 'c.step_id, c.slot_position, c.content, c.description,',
                  'c.step_id, c.slot_position, c.content, c.summary,');
  if length(d) = before_len then raise exception 'duplicate_path: no cells.description fragment matched'; end if;
  execute d;

  -- duplicate_scenario -------------------------------------------------------
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'duplicate_scenario';
  if d is null then raise exception 'duplicate_scenario not found'; end if;
  before_len := length(d);
  d := replace(d, '(path_id, layer_id, step_id, slot_position, content, description,',
                  '(path_id, layer_id, step_id, slot_position, content, summary,');
  d := replace(d, 'c.slot_position, c.content, c.description,',
                  'c.slot_position, c.content, c.summary,');
  if length(d) = before_len then raise exception 'duplicate_scenario: no cells.description fragment matched'; end if;
  execute d;

  -- search_blueprint ---------------------------------------------------------
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';
  if d is null then raise exception 'search_blueprint not found'; end if;
  before_len := length(d);
  d := replace(d, 'select c.id as cell_id, c.content, c.description as descr, c.links as lnk,',
                  'select c.id as cell_id, c.content, c.summary as descr, c.links as lnk,');
  if length(d) = before_len then raise exception 'search_blueprint: cells.description fragment did not match'; end if;
  execute d;
end
$do$;
