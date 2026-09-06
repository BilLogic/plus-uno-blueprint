-- Put this deployment's display values in its rows, where S2 made room for them.
-- Prepared for #326 S6 (#396 Q38 + Q48). NOT a migration. The owner runs it.
--
-- ══ What this is ═════════════════════════════════════════════════════════
--
-- Three literals in TypeScript said things about this deployment that only
-- this deployment could know:
--
--   src/lib/touchpointColors.ts    which colour each of PLUS's tools is drawn
--                                  in, and the older spellings that mean the
--                                  same tool
--   src/lib/scenarioParallelInfo.ts   which of three in-session scenarios can
--                                  run alongside the others, as a sentence
--
-- #396 Q48 settled where they belong: the machinery that resolves an alias and
-- falls back for an unchosen name is generic and stays in code; the VALUES are
-- each deployment's and move to columns. `20260905110000`, `20260905120000`
-- and `20260905130000` added those columns — `touchpoints.tone`,
-- `touchpoints.aliases`, `scenarios.note` — and deliberately wrote nothing
-- into them, because a migration that adds a column and fills it cannot be
-- reviewed as either. This file is the fill.
--
-- Until it runs, every column below is NULL, and the readers shipped with this
-- slice fall back exactly as they would in a fresh deployment: touchpoint
-- colours come from `src/data/touchpointRegistryFallback.ts`, and no scenario
-- shows a parallel note. Nothing breaks. What is missing is the point of the
-- slice — the values being data.
--
-- ══ Why it lives under docs/ and not in supabase/migrations/ ═════════════
--
-- The same reason `retire-plus-repair-shims.sql` does, and that file's header
-- carries the argument in full: a file in `supabase/migrations/` that has not
-- been applied is a new entry in the migration ledger's baseline, and the
-- session that prepared this one never contacts the hosted project, so it
-- cannot apply it. `docs/` is executed by nothing; every tool that walks the
-- series reads `supabase/migrations/` and only that.
--
-- Turning it into a numbered migration once it has been run is a rename. The
-- SQL is written to be safe either way: idempotent, no transaction control of
-- its own, asserting invariants rather than counting production's rows
-- (ADR 0009).
--
-- ══ How to run it ════════════════════════════════════════════════════════
--
--   psql "$DATABASE_URL" -1 -v ON_ERROR_STOP=1 \
--     -f docs/reference/seed-touchpoint-colours-and-scenario-notes.sql
--
-- `-1` wraps the whole file in ONE transaction and `ON_ERROR_STOP=1` aborts on
-- the first error, so a failed assertion rolls everything back rather than
-- leaving half the board recoloured. Both flags are required; without `-1`
-- psql commits statement by statement.
--
-- To see what it WOULD do without doing it:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -c 'begin' -f docs/reference/seed-touchpoint-colours-and-scenario-notes.sql \
--     -c 'rollback'
--
-- It prints its own counts as NOTICEs. A second run reports zero rows changed,
-- which is what idempotent means here.
--
-- The three writes need a role the deployed site does not have:
-- `touchpoints`'s UPDATE policy is `is_service_account()` and `authenticated`
-- holds no table-level UPDATE anywhere. Run it as the database owner over the
-- direct connection string, not through PostgREST.
--
-- ══ What decides each value ══════════════════════════════════════════════
--
-- EVERY VALUE BELOW IS THE COLOUR THE BOARD ALREADY DRAWS. Nothing here is a
-- new design decision, and that is deliberate: the old literal resolved 24 of
-- the 101 labels this deployment can render by a decision somebody made, and
-- the other 77 by a hash of the name. The 24 are written down. The 77 are
-- LEFT NULL on purpose — a hash is not a decision, and writing it into the
-- column would launder it into one and take away the picker's ability to show
-- the tool as unchosen. They keep hashing, which is the same colour they have
-- today.
--
-- One row is a judgement call and is called out here rather than buried:
-- `Google Docs/Slides` currently hashes to crimson, and the older spelling
-- `Google Docs/ Slides` — which the fixture boards still use — was
-- deliberately crimson in the literal. Writing crimson makes the two agree by
-- intent instead of by coincidence, and changes no pixel either way.
--
-- ══ What is NOT here, and why ════════════════════════════════════════════
--
-- `Clearance obtainment guide` was gold in the literal. This database has no
-- such row: it holds `Clearance guide`, which the rename left with no stored
-- colour, so the production board has been drawing that touchpoint in its
-- hashed colour since the rename and not in gold. Giving `Clearance guide`
-- gold would be the honest repair AND a visible change to a live board, which
-- is not this slice's business. It is left alone and recorded here so the next
-- person does not read the absence as an oversight.

-- ── 1. Touchpoint colours ────────────────────────────────────────────────

do $tones$
declare
  v_before integer;
  v_after integer;
  v_missing text;
begin
  select count(tone) into v_before from public.touchpoints;

  -- Dropped first as well as `on commit drop`ped, so that running this
  -- file twice inside ONE transaction is a no-op rather than a name clash.
  drop table if exists _tone_seed;
  create temporary table _tone_seed (name text primary key, tone text not null)
    on commit drop;

  insert into _tone_seed (name, tone) values
    ('Bank',               'tomato'),
    ('Dev Tools',          'indigo'),
    ('Email',              'purple'),
    ('Figma',              'purple'),
    ('Google Docs/Slides', 'crimson'),
    ('Google Form',        'gold'),
    ('Google Quiz',        'red'),
    ('Handshake',          'indigo'),
    ('Marketing Website',  'indigo'),
    ('Notion',             'gold'),
    ('On-campus booth',    'yellow'),
    ('PLUS App',           'yellow'),
    ('Posters',            'gold'),
    ('Slack',              'tomato'),
    ('Social Media',       'crimson'),
    ('Workday',            'indigo'),
    ('Zoom',               'indigo'),
    ('Zoom Recording',     'purple');

  -- An invariant, not a census: every name this file claims to colour has to
  -- name a row. A typo would otherwise update nothing and pass silently, and
  -- the board would keep hashing a tool somebody thought they had chosen.
  select string_agg(s.name, ', ' order by s.name) into v_missing
    from _tone_seed s
   where not exists (
     select 1 from public.touchpoints t where t.name = s.name
   );
  if v_missing is not null then
    raise exception
      'proof: no touchpoint is named %. Colouring a name that does not exist is a silent no-op', v_missing;
  end if;

  -- The tone vocabulary lives in the token model and NOT in a CHECK
  -- constraint, which `20260905110000` explains at length. That makes it this
  -- file's job to stay inside it.
  if exists (
    select 1 from _tone_seed
     where tone not in ('crimson','gold','indigo','purple','red','tomato','yellow')
  ) then
    raise exception
      'proof: a tone outside the renderer''s seven families would draw as no colour at all';
  end if;

  update public.touchpoints t
     set tone = s.tone
    from _tone_seed s
   where t.name = s.name
     and t.tone is distinct from s.tone;

  select count(tone) into v_after from public.touchpoints;
  raise notice 'touchpoints.tone: % set before, % set after (18 expected)', v_before, v_after;
end
$tones$;

-- ── 2. Touchpoint aliases ────────────────────────────────────────────────
--
-- The other spellings that mean one of these rows. Each was an entry in
-- `TECH_LABEL_ALIASES`, and each is a fact about this service's own history: a
-- tool it stopped pairing with another, a label that carried its own
-- specification before a touchpoint was made to name the THING, a spelling the
-- fixture boards still use.
--
-- Case alone is NOT an alias. The resolver folds case already, so `plus app`
-- finds `PLUS App` with nothing stored, and writing it down would be a row
-- that can only ever go stale against a rule in code.

do $aliases$
declare
  v_after integer;
  v_clash text;
begin
  -- Dropped first as well as `on commit drop`ped, so that running this
  -- file twice inside ONE transaction is a no-op rather than a name clash.
  drop table if exists _alias_seed;
  create temporary table _alias_seed (name text primary key, aliases text[] not null)
    on commit drop;

  insert into _alias_seed (name, aliases) values
    ('Google Docs/Slides', array['Google Docs/ Slides']),
    ('Google Form',        array['Google Form Application',
                                 'Acceptance Form (Google Form)',
                                 'Tutor Sign-up Form (Google Form)']),
    ('Handshake',          array['Handshake Employer Profile']),
    -- One employer runs one Workday. Which view a person is looking at is the
    -- placement's business, not a second touchpoint's.
    ('Workday',            array['Workday (Employee View)',
                                 'Workday (Employer View)']),
    -- PLUS stopped using Pencil. A cell still spelling the old pair should
    -- find the one tool that is left rather than mint a second. The literal
    -- matched this with a regular expression that allowed any spacing; a
    -- column holds spellings, so the three that occur are enumerated.
    ('Zoom',               array['Zoom/Pencil', 'Zoom/ Pencil', 'Zoom / Pencil']);

  -- The uniqueness rule `20260905120000` deferred to the resolver, asserted at
  -- the source as well: an alias that is also some other touchpoint's NAME is
  -- ambiguous, and the resolver settles it by dropping the alias — silently,
  -- because a render must not fail on data. Better to fail here, where a
  -- person is reading the output.
  select string_agg(a.alias, ', ' order by a.alias) into v_clash
    from (
      select unnest(aliases) as alias, name from _alias_seed
    ) a
    join public.touchpoints t
      on lower(t.name) = lower(a.alias)
     and t.name <> a.name;
  if v_clash is not null then
    raise exception
      'proof: % is another touchpoint''s name as well as an alias here; the resolver would drop the alias', v_clash;
  end if;

  update public.touchpoints t
     set aliases = s.aliases
    from _alias_seed s
   where t.name = s.name
     and t.aliases is distinct from s.aliases;

  select count(aliases) into v_after from public.touchpoints;
  raise notice 'touchpoints.aliases: % rows carry aliases (5 expected)', v_after;
end
$aliases$;

-- ── 3. Scenario parallel notes ───────────────────────────────────────────
--
-- Three sentences, one per in-session scenario that can run beside the others.
-- They were a `Record<uuid, string>` keyed on these same three ids, copied
-- onto every path of each scenario; `20260905130000` explains why a scenario's
-- note belongs to the scenario and not to each of its routes.
--
-- Matched by NAME within the phase rather than by the hardcoded id, so this
-- file does not become the fourth place those three UUIDs are written down.

do $notes$
declare
  v_after integer;
  v_missing text;
begin
  -- Dropped first as well as `on commit drop`ped, so that running this
  -- file twice inside ONE transaction is a no-op rather than a name clash.
  drop table if exists _note_seed;
  create temporary table _note_seed (name text primary key, note text not null)
    on commit drop;

  insert into _note_seed (name, note) values
    ('Warm-Up',
     'This scenario can run in parallel with the Goal Setting and Help Request scenarios.'),
    ('Goal Setting',
     'This scenario can run in parallel with the Warm-Up and Help Request scenarios.'),
    ('Help Request',
     'This scenario can run in parallel with the Warm-Up and Goal Setting scenarios.');

  select string_agg(s.name, ', ' order by s.name) into v_missing
    from _note_seed s
   where not exists (
     select 1 from public.scenarios c where c.name = s.name
   );
  if v_missing is not null then
    raise exception
      'proof: no scenario is named %. The note would be written nowhere', v_missing;
  end if;

  update public.scenarios c
     set note = s.note
    from _note_seed s
   where c.name = s.name
     and c.note is distinct from s.note;

  select count(note) into v_after from public.scenarios;
  raise notice 'scenarios.note: % rows carry a note (3 expected)', v_after;
end
$notes$;

-- ── 4. The path notes that were only ever the scenario's ─────────────────
--
-- `20260905130000` left one question for this slice: whether a path note that
-- merely repeats its scenario's is worth keeping. It is not. A path's note is
-- for what is true of THAT route and not of its siblings; parallelism is true
-- of every route in the scenario, and the old code wrote the identical
-- sentence onto all six Goal Setting paths, both Warm-Up paths and one Help
-- Request path. Nine rows that had to agree, with nothing making them.
--
-- Section 3 above put the sentence where it belongs, so these copies clear.
-- The match is on EXACT EQUALITY with the scenario's own note, which is what
-- makes this safe to run against a database somebody has since edited: a path
-- note that says anything of its own is not equal, and is untouched. The two
-- genuine path notes in this database — Help Request's "Routed out" and
-- Student Just Joined's "Few or none by 10 min" — are exactly that case.

do $path_notes$
declare
  v_cleared integer;
begin
  update public.paths p
     set note = null
    from public.scenarios s
   where s.id = p.scenario_id
     and p.note is not null
     and s.note is not null
     and p.note = s.note;
  get diagnostics v_cleared = row_count;
  raise notice 'paths.note: % duplicate copies cleared (9 expected on first run, 0 after)', v_cleared;
end
$path_notes$;
