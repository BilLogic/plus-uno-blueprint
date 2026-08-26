-- The search portal has been rejecting the word the rest of the model uses.
--
-- Everything inside `search_blueprint` already says lane. It joins
-- `public.lanes`, it reads `c.lane_id` and `l.lane_role`, it projects an output
-- column called `lane`, and since 20260820120100 it takes `filter_lane_role`.
-- That migration renamed the PARAMETER and stopped at the parameter list. The
-- granularity guard two dozen lines into the body was never touched, so:
--
--   granularity => 'lane'   raises "unknown granularity: lane"
--   granularity => 'layer'  works, and is the only spelling that does
--
-- and the exception's own hint teaches the caller the retired word. It has been
-- that way on production since 2026-08-20. The emitted row kind is the same
-- inversion one line further down: the lane rung tags its rows `'layer'` while
-- the column beside it is called `lane`.
--
-- WHY NOTHING CAUGHT IT. `src/lib/blueprintContract.ts` declares the search
-- RPC's parameter NAMES, and `check:contract:live` asserts every declared name
-- binds. Neither the accepted VALUES of `granularity` nor the row KINDS the
-- function emits were ever declared, so there was nothing for a guard to
-- compare against — a check has nothing to say about a value it was never told.
-- Both are declared in the contract in the same commit as this migration, which
-- is what turns the next value rename into contract drift rather than a 500.
--
-- ACCEPT BOTH, DELIBERATELY. `'layer'` stays valid on input. uno-bot vendors
-- the contract and deploys on its own cadence, so a hard flip would break every
-- bot search in the window between this migration landing and the bot's next
-- deploy — the same mid-deploy breakage the layers→lanes series kept tripping
-- over. Dropping `'layer'` is a follow-up, gated on the bot's vendored copy
-- having synced; it is not a tidy-up someone should do on sight.
--
-- The emitted KIND gets no such grace period, because a row kind is one value
-- with nowhere to put an alias. It becomes `'lane'` here. The live checker's
-- accounted set already said `lane`; it never saw the disagreement because the
-- only granularity it sends is `cell`.
--
-- NOT CHANGED: the breadcrumb label `'Layer: '` in the cell branch. All 808
-- corpus chunks carry that label inside their *stored* title, and the title is
-- part of the EMBEDDED text — flipping it strands every embedding until a full
-- re-embed, which is a workflow dispatch on the uno-bot repo and blocked on
-- access. plus-uno-blueprint#144 part 3, with `blueprint_chunks_src`. A guard
-- below fails this migration if that literal moves.
--
-- The body is taken from the live definition rather than retyped, so every
-- sweep since v5 is preserved. The signature does not change, so this is a
-- CREATE OR REPLACE and the grants survive on their own — the drop-and-recreate
-- ACL trap of 20260820120100/120200 is not in play. Asserted afterwards anyway:
-- this function is the single search entry point for every consumer.
--
-- Acceptance, run after: both spellings answer, neither doubles the other.
--   select count(*) from search_blueprint(granularity => array['lane']);
--   select count(*) from search_blueprint(granularity => array['lane','layer']);

do $do$
declare d text; before_len int;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';
  if d is null then raise exception 'search_blueprint not found'; end if;

  -- Every fragment below is matched against POST-rename text. A body that still
  -- says filter_layer_role is pre-20260820120100, and each replace would miss
  -- rather than mis-apply — but it would miss for the wrong reason, so say so.
  if d ~ 'filter_layer_role' then
    raise exception
      'search_blueprint still takes filter_layer_role — apply 20260820120100 first';
  end if;

  -- 1. The input guard. `lane` is added and `layer` is kept, in that order, so
  --    the list reads current-word-first with the retired spelling trailing it.
  before_len := length(d);
  d := replace(d,
    $$('phase','scenario','path','step','layer','cell')$$,
    $$('phase','scenario','path','step','lane','layer','cell')$$);
  if length(d) = before_len then
    raise exception 'search_blueprint: the granularity guard did not match';
  end if;

  -- 2. The hint, which is the only thing a caller sees when the guard fires.
  --    It names the current word and says the old one still works, so a reader
  --    who hits it learns which way the rename went.
  before_len := length(d);
  d := replace(d,
    $$'One or more of: phase, scenario, path, step, layer, cell.'$$,
    $$'One or more of: phase, scenario, path, step, lane, cell. "layer" is the retired spelling of "lane" and is still accepted.'$$);
  if length(d) = before_len then
    raise exception 'search_blueprint: the granularity hint did not match';
  end if;

  -- 3. The two predicates that gate the lane rung: one in the corpus-wide
  --    count, one in the `structural` CTE. Both have to move together — moving
  --    only the CTE would return rows against a `total_matched` that denies
  --    them. One predicate with an OR, not a second union branch: two branches
  --    would emit the rung twice for a caller that asks for both spellings.
  before_len := length(d);
  d := replace(d,
    $$where 'layer' = any(gran)$$,
    $$where ('layer' = any(gran) or 'lane' = any(gran))$$);
  if length(d) = before_len then
    raise exception 'search_blueprint: no lane-rung predicate matched';
  end if;
  if (
    select count(*) from regexp_matches(
      d, $$where \('layer' = any\(gran\) or 'lane' = any\(gran\)\)$$, 'g')
  ) <> 2 then
    raise exception
      'search_blueprint: expected 2 lane-rung predicates (the count and the CTE)';
  end if;

  -- 4. The emitted kind.
  before_len := length(d);
  d := replace(d,
    $$select 'layer', l.id, l.name, l.lane_role, l.updated_at,$$,
    $$select 'lane', l.id, l.name, l.lane_role, l.updated_at,$$);
  if length(d) = before_len then
    raise exception 'search_blueprint: the lane row kind did not match';
  end if;
  if d ~ $$select 'layer',$$ then
    raise exception 'search_blueprint: a layer row kind survived the replace';
  end if;

  -- 5. And the one that must NOT have moved. #144 part 3.
  if d !~ $$'Layer: '$$ then
    raise exception 'search_blueprint: the breadcrumb label left with the rest, and it is embedded in all 808 stored chunk titles (#144 part 3)';
  end if;

  execute d;
end
$do$;

-- The signature, the grants, and then the behaviour. A body-only replace should
-- disturb none of the first two, which is exactly why an unasserted one is how
-- a search outage ships looking like a rename.
do $do$
declare sig text; acl text;
begin
  select pg_get_function_identity_arguments(p.oid), array_to_string(coalesce(p.proacl::text[], '{}'::text[]), ' ')
  into sig, acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';

  if sig is null then raise exception 'search_blueprint did not survive the replace'; end if;
  if sig not like '%filter_lane_role text%'
     or sig not like '%granularity text[]%'
     or sig not like '%include text[]%' then
    raise exception 'search_blueprint signature drifted: %', sig;
  end if;

  if acl !~ 'anon=X' or acl !~ 'authenticated=X' or acl !~ 'service_role=X' then
    raise exception 'search_blueprint lost a grant — every caller now gets 42501: %', acl;
  end if;
  if acl ~ '(^| )=X' then
    raise exception 'search_blueprint came back executable by PUBLIC: %', acl;
  end if;
end
$do$;

do $do$
declare k text; n_lane bigint; n_both bigint;
begin
  -- The word the whole model uses now answers, and answers as itself.
  select s.kind into k
  from public.search_blueprint(granularity => array['lane'], match_count => 1) s;
  if k is not null and k <> 'lane' then
    raise exception 'granularity lane emitted kind %, not lane', k;
  end if;

  -- The retired word keeps answering until uno-bot's vendored contract syncs.
  perform 1 from public.search_blueprint(granularity => array['layer'], match_count => 1);

  -- And asking for both does not return the rung twice.
  select count(*) into n_lane
  from public.search_blueprint(granularity => array['lane'], match_count => 1000);
  select count(*) into n_both
  from public.search_blueprint(granularity => array['lane','layer'], match_count => 1000);
  if n_lane <> n_both then
    raise exception
      'lane+layer returns % rows where lane alone returns % — the rung is emitted twice',
      n_both, n_lane;
  end if;
end
$do$;
