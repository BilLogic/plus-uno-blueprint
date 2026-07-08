import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import type {
  BlueprintCell,
  BlueprintCellTrigger,
  BlueprintData,
} from '@/types/blueprint'

export const REPORTING_HOURS_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000208'

export const REPORTING_HOURS_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-000000000812'

const STEP_VISUAL_LAYER_ID = 'a0000000-0000-4000-8000-000000000920'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Visual', row_position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000921',
    name: 'Regular Tutor',
    row_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000922',
    name: 'Front Stage Actions',
    row_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000923',
    name: 'Front Stage Tech',
    row_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000924',
    name: 'Back Stage Actions',
    row_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000925',
    name: 'Back Stage Tech',
    row_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000926',
    name: 'Support Actions',
    row_position: 6,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000992',
    name: 'Report hours',
    column_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000994',
    name: 'Approve hours',
    column_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000995',
    name: 'Receive paycheck',
    column_position: 3,
  },
] as const

const L = {
  visual: STEP_VISUAL_LAYER_ID,
  regular: 'a0000000-0000-4000-8000-000000000921',
  frontStage: 'a0000000-0000-4000-8000-000000000922',
  frontStageTech: 'a0000000-0000-4000-8000-000000000923',
  backStage: 'a0000000-0000-4000-8000-000000000924',
  backStageTech: 'a0000000-0000-4000-8000-000000000925',
  support: 'a0000000-0000-4000-8000-000000000926',
} as const

function cell(
  id: string,
  layerId: string,
  stepId: string,
  content: string,
): BlueprintCell {
  return {
    id,
    layer_id: layerId,
    step_id: stepId,
    content,
    ...EMPTY_CELL_METADATA,
  }
}

function hoursCell(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-0000001e${stepSlot}${layerSuffix}`
}

function hoursTrigger(triggerSlot: string): string {
  return `a0000000-0000-4000-8000-000000098${triggerSlot}`
}

function trigger(
  slot: string,
  fromStep: string,
  fromLayer: string,
  toStep: string,
  toLayer: string,
): BlueprintCellTrigger {
  return {
    id: hoursTrigger(slot),
    source_cell_id: hoursCell(fromStep, fromLayer),
    target_cell_id: hoursCell(toStep, toLayer),
  }
}

const REPORTING_HOURS_TRIGGERS: BlueprintCellTrigger[] = [
  trigger('080', '01', '03', '02', '07'),
  trigger('081', '02', '07', '03', '03'),
]

const REPORTING_HOURS_CELLS: BlueprintCell[] = [
  cell(hoursCell('01', '10'), L.visual, STEPS[0].id, ''),
  cell(
    hoursCell('01', '03'),
    L.regular,
    STEPS[0].id,
    'Report Hours by Week Deadline',
  ),
  cell(hoursCell('01', '06'), L.frontStageTech, STEPS[0].id, 'Workday'),

  cell(hoursCell('02', '10'), L.visual, STEPS[1].id, ''),
  cell(
    hoursCell('02', '07'),
    L.backStage,
    STEPS[1].id,
    'PLUS Supervisor team reviews and approves hours',
  ),
  cell(hoursCell('02', '08'), L.backStageTech, STEPS[1].id, 'Workday'),

  cell(hoursCell('03', '10'), L.visual, STEPS[2].id, ''),
  cell(
    hoursCell('03', '03'),
    L.regular,
    STEPS[2].id,
    'Receive Biweekly Paycheck',
  ),
  cell(hoursCell('03', '06'), L.frontStageTech, STEPS[2].id, 'Bank'),
]

export const REPORTING_HOURS_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: REPORTING_HOURS_HAPPY_PATH_ID,
    name: 'Happy Path',
    description: 'Tutor reports tutoring hours after the session.',
    note: null,
    path_type: 'happy',
  },
  layers: [...LAYERS],
  steps: [...STEPS],
  cells: REPORTING_HOURS_CELLS,
  triggers: REPORTING_HOURS_TRIGGERS,
}
