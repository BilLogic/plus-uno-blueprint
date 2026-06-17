import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import type {
  BlueprintCell,
  BlueprintCellTrigger,
  BlueprintData,
} from '@/types/blueprint'

export const REPORTING_AN_ISSUE_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000207'

export const REPORTING_AN_ISSUE_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-00000000080f'

const STEP_VISUAL_LAYER_ID = 'a0000000-0000-4000-8000-000000000910'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Visual', row_position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000911',
    name: 'Regular Tutor',
    row_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000912',
    name: 'Front Stage Actions',
    row_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000913',
    name: 'Front Stage Tech',
    row_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000914',
    name: 'Back Stage Actions',
    row_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000915',
    name: 'Back Stage Tech',
    row_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000916',
    name: 'Support Actions',
    row_position: 6,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000988',
    name: 'Reach out',
    column_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000990',
    name: 'Resolve concern',
    column_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000991',
    name: 'Request assistance',
    column_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000993',
    name: 'Follow up',
    column_position: 4,
  },
] as const

const L = {
  visual: STEP_VISUAL_LAYER_ID,
  regular: 'a0000000-0000-4000-8000-000000000911',
  frontStage: 'a0000000-0000-4000-8000-000000000912',
  frontStageTech: 'a0000000-0000-4000-8000-000000000913',
  backStage: 'a0000000-0000-4000-8000-000000000914',
  backStageTech: 'a0000000-0000-4000-8000-000000000915',
  support: 'a0000000-0000-4000-8000-000000000916',
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

function issueCell(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-0000001d${stepSlot}${layerSuffix}`
}

function issueTrigger(triggerSlot: string): string {
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
    id: issueTrigger(slot),
    source_cell_id: issueCell(fromStep, fromLayer),
    target_cell_id: issueCell(toStep, toLayer),
  }
}

const REPORTING_AN_ISSUE_TRIGGERS: BlueprintCellTrigger[] = [
  trigger('070', '01', '03', '01', '04'),
  trigger('071', '01', '04', '02', '07'),
  trigger('072', '02', '07', '03', '04'),
  trigger('073', '03', '04', '04', '03'),
]

const REPORTING_AN_ISSUE_CELLS: BlueprintCell[] = [
  cell(issueCell('01', '10'), L.visual, STEPS[0].id, ''),
  cell(
    issueCell('01', '03'),
    L.regular,
    STEPS[0].id,
    'Reach out to PLUS staff with any concerns',
  ),
  cell(
    issueCell('01', '04'),
    L.frontStage,
    STEPS[0].id,
    'PLUS Tutor Supervisor / Team Lead evaluates concern and routes as needed',
  ),
  cell(issueCell('01', '06'), L.frontStageTech, STEPS[0].id, 'Slack, Email'),

  cell(issueCell('02', '10'), L.visual, STEPS[1].id, ''),
  cell(
    issueCell('02', '07'),
    L.backStage,
    STEPS[1].id,
    'PLUS Tutor Supervisor / Team Lead resolves concern',
  ),

  cell(issueCell('03', '10'), L.visual, STEPS[2].id, ''),
  cell(
    issueCell('03', '04'),
    L.frontStage,
    STEPS[2].id,
    'PLUS Staff might request assistance if issue is on recording',
  ),
  cell(issueCell('03', '06'), L.frontStageTech, STEPS[2].id, 'Slack, Email'),

  cell(issueCell('04', '10'), L.visual, STEPS[3].id, ''),
  cell(
    issueCell('04', '03'),
    L.regular,
    STEPS[3].id,
    'Processes request and follows up on request',
  ),
  cell(
    issueCell('04', '06'),
    L.frontStageTech,
    STEPS[3].id,
    'Slack, Email, Zoom, Phone',
  ),
]

export const REPORTING_AN_ISSUE_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: REPORTING_AN_ISSUE_HAPPY_PATH_ID,
    name: 'Happy Path',
    description: 'Tutor reports a session issue after tutoring.',
    path_type: 'happy',
  },
  layers: [...LAYERS],
  steps: [...STEPS],
  cells: REPORTING_AN_ISSUE_CELLS,
  triggers: REPORTING_AN_ISSUE_TRIGGERS,
}
