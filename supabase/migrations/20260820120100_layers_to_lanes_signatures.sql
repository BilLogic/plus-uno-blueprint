-- layers → lanes, part 2 of 3: the four functions whose SIGNATURES change.
--
-- Postgres refuses to rename an input parameter through CREATE OR REPLACE, so
-- each is dropped and recreated.
--
--   add_lane.layer_role                → lane_role         (app only)
--   mint_cell_key.layer_id             → lane_id           (internal)
--   upsert_cell.layer_id               → lane_id           (app + agent tools)
--   search_blueprint.filter_layer_role → filter_lane_role
--
-- PostgREST binds RPC arguments BY NAME, so each is a breaking change for a
-- caller that names it. uno-bot sends none of these — verified by grepping the
-- whole kit repo; filter_layer_role appears there once, in a comment.
--
-- ⚠️ search_blueprint's OUTPUT column `layer` also becomes `lane`. That IS a
-- wire format uno-bot reads by key, so it ships in the same window as the bot.
--
-- ⚠️⚠️ READ PART 3 BEFORE RUNNING THIS. Dropping a function drops its grants
-- AND the recreate restores Postgres's default EXECUTE to PUBLIC. The restore
-- loop below re-grants captured roles but does NOT revoke that default, which
-- widened four ACLs when this first ran. Part 3 repairs it; the two must be
-- applied together.
--
-- NOT changed here: the semantic breadcrumb still emits "Layer: …". All 808
-- corpus chunks have that label baked into their stored title, and the title is
-- part of the EMBEDDED text — renaming it strands every embedding until a full
-- re-embed. The bot's parser accepts "lane" alongside "layer" so the view can
-- be switched whenever that re-embed is run.

do $do$
declare r record; d text; acl text;
begin
  for r in
    select p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) as ident,
           coalesce(p.proacl::text[], '{}'::text[]) as acls
    from pg_proc p join pg_namespace nsp on nsp.oid = p.pronamespace
    where nsp.nspname = 'public' and p.prokind = 'f'
      and p.proname in ('add_lane','mint_cell_key','upsert_cell','search_blueprint')
  loop
    d := pg_get_functiondef(r.oid);
    -- filter_layer_role first: `layer_role` has no word boundary inside it.
    d := regexp_replace(d, '\mfilter_layer_role\M', 'filter_lane_role', 'g');
    d := regexp_replace(d, '\mlayers\M',     'lanes',     'g');
    d := regexp_replace(d, '\mlayer_id\M',   'lane_id',   'g');
    d := regexp_replace(d, '\mlayer_role\M', 'lane_role', 'g');
    d := replace(d, 'description text, layer text, step text',
                    'description text, lane text, step text');

    execute format('drop function public.%I(%s)', r.proname, r.ident);
    execute d;

    foreach acl in array r.acls loop
      if    acl like '=X/%'              then execute format('grant execute on function public.%I to public', r.proname);
      elsif acl like 'anon=X/%'          then execute format('grant execute on function public.%I to anon', r.proname);
      elsif acl like 'authenticated=X/%' then execute format('grant execute on function public.%I to authenticated', r.proname);
      elsif acl like 'service_role=X/%'  then execute format('grant execute on function public.%I to service_role', r.proname);
      end if;
    end loop;
  end loop;
end
$do$;
