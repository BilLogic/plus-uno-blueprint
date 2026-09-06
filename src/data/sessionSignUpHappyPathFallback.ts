import { SESSION_SIGN_UP_SCENARIO_ID } from '@/data/techSetupHappyPathFallback'
import {
  SESSION_SIGN_UP_GOOGLE_SPREADSHEET_STEP_01_DESCRIPTION,
  SESSION_SIGN_UP_GOOGLE_SPREADSHEET_STEP_01_FRAME,
  SESSION_SIGN_UP_PLUS_APP_STEP_01_DESCRIPTION,
  SESSION_SIGN_UP_PLUS_APP_STEP_01_FRAME,
  SESSION_SIGN_UP_REGULAR_TUTOR_STEP_01_FRAME,
  SESSION_SIGN_UP_SUPPORT_ACTIONS_STEP_01_DESCRIPTION,
} from '@/data/sessionSignUpFrames'
import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import { techDescriptionLink } from '@/lib/blueprintTechDescriptions'
import type {
  BlueprintCell,
  BlueprintCellDependency,
  BlueprintData,
} from '@/types/blueprint'

export { SESSION_SIGN_UP_SCENARIO_ID }

export const SESSION_SIGN_UP_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-000000000805'

const STEP_STORYBOARD_LANE_ID = 'a0000000-0000-4000-8000-000000000878'

const LANES = [
  { id: STEP_STORYBOARD_LANE_ID, name: 'Storyboard', position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000879',
    name: 'Regular Tutor',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000881',
    name: 'Front Stage Tech',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000880',
    name: 'Front Stage Actions',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000883',
    name: 'Back Stage Tech',
    position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000882',
    name: 'Back Stage Actions',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000884',
    name: 'Support Actions',
    position: 6,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000891',
    name: 'Sign up',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000892',
    name: 'Review scheduling',
    position: 2,
  },
] as const

const L = {
  storyboard: STEP_STORYBOARD_LANE_ID,
  regular: 'a0000000-0000-4000-8000-000000000879',
  frontStage: 'a0000000-0000-4000-8000-000000000880',
  frontStageTech: 'a0000000-0000-4000-8000-000000000881',
  backStage: 'a0000000-0000-4000-8000-000000000882',
  backStageTech: 'a0000000-0000-4000-8000-000000000883',
  support: 'a0000000-0000-4000-8000-000000000884',
} as const

function cell(
  id: string,
  laneId: string,
  stepId: string,
  content: string,
  extras?: Partial<Pick<BlueprintCell, 'frame' | 'summary' | 'links'>>,
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

function ssCell(stepSlot: string, laneSuffix: string): string {
  return `a0000000-0000-4000-8000-00000013${stepSlot}${laneSuffix}`
}

function ssDependency(dependencySlot: string): string {
  return `a0000000-0000-4000-8000-000000092${dependencySlot}`
}

function dependency(
  slot: string,
  fromStep: string,
  fromLane: string,
  toStep: string,
  toLane: string,
): BlueprintCellDependency {
  return {
    id: ssDependency(slot),
    source_cell_id: ssCell(fromStep, fromLane),
    target_cell_id: ssCell(toStep, toLane),
  }
}

const SESSION_SIGN_UP_TRIGGERS: BlueprintCellDependency[] = [
  // Regular Tutor → PLUS app
  dependency('003', '01', '03', '01', '06'),
  // PLUS app → Dev team stores scheduling info
  dependency('001', '01', '06', '01', '07'),
  // Dev team → Google Spreadsheet
  dependency('004', '01', '07', '01', '08'),
  // Google Spreadsheet → Tutor supervisor review
  dependency('005', '01', '08', '02', '07'),
]

const SESSION_SIGN_UP_CELLS: BlueprintCell[] = [
  // Storyboard row
  cell(ssCell('01', '10'), L.storyboard, STEPS[0].id, ''),
  cell(ssCell('02', '10'), L.storyboard, STEPS[1].id, ''),

  // Step 1 — Sign up
  cell(
    ssCell('01', '03'),
    L.regular,
    STEPS[0].id,
    'Signs up for recurring sessions for rest of semester.',
    { frame: SESSION_SIGN_UP_REGULAR_TUTOR_STEP_01_FRAME },
  ),
  cell(ssCell('01', '06'), L.frontStageTech, STEPS[0].id, 'PLUS app', {
    summary: SESSION_SIGN_UP_PLUS_APP_STEP_01_DESCRIPTION,
    links: [
      techDescriptionLink(
        'PLUS app',
        SESSION_SIGN_UP_PLUS_APP_STEP_01_DESCRIPTION,
        SESSION_SIGN_UP_PLUS_APP_STEP_01_FRAME,
        'https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1751-119990&t=rLMzaNhqBUszclus-1',
      ),
    ],
  }),
  cell(
    ssCell('01', '07'),
    L.backStage,
    STEPS[0].id,
    'Dev Team takes that scheduling info and stores it in a Google Spreadsheet.',
  ),
  cell(
    ssCell('01', '08'),
    L.backStageTech,
    STEPS[0].id,
    'Google Spreadsheet',
    {
      summary: SESSION_SIGN_UP_GOOGLE_SPREADSHEET_STEP_01_DESCRIPTION,
      links: [
        techDescriptionLink(
          'Google Spreadsheet',
          SESSION_SIGN_UP_GOOGLE_SPREADSHEET_STEP_01_DESCRIPTION,
          SESSION_SIGN_UP_GOOGLE_SPREADSHEET_STEP_01_FRAME,
        ),
      ],
    },
  ),
  cell(ssCell('01', '09'), L.support, STEPS[0].id, 'Dev Team\nDesign Team', {
    summary: SESSION_SIGN_UP_SUPPORT_ACTIONS_STEP_01_DESCRIPTION,
  }),

  // Step 2 — Review scheduling
  cell(
    ssCell('02', '07'),
    L.backStage,
    STEPS[1].id,
    'Tutor supervisor team receives and reviews Google Spreadsheet from Dev Team.',
  ),
  cell(ssCell('02', '08'), L.backStageTech, STEPS[1].id, ''),
]

export const SESSION_SIGN_UP_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: SESSION_SIGN_UP_HAPPY_PATH_ID,
    name: 'No conflicts',
    summary:
      'Tutor signs up for recurring sessions for the rest of the semester.',
    note: null,
    kind: 'happy',
    status: 'live',
  },
  lanes: [...LANES],
  steps: [...STEPS],
  cells: SESSION_SIGN_UP_CELLS,
  dependencies: SESSION_SIGN_UP_TRIGGERS,
}
