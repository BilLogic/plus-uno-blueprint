-- The six sibling `origin` columns say what they are.
--
-- `services.origin` has carried a comment since it was written, and that
-- comment ends "The same two values its six sibling tables carry." The six are
-- `phases`, `scenarios`, `paths`, `steps`, `lanes` and `cells`, and not one of
-- them says so itself. A reader who lands on `cells.origin` — an agent, and
-- every agent reads the account rendered from these comments — finds a bare
-- text column with a default and no statement of what it answers.
--
-- The gap was invisible until now for a reason worth recording: the app's
-- types file did not list these columns at all. It was maintained by hand for
-- a year, and `origin` on five of these six tables, along with `cells.cell_key`
-- and `stakeholders.parent_id`, had simply never been transcribed into it.
-- Coverage is counted over the columns that file names, so eight columns were
-- neither described nor counted as missing. Regenerating the file made them
-- visible; this migration answers what it made visible.
--
-- ── Why the wording repeats rather than pointing ────────────────────────
--
-- Each comment states the two values rather than saying "see services.origin".
-- These are read one column at a time, by a reader who has the column in front
-- of them and not the rest of the schema — the account renders a table per
-- relation. A pointer would resolve to a lookup the reader cannot make, which
-- is the failure mode this whole surface exists to avoid. The phrasing follows
-- `services.origin` so the six read as one concept, and each names the table it
-- is on, which is what makes the repetition informative rather than boilerplate.
--
-- Comments only: no column changes, no data changes, nothing to revert beyond
-- the comments themselves.

comment on column public.phases.origin is
  'Where this phase came from: import (the pipeline) or app (created in the canvas). The same two values services and its five other sibling tables carry.';

comment on column public.scenarios.origin is
  'Where this scenario came from: import (the pipeline) or app (created in the canvas). The same two values services and its five other sibling tables carry.';

comment on column public.paths.origin is
  'Where this path came from: import (the pipeline) or app (created in the canvas). The same two values services and its five other sibling tables carry.';

comment on column public.steps.origin is
  'Where this step came from: import (the pipeline) or app (created in the canvas). The same two values services and its five other sibling tables carry.';

comment on column public.lanes.origin is
  'Where this lane came from: import (the pipeline) or app (created in the canvas). The same two values services and its five other sibling tables carry.';

comment on column public.cells.origin is
  'Where this cell came from: import (the pipeline) or app (created in the canvas). A cell minted by upsert_cell is app; one written by the import pipeline is import, and its cell_key is the pipeline''s.';
