import { SESSION_SIGN_UP_SCENARIO_ID } from '@/data/techSetupHappyPathFallback'
import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import type {
  BlueprintCell,
  BlueprintCellTrigger,
  BlueprintData,
} from '@/types/blueprint'

export { SESSION_SIGN_UP_SCENARIO_ID }

export const SESSION_SIGN_UP_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-000000000805'

const STEP_VISUAL_LAYER_ID = 'a0000000-0000-4000-8000-000000000878'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Visual', row_position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000879',
    name: 'Regular Tutor',
    row_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000880',
    name: 'Front Stage Actions',
    row_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000881',
    name: 'Front Stage Tech',
    row_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000882',
    name: 'Back Stage Actions',
    row_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000883',
    name: 'Back Stage Tech',
    row_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000884',
    name: 'Support Actions',
    row_position: 6,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000891',
    name: 'Sign up',
    column_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000892',
    name: 'Review scheduling',
    column_position: 2,
  },
] as const

const L = {
  visual: STEP_VISUAL_LAYER_ID,
  regular: 'a0000000-0000-4000-8000-000000000879',
  frontStage: 'a0000000-0000-4000-8000-000000000880',
  frontStageTech: 'a0000000-0000-4000-8000-000000000881',
  backStage: 'a0000000-0000-4000-8000-000000000882',
  backStageTech: 'a0000000-0000-4000-8000-000000000883',
  support: 'a0000000-0000-4000-8000-000000000884',
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

function ssCell(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-00000013${stepSlot}${layerSuffix}`
}

function ssTrigger(triggerSlot: string): string {
  return `a0000000-0000-4000-8000-000000092${triggerSlot}`
}

function trigger(
  slot: string,
  fromStep: string,
  fromLayer: string,
  toStep: string,
  toLayer: string,
): BlueprintCellTrigger {
  return {
    id: ssTrigger(slot),
    source_cell_id: ssCell(fromStep, fromLayer),
    target_cell_id: ssCell(toStep, toLayer),
  }
}

const SESSION_SIGN_UP_TRIGGERS: BlueprintCellTrigger[] = [
  // PLUS app ↔ dev team stores scheduling info
  trigger('001', '01', '06', '01', '07'),
  trigger('002', '01', '07', '01', '06'),

  // Dev team → tutor supervisor review
  trigger('011', '01', '07', '02', '07'),
]

const SESSION_SIGN_UP_CELLS: BlueprintCell[] = [
  // Visual row
  cell(ssCell('01', '10'), L.visual, STEPS[0].id, ''),
  cell(ssCell('02', '10'), L.visual, STEPS[1].id, ''),

  // Step 1 — Sign up
  cell(
    ssCell('01', '03'),
    L.regular,
    STEPS[0].id,
    'Sign up for Recurring Sessions for rest of semester',
  ),
  cell(ssCell('01', '06'), L.frontStageTech, STEPS[0].id, 'PLUS app'),
  cell(
    ssCell('01', '07'),
    L.backStage,
    STEPS[0].id,
    'Dev team takes that scheduling info and stores it in a Google Spreadsheet',
  ),
  cell(
    ssCell('01', '08'),
    L.backStageTech,
    STEPS[0].id,
    'PLUS App, Google Spreadsheet',
  ),

  // Step 2 — Review scheduling
  cell(
    ssCell('02', '07'),
    L.backStage,
    STEPS[1].id,
    'Tutor Supervisor team receives and reviews google spreadsheet from dev team',
  ),
  cell(ssCell('02', '08'), L.backStageTech, STEPS[1].id, 'Google Spreadsheet'),
]

export const SESSION_SIGN_UP_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: SESSION_SIGN_UP_HAPPY_PATH_ID,
    name: 'Happy Path',
    description:
      'Tutor succesfully signs up for recurring sessions for the rest of the semester.',
    note: null,
    path_type: 'happy',
  },
  layers: [...LAYERS],
  steps: [...STEPS],
  cells: SESSION_SIGN_UP_CELLS,
  triggers: SESSION_SIGN_UP_TRIGGERS,
}
