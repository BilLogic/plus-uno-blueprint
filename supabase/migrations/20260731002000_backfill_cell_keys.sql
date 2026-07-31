-- Give every cell its key, and repoint the slices that reference it.
--
-- `slice_items.cell_keys` is how a slice survives a scenario re-import: the
-- import deletes and recreates every `cells` row, so ids change and keys do
-- not. Until this runs the stored keys are decorative — 17 of 36 are raw
-- UUIDs and the rest use two different abbreviation styles, none matching what
-- `mint_cell_key` produces. Recovery cannot match what it cannot recognise.
-- Deletion is *available* the moment `deleted_structure` exists, but undo
-- cannot put a slice back until this has run.
--
-- Colliding keys are left null on purpose. A key naming two cells identifies
-- neither, the partial unique index would reject the second, and a cell with
-- no key is honest where a shared key is not. The 24 cells this affects are
-- one real data defect rather than a flaw in the key: Discovery runs seven
-- lanes across two columns both named "Discovers PLUS". Renaming them apart is
-- a content decision, not something a migration should guess at — re-running
-- this file afterwards picks them up.
--
-- Measured against this database before running: 737 cells, 713 keyable, 24
-- colliding; 36 of 36 slice-frame keys resolve, 0 unresolvable, 17 frames
-- rewritten.

with keyed as (
  select c.id, public.mint_cell_key(c.path_id, c.layer_id, c.step_id) as k
  from public.cells c
),
uniq as (
  select k from keyed where k is not null group by k having count(*) = 1
)
update public.cells c
set cell_key = keyed.k
from keyed join uniq on uniq.k = keyed.k
where c.id = keyed.id and c.cell_key is distinct from keyed.k;

-- Rewrite each frame's keys positionally against its `cell_ids`. A cell with
-- no key contributes a null, which is what `splitByRecoverability` reads as
-- "this frame cannot be put back by undo" — surfaced in the confirm dialog
-- rather than papered over with a key that would match nothing.
update public.slice_items si
set cell_keys = sub.keys
from (
  select i.id,
         array_agg(c.cell_key order by e.ord) as keys
  from public.slice_items i
  cross join lateral unnest(i.cell_ids) with ordinality as e(cell_id, ord)
  left join public.cells c on c.id = e.cell_id
  group by i.id
) sub
where si.id = sub.id and si.cell_keys is distinct from sub.keys;
