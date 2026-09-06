import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import { getScenarioParallelNote } from '@/lib/scenarioParallelInfo'
import { techDescriptionLink, mergeUrlLinks } from '@/lib/blueprintTechDescriptions'
import { GOAL_SETTING_REGULAR_TUTOR_ONBOARDING_LINKS } from '@/data/goalSettingRegularTutorLinks'
import {
  buildParallelSessionPartnerLeadCells,
  buildParallelSessionPartnerLeadDependencies,
} from '@/data/parallelSessionPartnerLead'
import {
  GOAL_SETTING_PARALLEL_LEAD_STEP_FRAMES,
  GOAL_SETTING_PARALLEL_PARTNER_STEP_FRAMES,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_01_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_02_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_03_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_04_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_05_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_06_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_07_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_08_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_09_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_10_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_11_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_12_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_02_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_03_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_04_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_06_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_07_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_08_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_09_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_10_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_12_FRAME,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEPS_2_3_FIGMA_URL,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_04_FIGMA_URL,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_06_FIGMA_URL,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEPS_7_8_9_FIGMA_URL,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_10_FIGMA_URL,
  GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_12_FIGMA_URL,
} from '@/data/goalSettingParallelSessionFrames'
import {
  GOAL_SETTING_SCENARIO_ID,
  GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
} from '@/data/goalSettingHappyPathFallback'
import type {
  BlueprintCell,
  BlueprintCellDependency,
  BlueprintData,
} from '@/types/blueprint'

export { GOAL_SETTING_SCENARIO_ID }

export const GOAL_SETTING_SET_GOALS_EDGE_CASE_PATH_ID =
  'a0000000-0000-4000-8000-000000000816'

const STEP_STORYBOARD_LANE_ID = 'a0000000-0000-4000-8000-0000000008e0'

const LANES = [
  { id: STEP_STORYBOARD_LANE_ID, name: 'Storyboard', position: 0 },
  {
    id: 'a0000000-0000-4000-8000-0000000008e1',
    name: 'Teacher',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-0000000008e2',
    name: 'Lead Tutor',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-0000000008e3',
    name: 'Regular Tutor',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-0000000008e4',
    name: 'Front Stage Tech',
    position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-0000000008e5',
    name: 'Front Stage Actions',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-0000000008e7',
    name: 'Back Stage Tech',
    position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-0000000008e6',
    name: 'Back Stage Actions',
    position: 7,
  },
  {
    id: 'a0000000-0000-4000-8000-0000000008e8',
    name: 'Support Actions',
    position: 8,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000009f01',
    name: 'Join breakout session',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000009f02',
    name: "Sees action color in dashboard is warning and CTA copy is 'Set Goals' within a mid-cycle goal check-in session.",
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000009f03',
    name: "Click on 'Set Goals' CTA in the action column",
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000009f04',
    name: 'Share screen',
    position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000009f05',
    name: 'Explain to student what goal setting is',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000009f06',
    name: 'Once student understands, starts setting first goal while sharing screen',
    position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-000000009f07',
    name: 'Fill out goal settings and quantity with the student',
    position: 7,
  },
  {
    id: 'a0000000-0000-4000-8000-000000009f08',
    name: 'If prompted, fill out goal achievement strategy with the student',
    position: 8,
  },
  {
    id: 'a0000000-0000-4000-8000-000000009f09',
    name: 'Save goal',
    position: 9,
  },
  {
    id: 'a0000000-0000-4000-8000-000000009f0a',
    name: 'Finalize goal setting with student',
    position: 10,
  },
  {
    id: 'a0000000-0000-4000-8000-000000009f0b',
    name: 'Leave breakout room',
    position: 11,
  },
  {
    id: 'a0000000-0000-4000-8000-000000009f0c',
    name: 'Move on to the next student in sorted order set by researchers',
    position: 12,
  },
] as const

const L = {
  storyboard: STEP_STORYBOARD_LANE_ID,
  partner: 'a0000000-0000-4000-8000-0000000008e1',
  lead: 'a0000000-0000-4000-8000-0000000008e2',
  regular: 'a0000000-0000-4000-8000-0000000008e3',
  frontStageTech: 'a0000000-0000-4000-8000-0000000008e4',
  backStage: 'a0000000-0000-4000-8000-0000000008e6',
  support: 'a0000000-0000-4000-8000-0000000008e8',
} as const

const SUPPORT_DEV_DESIGN = 'Dev Team\nDesign Team'
const BACKSTAGE_RESEARCHERS = 'Researchers set goal setting activities.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_02_DESCRIPTION =
  'The tutor views the Student Dashboard screen in the PLUS app during a mid-cycle goal check-in session and sees the warning action color with a Set Goals CTA for a student who has not yet set goals.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_03_DESCRIPTION =
  'The tutor clicks the Set Goals CTA in the Action column in the PLUS app for the student they are working with.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_04_DESCRIPTION =
  'The tutor shares the set goals modal in the PLUS app with the student while screen sharing, which displays the student\'s goal cycle information and indicates no goals have been set yet.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_06_DESCRIPTION =
  'The tutor starts setting the student\'s first goals in the PLUS app while sharing their screen, filling out effort goal settings, progress goal settings, and goal achievement strategy.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_07_DESCRIPTION =
  'The tutor fills out effort and progress goal settings and quantities with the student in the PLUS app.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_08_DESCRIPTION =
  'If prompted, the tutor fills out the goal achievement strategy with the student in the PLUS app.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_09_DESCRIPTION =
  'The tutor saves the goal with the student in the PLUS app.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_10_DESCRIPTION =
  'The tutor finalizes goal setting with the student in the PLUS app, reviewing the saved effort and progress goals and goal achievement strategy summary.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_12_DESCRIPTION =
  'The tutor navigates back to the Student Dashboard screen in the PLUS app to move on to the next student in the researcher sorted list.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_01_DESCRIPTION =
  'The tutor connects with student via Zoom in individual breakout room.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_04_DESCRIPTION =
  'The tutor shares screen via Zoom screen share feature.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_05_DESCRIPTION =
  'The tutor connects with student via Zoom in individual breakout room.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_06_DESCRIPTION =
  'The tutor connects with student via Zoom in individual breakout room.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_07_DESCRIPTION =
  'The tutor connects with student via Zoom in individual breakout room.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_08_DESCRIPTION =
  'The tutor connects with student via Zoom in individual breakout room.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_09_DESCRIPTION =
  'The tutor connects with student via Zoom in individual breakout room.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_10_DESCRIPTION =
  'The tutor connects with student via Zoom in individual breakout room.'

const GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_11_DESCRIPTION =
  "The tutor leaves the student's Zoom breakout room."

function setGoalsEdgeCasePlusAppLink(
  description: string,
  frame: string,
  figmaUrl: string,
): ReturnType<typeof techDescriptionLink> {
  return techDescriptionLink('PLUS App', description, frame, figmaUrl)
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

function geCell(stepSlot: string, laneSuffix: string): string {
  return `a0000000-0000-4000-8000-000000c0${stepSlot}${laneSuffix}`
}

function geDependency(dependencySlot: string): string {
  return `a0000000-0000-4000-8000-00000009f${dependencySlot}`
}

function dependency(
  slot: string,
  fromStep: string,
  fromLane: string,
  toStep: string,
  toLane: string,
): BlueprintCellDependency {
  return {
    id: geDependency(slot),
    source_cell_id: geCell(fromStep, fromLane),
    target_cell_id: geCell(toStep, toLane),
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
    geCell(stepSlot, laneSuffix),
  dependencyId: (slot: string) => geDependency(slot),
  partnerLaneId: L.partner,
  leadLaneId: L.lead,
  stepIdForColumn: (column: number) => STEPS[column - 1]!.id,
  leadStepPictures: GOAL_SETTING_PARALLEL_LEAD_STEP_FRAMES,
  partnerStepPictures: GOAL_SETTING_PARALLEL_PARTNER_STEP_FRAMES,
}

const GOAL_SETTING_SET_GOALS_EDGE_CASE_TRIGGERS: BlueprintCellDependency[] = [
  ...buildParallelSessionPartnerLeadDependencies(partnerLeadOptions),
  ...rowDependencies('03', 50, 11),
  ...columnLaneDependencies('03', '06', 70, 12),
  dependency('062', '12', '03', '01', '03'),
]

const GOAL_SETTING_SET_GOALS_EDGE_CASE_CELLS: BlueprintCell[] = [
  ...STEPS.map((step, index) =>
    cell(
      geCell(String(index + 1).padStart(2, '0'), '10'),
      L.storyboard,
      step.id,
      '',
    ),
  ),
  ...buildParallelSessionPartnerLeadCells(partnerLeadOptions),

  cell(geCell('01', '03'), L.regular, STEPS[0].id, 'Join breakout session.', {
    frame: GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_01_FRAME,
  }),
  cell(
    geCell('02', '03'),
    L.regular,
    STEPS[1].id,
    "Sees action color in dashboard is warning and CTA copy is 'Set Goals' within a mid-cycle goal check-in session.",
    { frame: GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_02_FRAME },
  ),
  cell(
    geCell('03', '03'),
    L.regular,
    STEPS[2].id,
    "Click on 'Set Goals' CTA in the action column.",
    { frame: GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_03_FRAME },
  ),
  cell(geCell('04', '03'), L.regular, STEPS[3].id, 'Share screen.', {
    frame: GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_04_FRAME,
  }),
  cell(
    geCell('05', '03'),
    L.regular,
    STEPS[4].id,
    'Explain to student what goal setting is.',
    { frame: GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_05_FRAME },
  ),
  cell(
    geCell('06', '03'),
    L.regular,
    STEPS[5].id,
    'Once student understands, starts setting first goal while sharing screen.',
    { frame: GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_06_FRAME },
  ),
  cell(
    geCell('07', '03'),
    L.regular,
    STEPS[6].id,
    'Fill out goal settings and quantity with the student.',
    { frame: GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_07_FRAME },
  ),
  cell(
    geCell('08', '03'),
    L.regular,
    STEPS[7].id,
    'If prompted, fill out goal achievement strategy with the student.',
    { frame: GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_08_FRAME },
  ),
  cell(geCell('09', '03'), L.regular, STEPS[8].id, 'Save goal.', {
    frame: GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_09_FRAME,
  }),
  cell(
    geCell('10', '03'),
    L.regular,
    STEPS[9].id,
    'Finalize goal setting with student.',
    { frame: GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_10_FRAME },
  ),
  cell(geCell('11', '03'), L.regular, STEPS[10].id, 'Leave breakout room.', {
    frame: GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_11_FRAME,
  }),
  cell(
    geCell('12', '03'),
    L.regular,
    STEPS[11].id,
    'Move on to the next student in sorted order set by researchers.',
    { frame: GOAL_SETTING_SET_GOALS_EDGE_CASE_REGULAR_TUTOR_STEP_12_FRAME },
  ),

  cell(geCell('01', '06'), L.frontStageTech, STEPS[0].id, 'Zoom', {
    summary: GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_01_DESCRIPTION,
  }),
  cell(geCell('02', '06'), L.frontStageTech, STEPS[1].id, 'PLUS App', {
    links: [
      setGoalsEdgeCasePlusAppLink(
        GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_02_DESCRIPTION,
        GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_02_FRAME,
        GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEPS_2_3_FIGMA_URL,
      ),
    ],
  }),
  cell(geCell('03', '06'), L.frontStageTech, STEPS[2].id, 'PLUS App', {
    links: [
      setGoalsEdgeCasePlusAppLink(
        GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_03_DESCRIPTION,
        GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_03_FRAME,
        GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEPS_2_3_FIGMA_URL,
      ),
    ],
  }),
  cell(
    geCell('04', '06'),
    L.frontStageTech,
    STEPS[3].id,
    'Zoom, PLUS App',
    {
      summary: GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_04_DESCRIPTION,
      links: [
        setGoalsEdgeCasePlusAppLink(
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_04_DESCRIPTION,
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_04_FRAME,
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_04_FIGMA_URL,
        ),
      ],
    },
  ),
  cell(geCell('05', '06'), L.frontStageTech, STEPS[4].id, 'Zoom', {
    summary: GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_05_DESCRIPTION,
  }),
  cell(
    geCell('06', '06'),
    L.frontStageTech,
    STEPS[5].id,
    'Zoom, PLUS App',
    {
      summary: GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_06_DESCRIPTION,
      links: [
        setGoalsEdgeCasePlusAppLink(
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_06_DESCRIPTION,
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_06_FRAME,
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_06_FIGMA_URL,
        ),
      ],
    },
  ),
  cell(
    geCell('07', '06'),
    L.frontStageTech,
    STEPS[6].id,
    'Zoom, PLUS App',
    {
      summary: GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_07_DESCRIPTION,
      links: [
        setGoalsEdgeCasePlusAppLink(
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_07_DESCRIPTION,
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_07_FRAME,
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEPS_7_8_9_FIGMA_URL,
        ),
      ],
    },
  ),
  cell(
    geCell('08', '06'),
    L.frontStageTech,
    STEPS[7].id,
    'Zoom, PLUS App',
    {
      summary: GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_08_DESCRIPTION,
      links: [
        setGoalsEdgeCasePlusAppLink(
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_08_DESCRIPTION,
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_08_FRAME,
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEPS_7_8_9_FIGMA_URL,
        ),
      ],
    },
  ),
  cell(
    geCell('09', '06'),
    L.frontStageTech,
    STEPS[8].id,
    'Zoom, PLUS App',
    {
      summary: GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_09_DESCRIPTION,
      links: [
        setGoalsEdgeCasePlusAppLink(
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_09_DESCRIPTION,
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_09_FRAME,
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEPS_7_8_9_FIGMA_URL,
        ),
      ],
    },
  ),
  cell(
    geCell('10', '06'),
    L.frontStageTech,
    STEPS[9].id,
    'Zoom, PLUS App',
    {
      summary: GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_10_DESCRIPTION,
      links: [
        setGoalsEdgeCasePlusAppLink(
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_10_DESCRIPTION,
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_10_FRAME,
          GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_10_FIGMA_URL,
        ),
      ],
    },
  ),
  cell(geCell('11', '06'), L.frontStageTech, STEPS[10].id, 'Zoom', {
    summary: GOAL_SETTING_SET_GOALS_EDGE_CASE_ZOOM_STEP_11_DESCRIPTION,
  }),
  cell(geCell('12', '06'), L.frontStageTech, STEPS[11].id, 'PLUS App', {
    links: [
      setGoalsEdgeCasePlusAppLink(
        GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_12_DESCRIPTION,
        GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_12_FRAME,
        GOAL_SETTING_SET_GOALS_EDGE_CASE_PLUS_APP_STEP_12_FIGMA_URL,
      ),
    ],
  }),

  cell(geCell('05', '07'), L.backStage, STEPS[4].id, BACKSTAGE_RESEARCHERS),
  cell(geCell('06', '07'), L.backStage, STEPS[5].id, BACKSTAGE_RESEARCHERS),
  cell(geCell('07', '07'), L.backStage, STEPS[6].id, BACKSTAGE_RESEARCHERS),
  cell(geCell('08', '07'), L.backStage, STEPS[7].id, BACKSTAGE_RESEARCHERS),
  cell(geCell('09', '07'), L.backStage, STEPS[8].id, BACKSTAGE_RESEARCHERS),
  cell(geCell('10', '07'), L.backStage, STEPS[9].id, BACKSTAGE_RESEARCHERS),
  cell(
    geCell('12', '07'),
    L.backStage,
    STEPS[11].id,
    'Researchers set student order.',
  ),

  cell(geCell('02', '09'), L.support, STEPS[1].id, SUPPORT_DEV_DESIGN, {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(geCell('03', '09'), L.support, STEPS[2].id, SUPPORT_DEV_DESIGN, {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(geCell('04', '09'), L.support, STEPS[3].id, SUPPORT_DEV_DESIGN, {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(geCell('06', '09'), L.support, STEPS[5].id, SUPPORT_DEV_DESIGN, {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(geCell('07', '09'), L.support, STEPS[6].id, SUPPORT_DEV_DESIGN, {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(geCell('08', '09'), L.support, STEPS[7].id, SUPPORT_DEV_DESIGN, {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(geCell('09', '09'), L.support, STEPS[8].id, SUPPORT_DEV_DESIGN, {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(geCell('10', '09'), L.support, STEPS[9].id, SUPPORT_DEV_DESIGN, {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(geCell('12', '09'), L.support, STEPS[11].id, SUPPORT_DEV_DESIGN, {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
]

export const GOAL_SETTING_SET_GOALS_EDGE_CASE_PATH_FALLBACK: BlueprintData = {
  path: {
    id: GOAL_SETTING_SET_GOALS_EDGE_CASE_PATH_ID,
    name: 'Set Goals Edge Case',
    summary:
      'Goal cycle began and deadline not reached, but student did not set goals last session and student has no prior goals.',
    note: getScenarioParallelNote(GOAL_SETTING_SCENARIO_ID),
    kind: 'variant',
    status: 'live',
  },
  lanes: [...LANES],
  steps: [...STEPS],
  cells: GOAL_SETTING_SET_GOALS_EDGE_CASE_CELLS,
  dependencies: GOAL_SETTING_SET_GOALS_EDGE_CASE_TRIGGERS,
}
