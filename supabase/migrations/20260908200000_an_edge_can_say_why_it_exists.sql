-- An edge can say why it exists.
--
-- A `cell_dependencies` row already says WHAT it connects — `source_cell_id`
-- to `target_cell_id` — and how: `kind` (`leads_to` is drawn, `enables` is
-- recorded) and `name`, the word the arrow carries. None of those says WHY the
-- edge is there, and that is the sentence a reader of someone else's board
-- most often wants: not that dispatch enables repair, but that it enables it
-- because the technician cannot travel without a confirmed slot.
--
-- ── Why now, and why this column rather than a different one ────────────
--
-- The template renders it already. `blueprintCellConnections.ts` upstream maps
-- `dependency.note` onto a `linkNote` the dependency panel draws under each
-- row, and the template's own sample board authors sixteen of them. This
-- deployment has the renderer's ancestor and no column, so the two copies of
-- that file cannot converge: one side renders something the other cannot
-- store. Removing it upstream would delete a rendered line from every board
-- built on the template, which is a change nobody asked for.
--
-- `note` is the word the template's column already uses, and the word this
-- schema already uses for the same idea elsewhere — `paths.note` and
-- `scenarios.note` are both an author's aside beside a summary. A third
-- spelling for one concept is the failure `20260830190000` swept the board
-- for.
--
-- ── No new grant, and no writer yet ─────────────────────────────────────
--
-- The table's SELECT policy and grant already cover a new column. No UPDATE
-- grant: `authenticated` holds no column-scoped UPDATE on this table, and the
-- authoring surface — a field on the arrow editor — brings its own migration
-- when someone wants to write one. Display first: a board can show the notes
-- an import carried before the app can author them.
--
-- ── Replaying against an empty database ─────────────────────────────────
--
-- One additive column, nullable, no default, `if not exists` so a re-run is a
-- no-op. It replays clean against an empty database and does not join
-- `docs/reference/migration-replay-baseline.json`.
--
-- The proof is an INVARIANT, never a census (ADR 0009): the column exists and
-- is nullable. Nullable is load-bearing rather than incidental — null means
-- the edge has no stated reason, which is the state every row is in today, so
-- a NOT NULL column would either refuse the add or invent a reason for every
-- edge on the board.

alter table public.cell_dependencies
  add column if not exists note text;

comment on column public.cell_dependencies.note is
  'Why this edge exists, in the author''s own words — rendered as the why-line under the dependency row, revealed on hover. Distinct from name, which is the word ON the arrow (a channel, a hand-off): name says what the edge is called, note says why it is there. Null means no stated reason, which is not the same as no reason.';

do $proof$
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'cell_dependencies'
       and column_name = 'note'
       and is_nullable = 'YES'
  ) then
    raise exception 'cell_dependencies.note must exist and be nullable';
  end if;
end
$proof$;
