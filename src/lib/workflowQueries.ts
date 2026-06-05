/** Supabase nested selects for the Service Blueprint schema */

export const LIFECYCLE_LIST_SELECT = 'id, name, description, created_at, updated_at'

export const PATH_LIST_SELECT =
  'id, name, path_type, service_scenario_id, created_at, updated_at'

/** Steps on a path (junction → scenario step) */
export const PATH_STEPS_SELECT = `
  path_steps (
    column_position,
    steps (
      id,
      name
    )
  )
`

/** Blueprint grid: path with layers, path_steps, and cells */
export const PATH_BLUEPRINT_SELECT = `
  id,
  name,
  path_type,
  service_scenario_id,
  layers (
    id,
    name,
    row_position
  ),
  path_steps (
    column_position,
    steps (
      id,
      name
    )
  ),
  cells (
    id,
    layer_id,
    step_id,
    content,
    outgoing:cell_triggers!cell_triggers_source_cell_id_fkey (
      id,
      target_cell_id
    )
  )
`

export const PATH_DETAIL_SELECT = `
  id,
  name,
  path_type,
  created_at,
  updated_at,
  service_scenarios (
    id,
    name,
    description,
    order_position,
    phases (
      id,
      name,
      description,
      order_position,
      service_lifecycles (
        id,
        name,
        description
      )
    )
  ),
  layers (
    id,
    name,
    row_position
  ),
  path_steps (
    column_position,
    steps (
      id,
      name
    )
  ),
  cells (
    id,
    layer_id,
    step_id,
    content
  ),
  cell_triggers (
    id,
    source_cell_id,
    target_cell_id
  )
`

export const PHASE_LIST_SELECT = `
  id,
  name,
  description,
  order_position,
  created_at,
  service_scenarios (
    id,
    name,
    order_position,
    paths ( id, name, path_type )
  )
`
