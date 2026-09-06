-- A touchpoint answers to more than one name.
--
-- The other half of the literal `20260905110000` began unwinding.
-- `src/lib/touchpointColors.ts` carries `TECH_LABEL_ALIASES` beside its colour
-- map: a second table, this one from an old spelling to the canonical name.
-- `zoom/pencil` resolves to `Zoom` because PLUS stopped using Pencil and a
-- slice written before that should still find the one tool that is left rather
-- than mint a second. `handshake employer profile` resolves to `Handshake`
-- because a touchpoint names the THING, and which profile is the placement
-- summary's job. `plus app` resolves to `PLUS App` because a cell was typed by
-- a person.
--
-- Every one of those is a fact about this deployment's own history, and none of
-- it is knowledge a renderer should hold. #396 Q48 draws the line: the alias
-- RESOLUTION is generic machinery and reconciles into the template; the alias
-- LIST is each deployment's, sourced from a column. This is that column.
--
-- A touchpoint's `name` is its identity, unique deployment-wide (ADR 0014).
-- `aliases` are the other spellings that mean the same row — the same shape
-- `stakeholders.aliases` has carried since `20260820170000`, where lane and
-- cell text is matched against `unnest(aliases)` to find the stakeholder a
-- human wrote a nickname for.
--
-- ── Nullable, where the sibling column is NOT NULL ──────────────────────
--
-- `stakeholders.aliases` is `text[] not null default '{}'`. This one is a plain
-- nullable `text[]`, and the difference is deliberate enough to be worth
-- writing down rather than leaving a reader to notice it as an inconsistency.
--
-- The slice this file belongs to adds columns and nothing else, and every
-- column it adds is nullable, so that the whole change is one shape: an add
-- that cannot fail on a populated table and cannot invent a value for a row
-- nobody has authored yet. On this column null carries a meaning the empty
-- array does not — "no aliases have been considered for this touchpoint", as
-- against "considered, and there are none" — which is the state all of today's
-- rows are in.
--
-- The cost is that a reader must write `coalesce(aliases, '{}')` where the
-- stakeholder reader writes `aliases`. That is one function's worth of care in
-- S6 against a NOT NULL that would have to be added, defaulted and backfilled
-- here. If the owner would rather the two registries match exactly, narrowing
-- this to `not null default '{}'` is a one-line follow-up that no existing row
-- can fail.
--
-- ── What is NOT constrained, and why ────────────────────────────────────
--
-- Nothing here stops an alias colliding with another touchpoint's `name`, or
-- with another touchpoint's alias. Such a constraint is real and wanted, and it
-- belongs with the resolver that would be ambiguous without it — which is S6.
-- Written now it would be a rule with no reader, asserted against rows no
-- author has yet had the chance to get wrong. There is no index either: a
-- registry of this size resolves by sequential scan, and an index chosen before
-- a query exists is a guess about the query.
--
-- ── The reader is deliberately not in this file ─────────────────────────
--
-- `touchpointColors.ts` is untouched and no alias is copied into the column.
-- S2 is columns; S6 is the read side.
--
-- ── No new grant ────────────────────────────────────────────────────────
--
-- The registry's table-level SELECT policy and grant already cover a new
-- column. No UPDATE grant: the editing surface brings its own migration and its
-- `PANEL_COLUMNS` line when it arrives.
--
-- ── Replaying against an empty database ─────────────────────────────────
--
-- One additive column, nullable, no default beyond NULL, `if not exists` so a
-- re-run is a no-op. It replays clean against an empty database and does not
-- join `docs/reference/migration-replay-baseline.json`.
--
-- The proof is an INVARIANT, never a census (ADR 0009): the column exists, it
-- is nullable, and it is an array of text rather than a single text. The last
-- of those is worth asserting because `text` and `text[]` are both plausible
-- spellings of "the other names", and a scalar column would silently accept the
-- first alias and lose the rest.

alter table public.touchpoints
  add column if not exists aliases text[];

comment on column public.touchpoints.aliases is
  'The other spellings that mean this touchpoint — an older name the service has stopped using, a label that carried its own specification, a lower-case one a person typed into a cell. The name is the identity (ADR 0014); these resolve to it. This deployment''s own history, which is why it is a column and not the TECH_LABEL_ALIASES literal in touchpointColors.ts (#326 S2, #396 Q48). Nullable rather than NOT NULL DEFAULT ''{}'' like stakeholders.aliases: null means no aliases have been considered, which is what every row means today. Uniqueness against other names and aliases is not constrained here — that rule belongs with the resolver, in S6.';

do $proof$
declare
  v_type text;
  v_nullable text;
begin
  select data_type, is_nullable
    into v_type, v_nullable
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'touchpoints'
     and column_name = 'aliases';

  if v_type is null then
    raise exception
      'proof: touchpoints.aliases did not take';
  end if;

  if v_type <> 'ARRAY' then
    raise exception
      'proof: touchpoints.aliases is %, not an array — a scalar column keeps the first alias and loses the rest', v_type;
  end if;

  if v_nullable = 'NO' then
    raise exception
      'proof: touchpoints.aliases must be nullable — null is "no aliases considered", which is what every existing row means';
  end if;
end
$proof$;
