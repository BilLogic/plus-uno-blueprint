import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import type {
  BlueprintCell,
  BlueprintCellTrigger,
  BlueprintData,
} from '@/types/blueprint'

export const FILL_IN_REQUEST_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000127'

export const FILL_IN_REQUEST_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-000000000807'

const STEP_VISUAL_LAYER_ID = 'a0000000-0000-4000-8000-000000000903'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Visual', row_position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000904',
    name: 'Regular Tutor',
    row_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000905',
    name: 'Front Stage Actions',
    row_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000906',
    name: 'Front Stage Tech',
    row_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000907',
    name: 'Back Stage Actions',
    row_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000908',
    name: 'Back Stage Tech',
    row_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000909',
    name: 'Support Actions',
    row_position: 6,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000897',
    name: 'Initial request',
    column_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000898',
    name: 'Send request',
    column_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000899',
    name: 'Tutor response',
    column_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000900',
    name: 'Finalize assignment',
    column_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000901',
    name: 'Access session',
    column_position: 5,
  },
] as const

const L = {
  visual: STEP_VISUAL_LAYER_ID,
  regular: 'a0000000-0000-4000-8000-000000000904',
  frontStage: 'a0000000-0000-4000-8000-000000000905',
  frontStageTech: 'a0000000-0000-4000-8000-000000000906',
  backStage: 'a0000000-0000-4000-8000-000000000907',
  backStageTech: 'a0000000-0000-4000-8000-000000000908',
  support: 'a0000000-0000-4000-8000-000000000909',
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

function fillCell(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-00000015${stepSlot}${layerSuffix}`
}

function fillTrigger(triggerSlot: string): string {
  return `a0000000-0000-4000-8000-000000094${triggerSlot}`
}

function trigger(
  slot: string,
  fromStep: string,
  fromLayer: string,
  toStep: string,
  toLayer: string,
): BlueprintCellTrigger {
  return {
    id: fillTrigger(slot),
    source_cell_id: fillCell(fromStep, fromLayer),
    target_cell_id: fillCell(toStep, toLayer),
  }
}

const FILL_IN_REQUEST_TRIGGERS: BlueprintCellTrigger[] = [
  trigger('001', '01', '08', '01', '07'),
  trigger('002', '01', '07', '02', '04'),
  trigger('003', '02', '04', '02', '03'),
  trigger('004', '02', '03', '03', '03'),
  trigger('005', '03', '03', '03', '04'),
  trigger('006', '03', '04', '04', '07'),
  trigger('007', '04', '07', '04', '08'),
  trigger('008', '04', '07', '05', '03'),
]

const FILL_IN_REQUEST_CELLS: BlueprintCell[] = [
  cell(fillCell('01', '10'), L.visual, STEPS[0].id, ''),
  cell(
    fillCell('01', '07'),
    L.backStage,
    STEPS[0].id,
    'Tutor supervisor team receives call off request and reviews tutor availabilities',
  ),
  cell(
    fillCell('01', '08'),
    L.backStageTech,
    STEPS[0].id,
    'Swift Swap Google Form Responses, Tutor Scheduling Software',
  ),
  cell(fillCell('01', '06'), L.frontStageTech, STEPS[0].id, 'Swift Swap Google Form'),

  cell(fillCell('02', '10'), L.visual, STEPS[1].id, ''),
  cell(
    fillCell('02', '04'),
    L.frontStage,
    STEPS[1].id,
    'Tutor Supervisor Team requests fill in and fellow tutor sends message in #shift-swap slack channel',
  ),
  cell(fillCell('02', '03'), L.regular, STEPS[1].id, 'Tutor receives request'),
  cell(fillCell('02', '06'), L.frontStageTech, STEPS[1].id, 'Slack, Email'),

  cell(fillCell('03', '10'), L.visual, STEPS[2].id, ''),
  cell(
    fillCell('03', '03'),
    L.regular,
    STEPS[2].id,
    'Tutor confirms or denies fill in request',
  ),
  cell(
    fillCell('03', '04'),
    L.frontStage,
    STEPS[2].id,
    'Tutor Supervisor Team is notified on if Tutor can fill in',
  ),
  cell(fillCell('03', '06'), L.frontStageTech, STEPS[2].id, 'Slack, Email'),

  cell(fillCell('04', '10'), L.visual, STEPS[3].id, ''),
  cell(
    fillCell('04', '07'),
    L.backStage,
    STEPS[3].id,
    'Tutor Supervisor Team adds tutor to session if tutor confirms request',
  ),
  cell(fillCell('04', '08'), L.backStageTech, STEPS[3].id, 'PLUS App'),
  cell(fillCell('04', '09'), L.support, STEPS[3].id, 'Dev Team\nDesign Team'),

  cell(fillCell('05', '10'), L.visual, STEPS[4].id, ''),
  cell(
    fillCell('05', '03'),
    L.regular,
    STEPS[4].id,
    'Tutor accesses session if able to fill in',
  ),
  cell(fillCell('05', '06'), L.frontStageTech, STEPS[4].id, 'PLUS App'),
  cell(fillCell('05', '09'), L.support, STEPS[4].id, 'Dev Team\nDesign Team'),
]

export const FILL_IN_REQUEST_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: FILL_IN_REQUEST_HAPPY_PATH_ID,
    name: 'Happy Path',
    description: 'Tutor succesfully fills in for a fill-in request.',
    path_type: 'happy',
  },
  layers: [...LAYERS],
  steps: [...STEPS],
  cells: FILL_IN_REQUEST_CELLS,
  triggers: FILL_IN_REQUEST_TRIGGERS,
}
