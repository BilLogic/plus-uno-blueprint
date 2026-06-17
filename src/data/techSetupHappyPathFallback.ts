import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import type {
  BlueprintCell,
  BlueprintCellTrigger,
  BlueprintData,
} from '@/types/blueprint'

/** Onboarding phase scenarios (UI fallback until DB seed). */
export const ONBOARDING_PHASE_ID = 'a0000000-0000-4000-8000-000000000102'
export const TECH_SETUP_SCENARIO_ID = 'a0000000-0000-4000-8000-000000000120'
export const ONBOARDING_MODULES_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000123'
export const LESSON_MODULES_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000124'
export const SESSION_SIGN_UP_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000125'
export const TECH_SETUP_HAPPY_PATH_ID = 'a0000000-0000-4000-8000-000000000800'

const STEP_VISUAL_LAYER_ID = 'a0000000-0000-4000-8000-000000000818'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Visual', row_position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000831',
    name: 'Regular Tutor',
    row_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000832',
    name: 'Front Stage Actions',
    row_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000833',
    name: 'Front Stage Tech',
    row_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000834',
    name: 'Back Stage Actions',
    row_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000835',
    name: 'Back Stage Tech',
    row_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000836',
    name: 'Support Actions',
    row_position: 6,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000821',
    name: 'Clearance email',
    column_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000822',
    name: 'Obtain clearances',
    column_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000823',
    name: 'Send clearances',
    column_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000824',
    name: 'Payroll setup',
    column_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000825',
    name: 'Join Slack',
    column_position: 5,
  },
] as const

const L = {
  visual: STEP_VISUAL_LAYER_ID,
  regular: 'a0000000-0000-4000-8000-000000000831',
  frontStage: 'a0000000-0000-4000-8000-000000000832',
  frontStageTech: 'a0000000-0000-4000-8000-000000000833',
  backStage: 'a0000000-0000-4000-8000-000000000834',
  backStageTech: 'a0000000-0000-4000-8000-000000000835',
  support: 'a0000000-0000-4000-8000-000000000836',
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

function tsCell(stepSlot: string, layerSuffix: string): string {
  // Prefix 10 avoids Discovery sad-path rail detection (07/08 + …03).
  return `a0000000-0000-4000-8000-00000010${stepSlot}${layerSuffix}`
}

function tsTrigger(triggerSlot: string): string {
  return `a0000000-0000-4000-8000-000000088${triggerSlot}`
}

function trigger(
  slot: string,
  fromStep: string,
  fromLayer: string,
  toStep: string,
  toLayer: string,
): BlueprintCellTrigger {
  return {
    id: tsTrigger(slot),
    source_cell_id: tsCell(fromStep, fromLayer),
    target_cell_id: tsCell(toStep, toLayer),
  }
}

const TECH_SETUP_TRIGGERS: BlueprintCellTrigger[] = [
  // Step 1 — supervisor email → tutor receives
  trigger('001', '01', '04', '01', '03'),

  // Regular Tutor forward chain
  trigger('011', '01', '03', '02', '03'),
  trigger('012', '02', '03', '03', '03'),
  trigger('013', '03', '03', '04', '03'),
  trigger('014', '04', '03', '05', '03'),

  // Step 2 — tutor ↔ CMU HR
  trigger('021', '02', '03', '02', '04'),
  trigger('022', '02', '04', '02', '03'),

  // Step 3 — tutor sends clearances → supervisor receives
  trigger('031', '03', '03', '03', '04'),

  // Step 4 — tutor payroll setup → CMU HR I-9 meeting
  trigger('041', '04', '03', '04', '04'),

  // Step 5 — supervisor Slack invite → tutor joins
  trigger('051', '05', '04', '05', '03'),
]

const TECH_SETUP_CELLS: BlueprintCell[] = [
  ...STEPS.map((step, stepIndex) =>
    cell(
      tsCell(String(stepIndex + 1).padStart(2, '0'), '10'),
      L.visual,
      step.id,
      '',
    ),
  ),

  // Step 1 — clearance email
  cell(
    tsCell('01', '03'),
    L.regular,
    STEPS[0].id,
    'Receives email with steps for tutor clearances',
  ),
  cell(
    tsCell('01', '04'),
    L.frontStage,
    STEPS[0].id,
    'Tutor Supervisor team sends email for clearance checks',
  ),
  cell(tsCell('01', '06'), L.frontStageTech, STEPS[0].id, 'Email'),
  cell(tsCell('01', '09'), L.support, STEPS[0].id, 'Child Protection Laws'),

  // Step 2 — obtain clearances
  cell(tsCell('02', '03'), L.regular, STEPS[1].id, 'Obtains clearances'),
  cell(
    tsCell('02', '04'),
    L.frontStage,
    STEPS[1].id,
    'CMU HR Department',
  ),
  cell(
    tsCell('02', '06'),
    L.frontStageTech,
    STEPS[1].id,
    'Clearance Obtainment guide',
  ),
  cell(tsCell('02', '09'), L.support, STEPS[1].id, 'Child Protection Laws'),

  // Step 3 — send clearances
  cell(
    tsCell('03', '03'),
    L.regular,
    STEPS[2].id,
    'Sends clearances to CMU',
  ),
  cell(
    tsCell('03', '04'),
    L.frontStage,
    STEPS[2].id,
    'Tutor Supervisor team receives email with required clearances',
  ),
  cell(tsCell('03', '09'), L.support, STEPS[2].id, 'Child Protection Laws'),

  // Step 4 — payroll setup
  cell(tsCell('04', '03'), L.regular, STEPS[3].id, 'Payroll setup'),
  cell(
    tsCell('04', '04'),
    L.frontStage,
    STEPS[3].id,
    'CMU HR Department reviews employment forms at an I-9 Meeting',
  ),
  cell(
    tsCell('04', '06'),
    L.frontStageTech,
    STEPS[3].id,
    'Workday (payroll software)',
  ),
  cell(
    tsCell('04', '07'),
    L.backStage,
    STEPS[3].id,
    'PLUS Supervisor Team fills out corresponding paperwork for student employment in payroll software',
  ),
  cell(
    tsCell('04', '08'),
    L.backStageTech,
    STEPS[3].id,
    'Workday (payroll software)',
  ),
  cell(
    tsCell('04', '09'),
    L.support,
    STEPS[3].id,
    'HR Employment Laws and Onboarding Modules',
  ),

  // Step 5 — join Slack
  cell(
    tsCell('05', '03'),
    L.regular,
    STEPS[4].id,
    'Join PLUS tutor Slack Channel',
  ),
  cell(
    tsCell('05', '04'),
    L.frontStage,
    STEPS[4].id,
    'Tutor Supervisor Team sends invite to Slack workspace',
  ),
  cell(tsCell('05', '06'), L.frontStageTech, STEPS[4].id, 'Email\nSlack'),
]

export const TECH_SETUP_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: TECH_SETUP_HAPPY_PATH_ID,
    name: 'Happy Path',
    description:
      'Tutor succesfully sets up technology and obtains clearances.',
    path_type: 'happy',
  },
  layers: [...LAYERS],
  steps: [...STEPS],
  cells: TECH_SETUP_CELLS,
  triggers: TECH_SETUP_TRIGGERS,
}
