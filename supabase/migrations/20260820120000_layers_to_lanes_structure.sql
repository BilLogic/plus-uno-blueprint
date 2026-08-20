-- layers → lanes, part 1 of 3: the table, its columns and its dependent objects.
--
-- `layers` is defensible and nobody says it. layer-roles.md has to teach the
-- split, BlueprintLabelRail calls it a "swim-lane grid row", and remove_lane /
-- add_lane were already named lane. The code apologises for one of these in
-- writing: upsert_cell's spec said "lane id from get_blueprint (parameter
-- named layer_id FOR HISTORICAL REASONS)".
--
-- Renaming a table moves none of its constraints, indexes, policies or
-- triggers. All eleven are renamed explicitly, plus the two on `cells` that
-- carried the old column name.

alter table public.layers rename to lanes;
alter table public.lanes  rename column layer_role to lane_role;
alter table public.cells  rename column layer_id   to lane_id;

alter table public.lanes rename constraint layers_pkey           to lanes_pkey;
alter table public.lanes rename constraint layers_path_id_fkey   to lanes_path_id_fkey;
alter table public.lanes rename constraint layers_origin_check   to lanes_origin_check;
alter table public.lanes rename constraint layers_kpis_is_array  to lanes_kpis_is_array;
alter table public.lanes rename constraint layers_tools_is_array to lanes_tools_is_array;

alter table public.cells rename constraint cells_layer_id_fkey          to cells_lane_id_fkey;
alter table public.cells rename constraint cells_layer_step_slot_unique to cells_lane_step_slot_unique;

alter index public.layers_path_id_idx  rename to lanes_path_id_idx;
alter index public.layers_path_row_idx rename to lanes_path_row_idx;

alter policy layers_select              on public.lanes rename to lanes_select;
alter policy layers_insert_service_only on public.lanes rename to lanes_insert_service_only;
alter policy layers_update_service_only on public.lanes rename to lanes_update_service_only;
alter policy layers_update_auth         on public.lanes rename to lanes_update_auth;
alter policy layers_delete_service_only on public.lanes rename to lanes_delete_service_only;

alter trigger set_layers_updated_at on public.lanes rename to set_lanes_updated_at;

-- Function bodies are text, resolved at execution, so they follow none of the
-- above. Swept by word boundary. The four SIGNATURE-changing functions are
-- excluded here and handled in part 2 — rewriting their headers through
-- CREATE OR REPLACE raises "cannot change name of input parameter".
do $do$
declare r record; d text; n int := 0;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p join pg_namespace nsp on nsp.oid = p.pronamespace
    where nsp.nspname in ('public','semantic_search') and p.prokind = 'f'
      and p.proname not in ('add_lane','mint_cell_key','upsert_cell','search_blueprint')
      and pg_get_functiondef(p.oid) ~ '\m(layers|layer_id|layer_role)\M'
  loop
    d := pg_get_functiondef(r.oid);
    d := regexp_replace(d, '\mlayers\M',     'lanes',     'g');
    d := regexp_replace(d, '\mlayer_id\M',   'lane_id',   'g');
    d := regexp_replace(d, '\mlayer_role\M', 'lane_role', 'g');
    execute d;
    n := n + 1;
  end loop;
  raise notice 'rewrote % function bodies', n;
end
$do$;
