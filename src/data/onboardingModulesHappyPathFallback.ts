import { ONBOARDING_MODULES_SCENARIO_ID } from '@/data/techSetupHappyPathFallback'
import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import type {
  BlueprintCell,
  BlueprintCellTrigger,
  BlueprintData,
} from '@/types/blueprint'

export { ONBOARDING_MODULES_SCENARIO_ID }

export const ONBOARDING_MODULES_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-000000000801'

const STEP_VISUAL_LAYER_ID = 'a0000000-0000-4000-8000-000000000828'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Visual', row_position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000841',
    name: 'Regular Tutor',
    row_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000842',
    name: 'Front Stage Actions',
    row_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000843',
    name: 'Front Stage Tech',
    row_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000844',
    name: 'Back Stage Actions',
    row_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000845',
    name: 'Back Stage Tech',
    row_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000846',
    name: 'Support Actions',
    row_position: 6,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000851',
    name: 'Module opening',
    column_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000852',
    name: 'Accessing content',
    column_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000853',
    name: 'Reading lesson',
    column_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000854',
    name: 'Supplementary materials',
    column_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000855',
    name: 'Quiz completion',
    column_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000856',
    name: 'Reflection',
    column_position: 6,
  },
] as const

const L = {
  visual: STEP_VISUAL_LAYER_ID,
  regular: 'a0000000-0000-4000-8000-000000000841',
  frontStage: 'a0000000-0000-4000-8000-000000000842',
  frontStageTech: 'a0000000-0000-4000-8000-000000000843',
  backStage: 'a0000000-0000-4000-8000-000000000844',
  backStageTech: 'a0000000-0000-4000-8000-000000000845',
  support: 'a0000000-0000-4000-8000-000000000846',
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

function omCell(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-00000011${stepSlot}${layerSuffix}`
}

function omTrigger(triggerSlot: string): string {
  return `a0000000-0000-4000-8000-000000089${triggerSlot}`
}

function trigger(
  slot: string,
  fromStep: string,
  fromLayer: string,
  toStep: string,
  toLayer: string,
): BlueprintCellTrigger {
  return {
    id: omTrigger(slot),
    source_cell_id: omCell(fromStep, fromLayer),
    target_cell_id: omCell(toStep, toLayer),
  }
}

const ONBOARDING_MODULES_TRIGGERS: BlueprintCellTrigger[] = [
  // Regular Tutor forward chain
  trigger('011', '01', '03', '02', '03'),
  trigger('012', '02', '03', '03', '03'),
  trigger('013', '03', '03', '04', '03'),
  trigger('014', '04', '03', '05', '03'),
  trigger('015', '05', '03', '06', '03'),
  // Loop to next module
  trigger('016', '06', '03', '01', '03'),

  // Step 3 — instructional design → Notion
  trigger('031', '03', '07', '03', '06'),

  // Step 4 — instructional design → Google Docs/ Slides (nearest pill)
  trigger('041', '04', '07', '04', '06'),
  trigger('051', '05', '06', '05', '07'),
  trigger('052', '05', '07', '05', '06'),
  trigger('061', '06', '06', '06', '07'),
  trigger('062', '06', '07', '06', '06'),
]

const ONBOARDING_MODULES_CELLS: BlueprintCell[] = [
  ...STEPS.map((step, stepIndex) =>
    cell(
      omCell(String(stepIndex + 1).padStart(2, '0'), '10'),
      L.visual,
      step.id,
      '',
    ),
  ),

  // Step 1 — module opening
  cell(
    omCell('01', '03'),
    L.regular,
    STEPS[0].id,
    'Opens next uncompleted Onboarding Module',
  ),
  cell(omCell('01', '06'), L.frontStageTech, STEPS[0].id, 'PLUS App'),
  cell(omCell('01', '09'), L.support, STEPS[0].id, 'Dev Team\nDesign Team'),

  // Step 2 — accessing content
  cell(
    omCell('02', '03'),
    L.regular,
    STEPS[1].id,
    'Follows Notion Link in individual module page',
  ),
  cell(omCell('02', '06'), L.frontStageTech, STEPS[1].id, 'PLUS App\nNotion'),
  cell(omCell('02', '09'), L.support, STEPS[1].id, 'Dev Team\nDesign Team'),

  // Step 3 — reading lesson
  cell(
    omCell('03', '03'),
    L.regular,
    STEPS[2].id,
    'Reads through the onboarding module lesson',
  ),
  cell(omCell('03', '06'), L.frontStageTech, STEPS[2].id, 'Notion'),
  cell(
    omCell('03', '07'),
    L.backStage,
    STEPS[2].id,
    'The Instructional Design team creates and maintains the Lesson Modules.',
  ),
  cell(omCell('03', '08'), L.backStageTech, STEPS[2].id, 'Notion'),
  cell(
    omCell('03', '09'),
    L.support,
    STEPS[2].id,
    'Researchers help guide instructional implementation',
  ),

  // Step 4 — supplementary materials
  cell(
    omCell('04', '03'),
    L.regular,
    STEPS[3].id,
    'Reads through any supplementary materials in the lesson',
  ),
  cell(
    omCell('04', '06'),
    L.frontStageTech,
    STEPS[3].id,
    'Notion\nGoogle Docs/ Slides',
  ),
  cell(
    omCell('04', '07'),
    L.backStage,
    STEPS[3].id,
    'The Instructional Design team maintains the supplementary materials.',
  ),
  cell(
    omCell('04', '08'),
    L.backStageTech,
    STEPS[3].id,
    'Notion\nGoogle Docs/ Slides',
  ),
  cell(
    omCell('04', '09'),
    L.support,
    STEPS[3].id,
    'Researchers help guide instructional implementation',
  ),

  // Step 5 — quiz completion
  cell(omCell('05', '03'), L.regular, STEPS[4].id, 'Completes google quiz'),
  cell(
    omCell('05', '06'),
    L.frontStageTech,
    STEPS[4].id,
    'Google Quiz embedded in notion',
  ),
  cell(
    omCell('05', '07'),
    L.backStage,
    STEPS[4].id,
    'The Instructional Design team creates and maintains the google quiz.',
  ),
  cell(
    omCell('05', '08'),
    L.backStageTech,
    STEPS[4].id,
    'Notion\nGoogle Quizzes',
  ),
  cell(
    omCell('05', '09'),
    L.support,
    STEPS[4].id,
    'Researchers help guide instructional implementation',
  ),

  // Step 6 — reflection
  cell(
    omCell('06', '03'),
    L.regular,
    STEPS[5].id,
    'Fills out reflection for module',
  ),
  cell(omCell('06', '06'), L.frontStageTech, STEPS[5].id, 'PLUS App'),
  cell(
    omCell('06', '07'),
    L.backStage,
    STEPS[5].id,
    'Instructional design team designs and maintains reflection questions',
  ),
  cell(
    omCell('06', '08'),
    L.backStageTech,
    STEPS[5].id,
    'Notion\nFigma\nDev Tools',
  ),
  cell(
    omCell('06', '09'),
    L.support,
    STEPS[5].id,
    'Researchers help guide instructional implementation\nDev Team\nDesign Team',
  ),
]

export const ONBOARDING_MODULES_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: ONBOARDING_MODULES_HAPPY_PATH_ID,
    name: 'Happy Path',
    description:
      'Tutor succesfully completes onboarding modules.',
    path_type: 'happy',
  },
  layers: [...LAYERS],
  steps: [...STEPS],
  cells: ONBOARDING_MODULES_CELLS,
  triggers: ONBOARDING_MODULES_TRIGGERS,
}
