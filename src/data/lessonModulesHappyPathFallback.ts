import { LESSON_MODULES_SCENARIO_ID } from '@/data/techSetupHappyPathFallback'
import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import type {
  BlueprintCell,
  BlueprintCellTrigger,
  BlueprintData,
} from '@/types/blueprint'

export { LESSON_MODULES_SCENARIO_ID }

export const LESSON_MODULES_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-000000000802'

const STEP_VISUAL_LAYER_ID = 'a0000000-0000-4000-8000-000000001240'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Visual', row_position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000001241',
    name: 'Regular Tutor',
    row_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000001242',
    name: 'Front Stage Actions',
    row_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000001243',
    name: 'Front Stage Tech',
    row_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000001244',
    name: 'Back Stage Actions',
    row_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000001245',
    name: 'Back Stage Tech',
    row_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000001246',
    name: 'Support Actions',
    row_position: 6,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000861',
    name: 'Open lesson',
    column_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000862',
    name: 'Work through questions',
    column_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000863',
    name: 'Finish lesson',
    column_position: 3,
  },
] as const

const L = {
  visual: STEP_VISUAL_LAYER_ID,
  regular: 'a0000000-0000-4000-8000-000000001241',
  frontStage: 'a0000000-0000-4000-8000-000000001242',
  frontStageTech: 'a0000000-0000-4000-8000-000000001243',
  backStage: 'a0000000-0000-4000-8000-000000001244',
  backStageTech: 'a0000000-0000-4000-8000-000000001245',
  support: 'a0000000-0000-4000-8000-000000001246',
} as const

const STEP_1_SUPPORT =
  'Researchers help guide instructional implementation\nDev Team\nDesign Team'

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

function lmCell(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-00000012${stepSlot}${layerSuffix}`
}

function lmTrigger(triggerSlot: string): string {
  return `a0000000-0000-4000-8000-000000090${triggerSlot}`
}

function trigger(
  slot: string,
  fromStep: string,
  fromLayer: string,
  toStep: string,
  toLayer: string,
): BlueprintCellTrigger {
  return {
    id: lmTrigger(slot),
    source_cell_id: lmCell(fromStep, fromLayer),
    target_cell_id: lmCell(toStep, toLayer),
  }
}

const LESSON_MODULES_TRIGGERS: BlueprintCellTrigger[] = [
  // Regular Tutor forward chain
  trigger('011', '01', '03', '02', '03'),
  trigger('012', '02', '03', '03', '03'),
  // Loop to next lesson
  trigger('013', '03', '03', '01', '03'),

  // Step 1 — assignment & lesson design → PLUS app
  trigger('031', '01', '07', '01', '06'),
]

const LESSON_MODULES_CELLS: BlueprintCell[] = [
  ...STEPS.map((step, stepIndex) =>
    cell(
      lmCell(String(stepIndex + 1).padStart(2, '0'), '10'),
      L.visual,
      step.id,
      '',
    ),
  ),

  // Step 1 — open assigned lesson
  cell(
    lmCell('01', '03'),
    L.regular,
    STEPS[0].id,
    'Opens next uncompleted assigned lesson',
  ),
  cell(lmCell('01', '06'), L.frontStageTech, STEPS[0].id, 'PLUS App'),
  cell(
    lmCell('01', '07'),
    L.backStage,
    STEPS[0].id,
    'Tutor Supervisor Team assigns lessons.\nInstructional design team designs and maintains lessons',
  ),
  cell(
    lmCell('01', '08'),
    L.backStageTech,
    STEPS[0].id,
    'PLUS App\nFigma\nDev Tools',
  ),
  cell(lmCell('01', '09'), L.support, STEPS[0].id, STEP_1_SUPPORT),

  // Step 2 — work through questions
  cell(
    lmCell('02', '03'),
    L.regular,
    STEPS[1].id,
    'Works through the questions',
  ),
  cell(lmCell('02', '06'), L.frontStageTech, STEPS[1].id, 'PLUS App'),
  cell(lmCell('02', '08'), L.backStageTech, STEPS[1].id, 'Figma\nDev Tools'),
  cell(lmCell('02', '09'), L.support, STEPS[1].id, STEP_1_SUPPORT),

  // Step 3 — finish lesson
  cell(
    lmCell('03', '03'),
    L.regular,
    STEPS[2].id,
    'Finishes lesson and receives score',
  ),
  cell(lmCell('03', '06'), L.frontStageTech, STEPS[2].id, 'PLUS App'),
  cell(lmCell('03', '08'), L.backStageTech, STEPS[2].id, 'Figma\nDev Tools'),
  cell(lmCell('03', '09'), L.support, STEPS[2].id, 'Dev Team\nDesign Team'),
]

export const LESSON_MODULES_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: LESSON_MODULES_HAPPY_PATH_ID,
    name: 'Happy Path',
    description:
      'Tutor succesfully completes lesson modules.',
    path_type: 'happy',
  },
  layers: [...LAYERS],
  steps: [...STEPS],
  cells: LESSON_MODULES_CELLS,
  triggers: LESSON_MODULES_TRIGGERS,
}
