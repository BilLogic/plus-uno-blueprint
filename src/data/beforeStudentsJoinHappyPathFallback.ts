import { BEFORE_STUDENTS_JOIN_REGULAR_TUTOR_ONBOARDING_LINKS } from '@/data/onboardingModuleLinks'
import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import {
  BEFORE_STUDENTS_JOIN_PARTNER_STEP_01_FRAME,
  BEFORE_STUDENTS_JOIN_PARTNER_STEP_02_FRAME,
  BEFORE_STUDENTS_JOIN_PARTNER_STEP_03_FRAME,
  BEFORE_STUDENTS_JOIN_PARTNER_STEP_04_FRAME,
  BEFORE_STUDENTS_JOIN_PARTNER_STEP_05_FRAME,
  BEFORE_STUDENTS_JOIN_PARTNER_STEP_06_FRAME,
  BEFORE_STUDENTS_JOIN_LEAD_TUTOR_STEP_01_FRAME,
  BEFORE_STUDENTS_JOIN_LEAD_TUTOR_STEP_02_FRAME,
  BEFORE_STUDENTS_JOIN_LEAD_TUTOR_STEP_03_FRAME,
  BEFORE_STUDENTS_JOIN_LEAD_TUTOR_STEP_04_FRAME,
  BEFORE_STUDENTS_JOIN_LEAD_TUTOR_STEP_05_FRAME,
  BEFORE_STUDENTS_JOIN_LEAD_TUTOR_STEP_06_FRAME,
  BEFORE_STUDENTS_JOIN_REGULAR_TUTOR_STEP_01_FRAME,
  BEFORE_STUDENTS_JOIN_REGULAR_TUTOR_STEP_02_FRAME,
  BEFORE_STUDENTS_JOIN_REGULAR_TUTOR_STEP_03_FRAME,
  BEFORE_STUDENTS_JOIN_REGULAR_TUTOR_STEP_05_FRAME,
  BEFORE_STUDENTS_JOIN_REGULAR_TUTOR_STEP_06_FRAME,
  BEFORE_STUDENTS_JOIN_PLUS_APP_FIGMA_URL,
  BEFORE_STUDENTS_JOIN_PLUS_APP_PLACEHOLDER,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_01_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_01_FIGMA_URL,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_01_FRAME,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_02_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_02_FIGMA_URL,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_02_FRAME,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_05_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_05_FIGMA_URL,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_05_FRAME,
  BEFORE_STUDENTS_JOIN_ZOOM_STEP_02_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_ZOOM_STEP_03_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_ZOOM_STEP_04_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_ZOOM_STEP_05_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_ZOOM_STEP_06_DESCRIPTION,
} from '@/data/beforeStudentsJoinFrames'
import { SUPPORT_ACTIONS_DESCRIPTION } from '@/data/supportActionsCopy'
import { techDescriptionLink, mergeUrlLinks } from '@/lib/blueprintTechDescriptions'
import { ZOOM_TECH_LOGO } from '@/lib/blueprintTechPictures'
import type {
  BlueprintCell,
  BlueprintCellDependency,
  BlueprintData,
} from '@/types/blueprint'

export const BEFORE_STUDENTS_JOIN_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000201'

export const BEFORE_STUDENTS_JOIN_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-000000000809'

const STEP_VISUAL_LANE_ID = 'a0000000-0000-4000-8000-000000002010'

const LANES = [
  { id: STEP_VISUAL_LANE_ID, name: 'Storyboard', position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000002011',
    name: 'Teacher',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002012',
    name: 'Lead Tutor',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002013',
    name: 'Regular Tutor',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002015',
    name: 'Front Stage Tech',
    position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002014',
    name: 'Front Stage Actions',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002017',
    name: 'Back Stage Tech',
    position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002016',
    name: 'Back Stage Actions',
    position: 7,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002018',
    name: 'Support Actions',
    position: 8,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000950',
    name: 'Set up classroom',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000951',
    name: 'Open session',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000952',
    name: 'Share Zoom link',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000953',
    name: 'Prepare breakout rooms',
    position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000954',
    name: 'Review room order',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000955',
    name: 'Distribute breakout list',
    position: 6,
  },
] as const

const L = {
  visual: STEP_VISUAL_LANE_ID,
  partner: 'a0000000-0000-4000-8000-000000002011',
  lead: 'a0000000-0000-4000-8000-000000002012',
  regular: 'a0000000-0000-4000-8000-000000002013',
  frontStage: 'a0000000-0000-4000-8000-000000002014',
  frontStageTech: 'a0000000-0000-4000-8000-000000002015',
  backStage: 'a0000000-0000-4000-8000-000000002016',
  backStageTech: 'a0000000-0000-4000-8000-000000002017',
  support: 'a0000000-0000-4000-8000-000000002018',
} as const

function cell(
  id: string,
  laneId: string,
  stepId: string,
  content: string,
  metadata: Partial<Pick<BlueprintCell, 'frame' | 'summary' | 'links'>> = {},
): BlueprintCell {
  const links =
    laneId === L.regular
      ? mergeUrlLinks(metadata.links ?? [], BEFORE_STUDENTS_JOIN_REGULAR_TUTOR_ONBOARDING_LINKS)
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

function bsjCell(stepSlot: string, laneSuffix: string): string {
  return `a0000000-0000-4000-8000-00000018${stepSlot}${laneSuffix}`
}

function bsjDependency(dependencySlot: string): string {
  return `a0000000-0000-4000-8000-000000096${dependencySlot}`
}

function dependency(
  slot: string,
  fromStep: string,
  fromLane: string,
  toStep: string,
  toLane: string,
): BlueprintCellDependency {
  return {
    id: bsjDependency(slot),
    source_cell_id: bsjCell(fromStep, fromLane),
    target_cell_id: bsjCell(toStep, toLane),
  }
}

function rowDependencies(
  _startSlot: string,
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

const BEFORE_STUDENTS_JOIN_TRIGGERS: BlueprintCellDependency[] = [
  ...rowDependencies('01', '01', 1, 5),
  ...rowDependencies('01', '02', 10, 5),
  dependency('020', '01', '03', '02', '03'),
  dependency('021', '02', '03', '03', '03'),
  dependency('022', '03', '03', '05', '03'),
  dependency('023', '05', '03', '06', '03'),
  dependency('031', '05', '02', '05', '03'),
  dependency('032', '06', '02', '06', '03'),
  dependency('041', '01', '03', '01', '06'),
  dependency('042', '02', '03', '02', '06'),
  dependency('043', '03', '03', '03', '06'),
  dependency('044', '05', '03', '05', '06'),
  dependency('045', '06', '03', '06', '06'),
  // Back Stage Actions → Front Stage Tech
  dependency('061', '01', '07', '01', '06'),
  dependency('062', '02', '07', '02', '06'),
]

function beforeStudentsJoinPlusAppLink(
  description: string,
  frame: string = BEFORE_STUDENTS_JOIN_PLUS_APP_PLACEHOLDER,
  figmaUrl: string = BEFORE_STUDENTS_JOIN_PLUS_APP_FIGMA_URL,
) {
  return techDescriptionLink(
    'PLUS App',
    description,
    frame,
    figmaUrl,
  )
}

const BEFORE_STUDENTS_JOIN_CELLS: BlueprintCell[] = [
  ...STEPS.map((step, index) =>
    cell(bsjCell(String(index + 1).padStart(2, '0'), '10'), L.visual, step.id, ''),
  ),

  cell(
    bsjCell('01', '01'),
    L.partner,
    STEPS[0].id,
    'Turn on the projector or interactive whiteboard.',
    { frame: BEFORE_STUDENTS_JOIN_PARTNER_STEP_01_FRAME },
  ),
  cell(
    bsjCell('02', '01'),
    L.partner,
    STEPS[1].id,
    'Open slide deck shared by the tutor team.',
    { frame: BEFORE_STUDENTS_JOIN_PARTNER_STEP_02_FRAME },
  ),
  cell(
    bsjCell('03', '01'),
    L.partner,
    STEPS[2].id,
    'Post Zoom link in LMS or share the QR code depending on session needs.',
    { frame: BEFORE_STUDENTS_JOIN_PARTNER_STEP_03_FRAME },
  ),
  cell(bsjCell('04', '01'), L.partner, STEPS[3].id, 'Test the wifi.', {
    frame: BEFORE_STUDENTS_JOIN_PARTNER_STEP_04_FRAME,
  }),
  cell(
    bsjCell('05', '01'),
    L.partner,
    STEPS[4].id,
    'Make sure all student devices are ready.',
    { frame: BEFORE_STUDENTS_JOIN_PARTNER_STEP_05_FRAME },
  ),
  cell(
    bsjCell('06', '01'),
    L.partner,
    STEPS[5].id,
    'Remind students to plug in their headphones and use their real names on Zoom.',
    { frame: BEFORE_STUDENTS_JOIN_PARTNER_STEP_06_FRAME },
  ),

  cell(bsjCell('01', '02'), L.lead, STEPS[0].id, 'Open session detail page.', {
    frame: BEFORE_STUDENTS_JOIN_LEAD_TUTOR_STEP_01_FRAME,
  }),
  cell(bsjCell('02', '02'), L.lead, STEPS[1].id, 'Joins Zoom/ Pencil session.', {
    frame: BEFORE_STUDENTS_JOIN_LEAD_TUTOR_STEP_02_FRAME,
  }),
  cell(bsjCell('03', '02'), L.lead, STEPS[2].id, 'Take tutor attendance.', {
    frame: BEFORE_STUDENTS_JOIN_LEAD_TUTOR_STEP_03_FRAME,
  }),
  cell(bsjCell('04', '02'), L.lead, STEPS[3].id, 'Create breakout rooms.', {
    frame: BEFORE_STUDENTS_JOIN_LEAD_TUTOR_STEP_04_FRAME,
  }),
  cell(
    bsjCell('05', '02'),
    L.lead,
    STEPS[4].id,
    'Remind tutors to go through rooms in order of dashboard list.',
    { frame: BEFORE_STUDENTS_JOIN_LEAD_TUTOR_STEP_05_FRAME },
  ),
  cell(
    bsjCell('06', '02'),
    L.lead,
    STEPS[5].id,
    'Give breakout room list to the tutors.',
    { frame: BEFORE_STUDENTS_JOIN_LEAD_TUTOR_STEP_06_FRAME },
  ),

  cell(
    bsjCell('01', '03'),
    L.regular,
    STEPS[0].id,
    'Tutor open session detail page.',
    { frame: BEFORE_STUDENTS_JOIN_REGULAR_TUTOR_STEP_01_FRAME },
  ),
  cell(bsjCell('02', '03'), L.regular, STEPS[1].id, 'Joins Zoom session.', {
    frame: BEFORE_STUDENTS_JOIN_REGULAR_TUTOR_STEP_02_FRAME,
  }),
  cell(
    bsjCell('03', '03'),
    L.regular,
    STEPS[2].id,
    'Sign in with lead tutor and confirms they have co-host permissions.',
    { frame: BEFORE_STUDENTS_JOIN_REGULAR_TUTOR_STEP_03_FRAME },
  ),
  cell(
    bsjCell('05', '03'),
    L.regular,
    STEPS[4].id,
    'Review student list for session.',
    { frame: BEFORE_STUDENTS_JOIN_REGULAR_TUTOR_STEP_05_FRAME },
  ),
  cell(
    bsjCell('06', '03'),
    L.regular,
    STEPS[5].id,
    'Receive breakout rooms from lead tutor.',
    { frame: BEFORE_STUDENTS_JOIN_REGULAR_TUTOR_STEP_06_FRAME },
  ),

  cell(bsjCell('01', '06'), L.frontStageTech, STEPS[0].id, 'PLUS App', {
    links: [
      beforeStudentsJoinPlusAppLink(
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_01_DESCRIPTION,
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_01_FRAME,
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_01_FIGMA_URL,
      ),
    ],
  }),
  cell(bsjCell('02', '06'), L.frontStageTech, STEPS[1].id, 'PLUS App, Zoom', {
    frame: ZOOM_TECH_LOGO,
    summary: BEFORE_STUDENTS_JOIN_ZOOM_STEP_02_DESCRIPTION,
    links: [
      beforeStudentsJoinPlusAppLink(
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_02_DESCRIPTION,
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_02_FRAME,
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_02_FIGMA_URL,
      ),
    ],
  }),
  cell(bsjCell('03', '06'), L.frontStageTech, STEPS[2].id, 'Zoom', {
    frame: ZOOM_TECH_LOGO,
    summary: BEFORE_STUDENTS_JOIN_ZOOM_STEP_03_DESCRIPTION,
  }),
  cell(bsjCell('04', '06'), L.frontStageTech, STEPS[3].id, 'Zoom', {
    frame: ZOOM_TECH_LOGO,
    summary: BEFORE_STUDENTS_JOIN_ZOOM_STEP_04_DESCRIPTION,
  }),
  cell(bsjCell('05', '06'), L.frontStageTech, STEPS[4].id, 'PLUS App, Zoom', {
    frame: ZOOM_TECH_LOGO,
    summary: BEFORE_STUDENTS_JOIN_ZOOM_STEP_05_DESCRIPTION,
    links: [
      beforeStudentsJoinPlusAppLink(
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_05_DESCRIPTION,
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_05_FRAME,
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_05_FIGMA_URL,
      ),
    ],
  }),
  cell(bsjCell('06', '06'), L.frontStageTech, STEPS[5].id, 'Zoom', {
    frame: ZOOM_TECH_LOGO,
    summary: BEFORE_STUDENTS_JOIN_ZOOM_STEP_06_DESCRIPTION,
  }),

  cell(
    bsjCell('01', '07'),
    L.backStage,
    STEPS[0].id,
    'Tutor supervisor team sets up session details.',
  ),
  cell(
    bsjCell('02', '07'),
    L.backStage,
    STEPS[1].id,
    'Tutor supervisor team sets up Zoom link.',
  ),

  cell(bsjCell('01', '09'), L.support, STEPS[0].id, 'Dev team\nDesign team', {
    summary: SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(bsjCell('02', '09'), L.support, STEPS[1].id, 'Dev team\nDesign team', {
    summary: SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(bsjCell('05', '09'), L.support, STEPS[4].id, 'Dev team\nDesign team', {
    summary: SUPPORT_ACTIONS_DESCRIPTION,
  }),
]

export const BEFORE_STUDENTS_JOIN_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: BEFORE_STUDENTS_JOIN_HAPPY_PATH_ID,
    name: 'Setup goes to plan',
    summary: 'Teachers and tutors prepare the session before students join.',
    note: null,
    kind: 'happy',
    status: 'live',
  },
  lanes: [...LANES],
  steps: [...STEPS],
  cells: BEFORE_STUDENTS_JOIN_CELLS,
  dependencies: BEFORE_STUDENTS_JOIN_TRIGGERS,
}
