import { ONBOARDING_MODULES_SCENARIO_ID } from '@/data/techSetupHappyPathFallback'
import {
  ONBOARDING_MODULES_DEV_DESIGN_SUPPORT_DESCRIPTION,
  ONBOARDING_MODULES_GOOGLE_DOCS_SLIDES_STEP_04_DESCRIPTION,
  ONBOARDING_MODULES_GOOGLE_DOCS_SLIDES_STEP_04_FRAME,
  ONBOARDING_MODULES_GOOGLE_QUIZ_STEP_05_DESCRIPTION,
  ONBOARDING_MODULES_GOOGLE_QUIZ_STEP_05_FRAME,
  ONBOARDING_MODULES_NOTION_LOGO,
  ONBOARDING_MODULES_NOTION_STEP_02_DESCRIPTION,
  ONBOARDING_MODULES_NOTION_STEP_02_FRAME,
  ONBOARDING_MODULES_NOTION_STEP_03_DESCRIPTION,
  ONBOARDING_MODULES_NOTION_STEP_03_FRAME,
  ONBOARDING_MODULES_NOTION_STEP_04_DESCRIPTION,
  ONBOARDING_MODULES_NOTION_STEP_06_DESCRIPTION,
  ONBOARDING_MODULES_PLUS_APP_STEP_01_DESCRIPTION,
  ONBOARDING_MODULES_PLUS_APP_STEP_01_FIGMA_URL,
  ONBOARDING_MODULES_PLUS_APP_STEP_01_FRAME,
  ONBOARDING_MODULES_PLUS_APP_STEP_02_DESCRIPTION,
  ONBOARDING_MODULES_PLUS_APP_STEP_02_FIGMA_URL,
  ONBOARDING_MODULES_PLUS_APP_STEP_02_FRAME,
  ONBOARDING_MODULES_PLUS_APP_STEP_06_DESCRIPTION,
  ONBOARDING_MODULES_PLUS_APP_STEP_06_FIGMA_URL,
  ONBOARDING_MODULES_PLUS_APP_STEP_06_FRAME,
  ONBOARDING_MODULES_PLUS_APP_STEP_07_DESCRIPTION,
  ONBOARDING_MODULES_PLUS_APP_STEP_07_FIGMA_URL,
  ONBOARDING_MODULES_PLUS_APP_STEP_07_FRAME,
  ONBOARDING_MODULES_REGULAR_TUTOR_STEP_01_FRAME,
  ONBOARDING_MODULES_REGULAR_TUTOR_STEP_02_FRAME,
  ONBOARDING_MODULES_REGULAR_TUTOR_STEP_03_FRAME,
  ONBOARDING_MODULES_REGULAR_TUTOR_STEP_04_FRAME,
  ONBOARDING_MODULES_REGULAR_TUTOR_STEP_05_FRAME,
  ONBOARDING_MODULES_REGULAR_TUTOR_STEP_06_FRAME,
  ONBOARDING_MODULES_REGULAR_TUTOR_STEP_07_FRAME,
  ONBOARDING_MODULES_RESEARCHERS_SUPPORT_DESCRIPTION,
  ONBOARDING_MODULES_STEP_06_SUPPORT_DESCRIPTION,
} from '@/data/onboardingModulesFrames'
import { techDescriptionLink } from '@/lib/blueprintTechDescriptions'
import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import type {
  BlueprintCell,
  BlueprintCellDependency,
  BlueprintData,
} from '@/types/blueprint'

export { ONBOARDING_MODULES_SCENARIO_ID }

export const ONBOARDING_MODULES_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-000000007201'

const STEP_VISUAL_LAYER_ID = 'a0000000-0000-4000-8000-000000000828'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Storyboard', position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000841',
    name: 'Regular Tutor',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000843',
    name: 'Front Stage Tech',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000842',
    name: 'Front Stage Actions',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000845',
    name: 'Back Stage Tech',
    position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000844',
    name: 'Back Stage Actions',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000846',
    name: 'Support Actions',
    position: 6,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000851',
    name: 'Module opening',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000852',
    name: 'Accessing content',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000853',
    name: 'Reading lesson',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000854',
    name: 'Supplementary materials',
    position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000855',
    name: 'Quiz completion',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000856',
    name: 'Reflection',
    position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000857',
    name: 'Module completion',
    position: 7,
  },
] as const

const L = {
  visual: STEP_VISUAL_LAYER_ID,
  regular: 'a0000000-0000-4000-8000-000000000841',
  frontStage: 'a0000000-0000-4000-8000-000000000842',
  frontStageTech: 'a0000000-0000-4000-8000-000000000843',
  backStage: 'a0000000-0000-4000-8000-000000000844',
  backStageTech: 'a0000000-0000-4000-8000-000000000845',
  support: 'a0000000-0000-4000-8000-000000000846',
} as const

function cell(
  id: string,
  laneId: string,
  stepId: string,
  content: string,
  metadata: Partial<Pick<BlueprintCell, 'frame' | 'summary' | 'links'>> = {},
): BlueprintCell {
  return {
    id,
    lane_id: laneId,
    step_id: stepId,
    content,
    ...EMPTY_CELL_METADATA,
    ...metadata,
  }
}

function omCell(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-00000011${stepSlot}${layerSuffix}`
}

function omDependency(dependencySlot: string): string {
  return `a0000000-0000-4000-8000-000000089${dependencySlot}`
}

function dependency(
  slot: string,
  fromStep: string,
  fromLayer: string,
  toStep: string,
  toLayer: string,
): BlueprintCellDependency {
  return {
    id: omDependency(slot),
    source_cell_id: omCell(fromStep, fromLayer),
    target_cell_id: omCell(toStep, toLayer),
  }
}

const ONBOARDING_MODULES_TRIGGERS: BlueprintCellDependency[] = [
  // Step 1 — tutor opens module → PLUS App
  dependency('001', '01', '03', '01', '06'),

  // Step 2 — tutor follows Notion link → PLUS App / Notion
  dependency('002', '02', '03', '02', '06'),

  // Step 3 — tutor reads lesson → Notion
  dependency('003', '03', '03', '03', '06'),

  // Step 4 — tutor reads supplementary materials → Notion / Google Docs
  dependency('004', '04', '03', '04', '06'),

  // Step 5 — tutor completes quiz → Google Quiz
  dependency('005', '05', '03', '05', '06'),

  // Step 6 — tutor fills reflection → PLUS App
  dependency('006', '06', '03', '06', '06'),

  // Step 7 — tutor submits reflection / completes module → PLUS App
  dependency('007', '07', '03', '07', '06'),

  // Regular Tutor forward chain
  dependency('011', '01', '03', '02', '03'),
  dependency('012', '02', '03', '03', '03'),
  dependency('013', '03', '03', '04', '03'),
  dependency('014', '04', '03', '05', '03'),
  dependency('015', '05', '03', '06', '03'),
  dependency('017', '06', '03', '07', '03'),
  // Loop to next module
  dependency('016', '07', '03', '01', '03'),

  // Step 3 — instructional design → Notion
  dependency('031', '03', '07', '03', '06'),

  // Step 4 — instructional design → Google Docs/ Slides (nearest touchpoint)
  dependency('041', '04', '07', '04', '06'),
  dependency('051', '05', '06', '05', '07'),
  dependency('052', '05', '07', '05', '06'),
  // Step 6 — instructional design → Notion → PLUS App
  dependency('063', '06', '07', '06', '08'),
  dependency('064', '06', '08', '06', '06'),
]

const ONBOARDING_MODULES_CELLS: BlueprintCell[] = [
  ...STEPS.map((step, stepIndex) =>
    cell(
      omCell(String(stepIndex + 1).padStart(2, '0'), '10'),
      L.visual,
      step.id,
      '',
    ),
  ),

  // Step 1 — module opening
  cell(
    omCell('01', '03'),
    L.regular,
    STEPS[0].id,
    'Opens next uncompleted onboarding module.',
    { frame: ONBOARDING_MODULES_REGULAR_TUTOR_STEP_01_FRAME },
  ),
  cell(omCell('01', '06'), L.frontStageTech, STEPS[0].id, 'PLUS App', {
    links: [
      techDescriptionLink(
        'PLUS App',
        ONBOARDING_MODULES_PLUS_APP_STEP_01_DESCRIPTION,
        ONBOARDING_MODULES_PLUS_APP_STEP_01_FRAME,
        ONBOARDING_MODULES_PLUS_APP_STEP_01_FIGMA_URL,
      ),
    ],
  }),
  cell(omCell('01', '09'), L.support, STEPS[0].id, 'Dev Team\nDesign Team', {
    summary: ONBOARDING_MODULES_DEV_DESIGN_SUPPORT_DESCRIPTION,
  }),

  // Step 2 — accessing content
  cell(
    omCell('02', '03'),
    L.regular,
    STEPS[1].id,
    'Follows Notion link in individual module page.',
    { frame: ONBOARDING_MODULES_REGULAR_TUTOR_STEP_02_FRAME },
  ),
  cell(omCell('02', '06'), L.frontStageTech, STEPS[1].id, 'PLUS App\nNotion', {
    links: [
      techDescriptionLink(
        'PLUS App',
        ONBOARDING_MODULES_PLUS_APP_STEP_02_DESCRIPTION,
        ONBOARDING_MODULES_PLUS_APP_STEP_02_FRAME,
        ONBOARDING_MODULES_PLUS_APP_STEP_02_FIGMA_URL,
      ),
      techDescriptionLink(
        'Notion',
        ONBOARDING_MODULES_NOTION_STEP_02_DESCRIPTION,
        [
          ONBOARDING_MODULES_NOTION_LOGO,
          ONBOARDING_MODULES_NOTION_STEP_02_FRAME,
        ],
      ),
    ],
  }),
  cell(omCell('02', '09'), L.support, STEPS[1].id, 'Dev Team\nDesign Team', {
    summary: ONBOARDING_MODULES_DEV_DESIGN_SUPPORT_DESCRIPTION,
  }),

  // Step 3 — reading lesson
  cell(
    omCell('03', '03'),
    L.regular,
    STEPS[2].id,
    'Reads through the onboarding module lesson.',
    { frame: ONBOARDING_MODULES_REGULAR_TUTOR_STEP_03_FRAME },
  ),
  cell(omCell('03', '06'), L.frontStageTech, STEPS[2].id, 'Notion', {
    links: [
      techDescriptionLink(
        'Notion',
        ONBOARDING_MODULES_NOTION_STEP_03_DESCRIPTION,
        ONBOARDING_MODULES_NOTION_STEP_03_FRAME,
      ),
    ],
  }),
  cell(
    omCell('03', '07'),
    L.backStage,
    STEPS[2].id,
    'The instructional design team creates and maintains the lesson modules.',
  ),
  cell(
    omCell('03', '09'),
    L.support,
    STEPS[2].id,
    'Researchers help guide instructional implementation.',
    { summary: ONBOARDING_MODULES_RESEARCHERS_SUPPORT_DESCRIPTION },
  ),

  // Step 4 — supplementary materials
  cell(
    omCell('04', '03'),
    L.regular,
    STEPS[3].id,
    'Reads through any supplementary materials in the lesson.',
    { frame: ONBOARDING_MODULES_REGULAR_TUTOR_STEP_04_FRAME },
  ),
  cell(
    omCell('04', '06'),
    L.frontStageTech,
    STEPS[3].id,
    'Notion\nGoogle Docs/ Slides',
    {
      links: [
        techDescriptionLink(
          'Notion',
          ONBOARDING_MODULES_NOTION_STEP_04_DESCRIPTION,
          ONBOARDING_MODULES_NOTION_LOGO,
        ),
        techDescriptionLink(
          'Google Docs/ Slides',
          ONBOARDING_MODULES_GOOGLE_DOCS_SLIDES_STEP_04_DESCRIPTION,
          ONBOARDING_MODULES_GOOGLE_DOCS_SLIDES_STEP_04_FRAME,
        ),
      ],
    },
  ),
  cell(
    omCell('04', '07'),
    L.backStage,
    STEPS[3].id,
    'The instructional design team maintains the supplementary materials.',
  ),
  cell(
    omCell('04', '09'),
    L.support,
    STEPS[3].id,
    'Researchers help guide instructional implementation.',
    { summary: ONBOARDING_MODULES_RESEARCHERS_SUPPORT_DESCRIPTION },
  ),

  // Step 5 — quiz completion
  cell(omCell('05', '03'), L.regular, STEPS[4].id, 'Completes Google quiz.', {
    frame: ONBOARDING_MODULES_REGULAR_TUTOR_STEP_05_FRAME,
  }),
  cell(
    omCell('05', '06'),
    L.frontStageTech,
    STEPS[4].id,
    'Google Quiz',
    {
      links: [
        techDescriptionLink(
          'Google Quiz',
          ONBOARDING_MODULES_GOOGLE_QUIZ_STEP_05_DESCRIPTION,
          ONBOARDING_MODULES_GOOGLE_QUIZ_STEP_05_FRAME,
        ),
      ],
    },
  ),
  cell(
    omCell('05', '07'),
    L.backStage,
    STEPS[4].id,
    'The instructional design team creates and maintains the Google quiz.',
  ),
  cell(
    omCell('05', '09'),
    L.support,
    STEPS[4].id,
    'Researchers help guide instructional implementation.',
    { summary: ONBOARDING_MODULES_RESEARCHERS_SUPPORT_DESCRIPTION },
  ),

  // Step 6 — reflection
  cell(
    omCell('06', '03'),
    L.regular,
    STEPS[5].id,
    'Fills out reflection for module.',
    { frame: ONBOARDING_MODULES_REGULAR_TUTOR_STEP_06_FRAME },
  ),
  cell(omCell('06', '06'), L.frontStageTech, STEPS[5].id, 'PLUS App', {
    links: [
      techDescriptionLink(
        'PLUS App',
        ONBOARDING_MODULES_PLUS_APP_STEP_06_DESCRIPTION,
        ONBOARDING_MODULES_PLUS_APP_STEP_06_FRAME,
        ONBOARDING_MODULES_PLUS_APP_STEP_06_FIGMA_URL,
      ),
    ],
  }),
  cell(
    omCell('06', '07'),
    L.backStage,
    STEPS[5].id,
    'Instructional design team designs and maintains reflection questions.',
  ),
  cell(omCell('06', '08'), L.backStageTech, STEPS[5].id, 'Notion', {
    links: [
      techDescriptionLink(
        'Notion',
        ONBOARDING_MODULES_NOTION_STEP_06_DESCRIPTION,
        ONBOARDING_MODULES_NOTION_LOGO,
      ),
    ],
  }),
  cell(
    omCell('06', '09'),
    L.support,
    STEPS[5].id,
    'Researchers help guide instructional implementation.\nDev Team\nDesign Team',
    { summary: ONBOARDING_MODULES_STEP_06_SUPPORT_DESCRIPTION },
  ),

  // Step 7 — module completion
  cell(
    omCell('07', '03'),
    L.regular,
    STEPS[6].id,
    'Submits reflection questions and completes module.',
    { frame: ONBOARDING_MODULES_REGULAR_TUTOR_STEP_07_FRAME },
  ),
  cell(omCell('07', '06'), L.frontStageTech, STEPS[6].id, 'PLUS App', {
    links: [
      techDescriptionLink(
        'PLUS App',
        ONBOARDING_MODULES_PLUS_APP_STEP_07_DESCRIPTION,
        ONBOARDING_MODULES_PLUS_APP_STEP_07_FRAME,
        ONBOARDING_MODULES_PLUS_APP_STEP_07_FIGMA_URL,
      ),
    ],
  }),
  cell(omCell('07', '09'), L.support, STEPS[6].id, 'Dev Team\nDesign Team', {
    summary: ONBOARDING_MODULES_DEV_DESIGN_SUPPORT_DESCRIPTION,
  }),
]

export const ONBOARDING_MODULES_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: ONBOARDING_MODULES_HAPPY_PATH_ID,
    name: 'Standard',
    summary:
      'Tutor completes onboarding modules.',
    note: null,
    path_type: 'happy',
    status: 'live',
  },
  lanes: [...LAYERS],
  steps: [...STEPS],
  cells: ONBOARDING_MODULES_CELLS,
  dependencies: ONBOARDING_MODULES_TRIGGERS,
}
