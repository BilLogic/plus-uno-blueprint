import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import { GOAL_SETTING_SCENARIO_ID } from '@/data/parallelSessionScenarioIds'
import {
  GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  SUPPORT_ACTIONS_DESCRIPTION,
} from '@/data/supportActionsCopy'
import { techDescriptionLink, mergeUrlLinks } from '@/lib/blueprintTechDescriptions'
import { GOAL_SETTING_REGULAR_TUTOR_ONBOARDING_LINKS } from '@/data/goalSettingRegularTutorLinks'
import {
  buildParallelSessionPartnerLeadCells,
  buildParallelSessionPartnerLeadDependencies,
} from '@/data/parallelSessionPartnerLead'
import {
  GOAL_SETTING_PARALLEL_LEAD_STEP_FRAMES,
  GOAL_SETTING_PARALLEL_PARTNER_STEP_FRAMES,
  GOAL_SETTING_HAPPY_REGULAR_TUTOR_STEP_01_FRAME,
  GOAL_SETTING_HAPPY_REGULAR_TUTOR_STEP_02_FRAME,
  GOAL_SETTING_HAPPY_REGULAR_TUTOR_STEP_03_FRAME,
  GOAL_SETTING_HAPPY_REGULAR_TUTOR_STEP_04_FRAME,
  GOAL_SETTING_HAPPY_REGULAR_TUTOR_STEP_05_FRAME,
  GOAL_SETTING_HAPPY_REGULAR_TUTOR_STEP_06_FRAME,
  GOAL_SETTING_HAPPY_REGULAR_TUTOR_STEP_07_FRAME,
  GOAL_SETTING_HAPPY_PATH_PLUS_APP_STEP_02_FRAME,
  GOAL_SETTING_HAPPY_PATH_PLUS_APP_STEP_03_FRAME,
  GOAL_SETTING_HAPPY_PATH_PLUS_APP_STEP_04_FRAME,
  GOAL_SETTING_HAPPY_PATH_PLUS_APP_STEP_05_FRAME,
  GOAL_SETTING_HAPPY_PATH_PLUS_APP_STEP_07_FRAME,
  GOAL_SETTING_HAPPY_PATH_PLUS_APP_FIGMA_URL,
} from '@/data/goalSettingParallelSessionFrames'
import type {
  BlueprintCell,
  BlueprintCellDependency,
  BlueprintData,
} from '@/types/blueprint'

export { GOAL_SETTING_SCENARIO_ID, SUPPORT_ACTIONS_DESCRIPTION }
export { GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION }

export const GOAL_SETTING_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-00000000080c'

const STEP_STORYBOARD_LANE_ID = 'a0000000-0000-4000-8000-000000000850'

const LANES = [
  { id: STEP_STORYBOARD_LANE_ID, name: 'Storyboard', position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000857',
    name: 'Teacher',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000858',
    name: 'Lead Tutor',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000851',
    name: 'Regular Tutor',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000853',
    name: 'Front Stage Tech',
    position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000852',
    name: 'Front Stage Actions',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000855',
    name: 'Back Stage Tech',
    position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000854',
    name: 'Back Stage Actions',
    position: 7,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000856',
    name: 'Support Actions',
    position: 8,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000970',
    name: 'Join breakout session',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000971',
    name: 'Share screen',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000972',
    name: 'Set or check goal',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000973',
    name: 'Complete goal strategy',
    position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000984',
    name: 'Finalize goal activity with student',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000985',
    name: 'Leave breakout room',
    position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000974',
    name: 'Next student',
    position: 7,
  },
] as const

const L = {
  storyboard: STEP_STORYBOARD_LANE_ID,
  partner: 'a0000000-0000-4000-8000-000000000857',
  lead: 'a0000000-0000-4000-8000-000000000858',
  regular: 'a0000000-0000-4000-8000-000000000851',
  frontStage: 'a0000000-0000-4000-8000-000000000852',
  frontStageTech: 'a0000000-0000-4000-8000-000000000853',
  backStage: 'a0000000-0000-4000-8000-000000000854',
  backStageTech: 'a0000000-0000-4000-8000-000000000855',
  support: 'a0000000-0000-4000-8000-000000000856',
} as const

const GOAL_SETTING_HAPPY_PATH_ZOOM_DESCRIPTIONS = [
  'The tutor connects with student via Zoom in individual breakout room.',
  'The tutor shares screen via Zoom screen share feature.',
  'The tutor connects with student via Zoom in individual breakout room.',
  'The tutor connects with student via Zoom in individual breakout room.',
  'The tutor connects with student via Zoom in individual breakout room.',
  "The tutor leaves the student's Zoom breakout room."
] as const

const GOAL_SETTING_HAPPY_PATH_PLUS_APP_DESCRIPTIONS = [
  'The tutor shares the initial goal setting screen in the PLUS app, which is dependent on the point in the goal cycle the session is in.',
  'The tutor fills out the update, check, or set goals modal in the PLUS app with the student.',
  'If prompted, the tutor fills out the goal achievement strategy form in the PLUS app with the student.',
  'The tutor saves the goal activity with the student in the PLUS app.',
  'The tutor navigates back to the Student Dashboard screen in the PLUS app to move on to the student on the researcher sorted list.',
] as const

function happyPathPlusAppLink(
  description: string,
  frame: string,
): ReturnType<typeof techDescriptionLink> {
  return techDescriptionLink(
    'PLUS App',
    description,
    frame,
    GOAL_SETTING_HAPPY_PATH_PLUS_APP_FIGMA_URL,
  )
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
          GOAL_SETTING_REGULAR_TUTOR_ONBOARDING_LINKS,
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

export const GOAL_SETTING_HAPPY_PATH_RT_STEP_FRAMES = {
  joinBreakoutSession: GOAL_SETTING_HAPPY_REGULAR_TUTOR_STEP_01_FRAME,
  shareScreen: GOAL_SETTING_HAPPY_REGULAR_TUTOR_STEP_02_FRAME,
} as const

function gsCell(stepSlot: string, laneSuffix: string): string {
  return `a0000000-0000-4000-8000-0000001a${stepSlot}${laneSuffix}`
}

function gsDependency(dependencySlot: string): string {
  return `a0000000-0000-4000-8000-000000098${dependencySlot}`
}

function dependency(
  slot: string,
  fromStep: string,
  fromLane: string,
  toStep: string,
  toLane: string,
): BlueprintCellDependency {
  return {
    id: gsDependency(slot),
    source_cell_id: gsCell(fromStep, fromLane),
    target_cell_id: gsCell(toStep, toLane),
  }
}

function rowDependencies(
  lane: string,
  idStart: number,
  count: number,
): BlueprintCellDependency[] {
  const dependencies: BlueprintCellDependency[] = []
  for (let i = 0; i < count; i++) {
    const from = String(i + 1).padStart(2, '0')
    const to = String(i + 2).padStart(2, '0')
    dependencies.push(
      dependency(
        String(idStart + i).padStart(3, '0'),
        from,
        lane,
        to,
        lane,
      ),
    )
  }
  return dependencies
}

function columnLaneDependencies(
  fromLane: string,
  toLane: string,
  idStart: number,
  stepCount: number,
): BlueprintCellDependency[] {
  const dependencies: BlueprintCellDependency[] = []
  for (let i = 0; i < stepCount; i++) {
    const step = String(i + 1).padStart(2, '0')
    dependencies.push(
      dependency(
        String(idStart + i).padStart(3, '0'),
        step,
        fromLane,
        step,
        toLane,
      ),
    )
  }
  return dependencies
}

const partnerLeadOptions = {
  cellId: (stepSlot: string, laneSuffix: '01' | '02') =>
    gsCell(stepSlot, laneSuffix),
  dependencyId: (slot: string) => gsDependency(slot),
  partnerLaneId: L.partner,
  leadLaneId: L.lead,
  stepIdForColumn: (column: number) => STEPS[column - 1]!.id,
  leadStepPictures: GOAL_SETTING_PARALLEL_LEAD_STEP_FRAMES,
  partnerStepPictures: GOAL_SETTING_PARALLEL_PARTNER_STEP_FRAMES,
}

const GOAL_SETTING_TRIGGERS: BlueprintCellDependency[] = [
  ...buildParallelSessionPartnerLeadDependencies(partnerLeadOptions),
  ...rowDependencies('03', 50, 6),
  ...columnLaneDependencies('03', '06', 61, 7),
  dependency('060', '07', '03', '01', '03'),
]

const GOAL_SETTING_CELLS: BlueprintCell[] = [
  ...STEPS.map((step, index) =>
    cell(gsCell(String(index + 1).padStart(2, '0'), '10'), L.storyboard, step.id, ''),
  ),
  ...buildParallelSessionPartnerLeadCells(partnerLeadOptions),

  cell(gsCell('01', '03'), L.regular, STEPS[0].id, 'Join breakout session.', {
    frame: GOAL_SETTING_HAPPY_PATH_RT_STEP_FRAMES.joinBreakoutSession,
  }),
  cell(gsCell('02', '03'), L.regular, STEPS[1].id, 'Share screen.', {
    frame: GOAL_SETTING_HAPPY_PATH_RT_STEP_FRAMES.shareScreen,
  }),
  cell(
    gsCell('03', '03'),
    L.regular,
    STEPS[2].id,
    'Update, check, or set goal depending on point in the goal cycle.',
    { frame: GOAL_SETTING_HAPPY_REGULAR_TUTOR_STEP_03_FRAME },
  ),
  cell(
    gsCell('04', '03'),
    L.regular,
    STEPS[3].id,
    'If prompted, complete goal achievement strategy with student.',
    { frame: GOAL_SETTING_HAPPY_REGULAR_TUTOR_STEP_04_FRAME },
  ),
  cell(
    gsCell('05', '03'),
    L.regular,
    STEPS[4].id,
    'Finalize goal activity with student.',
    { frame: GOAL_SETTING_HAPPY_REGULAR_TUTOR_STEP_05_FRAME },
  ),
  cell(gsCell('06', '03'), L.regular, STEPS[5].id, 'Leave breakout room.', {
    frame: GOAL_SETTING_HAPPY_REGULAR_TUTOR_STEP_06_FRAME,
  }),
  cell(
    gsCell('07', '03'),
    L.regular,
    STEPS[6].id,
    'Move on to the next student in sorted order set by researchers.',
    { frame: GOAL_SETTING_HAPPY_REGULAR_TUTOR_STEP_07_FRAME },
  ),

  cell(gsCell('01', '06'), L.frontStageTech, STEPS[0].id, 'Zoom', {
    summary: GOAL_SETTING_HAPPY_PATH_ZOOM_DESCRIPTIONS[0],
  }),
  cell(gsCell('02', '06'), L.frontStageTech, STEPS[1].id, 'Zoom, PLUS App', {
    summary: GOAL_SETTING_HAPPY_PATH_ZOOM_DESCRIPTIONS[1],
    links: [happyPathPlusAppLink(
      GOAL_SETTING_HAPPY_PATH_PLUS_APP_DESCRIPTIONS[0],
      GOAL_SETTING_HAPPY_PATH_PLUS_APP_STEP_02_FRAME,
    )],
  }),
  cell(gsCell('03', '06'), L.frontStageTech, STEPS[2].id, 'Zoom, PLUS App', {
    summary: GOAL_SETTING_HAPPY_PATH_ZOOM_DESCRIPTIONS[2],
    links: [happyPathPlusAppLink(
      GOAL_SETTING_HAPPY_PATH_PLUS_APP_DESCRIPTIONS[1],
      GOAL_SETTING_HAPPY_PATH_PLUS_APP_STEP_03_FRAME,
    )],
  }),
  cell(gsCell('04', '06'), L.frontStageTech, STEPS[3].id, 'Zoom, PLUS App', {
    summary: GOAL_SETTING_HAPPY_PATH_ZOOM_DESCRIPTIONS[3],
    links: [happyPathPlusAppLink(
      GOAL_SETTING_HAPPY_PATH_PLUS_APP_DESCRIPTIONS[2],
      GOAL_SETTING_HAPPY_PATH_PLUS_APP_STEP_04_FRAME,
    )],
  }),
  cell(
    gsCell('05', '06'),
    L.frontStageTech,
    STEPS[4].id,
    'Zoom, PLUS App',
    {
      summary: GOAL_SETTING_HAPPY_PATH_ZOOM_DESCRIPTIONS[4],
      links: [happyPathPlusAppLink(
        GOAL_SETTING_HAPPY_PATH_PLUS_APP_DESCRIPTIONS[3],
        GOAL_SETTING_HAPPY_PATH_PLUS_APP_STEP_05_FRAME,
      )],
    },
  ),
  cell(gsCell('06', '06'), L.frontStageTech, STEPS[5].id, 'Zoom', {
    summary: GOAL_SETTING_HAPPY_PATH_ZOOM_DESCRIPTIONS[5],
  }),
  cell(gsCell('07', '06'), L.frontStageTech, STEPS[6].id, 'PLUS App', {
    links: [happyPathPlusAppLink(
      GOAL_SETTING_HAPPY_PATH_PLUS_APP_DESCRIPTIONS[4],
      GOAL_SETTING_HAPPY_PATH_PLUS_APP_STEP_07_FRAME,
    )],
  }),

  cell(
    gsCell('03', '07'),
    L.backStage,
    STEPS[2].id,
    'Researcher sets goal setting activities.',
  ),
  cell(
    gsCell('04', '07'),
    L.backStage,
    STEPS[3].id,
    'Researcher sets goal setting activities.',
  ),
  cell(
    gsCell('05', '07'),
    L.backStage,
    STEPS[4].id,
    'Researcher sets goal setting activities.',
  ),
  cell(
    gsCell('07', '07'),
    L.backStage,
    STEPS[6].id,
    'Researcher sets student order.',
  ),

  cell(gsCell('02', '09'), L.support, STEPS[1].id, 'Dev Team\nDesign Team', {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(gsCell('03', '09'), L.support, STEPS[2].id, 'Dev Team\nDesign Team', {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(gsCell('04', '09'), L.support, STEPS[3].id, 'Dev Team\nDesign Team', {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(gsCell('05', '09'), L.support, STEPS[4].id, 'Dev Team\nDesign Team', {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(gsCell('07', '09'), L.support, STEPS[6].id, 'Dev Team\nDesign Team', {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
]

export const GOAL_SETTING_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: GOAL_SETTING_HAPPY_PATH_ID,
    name: 'All conditions',
    summary:
      'General overview of tutors guiding students through goal-setting activities in breakout sessions. For a more detailed look at the activities, see the other paths in this scenario.',
    // A path's note is what is true of THAT route. Whether this scenario runs
    // beside others is true of every route in it, so it lives on the scenario
    // now — `scenarios.note` — and no longer here, where six sibling paths
    // each carried the same sentence with nothing making them agree
    // (#326 S6, 20260905130000).
    note: null,
    kind: 'happy',
    status: 'live',
  },
  lanes: [...LANES],
  steps: [...STEPS],
  cells: GOAL_SETTING_CELLS,
  dependencies: GOAL_SETTING_TRIGGERS,
}
