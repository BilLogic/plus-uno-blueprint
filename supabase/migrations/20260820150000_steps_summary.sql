-- steps.summary — what a moment is, across every lane.
--
-- A step is the only level a reader scans horizontally and has nothing to read:
-- it owned exactly one column, `name`. The column under it holds five lanes'
-- worth of cells and no sentence saying what the moment as a whole IS.
--
-- WHY A COLUMN AND NOT THE STORYBOARD CELL. The first attempt put this in the
-- `visual` lane's cell `content`, reasoning that the row already exists in all
-- 38 paths and occupies a real grid position. The DATA supported that — 215
-- (path, step) positions, all reachable. The RENDERER did not:
--
--   BlueprintStepVisual.tsx  →  if (!hasRealPictures) return null
--   MergedCompareGrid.tsx    →  "A visual lane's face comes from the
--                                walkthrough layers' pictures, NOT from its
--                                own cell text"
--
-- A visual cell's `content` is read by no renderer, and with no pictures the
-- cell does not render at all — so it is not clickable and the cell panel
-- cannot reach it. Writing a step's description there would have put it in
-- exactly the position this whole effort exists to fix: a filled field with no
-- front door.
--
-- Step identity is clean, which makes the column cheap: `steps` holds one row
-- per step keyed on scenario_id, and `path_steps` only positions it. No
-- fan-out, no drift, and it covers all 185 steps rather than the 138 that
-- happen to have a visual cell today.
--
-- DISPLAYED as the caption under the storyboard frame — pictures are already
-- resolved by step id, so the row is step-grained already.

alter table public.steps add column summary text;

comment on column public.steps.summary is
  'What this moment is, across every lane — the one sentence that makes the column legible without reading five cells. Shown as the caption on the storyboard frame.';

-- Column-level grant, matching how every other authored field is exposed.
-- AGENTS.md: never widen RLS. The existing authenticated update policy on
-- `steps` already scopes this; the grant is what limits it to this column.
grant update (summary) on public.steps to authenticated;
