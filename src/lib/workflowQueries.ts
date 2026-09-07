/**
 * Supabase nested selects for the Service Blueprint schema.
 *
 * These strings carry no aliases. They used to: `kind:kind` renamed
 * `paths.kind` back to the word `20260830190000` retired, for every consumer
 * at once. The note here called that "deliberate and temporary" and said the
 * app-side rename belonged with #172's interface work, because the collision
 * on `ColoredBlueprintDependency` — a cell dependency, already carrying its
 * own `kind`, decorated with the path's — meant choosing a third word.
 *
 * #172 closed on 2026-08-31 without it, which is how a temporary alias becomes
 * a permanent one. The third word is `pathKind`, which is what the template
 * chose for the same collision. A comment is what failed to stop this, so
 * `scripts/tests/an-alias-is-a-rename-that-skips-the-migration.test.mjs` is
 * the check that replaces this paragraph's promise.
 */

export const PATH_LIST_SELECT =
  'id, name, summary, note, kind, scenario_id, created_at, updated_at'

/** Blueprint grid: path with lanes, path_steps, and cells */
/*
  The board carries every column the cell panel renders.

  function / form / value_props / owner / perceived_owner used to be fetched
  per cell on panel open — up to three round-trips each. 935 cells hold 7.8 KB
  of spec between them and the owner pair is empty board-wide, against a board
  that already ships ~374 KB, so on-demand cost three requests to save 2%.
  See docs/plans/2026-08-21-001-refactor-skeleton-loading-fidelity-plan.md.

  `resources` is embedded through a NAMED foreign key. Two paths reach it
  from `cells` — directly, and through `cell_touchpoints` — and PostgREST
  answers an ambiguous embed with a 300 listing the candidates rather than
  with rows. The hint is the constraint name, the same disambiguation
  `cell_dependencies` already needs below.

  Nothing in here may carry a comment: PostgREST parses this string.
*/
export const PATH_BLUEPRINT_SELECT = `
  id,
  name,
  summary,
  note,
  kind,
  status,
  scenario_id,
  lanes (
    id,
    name,
    lane_role,
    position
  ),
  path_steps (
    position,
    steps (
      id,
      name,
      summary
    )
  ),
  cells (
    id,
    lane_id,
    step_id,
    position,
    content,
    frame,
    summary,
    status,
    "function",
    form,
    value_props,
    owner,
    perceived_owner,
    cell_touchpoints (
      id,
      touchpoint_id,
      name,
      position,
      summary,
      role,
      touchpoints (
        name,
        kind,
        icon_url
      )
    ),
    resources!resources_cell_id_fkey (
      id,
      position,
      kind,
      name,
      url,
      cell_touchpoint_id,
      featured
    ),
    outgoing:cell_dependencies!cell_dependencies_source_cell_id_fkey (
      id,
      target_cell_id,
      kind,
      name
    )
  )
`
