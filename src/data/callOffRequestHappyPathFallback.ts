import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import type {
  BlueprintCell,
  BlueprintCellTrigger,
  BlueprintData,
} from '@/types/blueprint'

export const CALL_OFF_REQUEST_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000128'

export const CALL_OFF_REQUEST_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-000000000808'

const STEP_VISUAL_LAYER_ID = 'a0000000-0000-4000-8000-000000000971'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Visual', row_position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000972',
    name: 'Regular Tutor',
    row_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000973',
    name: 'Front Stage Actions',
    row_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000974',
    name: 'Front Stage Tech',
    row_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000975',
    name: 'Back Stage Actions',
    row_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000976',
    name: 'Back Stage Tech',
    row_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000977',
    name: 'Support Actions',
    row_position: 6,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000940',
    name: 'Initial need',
    column_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000941',
    name: 'Early call-off',
    column_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000942',
    name: 'Late call-off',
    column_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000943',
    name: 'Peer support',
    column_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000944',
    name: 'Internal decision',
    column_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000945',
    name: 'Final notification',
    column_position: 6,
  },
] as const

const L = {
  visual: STEP_VISUAL_LAYER_ID,
  regular: 'a0000000-0000-4000-8000-000000000972',
  frontStage: 'a0000000-0000-4000-8000-000000000973',
  frontStageTech: 'a0000000-0000-4000-8000-000000000974',
  backStage: 'a0000000-0000-4000-8000-000000000975',
  backStageTech: 'a0000000-0000-4000-8000-000000000976',
  support: 'a0000000-0000-4000-8000-000000000977',
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

function callOffCell(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-00000017${stepSlot}${layerSuffix}`
}

function callOffTrigger(triggerSlot: string): string {
  return `a0000000-0000-4000-8000-000000095${triggerSlot}`
}

function trigger(
  slot: string,
  fromStep: string,
  fromLayer: string,
  toStep: string,
  toLayer: string,
): BlueprintCellTrigger {
  return {
    id: callOffTrigger(slot),
    source_cell_id: callOffCell(fromStep, fromLayer),
    target_cell_id: callOffCell(toStep, toLayer),
  }
}

const CALL_OFF_REQUEST_TRIGGERS: BlueprintCellTrigger[] = [
  trigger('001', '01', '03', '02', '03'),
  trigger('003', '01', '03', '03', '03'),
  trigger('002', '02', '03', '02', '07'),
  trigger('005', '03', '03', '03', '04'),
  trigger('006', '03', '03', '04', '03'),
  trigger('007', '04', '03', '04', '04'),
  trigger('008', '05', '07', '06', '04'),
  trigger('009', '06', '04', '06', '03'),
]

const CALL_OFF_REQUEST_CELLS: BlueprintCell[] = [
  cell(callOffCell('01', '10'), L.visual, STEPS[0].id, ''),
  cell(callOffCell('01', '03'), L.regular, STEPS[0].id, 'Tutor needs to Call off'),

  cell(callOffCell('02', '10'), L.visual, STEPS[1].id, ''),
  cell(
    callOffCell('02', '03'),
    L.regular,
    STEPS[1].id,
    "if it's 12 or more hours before session, tutor complete shift swap form.",
  ),
  cell(callOffCell('02', '06'), L.frontStageTech, STEPS[1].id, 'Shift Swap Google Form'),
  cell(
    callOffCell('02', '07'),
    L.backStage,
    STEPS[1].id,
    'Tutor Supervisor create and reviews google form request for shift swap',
  ),
  cell(
    callOffCell('02', '08'),
    L.backStageTech,
    STEPS[1].id,
    'Shift Swap Google Form Responses, Tutor Scheduling Software',
  ),

  cell(callOffCell('03', '10'), L.visual, STEPS[2].id, ''),
  cell(
    callOffCell('03', '03'),
    L.regular,
    STEPS[2].id,
    'if it is less than 12 hours before session, tutor emails supervisor.',
  ),
  cell(
    callOffCell('03', '04'),
    L.frontStage,
    STEPS[2].id,
    'Tutor Supervisor receives email request for shift swap',
  ),
  cell(callOffCell('03', '06'), L.frontStageTech, STEPS[2].id, 'Email'),

  cell(callOffCell('04', '10'), L.visual, STEPS[3].id, ''),
  cell(
    callOffCell('04', '03'),
    L.regular,
    STEPS[3].id,
    'Tutor send message in #shift-swap to see if anyone can cover',
  ),
  cell(
    callOffCell('04', '04'),
    L.frontStage,
    STEPS[3].id,
    'Other Tutors in #shift-swap channel may or may not respond',
  ),
  cell(callOffCell('04', '06'), L.frontStageTech, STEPS[3].id, 'Slack'),

  cell(callOffCell('05', '10'), L.visual, STEPS[4].id, ''),
  cell(
    callOffCell('05', '07'),
    L.backStage,
    STEPS[4].id,
    'Tutor Supervisor team may or may not find replacement for tutor and determines if this counts as excused or unexcused decision',
  ),
  cell(
    callOffCell('05', '08'),
    L.backStageTech,
    STEPS[4].id,
    'Tutor Scheduling Software',
  ),

  cell(callOffCell('06', '10'), L.visual, STEPS[5].id, ''),
  cell(
    callOffCell('06', '03'),
    L.regular,
    STEPS[5].id,
    'Tutor receives excused or unexcused decision',
  ),
  cell(
    callOffCell('06', '04'),
    L.frontStage,
    STEPS[5].id,
    'Tutor supervisor team sends excuse decision',
  ),
  cell(callOffCell('06', '06'), L.frontStageTech, STEPS[5].id, 'Email'),
]

export const CALL_OFF_REQUEST_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: CALL_OFF_REQUEST_HAPPY_PATH_ID,
    name: 'Happy Path',
    description: 'Tutor succesfully calls off for a call-off request.',
    note: null,
    path_type: 'happy',
  },
  layers: [...LAYERS],
  steps: [...STEPS],
  cells: CALL_OFF_REQUEST_CELLS,
  triggers: CALL_OFF_REQUEST_TRIGGERS,
}
