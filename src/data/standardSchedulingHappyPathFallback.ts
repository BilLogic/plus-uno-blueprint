import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import {
  STANDARD_SCHEDULING_GOOGLE_SPREADSHEET_STEP_01_DESCRIPTION,
  STANDARD_SCHEDULING_GOOGLE_SPREADSHEET_STEP_01_FRAME,
  STANDARD_SCHEDULING_PLUS_APP_STEP_02_DESCRIPTION,
  STANDARD_SCHEDULING_REGULAR_TUTOR_STEP_02_FRAME,
  STANDARD_SCHEDULING_SUPPORT_STEP_01_DESCRIPTION,
  STANDARD_SCHEDULING_SUPPORT_STEP_02_DESCRIPTION,
} from '@/data/standardSchedulingFrames'
import { techDescriptionLink } from '@/lib/blueprintTechDescriptions'
import type {
  BlueprintCell,
  BlueprintCellDependency,
  BlueprintData,
} from '@/types/blueprint'

export const STANDARD_SCHEDULING_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000126'

export const STANDARD_SCHEDULING_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-000000000806'

const STEP_STORYBOARD_LANE_ID = 'a0000000-0000-4000-8000-000000000885'

const LANES = [
  { id: STEP_STORYBOARD_LANE_ID, name: 'Storyboard', position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000886',
    name: 'Regular Tutor',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000888',
    name: 'Front Stage Tech',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000887',
    name: 'Front Stage Actions',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000890',
    name: 'Back Stage Tech',
    position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000889',
    name: 'Back Stage Actions',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000895',
    name: 'Support Actions',
    position: 6,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000894',
    name: 'Review schedules',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000896',
    name: 'Receive schedule',
    position: 2,
  },
] as const

const L = {
  storyboard: STEP_STORYBOARD_LANE_ID,
  regular: 'a0000000-0000-4000-8000-000000000886',
  frontStage: 'a0000000-0000-4000-8000-000000000887',
  frontStageTech: 'a0000000-0000-4000-8000-000000000888',
  backStage: 'a0000000-0000-4000-8000-000000000889',
  backStageTech: 'a0000000-0000-4000-8000-000000000890',
  support: 'a0000000-0000-4000-8000-000000000895',
} as const

function cell(
  id: string,
  laneId: string,
  stepId: string,
  content: string,
  extras?: Partial<Pick<BlueprintCell, 'summary' | 'links' | 'frame'>>,
): BlueprintCell {
  return {
    id,
    lane_id: laneId,
    step_id: stepId,
    content,
    ...EMPTY_CELL_METADATA,
    ...extras,
  }
}

function schedCell(stepSlot: string, laneSuffix: string): string {
  return `a0000000-0000-4000-8000-00000014${stepSlot}${laneSuffix}`
}

function schedDependency(dependencySlot: string): string {
  return `a0000000-0000-4000-8000-000000093${dependencySlot}`
}

function dependency(
  slot: string,
  fromStep: string,
  fromLane: string,
  toStep: string,
  toLane: string,
): BlueprintCellDependency {
  return {
    id: schedDependency(slot),
    source_cell_id: schedCell(fromStep, fromLane),
    target_cell_id: schedCell(toStep, toLane),
  }
}

const STANDARD_SCHEDULING_TRIGGERS: BlueprintCellDependency[] = [
  // Google Spreadsheet → Tutor supervisor review
  dependency('003', '01', '08', '01', '07'),
  // Supervisor review → send schedule to tutors
  dependency('001', '01', '07', '02', '04'),
  // Supervisor sends schedule → PLUS App
  dependency('002', '02', '04', '02', '06'),
  // PLUS App → tutor receives schedule
  dependency('004', '02', '06', '02', '03'),
]

const STANDARD_SCHEDULING_CELLS: BlueprintCell[] = [
  cell(schedCell('01', '10'), L.storyboard, STEPS[0].id, ''),

  cell(
    schedCell('01', '07'),
    L.backStage,
    STEPS[0].id,
    'Tutor supervisor team receives and reviews tutor schedules from the Dev Team.',
  ),
  cell(schedCell('01', '08'), L.backStageTech, STEPS[0].id, 'Google Spreadsheet', {
    summary: STANDARD_SCHEDULING_GOOGLE_SPREADSHEET_STEP_01_DESCRIPTION,
    links: [
      techDescriptionLink(
        'Google Spreadsheet',
        STANDARD_SCHEDULING_GOOGLE_SPREADSHEET_STEP_01_DESCRIPTION,
        STANDARD_SCHEDULING_GOOGLE_SPREADSHEET_STEP_01_FRAME,
      ),
    ],
  }),
  cell(schedCell('01', '09'), L.support, STEPS[0].id, 'Dev Team', {
    summary: STANDARD_SCHEDULING_SUPPORT_STEP_01_DESCRIPTION,
  }),

  cell(schedCell('02', '10'), L.storyboard, STEPS[1].id, ''),
  cell(
    schedCell('02', '03'),
    L.regular,
    STEPS[1].id,
    'Receive schedule for the semester.',
    { frame: STANDARD_SCHEDULING_REGULAR_TUTOR_STEP_02_FRAME },
  ),
  cell(
    schedCell('02', '04'),
    L.frontStage,
    STEPS[1].id,
    'Tutor supervisor team sends schedule.',
  ),
  cell(schedCell('02', '06'), L.frontStageTech, STEPS[1].id, 'PLUS App', {
    summary: STANDARD_SCHEDULING_PLUS_APP_STEP_02_DESCRIPTION,
    links: [
      techDescriptionLink(
        'PLUS App',
        STANDARD_SCHEDULING_PLUS_APP_STEP_02_DESCRIPTION,
      ),
    ],
  }),
  cell(schedCell('02', '09'), L.support, STEPS[1].id, 'Dev Team\nDesign Team', {
    summary: STANDARD_SCHEDULING_SUPPORT_STEP_02_DESCRIPTION,
  }),
]

export const STANDARD_SCHEDULING_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: STANDARD_SCHEDULING_HAPPY_PATH_ID,
    name: 'Schedule as issued',
    summary: 'Tutors receive semester schedule.',
    note: null,
    kind: 'happy',
    status: 'live',
  },
  lanes: [...LANES],
  steps: [...STEPS],
  cells: STANDARD_SCHEDULING_CELLS,
  dependencies: STANDARD_SCHEDULING_TRIGGERS,
}
