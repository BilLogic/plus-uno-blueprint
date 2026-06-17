import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import {
  buildParallelSessionPartnerLeadCells,
  buildParallelSessionPartnerLeadTriggers,
  PARALLEL_SESSION_PARTNER_CONTENT,
} from '@/data/parallelSessionPartnerLead'
import type {
  BlueprintCell,
  BlueprintCellTrigger,
  BlueprintData,
} from '@/types/blueprint'

export const GOAL_SETTING_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000204'

export const GOAL_SETTING_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-00000000080c'

const STEP_VISUAL_LAYER_ID = 'a0000000-0000-4000-8000-000000000850'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Visual', row_position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000857',
    name: 'Partner Action: Teacher',
    row_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000858',
    name: 'Lead Tutor',
    row_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000851',
    name: 'Regular Tutor',
    row_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000853',
    name: 'Front Stage Tech',
    row_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000852',
    name: 'Front Stage Actions',
    row_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000854',
    name: 'Back Stage Actions',
    row_position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000855',
    name: 'Back Stage Tech',
    row_position: 7,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000856',
    name: 'Support Actions',
    row_position: 8,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000970',
    name: 'Join breakout session',
    column_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000971',
    name: 'Share screen',
    column_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000972',
    name: 'Set or check goal',
    column_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000973',
    name: 'Complete goal strategy',
    column_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000974',
    name: 'Next student',
    column_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000984',
    name: PARALLEL_SESSION_PARTNER_CONTENT[5]!,
    column_position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000985',
    name: PARALLEL_SESSION_PARTNER_CONTENT[6]!,
    column_position: 7,
  },
] as const

const L = {
  visual: STEP_VISUAL_LAYER_ID,
  partner: 'a0000000-0000-4000-8000-000000000857',
  lead: 'a0000000-0000-4000-8000-000000000858',
  regular: 'a0000000-0000-4000-8000-000000000851',
  frontStage: 'a0000000-0000-4000-8000-000000000852',
  frontStageTech: 'a0000000-0000-4000-8000-000000000853',
  backStage: 'a0000000-0000-4000-8000-000000000854',
  backStageTech: 'a0000000-0000-4000-8000-000000000855',
  support: 'a0000000-0000-4000-8000-000000000856',
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

function gsCell(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-0000001a${stepSlot}${layerSuffix}`
}

function gsTrigger(triggerSlot: string): string {
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
    id: gsTrigger(slot),
    source_cell_id: gsCell(fromStep, fromLayer),
    target_cell_id: gsCell(toStep, toLayer),
  }
}

function rowTriggers(
  layer: string,
  idStart: number,
  count: number,
): BlueprintCellTrigger[] {
  const triggers: BlueprintCellTrigger[] = []
  for (let i = 0; i < count; i++) {
    const from = String(i + 1).padStart(2, '0')
    const to = String(i + 2).padStart(2, '0')
    triggers.push(
      trigger(
        String(idStart + i).padStart(3, '0'),
        from,
        layer,
        to,
        layer,
      ),
    )
  }
  return triggers
}

const partnerLeadOptions = {
  cellId: (stepSlot: string, layerSuffix: '01' | '02') =>
    gsCell(stepSlot, layerSuffix),
  triggerId: (slot: string) => gsTrigger(slot),
  partnerLayerId: L.partner,
  leadLayerId: L.lead,
  stepIdForColumn: (column: number) => STEPS[column - 1]!.id,
}

const GOAL_SETTING_TRIGGERS: BlueprintCellTrigger[] = [
  ...buildParallelSessionPartnerLeadTriggers(partnerLeadOptions),
  ...rowTriggers('03', 50, 4),
  trigger('060', '05', '03', '01', '03'),
]

const GOAL_SETTING_CELLS: BlueprintCell[] = [
  ...STEPS.map((step, index) =>
    cell(gsCell(String(index + 1).padStart(2, '0'), '10'), L.visual, step.id, ''),
  ),
  ...buildParallelSessionPartnerLeadCells(partnerLeadOptions),

  cell(gsCell('01', '03'), L.regular, STEPS[0].id, 'Join breakout session'),
  cell(gsCell('02', '03'), L.regular, STEPS[1].id, 'Share screen'),
  cell(
    gsCell('03', '03'),
    L.regular,
    STEPS[2].id,
    'update, check, or set goal depending on point in goal cycle',
  ),
  cell(
    gsCell('04', '03'),
    L.regular,
    STEPS[3].id,
    'If prompted, complete goal achievement strategy with student',
  ),
  cell(
    gsCell('05', '03'),
    L.regular,
    STEPS[4].id,
    'Move on to the next student in sorted order set by researchers',
  ),

  cell(gsCell('01', '06'), L.frontStageTech, STEPS[0].id, 'Zoom/Pencil, PLUS App'),
  cell(gsCell('02', '06'), L.frontStageTech, STEPS[1].id, 'Zoom/Pencil, PLUS App'),
  cell(gsCell('03', '06'), L.frontStageTech, STEPS[2].id, 'Zoom/Pencil, PLUS App'),
  cell(gsCell('04', '06'), L.frontStageTech, STEPS[3].id, 'Zoom/Pencil, PLUS App'),
  cell(gsCell('05', '06'), L.frontStageTech, STEPS[4].id, 'Zoom/Pencil, PLUS App'),

  cell(
    gsCell('03', '07'),
    L.backStage,
    STEPS[2].id,
    'Graduate Researcher sets goal setting activities',
  ),
  cell(
    gsCell('04', '07'),
    L.backStage,
    STEPS[3].id,
    'Graduate Researcher sets goal setting activities',
  ),
  cell(
    gsCell('05', '07'),
    L.backStage,
    STEPS[4].id,
    'Researchers set student order',
  ),

  cell(gsCell('01', '09'), L.support, STEPS[0].id, 'Dev Team\nDesign team'),
  cell(gsCell('02', '09'), L.support, STEPS[1].id, 'Dev Team\nDesign team'),
  cell(gsCell('03', '09'), L.support, STEPS[2].id, 'Dev Team\nDesign team'),
  cell(gsCell('04', '09'), L.support, STEPS[3].id, 'Dev Team\nDesign team'),
  cell(
    gsCell('05', '09'),
    L.support,
    STEPS[4].id,
    'Researchers set student order\nDev Team\nDesign team',
  ),
]

export const GOAL_SETTING_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: GOAL_SETTING_HAPPY_PATH_ID,
    name: 'Happy Path',
    description:
      'Tutors guide students through goal setting in breakout sessions.',
    path_type: 'happy',
  },
  layers: [...LAYERS],
  steps: [...STEPS],
  cells: GOAL_SETTING_CELLS,
  triggers: GOAL_SETTING_TRIGGERS,
}
