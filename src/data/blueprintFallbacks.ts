import {
  WARM_UP_REGULAR_TUTOR_STEP_01_FRAME,
  WARM_UP_REGULAR_TUTOR_STEP_02_FRAME,
  WARM_UP_REGULAR_TUTOR_STEP_03_FRAME,
  WARM_UP_REGULAR_TUTOR_STEP_04_FRAME,
  WARM_UP_REGULAR_TUTOR_STEP_05_FRAME,
  WARM_UP_REGULAR_TUTOR_STEP_06_FRAME,
  WARM_UP_REGULAR_TUTOR_STEP_07_FRAME,
  WARM_UP_REGULAR_TUTOR_STEP_08_FRAME,
  WARM_UP_REGULAR_TUTOR_STEP_09_FRAME,
  WARM_UP_PLUS_APP_STEP_05_FRAME,
  WARM_UP_PLUS_APP_STEP_05_DESCRIPTION,
  WARM_UP_PLUS_APP_STEP_05_FIGMA_URL,
  WARM_UP_PLUS_APP_STEPS_6_7_9_FRAME,
  WARM_UP_PLUS_APP_STEP_06_DESCRIPTION,
  WARM_UP_PLUS_APP_STEP_07_DESCRIPTION,
  WARM_UP_PLUS_APP_STEP_09_DESCRIPTION,
  WARM_UP_PLUS_APP_STEPS_6_7_9_FIGMA_URL,
} from '@/data/warmUpFrames'
import { WARM_UP_REGULAR_TUTOR_ONBOARDING_LINKS } from '@/data/warmUpRegularTutorLinks'
import { applyBlueprintDisplayFilters } from '@/lib/applyBlueprintDisplayFilters'
import { mergeUrlLinks, techDescriptionLink } from '@/lib/blueprintTechDescriptions'
import { getScenarioParallelNote } from '@/lib/scenarioParallelInfo'
import { WARM_UP_SCENARIO_ID } from '@/data/parallelSessionScenarioIds'
import { ZOOM_TECH_LOGO } from '@/lib/blueprintTechPictures'
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
  GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
} from '@/data/goalSettingHappyPathFallback'
import {
  GOAL_SETTING_DETAILED_PATH_FALLBACK,
  GOAL_SETTING_DETAILED_PATH_ID,
} from '@/data/goalSettingDetailedPathFallback'
import {
  GOAL_SETTING_CHECK_GOALS_PATH_FALLBACK,
  GOAL_SETTING_CHECK_GOALS_PATH_ID,
} from '@/data/goalSettingCheckGoalsPathFallback'
import {
  GOAL_SETTING_UPDATE_GOALS_PATH_FALLBACK,
  GOAL_SETTING_UPDATE_GOALS_PATH_ID,
} from '@/data/goalSettingUpdateGoalsPathFallback'
import {
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PATH_FALLBACK,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PATH_ID,
} from '@/data/goalSettingSetGoalsEdgeCasePathFallback'
import {
  GOAL_SETTING_UPDATED_GOALS_EDGE_CASE_PATH_FALLBACK,
  GOAL_SETTING_UPDATED_GOALS_EDGE_CASE_PATH_ID,
} from '@/data/goalSettingUpdatedGoalsEdgeCasePathFallback'
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
  assignWarmUpAlternateCellLayerId,
  repairWarmUpAlternatePathBlueprint,
} from '@/lib/repairWarmUpAlternatePathBlueprint'
import {
  buildParallelSessionPartnerLeadCells,
  buildParallelSessionPartnerLeadDependencies,
} from '@/data/parallelSessionPartnerLead'
import {
  GOAL_SETTING_PARALLEL_LEAD_STEP_FRAMES,
  GOAL_SETTING_PARALLEL_PARTNER_STEP_FRAMES,
} from '@/data/goalSettingParallelSessionFrames'
import type {
  BlueprintCell,
  BlueprintCellDependency,
  BlueprintData,
} from '@/types/blueprint'

/** Warm-Up scenario from supabase/seed.sql */
export { WARM_UP_SCENARIO_ID }

export const WARM_UP_HAPPY_PATH_ID = 'a0000000-0000-4000-8000-000000000300'
export const WARM_UP_ALTERNATE_PATH_ID = 'a0000000-0000-4000-8000-000000000350'
/** Retained so any legacy DB row stays hidden from the Warm-Up UI. */
const WARM_UP_SAD_PATH_ID = 'a0000000-0000-4000-8000-000000000360'

const WARM_UP_STEP_3_ID = 'a0000000-0000-4000-8000-000000000313'

const PATH_ID = WARM_UP_HAPPY_PATH_ID

export const STEP_VISUAL_LAYER_ID =
  'a0000000-0000-4000-8000-000000000310'
const ALTERNATE_STEP_VISUAL_LAYER_ID =
  'a0000000-0000-4000-8000-000000000410'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Storyboard', position: 0 },
  { id: 'a0000000-0000-4000-8000-000000000301', name: 'Teacher', position: 1 },
  { id: 'a0000000-0000-4000-8000-000000000302', name: 'Lead Tutor', position: 2 },
  { id: 'a0000000-0000-4000-8000-000000000303', name: 'Regular Tutor', position: 3 },
  { id: 'a0000000-0000-4000-8000-000000000306', name: 'Front Stage Tech', position: 4 },
  { id: 'a0000000-0000-4000-8000-000000000304', name: 'Front Stage Actions', position: 5 },
  { id: 'a0000000-0000-4000-8000-000000000308', name: 'Back Stage Tech', position: 6 },
  { id: 'a0000000-0000-4000-8000-000000000307', name: 'Back Stage Actions', position: 7 },
  { id: 'a0000000-0000-4000-8000-000000000309', name: 'Support Actions', position: 8 },
] as const

const STEPS = [
  { id: 'a0000000-0000-4000-8000-000000000311', name: 'Enter Breakout Room', position: 1 },
  { id: 'a0000000-0000-4000-8000-000000000312', name: 'Greet Student', position: 2 },
  { id: 'a0000000-0000-4000-8000-000000000313', name: 'Ask Student to Share Screen', position: 3 },
  { id: 'a0000000-0000-4000-8000-000000000314', name: 'Remind Student They Can Ask for Help', position: 4 },
  { id: 'a0000000-0000-4000-8000-000000000315', name: 'Mark Student Present', position: 5 },
  { id: 'a0000000-0000-4000-8000-000000000316', name: 'Select Engagement level', position: 6 },
  { id: 'a0000000-0000-4000-8000-000000000317', name: 'Mark Student Helped', position: 7 },
  { id: 'a0000000-0000-4000-8000-000000000319', name: 'Leave Breakout Room', position: 8 },
  { id: 'a0000000-0000-4000-8000-000000000318', name: 'Move to Next Student', position: 9 },
] as const

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

const WARM_UP_HAPPY_TO_ALTERNATE_LAYER_ID: Record<string, string> = {
  [STEP_VISUAL_LAYER_ID]: ALTERNATE_STEP_VISUAL_LAYER_ID,
  [L.partner]: 'a0000000-0000-4000-8000-000000000401',
  [L.lead]: 'a0000000-0000-4000-8000-000000000402',
  [L.regular]: 'a0000000-0000-4000-8000-000000000403',
  'a0000000-0000-4000-8000-000000000304':
    'a0000000-0000-4000-8000-000000000404',
  [L.frontTech]: 'a0000000-0000-4000-8000-000000000406',
  'a0000000-0000-4000-8000-000000000307':
    'a0000000-0000-4000-8000-000000000407',
  'a0000000-0000-4000-8000-000000000308':
    'a0000000-0000-4000-8000-000000000408',
  [L.support]: 'a0000000-0000-4000-8000-000000000409',
}

function mapAlternatePathLayerId(laneId: string): string {
  return WARM_UP_HAPPY_TO_ALTERNATE_LAYER_ID[laneId] ?? laneId
}

const FRONT_STAGE_TECH_ZOOM_ONLY = 'Zoom'
const FRONT_STAGE_TECH_STEP = 'Zoom\nPLUS App'
const FRONT_STAGE_TECH_PLUS_APP_ONLY = 'PLUS App'
const SUPPORT_STEP = 'Dev Team\nDesign Team'
const WARM_UP_ZOOM_DESCRIPTION =
  'The tutor connects with student via Zoom in individual breakout room.'
const WARM_UP_ZOOM_SHARE_SCREEN_DESCRIPTION =
  'The student shares screen via Zoom screen share feature.'
const WARM_UP_ZOOM_LEAVE_BREAKOUT_DESCRIPTION =
  "The tutor leaves the student's Zoom breakout room."

const warmUpPartnerLeadOptions = {
  cellId: (stepSlot: string, layerSuffix: '01' | '02') =>
    `a0000000-0000-4000-8000-00000004${stepSlot}${layerSuffix}`,
  dependencyId: (slot: string) =>
    `a0000000-0000-4000-8000-00000005${slot}`,
  partnerLayerId: L.partner,
  leadLayerId: L.lead,
  stepIdForColumn: (column: number) => STEPS[column - 1]!.id,
  leadStepPictures: GOAL_SETTING_PARALLEL_LEAD_STEP_FRAMES,
  partnerStepPictures: GOAL_SETTING_PARALLEL_PARTNER_STEP_FRAMES,
}

function cell(
  id: string,
  laneId: string,
  stepId: string,
  content: string,
  metadata: Partial<
    Pick<BlueprintCell, 'frame' | 'summary' | 'links'>
  > = {},
): BlueprintCell {
  const links =
    laneId === L.regular
      ? mergeUrlLinks(
          metadata.links ?? [],
          WARM_UP_REGULAR_TUTOR_ONBOARDING_LINKS,
        )
      : (metadata.links ?? EMPTY_CELL_METADATA.links)

  return {
    id,
    lane_id: laneId,
    step_id: stepId,
    content,
    ...EMPTY_CELL_METADATA,
    ...metadata,
    links,
  }
}

function warmUpFrontStageTechCell(
  id: string,
  stepId: string,
  content: string,
  metadata: Partial<
    Pick<BlueprintCell, 'summary' | 'links'>
  > = {},
): BlueprintCell {
  return cell(
    id,
    L.frontTech,
    stepId,
    content,
    {
      ...(content.includes('Zoom') ? { frame: ZOOM_TECH_LOGO } : {}),
      ...metadata,
    },
  )
}

const WARM_UP_RT_TO_FRONT_TECH_STEP_SLOTS = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
] as const

const WARM_UP_ALTERNATE_RT_TO_FRONT_TECH_STEP_SLOTS = [
  '01',
  '02',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
] as const

function buildRegularTutorToFrontStageTechDependencies(
  cellPrefix: '04' | '06',
  dependencyPrefix: '05' | '07',
  idStart: number,
  stepSlots: readonly string[],
): BlueprintCellDependency[] {
  return stepSlots.map((step, index) => {
    const dependencySlot = String(idStart + index).padStart(4, '0')
    return {
      id: `a0000000-0000-4000-8000-000000${dependencyPrefix}${dependencySlot}`,
      source_cell_id: `a0000000-0000-4000-8000-000000${cellPrefix}${step}03`,
      target_cell_id: `a0000000-0000-4000-8000-000000${cellPrefix}${step}06`,
    }
  })
}

const WARM_UP_RT_TO_FRONT_TECH_TRIGGERS =
  buildRegularTutorToFrontStageTechDependencies(
    '04',
    '05',
    113,
    WARM_UP_RT_TO_FRONT_TECH_STEP_SLOTS,
  )

const WARM_UP_ALTERNATE_RT_TO_FRONT_TECH_TRIGGERS =
  buildRegularTutorToFrontStageTechDependencies(
    '06',
    '07',
    113,
    WARM_UP_ALTERNATE_RT_TO_FRONT_TECH_STEP_SLOTS,
  )

const WARM_UP_CELLS: BlueprintCell[] = [
  ...STEPS.map((step, stepIndex) =>
    cell(stepVisualCellId(stepIndex), L.stepVisual, step.id, ''),
  ),
  ...buildParallelSessionPartnerLeadCells(warmUpPartnerLeadOptions),
  cell('a0000000-0000-4000-8000-000000040103', L.regular, STEPS[0].id, 'Enter breakout room.', {
    frame: WARM_UP_REGULAR_TUTOR_STEP_01_FRAME,
  }),
  warmUpFrontStageTechCell(
    'a0000000-0000-4000-8000-000000040106',
    STEPS[0].id,
    FRONT_STAGE_TECH_ZOOM_ONLY,
    { summary: WARM_UP_ZOOM_DESCRIPTION },
  ),
  cell('a0000000-0000-4000-8000-000000040203', L.regular, STEPS[1].id, 'Greet student.', {
    frame: WARM_UP_REGULAR_TUTOR_STEP_02_FRAME,
  }),
  warmUpFrontStageTechCell(
    'a0000000-0000-4000-8000-000000040206',
    STEPS[1].id,
    FRONT_STAGE_TECH_ZOOM_ONLY,
    { summary: WARM_UP_ZOOM_DESCRIPTION },
  ),
  cell('a0000000-0000-4000-8000-000000040303', L.regular, STEPS[2].id, 'Ask them to share screen.', {
    frame: WARM_UP_REGULAR_TUTOR_STEP_03_FRAME,
  }),
  warmUpFrontStageTechCell(
    'a0000000-0000-4000-8000-000000040306',
    STEPS[2].id,
    FRONT_STAGE_TECH_ZOOM_ONLY,
    { summary: WARM_UP_ZOOM_SHARE_SCREEN_DESCRIPTION },
  ),
  cell(
    'a0000000-0000-4000-8000-000000040403',
    L.regular,
    STEPS[3].id,
    'Remind them that they can ask for help on content and support.',
    { frame: WARM_UP_REGULAR_TUTOR_STEP_04_FRAME },
  ),
  warmUpFrontStageTechCell(
    'a0000000-0000-4000-8000-000000040406',
    STEPS[3].id,
    FRONT_STAGE_TECH_ZOOM_ONLY,
    { summary: WARM_UP_ZOOM_DESCRIPTION },
  ),
  cell('a0000000-0000-4000-8000-000000040503', L.regular, STEPS[4].id, 'Mark them as present.', {
    frame: WARM_UP_REGULAR_TUTOR_STEP_05_FRAME,
  }),
  warmUpFrontStageTechCell(
    'a0000000-0000-4000-8000-000000040506',
    STEPS[4].id,
    FRONT_STAGE_TECH_STEP,
    {
      summary: WARM_UP_ZOOM_DESCRIPTION,
      links: [
        techDescriptionLink(
          'PLUS App',
          WARM_UP_PLUS_APP_STEP_05_DESCRIPTION,
          WARM_UP_PLUS_APP_STEP_05_FRAME,
          WARM_UP_PLUS_APP_STEP_05_FIGMA_URL,
        ),
      ],
    },
  ),
  cell('a0000000-0000-4000-8000-000000040509', L.support, STEPS[4].id, SUPPORT_STEP, {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell('a0000000-0000-4000-8000-000000040603', L.regular, STEPS[5].id, 'Select engagement level.', {
    frame: WARM_UP_REGULAR_TUTOR_STEP_06_FRAME,
  }),
  warmUpFrontStageTechCell(
    'a0000000-0000-4000-8000-000000040606',
    STEPS[5].id,
    FRONT_STAGE_TECH_STEP,
    {
      summary: WARM_UP_ZOOM_DESCRIPTION,
      links: [
        techDescriptionLink(
          'PLUS App',
          WARM_UP_PLUS_APP_STEP_06_DESCRIPTION,
          WARM_UP_PLUS_APP_STEPS_6_7_9_FRAME,
          WARM_UP_PLUS_APP_STEPS_6_7_9_FIGMA_URL,
        ),
      ],
    },
  ),
  cell('a0000000-0000-4000-8000-000000040609', L.support, STEPS[5].id, SUPPORT_STEP, {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell('a0000000-0000-4000-8000-000000040703', L.regular, STEPS[6].id, 'Mark them as helped.', {
    frame: WARM_UP_REGULAR_TUTOR_STEP_07_FRAME,
  }),
  warmUpFrontStageTechCell(
    'a0000000-0000-4000-8000-000000040706',
    STEPS[6].id,
    FRONT_STAGE_TECH_STEP,
    {
      summary: WARM_UP_ZOOM_DESCRIPTION,
      links: [
        techDescriptionLink(
          'PLUS App',
          WARM_UP_PLUS_APP_STEP_07_DESCRIPTION,
          WARM_UP_PLUS_APP_STEPS_6_7_9_FRAME,
          WARM_UP_PLUS_APP_STEPS_6_7_9_FIGMA_URL,
        ),
      ],
    },
  ),
  cell('a0000000-0000-4000-8000-000000040709', L.support, STEPS[6].id, SUPPORT_STEP, {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell('a0000000-0000-4000-8000-000000040803', L.regular, STEPS[7].id, 'Leave breakout room.', {
    frame: WARM_UP_REGULAR_TUTOR_STEP_08_FRAME,
  }),
  warmUpFrontStageTechCell(
    'a0000000-0000-4000-8000-000000040806',
    STEPS[7].id,
    FRONT_STAGE_TECH_ZOOM_ONLY,
    { summary: WARM_UP_ZOOM_LEAVE_BREAKOUT_DESCRIPTION },
  ),
  cell(
    'a0000000-0000-4000-8000-000000040903',
    L.regular,
    STEPS[8].id,
    'Move on to the next student in sorted order set by researchers.',
    { frame: WARM_UP_REGULAR_TUTOR_STEP_09_FRAME },
  ),
  cell(
    'a0000000-0000-4000-8000-000000040906',
    L.frontTech,
    STEPS[8].id,
    FRONT_STAGE_TECH_PLUS_APP_ONLY,
    {
      links: [
        techDescriptionLink(
          'PLUS App',
          WARM_UP_PLUS_APP_STEP_09_DESCRIPTION,
          WARM_UP_PLUS_APP_STEPS_6_7_9_FRAME,
          WARM_UP_PLUS_APP_STEPS_6_7_9_FIGMA_URL,
        ),
      ],
    },
  ),
  cell('a0000000-0000-4000-8000-000000040909', L.support, STEPS[8].id, SUPPORT_STEP, {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
]

const WARM_UP_TRIGGERS: BlueprintCellDependency[] = [
  ...buildParallelSessionPartnerLeadDependencies(warmUpPartnerLeadOptions),
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
    id: 'a0000000-0000-4000-8000-000000050108',
    source_cell_id: 'a0000000-0000-4000-8000-000000040803',
    target_cell_id: 'a0000000-0000-4000-8000-000000040903',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050112',
    source_cell_id: 'a0000000-0000-4000-8000-000000040903',
    target_cell_id: 'a0000000-0000-4000-8000-000000040103',
  },
  ...WARM_UP_RT_TO_FRONT_TECH_TRIGGERS,
]

export const WARM_UP_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: PATH_ID,
    name: 'Student shares screen',
    summary:
      'Engaged or partially engaged student warm-up.',
    note: getScenarioParallelNote(WARM_UP_SCENARIO_ID),
    kind: 'happy',
    status: 'live',
  },
  lanes: [...LAYERS],
  steps: [...STEPS],
  cells: WARM_UP_CELLS,
  dependencies: WARM_UP_TRIGGERS,
}

function mapHappyCellId(id: string): string {
  return id.replace('00000004', '00000006')
}

function mapHappyDependencyId(id: string): string {
  return id.replace('00000005', '00000007')
}

function isWarmUpPartnerOrLeadCell(cell: BlueprintCell): boolean {
  const suffix = cell.id.slice(-2)
  return suffix === '01' || suffix === '02'
}

const WARM_UP_ALTERNATE_STEPS = STEPS.filter(
  (step) => step.id !== WARM_UP_STEP_3_ID,
).map((step, index) => ({
  ...step,
  position: index + 1,
}))

const warmUpAlternatePartnerLeadOptions = {
  cellId: (stepSlot: string, layerSuffix: '01' | '02') =>
    `a0000000-0000-4000-8000-00000006${stepSlot}${layerSuffix}`,
  dependencyId: (slot: string) => `a0000000-0000-4000-8000-00000007${slot}`,
  partnerLayerId: mapAlternatePathLayerId(L.partner),
  leadLayerId: mapAlternatePathLayerId(L.lead),
  stepIdForColumn: (column: number) => WARM_UP_ALTERNATE_STEPS[column - 1]!.id,
  leadStepPictures: GOAL_SETTING_PARALLEL_LEAD_STEP_FRAMES,
  partnerStepPictures: GOAL_SETTING_PARALLEL_PARTNER_STEP_FRAMES,
}

function buildWarmUpAlternatePathCells(): BlueprintCell[] {
  const nonPartnerLeadCells = WARM_UP_CELLS.filter(
    (cell) =>
      !isWarmUpPartnerOrLeadCell(cell) &&
      cell.step_id !== WARM_UP_STEP_3_ID,
  ).map((cell) => ({
    ...cell,
    id: mapHappyCellId(cell.id),
    lane_id: mapAlternatePathLayerId(cell.lane_id),
  }))

  return [
    ...nonPartnerLeadCells.map(assignWarmUpAlternateCellLayerId),
    ...buildParallelSessionPartnerLeadCells(
      warmUpAlternatePartnerLeadOptions,
    ).map(assignWarmUpAlternateCellLayerId),
  ]
}

const WARM_UP_ALTERNATE_REGULAR_TUTOR_TRIGGER_IDS = new Set([
  'a0000000-0000-4000-8000-000000050101',
  'a0000000-0000-4000-8000-000000050102',
  'a0000000-0000-4000-8000-000000050103',
  'a0000000-0000-4000-8000-000000050104',
  'a0000000-0000-4000-8000-000000050105',
  'a0000000-0000-4000-8000-000000050106',
  'a0000000-0000-4000-8000-000000050107',
  'a0000000-0000-4000-8000-000000050108',
  'a0000000-0000-4000-8000-000000050112',
])

function buildWarmUpAlternatePathDependencies(): BlueprintCellDependency[] {
  const regularTutorDependencies = WARM_UP_TRIGGERS.filter(
    (dependency) =>
      WARM_UP_ALTERNATE_REGULAR_TUTOR_TRIGGER_IDS.has(dependency.id) &&
      dependency.id !== 'a0000000-0000-4000-8000-000000050102' &&
      dependency.id !== 'a0000000-0000-4000-8000-000000050103',
  ).map((dependency) => ({
    id: mapHappyDependencyId(dependency.id),
    source_cell_id: mapHappyCellId(dependency.source_cell_id),
    target_cell_id: mapHappyCellId(dependency.target_cell_id),
  }))

  return [
    ...buildParallelSessionPartnerLeadDependencies(warmUpAlternatePartnerLeadOptions),
    ...regularTutorDependencies,
    {
      id: 'a0000000-0000-4000-8000-000000070102',
      source_cell_id: 'a0000000-0000-4000-8000-000000060203',
      target_cell_id: 'a0000000-0000-4000-8000-000000060403',
    },
    ...WARM_UP_ALTERNATE_RT_TO_FRONT_TECH_TRIGGERS,
  ]
}

const WARM_UP_ALTERNATE_TRIGGERS: BlueprintCellDependency[] =
  buildWarmUpAlternatePathDependencies()

export const WARM_UP_ALTERNATE_PATH_FALLBACK: BlueprintData = {
  path: {
    id: WARM_UP_ALTERNATE_PATH_ID,
    name: 'No screen share',
    summary: 'Not engaged student warm-up.',
    note: getScenarioParallelNote(WARM_UP_SCENARIO_ID),
    kind: 'variant',
    status: 'live',
  },
  lanes: LAYERS.map((lane) => ({
    ...lane,
    id: mapAlternatePathLayerId(lane.id),
  })),
  steps: WARM_UP_ALTERNATE_STEPS,
  cells: buildWarmUpAlternatePathCells(),
  dependencies: WARM_UP_ALTERNATE_TRIGGERS,
}

const FALLBACK_BY_PATH: Record<string, BlueprintData> = {
  [WARM_UP_HAPPY_PATH_ID]: WARM_UP_HAPPY_PATH_FALLBACK,
  [WARM_UP_ALTERNATE_PATH_ID]: WARM_UP_ALTERNATE_PATH_FALLBACK,
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
  [GOAL_SETTING_DETAILED_PATH_ID]: GOAL_SETTING_DETAILED_PATH_FALLBACK,
  [GOAL_SETTING_CHECK_GOALS_PATH_ID]: GOAL_SETTING_CHECK_GOALS_PATH_FALLBACK,
  [GOAL_SETTING_UPDATE_GOALS_PATH_ID]: GOAL_SETTING_UPDATE_GOALS_PATH_FALLBACK,
  [GOAL_SETTING_SET_GOALS_EDGE_CASE_PATH_ID]:
    GOAL_SETTING_SET_GOALS_EDGE_CASE_PATH_FALLBACK,
  [GOAL_SETTING_UPDATED_GOALS_EDGE_CASE_PATH_ID]:
    GOAL_SETTING_UPDATED_GOALS_EDGE_CASE_PATH_FALLBACK,
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
    summary: string | null
    note: string | null
    kind: BlueprintData['path']['kind']
  }>
> = {
  [WARM_UP_SCENARIO_ID]: [
    {
      id: WARM_UP_HAPPY_PATH_FALLBACK.path.id,
      name: WARM_UP_HAPPY_PATH_FALLBACK.path.name,
      summary: WARM_UP_HAPPY_PATH_FALLBACK.path.summary,
      note: WARM_UP_HAPPY_PATH_FALLBACK.path.note,
      kind: WARM_UP_HAPPY_PATH_FALLBACK.path.kind,
    },
    {
      id: WARM_UP_ALTERNATE_PATH_FALLBACK.path.id,
      name: WARM_UP_ALTERNATE_PATH_FALLBACK.path.name,
      summary: WARM_UP_ALTERNATE_PATH_FALLBACK.path.summary,
      note: WARM_UP_ALTERNATE_PATH_FALLBACK.path.note,
      kind: WARM_UP_ALTERNATE_PATH_FALLBACK.path.kind,
    },
  ],
  [DISCOVERY_SCENARIO_ID]: [
    {
      id: APPLICATION_HAPPY_PATH_FALLBACK.path.id,
      name: APPLICATION_HAPPY_PATH_FALLBACK.path.name,
      summary: APPLICATION_HAPPY_PATH_FALLBACK.path.summary,
      note: APPLICATION_HAPPY_PATH_FALLBACK.path.note,
      kind: APPLICATION_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
  [INTERVIEW_SCENARIO_ID]: [
    {
      id: APPLICATION_INTERVIEW_HAPPY_PATH_FALLBACK.path.id,
      name: APPLICATION_INTERVIEW_HAPPY_PATH_FALLBACK.path.name,
      summary: APPLICATION_INTERVIEW_HAPPY_PATH_FALLBACK.path.summary,
      note: APPLICATION_INTERVIEW_HAPPY_PATH_FALLBACK.path.note,
      kind: APPLICATION_INTERVIEW_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
  [TECH_SETUP_SCENARIO_ID]: [
    {
      id: TECH_SETUP_HAPPY_PATH_FALLBACK.path.id,
      name: TECH_SETUP_HAPPY_PATH_FALLBACK.path.name,
      summary: TECH_SETUP_HAPPY_PATH_FALLBACK.path.summary,
      note: TECH_SETUP_HAPPY_PATH_FALLBACK.path.note,
      kind: TECH_SETUP_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
  [ONBOARDING_MODULES_SCENARIO_ID]: [
    {
      id: ONBOARDING_MODULES_HAPPY_PATH_FALLBACK.path.id,
      name: ONBOARDING_MODULES_HAPPY_PATH_FALLBACK.path.name,
      summary: ONBOARDING_MODULES_HAPPY_PATH_FALLBACK.path.summary,
      note: ONBOARDING_MODULES_HAPPY_PATH_FALLBACK.path.note,
      kind: ONBOARDING_MODULES_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
  [LESSON_MODULES_SCENARIO_ID]: [
    {
      id: LESSON_MODULES_HAPPY_PATH_FALLBACK.path.id,
      name: LESSON_MODULES_HAPPY_PATH_FALLBACK.path.name,
      summary: LESSON_MODULES_HAPPY_PATH_FALLBACK.path.summary,
      note: LESSON_MODULES_HAPPY_PATH_FALLBACK.path.note,
      kind: LESSON_MODULES_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
  [SESSION_SIGN_UP_SCENARIO_ID]: [
    {
      id: SESSION_SIGN_UP_HAPPY_PATH_FALLBACK.path.id,
      name: SESSION_SIGN_UP_HAPPY_PATH_FALLBACK.path.name,
      summary: SESSION_SIGN_UP_HAPPY_PATH_FALLBACK.path.summary,
      note: SESSION_SIGN_UP_HAPPY_PATH_FALLBACK.path.note,
      kind: SESSION_SIGN_UP_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
  [STANDARD_SCHEDULING_SCENARIO_ID]: [
    {
      id: STANDARD_SCHEDULING_HAPPY_PATH_FALLBACK.path.id,
      name: STANDARD_SCHEDULING_HAPPY_PATH_FALLBACK.path.name,
      summary: STANDARD_SCHEDULING_HAPPY_PATH_FALLBACK.path.summary,
      note: STANDARD_SCHEDULING_HAPPY_PATH_FALLBACK.path.note,
      kind: STANDARD_SCHEDULING_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
  [FILL_IN_REQUEST_SCENARIO_ID]: [
    {
      id: FILL_IN_REQUEST_HAPPY_PATH_FALLBACK.path.id,
      name: FILL_IN_REQUEST_HAPPY_PATH_FALLBACK.path.name,
      summary: FILL_IN_REQUEST_HAPPY_PATH_FALLBACK.path.summary,
      note: FILL_IN_REQUEST_HAPPY_PATH_FALLBACK.path.note,
      kind: FILL_IN_REQUEST_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
  [CALL_OFF_REQUEST_SCENARIO_ID]: [
    {
      id: CALL_OFF_REQUEST_HAPPY_PATH_FALLBACK.path.id,
      name: CALL_OFF_REQUEST_HAPPY_PATH_FALLBACK.path.name,
      summary: CALL_OFF_REQUEST_HAPPY_PATH_FALLBACK.path.summary,
      note: CALL_OFF_REQUEST_HAPPY_PATH_FALLBACK.path.note,
      kind: CALL_OFF_REQUEST_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
  [BEFORE_STUDENTS_JOIN_SCENARIO_ID]: [
    {
      id: BEFORE_STUDENTS_JOIN_HAPPY_PATH_FALLBACK.path.id,
      name: BEFORE_STUDENTS_JOIN_HAPPY_PATH_FALLBACK.path.name,
      summary: BEFORE_STUDENTS_JOIN_HAPPY_PATH_FALLBACK.path.summary,
      note: BEFORE_STUDENTS_JOIN_HAPPY_PATH_FALLBACK.path.note,
      kind: BEFORE_STUDENTS_JOIN_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
  [STUDENTS_JUST_JOINED_SCENARIO_ID]: [
    {
      id: STUDENTS_JUST_JOINED_HAPPY_PATH_FALLBACK.path.id,
      name: STUDENTS_JUST_JOINED_HAPPY_PATH_FALLBACK.path.name,
      summary: STUDENTS_JUST_JOINED_HAPPY_PATH_FALLBACK.path.summary,
      note: STUDENTS_JUST_JOINED_HAPPY_PATH_FALLBACK.path.note,
      kind: STUDENTS_JUST_JOINED_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
  [GOAL_SETTING_SCENARIO_ID]: [
    {
      id: GOAL_SETTING_HAPPY_PATH_FALLBACK.path.id,
      name: GOAL_SETTING_HAPPY_PATH_FALLBACK.path.name,
      summary: GOAL_SETTING_HAPPY_PATH_FALLBACK.path.summary,
      note: GOAL_SETTING_HAPPY_PATH_FALLBACK.path.note,
      kind: GOAL_SETTING_HAPPY_PATH_FALLBACK.path.kind,
    },
    {
      id: GOAL_SETTING_DETAILED_PATH_FALLBACK.path.id,
      name: GOAL_SETTING_DETAILED_PATH_FALLBACK.path.name,
      summary: GOAL_SETTING_DETAILED_PATH_FALLBACK.path.summary,
      note: GOAL_SETTING_DETAILED_PATH_FALLBACK.path.note,
      kind: GOAL_SETTING_DETAILED_PATH_FALLBACK.path.kind,
    },
    {
      id: GOAL_SETTING_CHECK_GOALS_PATH_FALLBACK.path.id,
      name: GOAL_SETTING_CHECK_GOALS_PATH_FALLBACK.path.name,
      summary: GOAL_SETTING_CHECK_GOALS_PATH_FALLBACK.path.summary,
      note: GOAL_SETTING_CHECK_GOALS_PATH_FALLBACK.path.note,
      kind: GOAL_SETTING_CHECK_GOALS_PATH_FALLBACK.path.kind,
    },
    {
      id: GOAL_SETTING_UPDATE_GOALS_PATH_FALLBACK.path.id,
      name: GOAL_SETTING_UPDATE_GOALS_PATH_FALLBACK.path.name,
      summary: GOAL_SETTING_UPDATE_GOALS_PATH_FALLBACK.path.summary,
      note: GOAL_SETTING_UPDATE_GOALS_PATH_FALLBACK.path.note,
      kind: GOAL_SETTING_UPDATE_GOALS_PATH_FALLBACK.path.kind,
    },
    {
      id: GOAL_SETTING_SET_GOALS_EDGE_CASE_PATH_FALLBACK.path.id,
      name: GOAL_SETTING_SET_GOALS_EDGE_CASE_PATH_FALLBACK.path.name,
      summary:
        GOAL_SETTING_SET_GOALS_EDGE_CASE_PATH_FALLBACK.path.summary,
      note: GOAL_SETTING_SET_GOALS_EDGE_CASE_PATH_FALLBACK.path.note,
      kind: GOAL_SETTING_SET_GOALS_EDGE_CASE_PATH_FALLBACK.path.kind,
    },
    {
      id: GOAL_SETTING_UPDATED_GOALS_EDGE_CASE_PATH_FALLBACK.path.id,
      name: GOAL_SETTING_UPDATED_GOALS_EDGE_CASE_PATH_FALLBACK.path.name,
      summary:
        GOAL_SETTING_UPDATED_GOALS_EDGE_CASE_PATH_FALLBACK.path.summary,
      note: GOAL_SETTING_UPDATED_GOALS_EDGE_CASE_PATH_FALLBACK.path.note,
      kind:
        GOAL_SETTING_UPDATED_GOALS_EDGE_CASE_PATH_FALLBACK.path.kind,
    },
  ],
  [HELP_REQUEST_SCENARIO_ID]: [
    {
      id: HELP_REQUEST_HAPPY_PATH_FALLBACK.path.id,
      name: HELP_REQUEST_HAPPY_PATH_FALLBACK.path.name,
      summary: HELP_REQUEST_HAPPY_PATH_FALLBACK.path.summary,
      note: HELP_REQUEST_HAPPY_PATH_FALLBACK.path.note,
      kind: HELP_REQUEST_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
  [WRAP_UP_SCENARIO_ID]: [
    {
      id: WRAP_UP_HAPPY_PATH_FALLBACK.path.id,
      name: WRAP_UP_HAPPY_PATH_FALLBACK.path.name,
      summary: WRAP_UP_HAPPY_PATH_FALLBACK.path.summary,
      note: WRAP_UP_HAPPY_PATH_FALLBACK.path.note,
      kind: WRAP_UP_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
  [REPORTING_AN_ISSUE_SCENARIO_ID]: [
    {
      id: REPORTING_AN_ISSUE_HAPPY_PATH_FALLBACK.path.id,
      name: REPORTING_AN_ISSUE_HAPPY_PATH_FALLBACK.path.name,
      summary: REPORTING_AN_ISSUE_HAPPY_PATH_FALLBACK.path.summary,
      note: REPORTING_AN_ISSUE_HAPPY_PATH_FALLBACK.path.note,
      kind: REPORTING_AN_ISSUE_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
  [REPORTING_HOURS_SCENARIO_ID]: [
    {
      id: REPORTING_HOURS_HAPPY_PATH_FALLBACK.path.id,
      name: REPORTING_HOURS_HAPPY_PATH_FALLBACK.path.name,
      summary: REPORTING_HOURS_HAPPY_PATH_FALLBACK.path.summary,
      note: REPORTING_HOURS_HAPPY_PATH_FALLBACK.path.note,
      kind: REPORTING_HOURS_HAPPY_PATH_FALLBACK.path.kind,
    },
  ],
}

const FALLBACK_BY_SCENARIO: Record<string, BlueprintData> = {
  [WARM_UP_SCENARIO_ID]: WARM_UP_HAPPY_PATH_FALLBACK,
  [DISCOVERY_SCENARIO_ID]: APPLICATION_HAPPY_PATH_FALLBACK,
  [INTERVIEW_SCENARIO_ID]: APPLICATION_INTERVIEW_HAPPY_PATH_FALLBACK,
  [TECH_SETUP_SCENARIO_ID]: TECH_SETUP_HAPPY_PATH_FALLBACK,
  [ONBOARDING_MODULES_SCENARIO_ID]: ONBOARDING_MODULES_HAPPY_PATH_FALLBACK,
  [LESSON_MODULES_SCENARIO_ID]: LESSON_MODULES_HAPPY_PATH_FALLBACK,
  [SESSION_SIGN_UP_SCENARIO_ID]: SESSION_SIGN_UP_HAPPY_PATH_FALLBACK,
}

const EMPTY_FALLBACK_PATHS: Array<{
  id: string
  name: string
  summary: string | null
  note: string | null
  kind: BlueprintData['path']['kind']
}> = []

export function hasBlueprintFallback(scenarioId: string | undefined): boolean {
  if (!scenarioId) return false
  return (
    scenarioId in FALLBACK_BY_SCENARIO ||
    scenarioId in FALLBACK_PATHS_BY_SCENARIO
  )
}

/** Paths hidden from pickers/grids until the scenario is ready in the UI. */
const UI_HIDDEN_PATH_IDS_BY_SCENARIO: Record<string, readonly string[]> = {
  [DISCOVERY_SCENARIO_ID]: [APPLICATION_SAD_PATH_ID],
  [WARM_UP_SCENARIO_ID]: [WARM_UP_SAD_PATH_ID],
}

export function filterPathsForScenarioUi<T extends { id: string }>(
  scenarioId: string | undefined,
  paths: readonly T[],
): T[] {
  if (!scenarioId) return [...paths]
  const hidden = UI_HIDDEN_PATH_IDS_BY_SCENARIO[scenarioId]
  if (!hidden?.length) return [...paths]
  const hiddenIds = new Set(hidden)
  return paths.filter((path) => !hiddenIds.has(path.id))
}

/** Union DB paths with registered fallback paths missing from the database. */
export function mergePathsWithFallback<
  T extends {
    id: string
    name: string
    summary: string | null
    note: string | null
    kind: BlueprintData['path']['kind']
  },
>(scenarioId: string | undefined, paths: readonly T[]): T[] {
  const fallbackPaths = getFallbackPathsForScenario(scenarioId)
  if (!scenarioId || fallbackPaths.length === 0) {
    return filterPathsForScenarioUi(scenarioId, paths)
  }

  const merged = new Map(
    filterPathsForScenarioUi(scenarioId, paths).map((path) => [path.id, path]),
  )
  for (const fallbackPath of fallbackPaths) {
    const existing = merged.get(fallbackPath.id)
    if (existing) {
      merged.set(fallbackPath.id, {
        ...existing,
        name: fallbackPath.name,
        summary: fallbackPath.summary,
        note: fallbackPath.note ?? existing.note,
      })
    } else {
      const hasPathOfType = [...merged.values()].some(
        (path) => path.kind === fallbackPath.kind,
      )
      if (!hasPathOfType) {
        merged.set(fallbackPath.id, fallbackPath as T)
      }
    }
  }

  const order = fallbackPaths.map((path) => path.id)
  return [...merged.values()].sort((a, b) => {
    const aIndex = order.indexOf(a.id)
    const bIndex = order.indexOf(b.id)
    if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })
}

export function getFallbackPathsForScenario(
  scenarioId: string | undefined,
): Array<{
  id: string
  name: string
  summary: string | null
  note: string | null
  kind: BlueprintData['path']['kind']
}> {
  if (!scenarioId) return EMPTY_FALLBACK_PATHS
  return filterPathsForScenarioUi(
    scenarioId,
    FALLBACK_PATHS_BY_SCENARIO[scenarioId] ?? EMPTY_FALLBACK_PATHS,
  )
}

function withPathIdentity(
  data: BlueprintData,
  path: {
    id: string
    name: string
    summary?: string | null
    note?: string | null
    kind: BlueprintData['path']['kind']
  },
): BlueprintData {
  return {
    ...data,
    path: {
      ...data.path,
      id: path.id,
      name: path.name,
      summary: path.summary ?? data.path.summary,
      note: path.note ?? data.path.note,
      kind: path.kind,
    },
  }
}

export function hasRegisteredPathFallback(
  pathId: string | undefined | null,
): boolean {
  return Boolean(pathId && pathId in FALLBACK_BY_PATH)
}

export function getRawBlueprintFallback(
  scenarioId: string | undefined,
  pathId?: string | null,
  pathKind?: BlueprintData['path']['kind'],
): BlueprintData | null {
  let data: BlueprintData | null = null
  if (pathId && FALLBACK_BY_PATH[pathId]) {
    data = FALLBACK_BY_PATH[pathId]
  } else if (scenarioId && pathKind) {
    const match = (FALLBACK_PATHS_BY_SCENARIO[scenarioId] ?? []).find(
      (path) => path.kind === pathKind,
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
    pathId && pathKind
      ? { id: pathId, name: data.path.name, kind: pathKind }
      : null

  return identity ? withPathIdentity(data, identity) : data
}

export function getBlueprintFallback(
  scenarioId: string | undefined,
  pathId?: string | null,
  pathKind?: BlueprintData['path']['kind'],
): BlueprintData | null {
  const data = getRawBlueprintFallback(scenarioId, pathId, pathKind)
  if (!data) return null

  const resolvedPathId = pathId ?? data.path.id
  const repaired =
    resolvedPathId === WARM_UP_ALTERNATE_PATH_ID
      ? repairWarmUpAlternatePathBlueprint(data)
      : data

  return applyBlueprintDisplayFilters(
    repaired,
    scenarioId,
    resolvedPathId,
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
