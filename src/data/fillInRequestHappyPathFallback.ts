import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import {
  FILL_IN_REQUEST_EMAIL_STEP_02_DESCRIPTION,
  FILL_IN_REQUEST_EMAIL_STEP_03_DESCRIPTION,
  FILL_IN_REQUEST_GOOGLE_SPREADSHEET_STEP_01_DESCRIPTION,
  FILL_IN_REQUEST_GOOGLE_SPREADSHEET_STEP_01_PICTURE,
  FILL_IN_REQUEST_PLUS_APP_STEP_04_DESCRIPTION,
  FILL_IN_REQUEST_PLUS_APP_STEP_04_PICTURE,
  FILL_IN_REQUEST_REGULAR_TUTOR_STEP_02_PICTURE,
  FILL_IN_REQUEST_REGULAR_TUTOR_STEP_03_PICTURE,
  FILL_IN_REQUEST_REGULAR_TUTOR_STEP_04_PICTURE,
  FILL_IN_REQUEST_SHIFT_SWAP_FORM_STEP_01_DESCRIPTION,
  FILL_IN_REQUEST_SLACK_STEP_02_DESCRIPTION,
  FILL_IN_REQUEST_SLACK_STEP_03_DESCRIPTION,
  FILL_IN_REQUEST_SUPPORT_STEP_01_DESCRIPTION,
  FILL_IN_REQUEST_SUPPORT_STEP_04_DESCRIPTION,
} from '@/data/fillInRequestPictures'
import { techDescriptionLink } from '@/lib/blueprintTechDescriptions'
import {
  EMAIL_TECH_LOGO,
  GOOGLE_FORM_TECH_LOGO,
  SLACK_TECH_LOGO,
} from '@/lib/blueprintTechPictures'
import type {
  BlueprintCell,
  BlueprintCellDependency,
  BlueprintData,
} from '@/types/blueprint'

export const FILL_IN_REQUEST_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000127'

export const FILL_IN_REQUEST_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-000000000807'

const STEP_VISUAL_LAYER_ID = 'a0000000-0000-4000-8000-000000000903'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Storyboard', position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000904',
    name: 'Regular Tutor',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000906',
    name: 'Front Stage Tech',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000905',
    name: 'Front Stage Actions',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000908',
    name: 'Back Stage Tech',
    position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000907',
    name: 'Back Stage Actions',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000909',
    name: 'Support Actions',
    position: 6,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000897',
    name: 'Initial request',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000898',
    name: 'Send request',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000899',
    name: 'Tutor response',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000900',
    name: 'Finalize assignment',
    position: 4,
  },
] as const

const L = {
  visual: STEP_VISUAL_LAYER_ID,
  regular: 'a0000000-0000-4000-8000-000000000904',
  frontStage: 'a0000000-0000-4000-8000-000000000905',
  frontStageTech: 'a0000000-0000-4000-8000-000000000906',
  backStage: 'a0000000-0000-4000-8000-000000000907',
  backStageTech: 'a0000000-0000-4000-8000-000000000908',
  support: 'a0000000-0000-4000-8000-000000000909',
} as const

function cell(
  id: string,
  laneId: string,
  stepId: string,
  content: string,
  extras?: Partial<Pick<BlueprintCell, 'summary' | 'links' | 'picture'>>,
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

function fillCell(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-00000015${stepSlot}${layerSuffix}`
}

function fillDependency(dependencySlot: string): string {
  return `a0000000-0000-4000-8000-000000094${dependencySlot}`
}

function dependency(
  slot: string,
  fromStep: string,
  fromLayer: string,
  toStep: string,
  toLayer: string,
): BlueprintCellDependency {
  return {
    id: fillDependency(slot),
    source_cell_id: fillCell(fromStep, fromLayer),
    target_cell_id: fillCell(toStep, toLayer),
  }
}

const FILL_IN_REQUEST_TRIGGERS: BlueprintCellDependency[] = [
  dependency('001', '01', '07', '01', '08'),
  dependency('009', '01', '06', '01', '07'),
  dependency('002', '01', '07', '02', '04'),
  dependency('003', '02', '04', '02', '06'),
  dependency('010', '02', '06', '02', '03'),
  dependency('004', '02', '03', '03', '03'),
  dependency('005', '03', '03', '03', '06'),
  dependency('011', '03', '06', '03', '04'),
  dependency('012', '03', '03', '04', '03'),
  dependency('006', '03', '04', '04', '07'),
  dependency('013', '04', '07', '04', '06'),
  dependency('014', '04', '06', '04', '03'),
]

const FILL_IN_REQUEST_CELLS: BlueprintCell[] = [
  cell(fillCell('01', '10'), L.visual, STEPS[0].id, ''),
  cell(
    fillCell('01', '07'),
    L.backStage,
    STEPS[0].id,
    'Tutor supervisor team receives call off request and reviews tutor availabilities.',
  ),
  cell(
    fillCell('01', '08'),
    L.backStageTech,
    STEPS[0].id,
    'Google Spreadsheet',
    {
      summary: FILL_IN_REQUEST_GOOGLE_SPREADSHEET_STEP_01_DESCRIPTION,
      links: [
        techDescriptionLink(
          'Google Spreadsheet',
          FILL_IN_REQUEST_GOOGLE_SPREADSHEET_STEP_01_DESCRIPTION,
          FILL_IN_REQUEST_GOOGLE_SPREADSHEET_STEP_01_PICTURE,
        ),
      ],
    },
  ),
  cell(fillCell('01', '06'), L.frontStageTech, STEPS[0].id, 'Shift Swap Google Form', {
    links: [
      techDescriptionLink(
        'Shift Swap Google Form',
        FILL_IN_REQUEST_SHIFT_SWAP_FORM_STEP_01_DESCRIPTION,
        GOOGLE_FORM_TECH_LOGO,
      ),
    ],
  }),
  cell(fillCell('01', '09'), L.support, STEPS[0].id, 'Dev Team', {
    summary: FILL_IN_REQUEST_SUPPORT_STEP_01_DESCRIPTION,
  }),

  cell(fillCell('02', '10'), L.visual, STEPS[1].id, ''),
  cell(
    fillCell('02', '04'),
    L.frontStage,
    STEPS[1].id,
    'Tutor supervisor team requests fill in and fellow tutor sends message in #shift-swap Slack channel.',
  ),
  cell(fillCell('02', '03'), L.regular, STEPS[1].id, 'Tutor receives request.', {
    picture: FILL_IN_REQUEST_REGULAR_TUTOR_STEP_02_PICTURE,
  }),
  cell(fillCell('02', '06'), L.frontStageTech, STEPS[1].id, 'Slack, Email', {
    links: [
      techDescriptionLink(
        'Slack',
        FILL_IN_REQUEST_SLACK_STEP_02_DESCRIPTION,
        SLACK_TECH_LOGO,
      ),
      techDescriptionLink(
        'Email',
        FILL_IN_REQUEST_EMAIL_STEP_02_DESCRIPTION,
        EMAIL_TECH_LOGO,
      ),
    ],
  }),

  cell(fillCell('03', '10'), L.visual, STEPS[2].id, ''),
  cell(
    fillCell('03', '03'),
    L.regular,
    STEPS[2].id,
    'Tutor confirms or denies fill in request.',
    { picture: FILL_IN_REQUEST_REGULAR_TUTOR_STEP_03_PICTURE },
  ),
  cell(
    fillCell('03', '04'),
    L.frontStage,
    STEPS[2].id,
    'Tutor supervisor team is notified on if tutor can fill in.',
  ),
  cell(fillCell('03', '06'), L.frontStageTech, STEPS[2].id, 'Slack, Email', {
    links: [
      techDescriptionLink(
        'Slack',
        FILL_IN_REQUEST_SLACK_STEP_03_DESCRIPTION,
        SLACK_TECH_LOGO,
      ),
      techDescriptionLink(
        'Email',
        FILL_IN_REQUEST_EMAIL_STEP_03_DESCRIPTION,
        EMAIL_TECH_LOGO,
      ),
    ],
  }),

  cell(fillCell('04', '10'), L.visual, STEPS[3].id, ''),
  cell(
    fillCell('04', '03'),
    L.regular,
    STEPS[3].id,
    'Tutor accesses session if able to fill in.',
    { picture: FILL_IN_REQUEST_REGULAR_TUTOR_STEP_04_PICTURE },
  ),
  cell(fillCell('04', '06'), L.frontStageTech, STEPS[3].id, 'PLUS App', {
    links: [
      techDescriptionLink(
        'PLUS App',
        FILL_IN_REQUEST_PLUS_APP_STEP_04_DESCRIPTION,
        FILL_IN_REQUEST_PLUS_APP_STEP_04_PICTURE,
        'https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=2942-401328&t=NRQGuswXJmExM6wI-1',
      ),
    ],
  }),
  cell(
    fillCell('04', '07'),
    L.backStage,
    STEPS[3].id,
    'Tutor supervisor team adds tutor to session if tutor confirms request.',
  ),
  cell(fillCell('04', '09'), L.support, STEPS[3].id, 'Dev Team\nDesign Team', {
    summary: FILL_IN_REQUEST_SUPPORT_STEP_04_DESCRIPTION,
  }),
]

export const FILL_IN_REQUEST_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: FILL_IN_REQUEST_HAPPY_PATH_ID,
    name: 'Takes a slot from the pool',
    summary: 'Tutor is requested to fill in for a session.',
    note: null,
    path_type: 'happy',
    status: 'live',
  },
  lanes: [...LAYERS],
  steps: [...STEPS],
  cells: FILL_IN_REQUEST_CELLS,
  dependencies: FILL_IN_REQUEST_TRIGGERS,
}
