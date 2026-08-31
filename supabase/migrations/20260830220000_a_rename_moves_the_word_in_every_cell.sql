-- A rename has to move the word in every cell, not just the catalog row.
--
-- The catalog landed in 20260830140000 and the read path is genuinely
-- catalog-backed: the board draws `touchpoints.name` through the placement,
-- so changing that one row moves all 69 uses of "PLUS App" on screen at
-- once. That is the headline promise, and on its own it comes apart the
-- first time anyone uses it.
--
-- `cells.content` still holds the OLD string, and a content save re-derives
-- placements from that text. So the next edit to any affected cell hands
-- `sync_cell_touchpoints` the stale name, the renamed placement is not in
-- the wanted list, and it is deleted — taking its per-moment summary and
-- screenshot with it — while a fresh catalog entry is created under the old
-- name and placed in its stead. The rename is silently undone and the
-- authored detail is gone.
--
-- That is this spec's own defect returning: two records of the same fact,
-- drifting. Nothing writes `touchpoints.name` yet, so it is latent rather
-- than live, which is exactly why it is fixable now rather than after a
-- rename affordance has shipped.
--
-- ── Why this is a function and not a client loop ───────────────────────────
--
-- The same reason `sync_cell_touchpoints` is, one migration earlier: the
-- catalog row and every bearing cell's text must move TOGETHER OR NOT AT
-- ALL, and PostgREST gives every statement its own transaction. A client
-- that updated the catalog and then looped over cells would leave the two
-- halves disagreeing the moment any one of those requests failed — which is
-- the state this whole ticket exists to end. One call, one transaction.
--
-- ── Which cells, and how the word is matched ──────────────────────────────
--
-- The cells are found through `cell_touchpoints`, never by scanning text for
-- the old name. The placement IS the record of "this cell uses this
-- touchpoint", so the rewrite is keyed on identity and a cell that merely
-- happens to spell the same word somewhere else is not touched.
--
-- Inside a cell, `content` is a delimited list — `parseCellContent.ts`
-- splits on newline or comma and trims — so the match is against a whole
-- ITEM, never a substring. Renaming `Zoom` must leave `Zoom Recording`
-- alone, and both are real names in this catalog — the second arrived from a
-- Support Actions cell in 20260830140000.
-- `rename_content_item` below rebuilds the list from its own tokens, so the
-- author's delimiters and spacing survive untouched and only the item that
-- IS the old name is replaced.

-- ── The one-item rewrite ───────────────────────────────────────────────────
--
-- Tokenised rather than regexp-replaced. A replace bounded by delimiters
-- consumes the delimiter it matched, so two adjacent items that both match
-- lose the second; and a word-boundary replace rewrites `Zoom` inside
-- `Zoom Recording`, which is the near miss this ticket names. Splitting into
-- items AND delimiters, mapping the items, and concatenating puts the
-- original string back verbatim wherever nothing matched.

create or replace function public.rename_content_item(
  p_content text,
  p_from    text,
  p_to      text
)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $function$
  select coalesce(
    string_agg(
      case
        -- A delimiter travels through unchanged, which is what keeps
        -- "A,\nB" from coming back as "A, B".
        when m.token[1] in (E'\n', ',') then m.token[1]
        when btrim(m.token[1], E' \t\r\n') = p_from
          -- Surrounding whitespace is the author's, not ours.
          then substring(m.token[1] from '^[ \t\r\n]*')
               || p_to
               || substring(m.token[1] from '[ \t\r\n]*$')
        else m.token[1]
      end,
      '' order by m.ord),
    p_content)
  from regexp_matches(p_content, E'[^\n,]+|[\n,]', 'g')
       with ordinality as m(token, ord);
$function$;

comment on function public.rename_content_item(text, text, text) is
  'Replace one whole item in a delimited cell content string. The match is '
  'against the trimmed item, never a substring, so renaming Zoom leaves '
  'Zoom Recording alone.';

-- ── The rename ─────────────────────────────────────────────────────────────

create or replace function public.rename_touchpoint(
  p_touchpoint_id uuid,
  p_name          text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_name     text := btrim(coalesce(p_name, ''));
  v_previous text;
  v_written  int;
  v_cells    uuid[] := '{}';
  v_stale    int;
begin
  if v_name = '' then
    raise exception 'a touchpoint needs a name — an empty one is a blank pill';
  end if;

  -- Locked, because everything below is decided from this row's old name.
  select name into v_previous
    from public.touchpoints
   where id = p_touchpoint_id
     for update;

  if v_previous is null then
    raise exception 'touchpoint % does not exist', p_touchpoint_id;
  end if;

  update public.touchpoints
     set name = v_name,
         updated_at = now()
   where id = p_touchpoint_id;

  -- A zero-row write is a failure, not a no-op. The select above already
  -- found the row, so nought here means it went in the moment between —
  -- and the caller is about to record an inverse for a rename that never
  -- happened.
  get diagnostics v_written = row_count;
  if v_written <> 1 then
    raise exception 'renaming touchpoint % wrote % rows', p_touchpoint_id, v_written;
  end if;

  -- Renaming a touchpoint to what it is already called is a no-op on the
  -- text, and running the rewrite anyway would trip the post-condition
  -- below on every cell. The catalog write above still happened, so the
  -- caller gets a truthful answer either way.
  if v_previous <> v_name then
    with bearing as (
      -- Identity, not text search. A cell bears this touchpoint because a
      -- placement says so.
      select ct.cell_id from public.cell_touchpoints ct
       where ct.touchpoint_id = p_touchpoint_id
    ),
    rewritten as (
      update public.cells c
         set content = public.rename_content_item(c.content, v_previous, v_name)
        from bearing b
       where c.id = b.cell_id
         and c.content
             is distinct from public.rename_content_item(c.content, v_previous, v_name)
      returning c.id
    )
    select coalesce(array_agg(id), '{}'::uuid[]) into v_cells from rewritten;

    -- The post-condition, and the reason the rewrite cannot fail quietly.
    -- If the item match ever stopped matching, every statement above would
    -- still succeed, no cell would change, and the rename would go back to
    -- being undone by the next content save — the exact defect, restored,
    -- with a green call to show for it.
    select count(*) into v_stale
      from public.cell_touchpoints ct
      join public.cells c on c.id = ct.cell_id
     where ct.touchpoint_id = p_touchpoint_id
       and exists (
         select 1
           from unnest(regexp_split_to_array(c.content, E'[\n,]')) as item
          where btrim(item, E' \t\r\n') = v_previous
       );
    if v_stale <> 0 then
      raise exception
        '% cells still name "%" after renaming it to "%"',
        v_stale, v_previous, v_name;
    end if;
  end if;

  return jsonb_build_object(
    'touchpoint_id', p_touchpoint_id,
    'name', v_name,
    'previous_name', v_previous,
    'cell_ids', to_jsonb(v_cells)
  );
end
$function$;

comment on function public.rename_touchpoint(uuid, text) is
  'Rename a touchpoint: the catalog row and the matching item in every '
  'bearing cell''s content, in one transaction. Returns the previous name '
  'and the cells rewritten, so the caller can record an inverse that '
  'restores both halves.';

grant execute on function public.rename_content_item(text, text, text) to authenticated;
grant execute on function public.rename_touchpoint(uuid, text) to authenticated;

-- ── The stamp the placement functions could not write ─────────────────────
--
-- Found while writing this, and it is the sync path rather than the rename:
-- `sync_cell_touchpoints` and `restore_cell_touchpoints` both stamp
-- `updated_at = now()`, and 20260830140000 granted `authenticated` only the
-- columns a panel edits. Column privileges are checked against the SET LIST,
-- not against what the statement changes, so on the grant surface that file
-- intended, a signed-in author's content save is refused — "permission denied
-- for column updated_at" — before it reaches a single placement.
--
-- IT IS NOT REFUSED TODAY, and the reason is worth writing down rather than
-- leaving as a happy accident. Production says:
--
--   select has_column_privilege('authenticated','public.cell_touchpoints',
--                               'updated_at','UPDATE');
--   t
--
-- because the platform grants the API roles table-level UPDATE on relations
-- created in `public` — the same mechanism `20260830240000` caught handing
-- `anon` four write privileges nobody wrote. A table-level grant covers every
-- column, so 20260830140000's careful column list has never been the
-- operative permission on these two tables. Its intent is not in effect.
--
-- So this grant is dormant and correct rather than urgent: it is what keeps
-- the sync path working on the day #183 narrows the table grants to the
-- column lists that were always meant to hold. Shipping it now means that
-- ticket does not silently break content saves.
--
-- An explicit stamp is the mechanism these two tables chose — they carry no
-- `set_updated_at` trigger, unlike `cells` — so it gets the grant it needs.
-- Swapping the mechanism would mean re-emitting both placement functions to
-- change one clause each, and the grant surface as a whole is #183's.

grant update (updated_at) on public.touchpoints to authenticated;
grant update (updated_at) on public.cell_touchpoints to authenticated;

-- ── Prove the item match, on an empty database too ────────────────────────
--
-- `rename_content_item` is pure, so this block needs no rows and runs on
-- every replay including the empty one. The near miss is the first case
-- because it is the one the ticket names: `Zoom` and `Zoom Recording` are
-- both real entries in this catalog, and a substring replace turns the
-- second into `Meet Recording` without a word of warning.

do $do$
declare
  v_got text;
begin
  v_got := public.rename_content_item('Zoom, Zoom Recording', 'Zoom', 'Meet');
  if v_got <> 'Meet, Zoom Recording' then
    raise exception 'the near miss was rewritten: %', v_got;
  end if;

  -- The longer name renames on its own terms, and leaves the shorter alone.
  v_got := public.rename_content_item('Zoom, Zoom Recording', 'Zoom Recording', 'Recording');
  if v_got <> 'Zoom, Recording' then
    raise exception 'the longer item did not rename: %', v_got;
  end if;

  -- Newlines are a delimiter too, and the author's spacing is theirs.
  v_got := public.rename_content_item(E'PLUS App\n  Zoom  , Slack', 'Zoom', 'Meet');
  if v_got <> E'PLUS App\n  Meet  , Slack' then
    raise exception 'delimiters or spacing did not survive: %', v_got;
  end if;

  -- Two adjacent items that both match. A delimiter-consuming replace gets
  -- the first and silently skips the second.
  v_got := public.rename_content_item('Zoom,Zoom', 'Zoom', 'Meet');
  if v_got <> 'Meet,Meet' then
    raise exception 'an adjacent repeat was skipped: %', v_got;
  end if;

  -- A name that appears only as part of another item changes nothing.
  v_got := public.rename_content_item('Zoom Recording', 'Zoom', 'Meet');
  if v_got <> 'Zoom Recording' then
    raise exception 'a substring was rewritten: %', v_got;
  end if;

  -- Nothing to rename is not an error, and must not reshape the string.
  v_got := public.rename_content_item('', 'Zoom', 'Meet');
  if v_got <> '' then
    raise exception 'empty content did not survive: %', v_got;
  end if;
end
$do$;

-- ── Prove the rename survives the next content save ───────────────────────
--
-- The load-bearing one. A test that only checked the rename itself would
-- pass while the bug stayed: the loss happens one save LATER, when
-- `sync_cell_touchpoints` is handed the text and finds the placement's name
-- missing from it.
--
-- So this renames a probe touchpoint and then replays the ordinary content
-- save — the same function the panel calls — against the rewritten text,
-- and asserts the placement is the same row, still carrying its summary and
-- its screenshot.
--
-- The probes are ADDED to a real cell's content rather than replacing it, so
-- no real placement is ever absent from the text the sync sees and none is
-- deleted. Content and probe rows are put back at the end; the cell's
-- `updated_at` moves, which is the whole footprint. On an empty database
-- there is no cell to borrow and the block says so and returns — the pure
-- proof above is the one that runs everywhere.

do $do$
declare
  v_cell     uuid;
  v_content  text;
  v_probe    text := 'ZZ Rename Zoom';
  v_sibling  text := 'ZZ Rename Zoom Recording';
  v_renamed  text := 'ZZ Rename Meet';
  v_tp       uuid;
  v_placement uuid;
  v_names    text[];
  v_result   jsonb;
  v_summary  text;
  v_shot     text;
  v_after    uuid;
begin
  -- A touchpoint cell that holds no placements yet is borrowed first: the
  -- syncs below then have nothing of anyone's to remove. Falling back to an
  -- occupied cell is still safe — the probes are APPENDED, so every name the
  -- cell already carries is in the text each sync sees — but it leans on the
  -- placement-names-are-content-items invariant rather than not needing it.
  select c.id, c.content into v_cell, v_content
    from public.cells c
    join public.lanes ln on ln.id = c.lane_id
   where ln.lane_role in ('frontstage_touchpoints', 'backstage_touchpoints',
                          'frontstage_tech', 'backstage_tech')
   order by exists (
     select 1 from public.cell_touchpoints ct where ct.cell_id = c.id
   ), c.id
   limit 1;

  if v_cell is null then
    raise notice 'no touchpoint cell exists, so the rename proof has nothing to run against';
    return;
  end if;

  update public.cells
     set content = case when btrim(v_content) = ''
                        then v_probe || ', ' || v_sibling
                        else v_content || ', ' || v_probe || ', ' || v_sibling end
   where id = v_cell;

  select array_agg(btrim(item) order by ord) into v_names
    from public.cells c,
         unnest(regexp_split_to_array(c.content, E'[\n,]')) with ordinality as t(item, ord)
   where c.id = v_cell and btrim(item) <> '';
  perform public.sync_cell_touchpoints(v_cell, v_names);

  -- The per-moment writing this whole ticket exists to protect.
  select ct.id, ct.touchpoint_id into v_placement, v_tp
    from public.cell_touchpoints ct
    join public.touchpoints tp on tp.id = ct.touchpoint_id
   where ct.cell_id = v_cell and tp.name = v_probe;
  if v_placement is null then
    raise exception 'the probe placement was not created';
  end if;
  update public.cell_touchpoints
     set summary = 'What this tool does at THIS moment',
         screenshot = 'https://example.invalid/shot.png'
   where id = v_placement;

  v_result := public.rename_touchpoint(v_tp, v_renamed);
  if (v_result ->> 'previous_name') <> v_probe then
    raise exception 'the rename did not report the name it replaced: %', v_result;
  end if;

  -- Both halves moved: the catalog row, and the word in the cell.
  if not exists (select 1 from public.touchpoints where id = v_tp and name = v_renamed) then
    raise exception 'the catalog row did not take the new name';
  end if;
  if not exists (
    select 1 from public.cells c,
         unnest(regexp_split_to_array(c.content, E'[\n,]')) as item
     where c.id = v_cell and btrim(item) = v_renamed
  ) then
    raise exception 'the cell text still does not name the touchpoint';
  end if;

  -- The near miss, against the real thing rather than a string in a
  -- variable: the sibling is a longer name containing the renamed one.
  if not exists (
    select 1 from public.cells c,
         unnest(regexp_split_to_array(c.content, E'[\n,]')) as item
     where c.id = v_cell and btrim(item) = v_sibling
  ) then
    raise exception 'renaming the short name rewrote the longer one';
  end if;

  -- The save that used to undo it all. Same function the panel calls, on
  -- the text as it now stands.
  select array_agg(btrim(item) order by ord) into v_names
    from public.cells c,
         unnest(regexp_split_to_array(c.content, E'[\n,]')) with ordinality as t(item, ord)
   where c.id = v_cell and btrim(item) <> '';
  perform public.sync_cell_touchpoints(v_cell, v_names);

  select ct.id, ct.summary, ct.screenshot into v_after, v_summary, v_shot
    from public.cell_touchpoints ct
   where ct.cell_id = v_cell and ct.touchpoint_id = v_tp;

  if v_after is null then
    raise exception 'the content save deleted the renamed placement';
  end if;
  if v_after <> v_placement then
    raise exception 'the content save replaced the placement rather than keeping it';
  end if;
  if v_summary is distinct from 'What this tool does at THIS moment'
     or v_shot is distinct from 'https://example.invalid/shot.png' then
    raise exception 'the placement lost its summary or screenshot to the save';
  end if;

  -- The inverse restores both halves, because it is the same operation
  -- pointed the other way and keyed on the touchpoint's id.
  perform public.rename_touchpoint(v_tp, v_probe);
  if not exists (
    select 1 from public.cells c,
         unnest(regexp_split_to_array(c.content, E'[\n,]')) as item
     where c.id = v_cell and btrim(item) = v_probe
  ) then
    raise exception 'the inverse restored the catalog row but not the text';
  end if;

  -- Put the cell back. The probe placements go first: `on delete restrict`
  -- from the placement to the catalog means the other order fails.
  delete from public.cell_touchpoints ct
   using public.touchpoints tp
   where ct.touchpoint_id = tp.id
     and ct.cell_id = v_cell
     and tp.name like 'ZZ Rename %';
  delete from public.touchpoints where name like 'ZZ Rename %';
  update public.cells set content = v_content where id = v_cell;
end
$do$;
