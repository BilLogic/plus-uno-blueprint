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

export const HELP_REQUEST_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000205'

export const HELP_REQUEST_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-00000000080d'

const STEP_VISUAL_LAYER_ID = 'a0000000-0000-4000-8000-000000000860'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Visual', row_position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000867',
    name: 'Partner Action: Teacher',
    row_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000868',
    name: 'Lead Tutor',
    row_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000861',
    name: 'Regular Tutor',
    row_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000863',
    name: 'Front Stage Tech',
    row_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000862',
    name: 'Front Stage Actions',
    row_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000864',
    name: 'Back Stage Actions',
    row_position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000865',
    name: 'Back Stage Tech',
    row_position: 7,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000866',
    name: 'Support Actions',
    row_position: 8,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000975',
    name: 'Receive help request',
    column_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000976',
    name: 'Finish conversation',
    column_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000977',
    name: 'Visit student',
    column_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000978',
    name: 'Resolve issue',
    column_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000979',
    name: 'Next student',
    column_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000986',
    name: PARALLEL_SESSION_PARTNER_CONTENT[5]!,
    column_position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000987',
    name: PARALLEL_SESSION_PARTNER_CONTENT[6]!,
    column_position: 7,
  },
] as const

const L = {
  visual: STEP_VISUAL_LAYER_ID,
  partner: 'a0000000-0000-4000-8000-000000000867',
  lead: 'a0000000-0000-4000-8000-000000000868',
  regular: 'a0000000-0000-4000-8000-000000000861',
  frontStage: 'a0000000-0000-4000-8000-000000000862',
  frontStageTech: 'a0000000-0000-4000-8000-000000000863',
  backStage: 'a0000000-0000-4000-8000-000000000864',
  backStageTech: 'a0000000-0000-4000-8000-000000000865',
  support: 'a0000000-0000-4000-8000-000000000866',
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

function hrCell(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-0000001b${stepSlot}${layerSuffix}`
}

function hrTrigger(triggerSlot: string): string {
  return `a0000000-0000-4000-8000-000000099${triggerSlot}`
}

function trigger(
  slot: string,
  fromStep: string,
  fromLayer: string,
  toStep: string,
  toLayer: string,
): BlueprintCellTrigger {
  return {
    id: hrTrigger(slot),
    source_cell_id: hrCell(fromStep, fromLayer),
    target_cell_id: hrCell(toStep, toLayer),
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
    hrCell(stepSlot, layerSuffix),
  triggerId: (slot: string) => hrTrigger(slot),
  partnerLayerId: L.partner,
  leadLayerId: L.lead,
  stepIdForColumn: (column: number) => STEPS[column - 1]!.id,
}

const HELP_REQUEST_TRIGGERS: BlueprintCellTrigger[] = [
  ...buildParallelSessionPartnerLeadTriggers(partnerLeadOptions),
  ...rowTriggers('03', 50, 4),
  trigger('060', '05', '03', '01', '03'),
]

const HELP_REQUEST_CELLS: BlueprintCell[] = [
  ...STEPS.map((step, index) =>
    cell(hrCell(String(index + 1).padStart(2, '0'), '10'), L.visual, step.id, ''),
  ),
  ...buildParallelSessionPartnerLeadCells(partnerLeadOptions),

  cell(hrCell('01', '03'), L.regular, STEPS[0].id, 'Tutor Receives Help Request'),
  cell(
    hrCell('02', '03'),
    L.regular,
    STEPS[1].id,
    'Finish current conversation in 1-2 minutes',
  ),
  cell(hrCell('03', '03'), L.regular, STEPS[2].id, 'Visit student requesting help'),
  cell(hrCell('04', '03'), L.regular, STEPS[3].id, 'Resolve Issue'),
  cell(
    hrCell('05', '03'),
    L.regular,
    STEPS[4].id,
    'Return to the next student in sorted order set by researchers',
  ),

  cell(hrCell('01', '06'), L.frontStageTech, STEPS[0].id, 'Zoom/Pencil, PLUS App'),
  cell(hrCell('02', '06'), L.frontStageTech, STEPS[1].id, 'Zoom/Pencil, PLUS App'),
  cell(hrCell('03', '06'), L.frontStageTech, STEPS[2].id, 'Zoom/Pencil, PLUS App'),
  cell(hrCell('04', '06'), L.frontStageTech, STEPS[3].id, 'Zoom/Pencil, PLUS App'),
  cell(hrCell('05', '06'), L.frontStageTech, STEPS[4].id, 'Zoom/Pencil, PLUS App'),

  cell(
    hrCell('05', '07'),
    L.backStage,
    STEPS[4].id,
    'Researchers set student order',
  ),

  cell(hrCell('01', '09'), L.support, STEPS[0].id, 'Dev Team\nDesign team'),
  cell(hrCell('02', '09'), L.support, STEPS[1].id, 'Dev Team\nDesign team'),
  cell(hrCell('03', '09'), L.support, STEPS[2].id, 'Dev Team\nDesign team'),
  cell(hrCell('04', '09'), L.support, STEPS[3].id, 'Dev Team\nDesign team'),
  cell(
    hrCell('05', '09'),
    L.support,
    STEPS[4].id,
    'Researchers set student order\nDev Team\nDesign team',
  ),
]

export const HELP_REQUEST_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: HELP_REQUEST_HAPPY_PATH_ID,
    name: 'Happy Path',
    description:
      'Tutors receive and resolve student help requests during the session.',
    path_type: 'happy',
  },
  layers: [...LAYERS],
  steps: [...STEPS],
  cells: HELP_REQUEST_CELLS,
  triggers: HELP_REQUEST_TRIGGERS,
}
