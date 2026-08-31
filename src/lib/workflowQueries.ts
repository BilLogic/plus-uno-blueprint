/**
 * Supabase nested selects for the Service Blueprint schema.
 *
 * `path_type:kind` is a PostgREST column ALIAS, not a column. The column is
 * `paths.kind` as of 20260830190000; the app's own path shapes still call the
 * field `path_type`, and the alias is where the two meet. It is deliberate and
 * temporary: the app-side rename collides on `ColoredBlueprintDependency`,
 * which is a cell dependency (already carrying its own `kind`) decorated with
 * the path's, so finishing it means choosing a third word for that decorator.
 * That is interface work and belongs with the rest of #172's, not with the
 * migration. Until then the alias keeps the schema's word in one place instead
 * of scattering a mapping through every consumer.
 */

export const PATH_LIST_SELECT =
  'id, name, summary, note, path_type:kind, scenario_id, created_at, updated_at'

/** Blueprint grid: path with lanes, path_steps, and cells */
/*
  The board carries every column the cell panel renders.

  function / form / value_props / owner / perceived_owner used to be fetched
  per cell on panel open — up to three round-trips each. 935 cells hold 7.8 KB
  of spec between them and the owner pair is empty board-wide, against a board
  that already ships ~374 KB, so on-demand cost three requests to save 2%.
  See docs/plans/2026-08-21-001-refactor-skeleton-loading-fidelity-plan.md.

  Nothing in here may carry a comment: PostgREST parses this string.
*/
export const PATH_BLUEPRINT_SELECT = `
  id,
  name,
  summary,
  note,
  path_type:kind,
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
    links,
    "function",
    form,
    value_props,
    owner,
    perceived_owner,
    cell_touchpoints (
      id,
      position,
      summary,
      screenshot,
      url,
      prominence,
      touchpoints (
        name,
        kind,
        url
      )
    ),
    outgoing:cell_dependencies!cell_dependencies_source_cell_id_fkey (
      id,
      target_cell_id,
      kind,
      name
    )
  )
`
