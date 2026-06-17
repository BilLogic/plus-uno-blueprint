import { applyBlueprintDisplayFilters } from '@/lib/applyBlueprintDisplayFilters'
import {
  APPLICATION_HAPPY_PATH_FALLBACK,
  APPLICATION_HAPPY_PATH_ID,
  APPLICATION_SAD_PATH_FALLBACK,
  APPLICATION_SAD_PATH_ID,
  DISCOVERY_SCENARIO_ID,
  INTERVIEW_SCENARIO_ID,
} from '@/data/applicationHappyPathFallback'
import {
  APPLICATION_INTERVIEW_HAPPY_PATH_FALLBACK,
  APPLICATION_INTERVIEW_HAPPY_PATH_ID,
} from '@/data/applicationInterviewHappyPathFallback'
import {
  BEFORE_STUDENTS_JOIN_HAPPY_PATH_FALLBACK,
  BEFORE_STUDENTS_JOIN_HAPPY_PATH_ID,
  BEFORE_STUDENTS_JOIN_SCENARIO_ID,
} from '@/data/beforeStudentsJoinHappyPathFallback'
import {
  GOAL_SETTING_HAPPY_PATH_FALLBACK,
  GOAL_SETTING_HAPPY_PATH_ID,
  GOAL_SETTING_SCENARIO_ID,
} from '@/data/goalSettingHappyPathFallback'
import {
  HELP_REQUEST_HAPPY_PATH_FALLBACK,
  HELP_REQUEST_HAPPY_PATH_ID,
  HELP_REQUEST_SCENARIO_ID,
} from '@/data/helpRequestHappyPathFallback'
import {
  WRAP_UP_HAPPY_PATH_FALLBACK,
  WRAP_UP_HAPPY_PATH_ID,
  WRAP_UP_SCENARIO_ID,
} from '@/data/wrapUpHappyPathFallback'
import {
  REPORTING_AN_ISSUE_HAPPY_PATH_FALLBACK,
  REPORTING_AN_ISSUE_HAPPY_PATH_ID,
  REPORTING_AN_ISSUE_SCENARIO_ID,
  REPORTING_HOURS_HAPPY_PATH_FALLBACK,
  REPORTING_HOURS_HAPPY_PATH_ID,
  REPORTING_HOURS_SCENARIO_ID,
} from '@/data/postSessionHappyPathFallbacks'
import {
  STUDENTS_JUST_JOINED_HAPPY_PATH_FALLBACK,
  STUDENTS_JUST_JOINED_HAPPY_PATH_ID,
  STUDENTS_JUST_JOINED_SCENARIO_ID,
} from '@/data/studentsJustJoinedHappyPathFallback'
import {
  CALL_OFF_REQUEST_HAPPY_PATH_FALLBACK,
  CALL_OFF_REQUEST_HAPPY_PATH_ID,
  CALL_OFF_REQUEST_SCENARIO_ID,
} from '@/data/callOffRequestHappyPathFallback'
import {
  FILL_IN_REQUEST_HAPPY_PATH_FALLBACK,
  FILL_IN_REQUEST_HAPPY_PATH_ID,
  FILL_IN_REQUEST_SCENARIO_ID,
} from '@/data/fillInRequestHappyPathFallback'
import {
  LESSON_MODULES_HAPPY_PATH_FALLBACK,
  LESSON_MODULES_HAPPY_PATH_ID,
} from '@/data/lessonModulesHappyPathFallback'
import {
  ONBOARDING_MODULES_HAPPY_PATH_FALLBACK,
  ONBOARDING_MODULES_HAPPY_PATH_ID,
} from '@/data/onboardingModulesHappyPathFallback'
import {
  SESSION_SIGN_UP_HAPPY_PATH_FALLBACK,
  SESSION_SIGN_UP_HAPPY_PATH_ID,
} from '@/data/sessionSignUpHappyPathFallback'
import {
  STANDARD_SCHEDULING_HAPPY_PATH_FALLBACK,
  STANDARD_SCHEDULING_HAPPY_PATH_ID,
  STANDARD_SCHEDULING_SCENARIO_ID,
} from '@/data/standardSchedulingHappyPathFallback'
import {
  LESSON_MODULES_SCENARIO_ID,
  ONBOARDING_MODULES_SCENARIO_ID,
  SESSION_SIGN_UP_SCENARIO_ID,
  TECH_SETUP_HAPPY_PATH_FALLBACK,
  TECH_SETUP_HAPPY_PATH_ID,
  TECH_SETUP_SCENARIO_ID,
} from '@/data/techSetupHappyPathFallback'
import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import {
  buildParallelSessionPartnerLeadCells,
  buildParallelSessionPartnerLeadTriggers,
} from '@/data/parallelSessionPartnerLead'
import type {
  BlueprintCell,
  BlueprintCellTrigger,
  BlueprintData,
} from '@/types/blueprint'

/** Warm-Up scenario from supabase/seed.sql */
export const WARM_UP_SCENARIO_ID = 'a0000000-0000-4000-8000-000000000203'

export const WARM_UP_HAPPY_PATH_ID = 'a0000000-0000-4000-8000-000000000300'
export const WARM_UP_ALTERNATE_PATH_ID = 'a0000000-0000-4000-8000-000000000350'
export const WARM_UP_SAD_PATH_ID = 'a0000000-0000-4000-8000-000000000360'

const WARM_UP_STEP_3_ID = 'a0000000-0000-4000-8000-000000000313'
/** Sad-path-only step after the shared first four happy steps. */
export const WARM_UP_SAD_STEP_5_ID = 'a0000000-0000-4000-8000-000000000319'
export const WARM_UP_SAD_STEP_6_ID = 'a0000000-0000-4000-8000-000000000320'

const PATH_ID = WARM_UP_HAPPY_PATH_ID

export const STEP_VISUAL_LAYER_ID =
  'a0000000-0000-4000-8000-000000000310'
const ALTERNATE_STEP_VISUAL_LAYER_ID =
  'a0000000-0000-4000-8000-000000000410'
const SAD_STEP_VISUAL_LAYER_ID =
  'a0000000-0000-4000-8000-000000000510'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Visual', row_position: 0 },
  { id: 'a0000000-0000-4000-8000-000000000301', name: 'Partner Action: Teacher', row_position: 1 },
  { id: 'a0000000-0000-4000-8000-000000000302', name: 'Lead Tutor', row_position: 2 },
  { id: 'a0000000-0000-4000-8000-000000000303', name: 'Regular Tutor', row_position: 3 },
  { id: 'a0000000-0000-4000-8000-000000000306', name: 'Front Stage Tech', row_position: 4 },
  { id: 'a0000000-0000-4000-8000-000000000304', name: 'Front Stage Actions', row_position: 5 },
  { id: 'a0000000-0000-4000-8000-000000000307', name: 'Back Stage Actions', row_position: 6 },
  { id: 'a0000000-0000-4000-8000-000000000308', name: 'Back Stage Tech', row_position: 7 },
  { id: 'a0000000-0000-4000-8000-000000000309', name: 'Support Actions', row_position: 8 },
] as const

const STEPS = [
  { id: 'a0000000-0000-4000-8000-000000000311', name: 'Enter Breakout Room', column_position: 1 },
  { id: 'a0000000-0000-4000-8000-000000000312', name: 'Greet Student', column_position: 2 },
  { id: 'a0000000-0000-4000-8000-000000000313', name: 'Ask Student to Share Screen', column_position: 3 },
  { id: 'a0000000-0000-4000-8000-000000000314', name: 'Remind Student They Can Ask for Help', column_position: 4 },
  { id: 'a0000000-0000-4000-8000-000000000315', name: 'Mark Student Present', column_position: 5 },
  { id: 'a0000000-0000-4000-8000-000000000316', name: 'Select Engagement level', column_position: 6 },
  { id: 'a0000000-0000-4000-8000-000000000317', name: 'Mark Student Helped', column_position: 7 },
  { id: 'a0000000-0000-4000-8000-000000000318', name: 'Move to Next Student', column_position: 8 },
] as const

const WARM_UP_SAD_STEP_5 = {
  id: WARM_UP_SAD_STEP_5_ID,
  name: 'PLUS App Not Working',
  column_position: 5,
} as const

const WARM_UP_SAD_STEP_6 = {
  id: WARM_UP_SAD_STEP_6_ID,
  name: 'Unable to Complete Warm-Up',
  column_position: 6,
} as const

const L = {
  stepVisual: STEP_VISUAL_LAYER_ID,
  partner: 'a0000000-0000-4000-8000-000000000301',
  lead: 'a0000000-0000-4000-8000-000000000302',
  regular: 'a0000000-0000-4000-8000-000000000303',
  frontTech: 'a0000000-0000-4000-8000-000000000306',
  support: 'a0000000-0000-4000-8000-000000000309',
} as const

function stepVisualCellId(stepIndex: number): string {
  const slot = String(stepIndex + 1).padStart(2, '0')
  return `a0000000-0000-4000-8000-00000004${slot}10`
}

function mapPathLayerId(
  layerId: string,
  path: 'alternate' | 'sad',
): string {
  if (layerId === STEP_VISUAL_LAYER_ID) {
    return path === 'alternate'
      ? ALTERNATE_STEP_VISUAL_LAYER_ID
      : SAD_STEP_VISUAL_LAYER_ID
  }

  return path === 'alternate'
    ? mapHappyLayerId(layerId)
    : mapSadLayerId(layerId)
}

const FRONT_STAGE_TECH_STEP = 'Zoom/Pencil\nPLUS App\nSlack'
const SUPPORT_STEP = 'Dev Team\nDesign team'
const SUPPORT_STEP_8 =
  'Researchers set student order\nDev Team\nDesign team'

const warmUpPartnerLeadOptions = {
  cellId: (stepSlot: string, layerSuffix: '01' | '02') =>
    `a0000000-0000-4000-8000-00000004${stepSlot}${layerSuffix}`,
  triggerId: (slot: string) =>
    `a0000000-0000-4000-8000-00000005${slot}`,
  partnerLayerId: L.partner,
  leadLayerId: L.lead,
  stepIdForColumn: (column: number) => STEPS[column - 1]!.id,
}

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

const WARM_UP_CELLS: BlueprintCell[] = [
  ...STEPS.map((step, stepIndex) =>
    cell(stepVisualCellId(stepIndex), L.stepVisual, step.id, ''),
  ),
  ...buildParallelSessionPartnerLeadCells(warmUpPartnerLeadOptions),
  cell('a0000000-0000-4000-8000-000000040103', L.regular, STEPS[0].id, 'Enter Breakout room'),
  cell(
    'a0000000-0000-4000-8000-000000040106',
    L.frontTech,
    STEPS[0].id,
    'Zoom/Pencil\nPLUS App\nSlack',
  ),
  cell('a0000000-0000-4000-8000-000000040109', L.support, STEPS[0].id, 'Dev Team\nDesign team'),
  cell('a0000000-0000-4000-8000-000000040203', L.regular, STEPS[1].id, 'Greet student'),
  cell('a0000000-0000-4000-8000-000000040206', L.frontTech, STEPS[1].id, FRONT_STAGE_TECH_STEP),
  cell('a0000000-0000-4000-8000-000000040209', L.support, STEPS[1].id, SUPPORT_STEP),
  cell('a0000000-0000-4000-8000-000000040303', L.regular, STEPS[2].id, 'Ask them to share screen'),
  cell('a0000000-0000-4000-8000-000000040306', L.frontTech, STEPS[2].id, FRONT_STAGE_TECH_STEP),
  cell('a0000000-0000-4000-8000-000000040309', L.support, STEPS[2].id, SUPPORT_STEP),
  cell(
    'a0000000-0000-4000-8000-000000040403',
    L.regular,
    STEPS[3].id,
    'Remind them that they can ask for help on content and support',
  ),
  cell('a0000000-0000-4000-8000-000000040406', L.frontTech, STEPS[3].id, FRONT_STAGE_TECH_STEP),
  cell('a0000000-0000-4000-8000-000000040409', L.support, STEPS[3].id, SUPPORT_STEP),
  cell('a0000000-0000-4000-8000-000000040503', L.regular, STEPS[4].id, 'Mark them as present'),
  cell('a0000000-0000-4000-8000-000000040506', L.frontTech, STEPS[4].id, FRONT_STAGE_TECH_STEP),
  cell('a0000000-0000-4000-8000-000000040509', L.support, STEPS[4].id, SUPPORT_STEP),
  cell('a0000000-0000-4000-8000-000000040603', L.regular, STEPS[5].id, 'Select Engagement level'),
  cell('a0000000-0000-4000-8000-000000040606', L.frontTech, STEPS[5].id, FRONT_STAGE_TECH_STEP),
  cell('a0000000-0000-4000-8000-000000040609', L.support, STEPS[5].id, SUPPORT_STEP),
  cell('a0000000-0000-4000-8000-000000040703', L.regular, STEPS[6].id, 'Mark them as helped'),
  cell('a0000000-0000-4000-8000-000000040706', L.frontTech, STEPS[6].id, FRONT_STAGE_TECH_STEP),
  cell('a0000000-0000-4000-8000-000000040709', L.support, STEPS[6].id, SUPPORT_STEP),
  cell('a0000000-0000-4000-8000-000000040803', L.regular, STEPS[7].id, 'Move on to the next student in sorted order set by researchers'),
  cell('a0000000-0000-4000-8000-000000040806', L.frontTech, STEPS[7].id, FRONT_STAGE_TECH_STEP),
  cell('a0000000-0000-4000-8000-000000040809', L.support, STEPS[7].id, SUPPORT_STEP_8),
]

const WARM_UP_TRIGGERS: BlueprintCellTrigger[] = [
  ...buildParallelSessionPartnerLeadTriggers(warmUpPartnerLeadOptions),
  {
    id: 'a0000000-0000-4000-8000-000000050101',
    source_cell_id: 'a0000000-0000-4000-8000-000000040103',
    target_cell_id: 'a0000000-0000-4000-8000-000000040203',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050102',
    source_cell_id: 'a0000000-0000-4000-8000-000000040203',
    target_cell_id: 'a0000000-0000-4000-8000-000000040303',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050103',
    source_cell_id: 'a0000000-0000-4000-8000-000000040303',
    target_cell_id: 'a0000000-0000-4000-8000-000000040403',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050104',
    source_cell_id: 'a0000000-0000-4000-8000-000000040403',
    target_cell_id: 'a0000000-0000-4000-8000-000000040503',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050105',
    source_cell_id: 'a0000000-0000-4000-8000-000000040503',
    target_cell_id: 'a0000000-0000-4000-8000-000000040603',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050106',
    source_cell_id: 'a0000000-0000-4000-8000-000000040603',
    target_cell_id: 'a0000000-0000-4000-8000-000000040703',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050107',
    source_cell_id: 'a0000000-0000-4000-8000-000000040703',
    target_cell_id: 'a0000000-0000-4000-8000-000000040803',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050112',
    source_cell_id: 'a0000000-0000-4000-8000-000000040803',
    target_cell_id: 'a0000000-0000-4000-8000-000000040103',
  },
]

export const WARM_UP_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: PATH_ID,
    name: 'Happy Path',
    description:
      'Standard warm-up when students join on time and the session proceeds normally.',
    path_type: 'happy',
  },
  layers: [...LAYERS],
  steps: [...STEPS],
  cells: WARM_UP_CELLS,
  triggers: WARM_UP_TRIGGERS,
}

function mapHappyCellId(id: string): string {
  return id.replace('00000004', '00000006')
}

function mapHappyLayerId(id: string): string {
  return id.replace('00000003', '00000004')
}

function mapHappyTriggerId(id: string): string {
  return id.replace('00000005', '00000007')
}

function mapSadCellId(id: string): string {
  return id.replace('00000004', '00000008')
}

function mapSadLayerId(id: string): string {
  return id.replace('00000003', '00000005')
}

function mapSadTriggerId(id: string): string {
  return id.replace('00000005', '00000009')
}

const WARM_UP_ALTERNATE_TRIGGERS: BlueprintCellTrigger[] = [
  ...WARM_UP_TRIGGERS.filter(
    (t) =>
      t.id !== 'a0000000-0000-4000-8000-000000050102' &&
      t.id !== 'a0000000-0000-4000-8000-000000050103' &&
      t.id !== 'a0000000-0000-4000-8000-000000050110' &&
      t.id !== 'a0000000-0000-4000-8000-000000050111',
  ).map((t) => ({
    id: mapHappyTriggerId(t.id),
    source_cell_id: mapHappyCellId(t.source_cell_id),
    target_cell_id: mapHappyCellId(t.target_cell_id),
  })),
  {
    id: 'a0000000-0000-4000-8000-000000070102',
    source_cell_id: 'a0000000-0000-4000-8000-000000060203',
    target_cell_id: 'a0000000-0000-4000-8000-000000060403',
  },
]

const WARM_UP_ALTERNATE_STEPS = STEPS.filter(
  (step) => step.id !== WARM_UP_STEP_3_ID,
).map((step, index) => ({
  ...step,
  column_position: index + 1,
}))

const WARM_UP_SAD_STEPS = [
  STEPS[0],
  STEPS[1],
  STEPS[2],
  STEPS[3],
  WARM_UP_SAD_STEP_5,
  WARM_UP_SAD_STEP_6,
]

const SAD_PATH_LAYER_SUFFIXES = ['03', '06', '09'] as const

const HAPPY_CELL_BY_ID = new Map(WARM_UP_CELLS.map((cell) => [cell.id, cell]))

function happyCellId(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-00000004${stepSlot}${layerSuffix}`
}

function sadCellId(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-00000008${stepSlot}${layerSuffix}`
}

function addSadPathSlotCells(
  cells: BlueprintCell[],
  sadSlot: string,
  happySlot: string,
  stepId: string,
  contentOverrides: Partial<Record<(typeof SAD_PATH_LAYER_SUFFIXES)[number], string>> = {},
): void {
  for (const suffix of SAD_PATH_LAYER_SUFFIXES) {
    const source = HAPPY_CELL_BY_ID.get(happyCellId(happySlot, suffix))
    if (!source?.content.trim()) continue

    cells.push({
      id: sadCellId(sadSlot, suffix),
      layer_id: mapSadLayerId(source.layer_id),
      step_id: stepId,
      content: contentOverrides[suffix] ?? source.content,
      picture: source.picture,
      description: source.description,
      links: source.links,
    })
  }
}

function buildSadPathCells(): BlueprintCell[] {
  const cells: BlueprintCell[] = []

  for (const cell of WARM_UP_CELLS) {
    const stepSlot = cell.id.slice(-4, -2)
    if (stepSlot >= '05' && stepSlot <= '08') continue

    cells.push({
      ...cell,
      id: mapSadCellId(cell.id),
      layer_id: mapPathLayerId(cell.layer_id, 'sad'),
    })
  }

  addSadPathSlotCells(cells, '05', '05', WARM_UP_SAD_STEP_5_ID, {
    '03':
      'PLUS app is not working properly and tutor is unable to update student data.',
  })
  addSadPathSlotCells(cells, '06', '06', WARM_UP_SAD_STEP_6_ID, {
    '03': 'Unable to complete warm up phase.',
  })

  for (const [slot, stepId] of [
    ['05', WARM_UP_SAD_STEP_5_ID],
    ['06', WARM_UP_SAD_STEP_6_ID],
  ] as const) {
    cells.push({
      id: sadCellId(slot, '10'),
      layer_id: SAD_STEP_VISUAL_LAYER_ID,
      step_id: stepId,
      content: '',
      ...EMPTY_CELL_METADATA,
    })
  }

  return cells
}

const WARM_UP_SAD_END_TRIGGER_IDS = new Set([
  'a0000000-0000-4000-8000-000000050106',
  'a0000000-0000-4000-8000-000000050107',
  'a0000000-0000-4000-8000-000000050112',
])

function buildSadPathTriggers(): BlueprintCellTrigger[] {
  return WARM_UP_TRIGGERS.filter(
    (trigger) => !WARM_UP_SAD_END_TRIGGER_IDS.has(trigger.id),
  ).map((trigger) => ({
    id: mapSadTriggerId(trigger.id),
    source_cell_id: mapSadCellId(trigger.source_cell_id),
    target_cell_id: mapSadCellId(trigger.target_cell_id),
  }))
}

export const WARM_UP_ALTERNATE_PATH_FALLBACK: BlueprintData = {
  path: {
    id: WARM_UP_ALTERNATE_PATH_ID,
    name: 'Alternate Path',
    description: 'Warm-up flow that skips the screen-share step.',
    path_type: 'alternative',
  },
  layers: LAYERS.map((layer) => ({
    ...layer,
    id: mapPathLayerId(layer.id, 'alternate'),
  })),
  steps: WARM_UP_ALTERNATE_STEPS,
  cells: WARM_UP_CELLS.filter((cell) => cell.step_id !== WARM_UP_STEP_3_ID).map(
    (cell) => ({
      ...cell,
      id: mapHappyCellId(cell.id),
      layer_id: mapPathLayerId(cell.layer_id, 'alternate'),
    }),
  ),
  triggers: WARM_UP_ALTERNATE_TRIGGERS,
}

export const WARM_UP_SAD_PATH_FALLBACK: BlueprintData = {
  path: {
    id: WARM_UP_SAD_PATH_ID,
    name: 'Sad Path',
    description:
      'Warm-up when the PLUS app fails and the tutor cannot complete student updates.',
    path_type: 'unhappy',
  },
  layers: LAYERS.map((layer) => ({
    ...layer,
    id: mapPathLayerId(layer.id, 'sad'),
  })),
  steps: WARM_UP_SAD_STEPS,
  cells: buildSadPathCells(),
  triggers: buildSadPathTriggers(),
}

const FALLBACK_BY_PATH: Record<string, BlueprintData> = {
  [WARM_UP_HAPPY_PATH_ID]: WARM_UP_HAPPY_PATH_FALLBACK,
  [WARM_UP_ALTERNATE_PATH_ID]: WARM_UP_ALTERNATE_PATH_FALLBACK,
  [WARM_UP_SAD_PATH_ID]: WARM_UP_SAD_PATH_FALLBACK,
  [APPLICATION_HAPPY_PATH_ID]: APPLICATION_HAPPY_PATH_FALLBACK,
  [APPLICATION_SAD_PATH_ID]: APPLICATION_SAD_PATH_FALLBACK,
  [APPLICATION_INTERVIEW_HAPPY_PATH_ID]: APPLICATION_INTERVIEW_HAPPY_PATH_FALLBACK,
  [TECH_SETUP_HAPPY_PATH_ID]: TECH_SETUP_HAPPY_PATH_FALLBACK,
  [ONBOARDING_MODULES_HAPPY_PATH_ID]: ONBOARDING_MODULES_HAPPY_PATH_FALLBACK,
  [LESSON_MODULES_HAPPY_PATH_ID]: LESSON_MODULES_HAPPY_PATH_FALLBACK,
  [SESSION_SIGN_UP_HAPPY_PATH_ID]: SESSION_SIGN_UP_HAPPY_PATH_FALLBACK,
  [STANDARD_SCHEDULING_HAPPY_PATH_ID]: STANDARD_SCHEDULING_HAPPY_PATH_FALLBACK,
  [FILL_IN_REQUEST_HAPPY_PATH_ID]: FILL_IN_REQUEST_HAPPY_PATH_FALLBACK,
  [CALL_OFF_REQUEST_HAPPY_PATH_ID]: CALL_OFF_REQUEST_HAPPY_PATH_FALLBACK,
  [BEFORE_STUDENTS_JOIN_HAPPY_PATH_ID]: BEFORE_STUDENTS_JOIN_HAPPY_PATH_FALLBACK,
  [STUDENTS_JUST_JOINED_HAPPY_PATH_ID]: STUDENTS_JUST_JOINED_HAPPY_PATH_FALLBACK,
  [GOAL_SETTING_HAPPY_PATH_ID]: GOAL_SETTING_HAPPY_PATH_FALLBACK,
  [HELP_REQUEST_HAPPY_PATH_ID]: HELP_REQUEST_HAPPY_PATH_FALLBACK,
  [WRAP_UP_HAPPY_PATH_ID]: WRAP_UP_HAPPY_PATH_FALLBACK,
  [REPORTING_AN_ISSUE_HAPPY_PATH_ID]: REPORTING_AN_ISSUE_HAPPY_PATH_FALLBACK,
  [REPORTING_HOURS_HAPPY_PATH_ID]: REPORTING_HOURS_HAPPY_PATH_FALLBACK,
}

const FALLBACK_PATHS_BY_SCENARIO: Record<
  string,
  Array<{
    id: string
    name: string
    description: string | null
    path_type: BlueprintData['path']['path_type']
  }>
> = {
  [WARM_UP_SCENARIO_ID]: [
    {
      id: WARM_UP_HAPPY_PATH_FALLBACK.path.id,
      name: WARM_UP_HAPPY_PATH_FALLBACK.path.name,
      description: WARM_UP_HAPPY_PATH_FALLBACK.path.description,
      path_type: WARM_UP_HAPPY_PATH_FALLBACK.path.path_type,
    },
    {
      id: WARM_UP_ALTERNATE_PATH_FALLBACK.path.id,
      name: WARM_UP_ALTERNATE_PATH_FALLBACK.path.name,
      description: WARM_UP_ALTERNATE_PATH_FALLBACK.path.description,
      path_type: WARM_UP_ALTERNATE_PATH_FALLBACK.path.path_type,
    },
    {
      id: WARM_UP_SAD_PATH_FALLBACK.path.id,
      name: WARM_UP_SAD_PATH_FALLBACK.path.name,
      description: WARM_UP_SAD_PATH_FALLBACK.path.description,
      path_type: WARM_UP_SAD_PATH_FALLBACK.path.path_type,
    },
  ],
  [DISCOVERY_SCENARIO_ID]: [
    {
      id: APPLICATION_HAPPY_PATH_FALLBACK.path.id,
      name: APPLICATION_HAPPY_PATH_FALLBACK.path.name,
      description: APPLICATION_HAPPY_PATH_FALLBACK.path.description,
      path_type: APPLICATION_HAPPY_PATH_FALLBACK.path.path_type,
    },
    {
      id: APPLICATION_SAD_PATH_FALLBACK.path.id,
      name: APPLICATION_SAD_PATH_FALLBACK.path.name,
      description: APPLICATION_SAD_PATH_FALLBACK.path.description,
      path_type: APPLICATION_SAD_PATH_FALLBACK.path.path_type,
    },
  ],
  [INTERVIEW_SCENARIO_ID]: [
    {
      id: APPLICATION_INTERVIEW_HAPPY_PATH_FALLBACK.path.id,
      name: APPLICATION_INTERVIEW_HAPPY_PATH_FALLBACK.path.name,
      description: APPLICATION_INTERVIEW_HAPPY_PATH_FALLBACK.path.description,
      path_type: APPLICATION_INTERVIEW_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
  [TECH_SETUP_SCENARIO_ID]: [
    {
      id: TECH_SETUP_HAPPY_PATH_FALLBACK.path.id,
      name: TECH_SETUP_HAPPY_PATH_FALLBACK.path.name,
      description: TECH_SETUP_HAPPY_PATH_FALLBACK.path.description,
      path_type: TECH_SETUP_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
  [ONBOARDING_MODULES_SCENARIO_ID]: [
    {
      id: ONBOARDING_MODULES_HAPPY_PATH_FALLBACK.path.id,
      name: ONBOARDING_MODULES_HAPPY_PATH_FALLBACK.path.name,
      description: ONBOARDING_MODULES_HAPPY_PATH_FALLBACK.path.description,
      path_type: ONBOARDING_MODULES_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
  [LESSON_MODULES_SCENARIO_ID]: [
    {
      id: LESSON_MODULES_HAPPY_PATH_FALLBACK.path.id,
      name: LESSON_MODULES_HAPPY_PATH_FALLBACK.path.name,
      description: LESSON_MODULES_HAPPY_PATH_FALLBACK.path.description,
      path_type: LESSON_MODULES_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
  [SESSION_SIGN_UP_SCENARIO_ID]: [
    {
      id: SESSION_SIGN_UP_HAPPY_PATH_FALLBACK.path.id,
      name: SESSION_SIGN_UP_HAPPY_PATH_FALLBACK.path.name,
      description: SESSION_SIGN_UP_HAPPY_PATH_FALLBACK.path.description,
      path_type: SESSION_SIGN_UP_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
  [STANDARD_SCHEDULING_SCENARIO_ID]: [
    {
      id: STANDARD_SCHEDULING_HAPPY_PATH_FALLBACK.path.id,
      name: STANDARD_SCHEDULING_HAPPY_PATH_FALLBACK.path.name,
      description: STANDARD_SCHEDULING_HAPPY_PATH_FALLBACK.path.description,
      path_type: STANDARD_SCHEDULING_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
  [FILL_IN_REQUEST_SCENARIO_ID]: [
    {
      id: FILL_IN_REQUEST_HAPPY_PATH_FALLBACK.path.id,
      name: FILL_IN_REQUEST_HAPPY_PATH_FALLBACK.path.name,
      description: FILL_IN_REQUEST_HAPPY_PATH_FALLBACK.path.description,
      path_type: FILL_IN_REQUEST_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
  [CALL_OFF_REQUEST_SCENARIO_ID]: [
    {
      id: CALL_OFF_REQUEST_HAPPY_PATH_FALLBACK.path.id,
      name: CALL_OFF_REQUEST_HAPPY_PATH_FALLBACK.path.name,
      description: CALL_OFF_REQUEST_HAPPY_PATH_FALLBACK.path.description,
      path_type: CALL_OFF_REQUEST_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
  [BEFORE_STUDENTS_JOIN_SCENARIO_ID]: [
    {
      id: BEFORE_STUDENTS_JOIN_HAPPY_PATH_FALLBACK.path.id,
      name: BEFORE_STUDENTS_JOIN_HAPPY_PATH_FALLBACK.path.name,
      description: BEFORE_STUDENTS_JOIN_HAPPY_PATH_FALLBACK.path.description,
      path_type: BEFORE_STUDENTS_JOIN_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
  [STUDENTS_JUST_JOINED_SCENARIO_ID]: [
    {
      id: STUDENTS_JUST_JOINED_HAPPY_PATH_FALLBACK.path.id,
      name: STUDENTS_JUST_JOINED_HAPPY_PATH_FALLBACK.path.name,
      description: STUDENTS_JUST_JOINED_HAPPY_PATH_FALLBACK.path.description,
      path_type: STUDENTS_JUST_JOINED_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
  [GOAL_SETTING_SCENARIO_ID]: [
    {
      id: GOAL_SETTING_HAPPY_PATH_FALLBACK.path.id,
      name: GOAL_SETTING_HAPPY_PATH_FALLBACK.path.name,
      description: GOAL_SETTING_HAPPY_PATH_FALLBACK.path.description,
      path_type: GOAL_SETTING_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
  [HELP_REQUEST_SCENARIO_ID]: [
    {
      id: HELP_REQUEST_HAPPY_PATH_FALLBACK.path.id,
      name: HELP_REQUEST_HAPPY_PATH_FALLBACK.path.name,
      description: HELP_REQUEST_HAPPY_PATH_FALLBACK.path.description,
      path_type: HELP_REQUEST_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
  [WRAP_UP_SCENARIO_ID]: [
    {
      id: WRAP_UP_HAPPY_PATH_FALLBACK.path.id,
      name: WRAP_UP_HAPPY_PATH_FALLBACK.path.name,
      description: WRAP_UP_HAPPY_PATH_FALLBACK.path.description,
      path_type: WRAP_UP_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
  [REPORTING_AN_ISSUE_SCENARIO_ID]: [
    {
      id: REPORTING_AN_ISSUE_HAPPY_PATH_FALLBACK.path.id,
      name: REPORTING_AN_ISSUE_HAPPY_PATH_FALLBACK.path.name,
      description: REPORTING_AN_ISSUE_HAPPY_PATH_FALLBACK.path.description,
      path_type: REPORTING_AN_ISSUE_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
  [REPORTING_HOURS_SCENARIO_ID]: [
    {
      id: REPORTING_HOURS_HAPPY_PATH_FALLBACK.path.id,
      name: REPORTING_HOURS_HAPPY_PATH_FALLBACK.path.name,
      description: REPORTING_HOURS_HAPPY_PATH_FALLBACK.path.description,
      path_type: REPORTING_HOURS_HAPPY_PATH_FALLBACK.path.path_type,
    },
  ],
}

const FALLBACK_BY_SCENARIO: Record<string, BlueprintData> = {
  [WARM_UP_SCENARIO_ID]: WARM_UP_HAPPY_PATH_FALLBACK,
  [DISCOVERY_SCENARIO_ID]: APPLICATION_HAPPY_PATH_FALLBACK,
  [INTERVIEW_SCENARIO_ID]: APPLICATION_INTERVIEW_HAPPY_PATH_FALLBACK,
  [TECH_SETUP_SCENARIO_ID]: TECH_SETUP_HAPPY_PATH_FALLBACK,
}

const EMPTY_FALLBACK_PATHS: Array<{
  id: string
  name: string
  description: string | null
  path_type: BlueprintData['path']['path_type']
}> = []

export function hasBlueprintFallback(scenarioId: string | undefined): boolean {
  if (!scenarioId) return false
  return (
    scenarioId in FALLBACK_BY_SCENARIO ||
    scenarioId in FALLBACK_PATHS_BY_SCENARIO
  )
}

export function getFallbackPathsForScenario(
  scenarioId: string | undefined,
): Array<{
  id: string
  name: string
  description: string | null
  path_type: BlueprintData['path']['path_type']
}> {
  if (!scenarioId) return EMPTY_FALLBACK_PATHS
  return FALLBACK_PATHS_BY_SCENARIO[scenarioId] ?? EMPTY_FALLBACK_PATHS
}

function withPathIdentity(
  data: BlueprintData,
  path: {
    id: string
    name: string
    description?: string | null
    path_type: BlueprintData['path']['path_type']
  },
): BlueprintData {
  return {
    ...data,
    path: {
      ...data.path,
      id: path.id,
      name: path.name,
      description: path.description ?? data.path.description,
      path_type: path.path_type,
    },
  }
}

export function hasRegisteredPathFallback(
  pathId: string | undefined | null,
): boolean {
  return Boolean(pathId && pathId in FALLBACK_BY_PATH)
}

export function getBlueprintFallback(
  scenarioId: string | undefined,
  pathId?: string | null,
  pathType?: BlueprintData['path']['path_type'],
): BlueprintData | null {
  let data: BlueprintData | null = null
  if (pathId && FALLBACK_BY_PATH[pathId]) {
    data = FALLBACK_BY_PATH[pathId]
  } else if (scenarioId && pathType) {
    const match = (FALLBACK_PATHS_BY_SCENARIO[scenarioId] ?? []).find(
      (path) => path.path_type === pathType,
    )
    if (match) {
      data = FALLBACK_BY_PATH[match.id] ?? null
    }
  }

  if (!data && scenarioId) {
    data = FALLBACK_BY_SCENARIO[scenarioId] ?? null
  }

  if (!data) return null

  const identity =
    pathId && pathType
      ? { id: pathId, name: data.path.name, path_type: pathType }
      : null

  return applyBlueprintDisplayFilters(
    identity ? withPathIdentity(data, identity) : data,
    scenarioId,
    pathId ?? data.path.id,
  )
}

export function getFallbackBlueprintsForScenarios(
  scenarioIds: string[],
): Map<string, BlueprintData> {
  const map = new Map<string, BlueprintData>()
  for (const id of scenarioIds) {
    const data = getBlueprintFallback(id)
    if (data) map.set(id, data)
  }
  return map
}
