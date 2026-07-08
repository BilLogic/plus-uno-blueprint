import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import {
  BEFORE_STUDENTS_JOIN_ACTION_LAYER_PLACEHOLDER,
  BEFORE_STUDENTS_JOIN_BACK_STAGE_PLUS_APP_STEP_01_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_BACK_STAGE_PLUS_APP_STEP_01_FIGMA_URL,
  BEFORE_STUDENTS_JOIN_BACK_STAGE_PLUS_APP_STEP_01_PICTURE,
  BEFORE_STUDENTS_JOIN_BACK_STAGE_ZOOM_PENCIL_STEP_02_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_PLUS_APP_FIGMA_URL,
  BEFORE_STUDENTS_JOIN_PLUS_APP_PLACEHOLDER,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_01_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_01_FIGMA_URL,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_01_PICTURE,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_02_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_02_FIGMA_URL,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_02_PICTURE,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_05_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_05_FIGMA_URL,
  BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_05_PICTURE,
  BEFORE_STUDENTS_JOIN_ZOOM_PENCIL_STEP_02_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_ZOOM_PENCIL_STEP_03_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_ZOOM_PENCIL_STEP_04_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_ZOOM_PENCIL_STEP_05_DESCRIPTION,
  BEFORE_STUDENTS_JOIN_ZOOM_PENCIL_STEP_06_DESCRIPTION,
} from '@/data/beforeStudentsJoinPictures'
import { SUPPORT_ACTIONS_DESCRIPTION } from '@/data/supportActionsCopy'
import { techDescriptionLink } from '@/lib/blueprintTechDescriptions'
import { ZOOM_TECH_LOGO } from '@/lib/blueprintTechPictures'
import type {
  BlueprintCell,
  BlueprintCellTrigger,
  BlueprintData,
} from '@/types/blueprint'

export const BEFORE_STUDENTS_JOIN_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000201'

export const BEFORE_STUDENTS_JOIN_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-000000000809'

const STEP_VISUAL_LAYER_ID = 'a0000000-0000-4000-8000-000000002010'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Visual', row_position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000002011',
    name: 'Partner Action: Teacher',
    row_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002012',
    name: 'Lead Tutor',
    row_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002013',
    name: 'Regular Tutor',
    row_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002015',
    name: 'Front Stage Tech',
    row_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002014',
    name: 'Front Stage Actions',
    row_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002016',
    name: 'Back Stage Actions',
    row_position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002017',
    name: 'Back Stage Tech',
    row_position: 7,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002018',
    name: 'Support Actions',
    row_position: 8,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000950',
    name: 'Set up classroom',
    column_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000951',
    name: 'Open session',
    column_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000952',
    name: 'Share Zoom link',
    column_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000953',
    name: 'Prepare breakout rooms',
    column_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000954',
    name: 'Review room order',
    column_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000955',
    name: 'Distribute breakout list',
    column_position: 6,
  },
] as const

const L = {
  visual: STEP_VISUAL_LAYER_ID,
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
  layerId: string,
  stepId: string,
  content: string,
  metadata: Partial<Pick<BlueprintCell, 'picture' | 'description' | 'links'>> = {},
): BlueprintCell {
  return {
    id,
    layer_id: layerId,
    step_id: stepId,
    content,
    ...EMPTY_CELL_METADATA,
    ...metadata,
  }
}

function bsjCell(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-00000018${stepSlot}${layerSuffix}`
}

function bsjTrigger(triggerSlot: string): string {
  return `a0000000-0000-4000-8000-000000096${triggerSlot}`
}

function trigger(
  slot: string,
  fromStep: string,
  fromLayer: string,
  toStep: string,
  toLayer: string,
): BlueprintCellTrigger {
  return {
    id: bsjTrigger(slot),
    source_cell_id: bsjCell(fromStep, fromLayer),
    target_cell_id: bsjCell(toStep, toLayer),
  }
}

function rowTriggers(
  _startSlot: string,
  layer: string,
  idStart: number,
  count: number,
): BlueprintCellTrigger[] {
  const triggers: BlueprintCellTrigger[] = []
  for (let i = 0; i < count; i++) {
    const from = String(i + 1).padStart(2, '0')
    const to = String(i + 2).padStart(2, '0')
    triggers.push(
      trigger(
        String(idStart + i).padStart(3, '0'),
        from,
        layer,
        to,
        layer,
      ),
    )
  }
  return triggers
}

const BEFORE_STUDENTS_JOIN_TRIGGERS: BlueprintCellTrigger[] = [
  ...rowTriggers('01', '01', 1, 5),
  ...rowTriggers('01', '02', 10, 5),
  trigger('020', '01', '03', '02', '03'),
  trigger('021', '02', '03', '03', '03'),
  trigger('022', '03', '03', '05', '03'),
  trigger('023', '05', '03', '06', '03'),
  trigger('031', '05', '02', '05', '03'),
  trigger('032', '06', '02', '06', '03'),
  trigger('033', '03', '02', '03', '03'),
  trigger('034', '03', '03', '03', '02'),
  trigger('041', '01', '03', '01', '06'),
  trigger('042', '02', '03', '02', '06'),
  trigger('043', '03', '03', '03', '06'),
  trigger('044', '05', '03', '05', '06'),
  trigger('045', '06', '03', '06', '06'),
  trigger('046', '04', '02', '04', '06'),
  trigger('051', '01', '07', '01', '06'),
  trigger('052', '02', '07', '02', '06'),
  trigger('061', '01', '07', '01', '08'),
  trigger('062', '02', '07', '02', '08'),
]

const ACTION_PLACEHOLDER = {
  picture: BEFORE_STUDENTS_JOIN_ACTION_LAYER_PLACEHOLDER,
} as const

function beforeStudentsJoinPlusAppLink(
  description: string,
  picture: string = BEFORE_STUDENTS_JOIN_PLUS_APP_PLACEHOLDER,
  figmaUrl: string = BEFORE_STUDENTS_JOIN_PLUS_APP_FIGMA_URL,
) {
  return techDescriptionLink(
    'PLUS App',
    description,
    picture,
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
    'Turn on the projector or interactive whiteboard',
    ACTION_PLACEHOLDER,
  ),
  cell(
    bsjCell('02', '01'),
    L.partner,
    STEPS[1].id,
    'Open Slide deck shared by the tutor team',
    ACTION_PLACEHOLDER,
  ),
  cell(
    bsjCell('03', '01'),
    L.partner,
    STEPS[2].id,
    'Post Zoom link in LMS or share the QR code depending on session needs',
    ACTION_PLACEHOLDER,
  ),
  cell(bsjCell('04', '01'), L.partner, STEPS[3].id, 'test the wifi', ACTION_PLACEHOLDER),
  cell(
    bsjCell('05', '01'),
    L.partner,
    STEPS[4].id,
    'Make sure all student devices are ready',
    ACTION_PLACEHOLDER,
  ),
  cell(
    bsjCell('06', '01'),
    L.partner,
    STEPS[5].id,
    'Remind students to plug in their headphones and use their real names on Zoom',
    ACTION_PLACEHOLDER,
  ),

  cell(bsjCell('01', '02'), L.lead, STEPS[0].id, 'Open Session Detail page', ACTION_PLACEHOLDER),
  cell(bsjCell('02', '02'), L.lead, STEPS[1].id, 'Joins Zoom/ Pencil Session', ACTION_PLACEHOLDER),
  cell(bsjCell('03', '02'), L.lead, STEPS[2].id, 'Take Tutor Attendance', ACTION_PLACEHOLDER),
  cell(bsjCell('04', '02'), L.lead, STEPS[3].id, 'Create Breakout rooms', ACTION_PLACEHOLDER),
  cell(
    bsjCell('05', '02'),
    L.lead,
    STEPS[4].id,
    'Remind tutors to go through rooms in order of dashboard list',
    ACTION_PLACEHOLDER,
  ),
  cell(
    bsjCell('06', '02'),
    L.lead,
    STEPS[5].id,
    'Give breakout room list to the tutors',
    ACTION_PLACEHOLDER,
  ),

  cell(
    bsjCell('01', '03'),
    L.regular,
    STEPS[0].id,
    'Tutor Open Session Detail page',
    ACTION_PLACEHOLDER,
  ),
  cell(bsjCell('02', '03'), L.regular, STEPS[1].id, 'Joins Zoom Session', ACTION_PLACEHOLDER),
  cell(
    bsjCell('03', '03'),
    L.regular,
    STEPS[2].id,
    'Sign In with Lead Tutor and confirms they have co-host permissions',
    ACTION_PLACEHOLDER,
  ),
  cell(
    bsjCell('05', '03'),
    L.regular,
    STEPS[4].id,
    'review student list for session',
    ACTION_PLACEHOLDER,
  ),
  cell(
    bsjCell('06', '03'),
    L.regular,
    STEPS[5].id,
    'receive breakout rooms from Lead tutor',
    ACTION_PLACEHOLDER,
  ),

  cell(bsjCell('01', '06'), L.frontStageTech, STEPS[0].id, 'PLUS App', {
    links: [
      beforeStudentsJoinPlusAppLink(
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_01_DESCRIPTION,
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_01_PICTURE,
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_01_FIGMA_URL,
      ),
    ],
  }),
  cell(bsjCell('02', '06'), L.frontStageTech, STEPS[1].id, 'PLUS App, Zoom/Pencil', {
    picture: ZOOM_TECH_LOGO,
    description: BEFORE_STUDENTS_JOIN_ZOOM_PENCIL_STEP_02_DESCRIPTION,
    links: [
      beforeStudentsJoinPlusAppLink(
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_02_DESCRIPTION,
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_02_PICTURE,
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_02_FIGMA_URL,
      ),
    ],
  }),
  cell(bsjCell('03', '06'), L.frontStageTech, STEPS[2].id, 'Zoom/Pencil', {
    picture: ZOOM_TECH_LOGO,
    description: BEFORE_STUDENTS_JOIN_ZOOM_PENCIL_STEP_03_DESCRIPTION,
  }),
  cell(bsjCell('04', '06'), L.frontStageTech, STEPS[3].id, 'Zoom/Pencil', {
    picture: ZOOM_TECH_LOGO,
    description: BEFORE_STUDENTS_JOIN_ZOOM_PENCIL_STEP_04_DESCRIPTION,
  }),
  cell(bsjCell('05', '06'), L.frontStageTech, STEPS[4].id, 'PLUS App, Zoom/Pencil', {
    picture: ZOOM_TECH_LOGO,
    description: BEFORE_STUDENTS_JOIN_ZOOM_PENCIL_STEP_05_DESCRIPTION,
    links: [
      beforeStudentsJoinPlusAppLink(
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_05_DESCRIPTION,
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_05_PICTURE,
        BEFORE_STUDENTS_JOIN_PLUS_APP_STEP_05_FIGMA_URL,
      ),
    ],
  }),
  cell(bsjCell('06', '06'), L.frontStageTech, STEPS[5].id, 'Zoom/Pencil', {
    picture: ZOOM_TECH_LOGO,
    description: BEFORE_STUDENTS_JOIN_ZOOM_PENCIL_STEP_06_DESCRIPTION,
  }),

  cell(
    bsjCell('01', '07'),
    L.backStage,
    STEPS[0].id,
    'Tutor Supervisor Team sets up session details',
  ),
  cell(
    bsjCell('02', '07'),
    L.backStage,
    STEPS[1].id,
    'Tutor supervisor team sets up zoom/pencil link',
  ),

  cell(bsjCell('01', '08'), L.backStageTech, STEPS[0].id, 'PLUS App', {
    links: [
      beforeStudentsJoinPlusAppLink(
        BEFORE_STUDENTS_JOIN_BACK_STAGE_PLUS_APP_STEP_01_DESCRIPTION,
        BEFORE_STUDENTS_JOIN_BACK_STAGE_PLUS_APP_STEP_01_PICTURE,
        BEFORE_STUDENTS_JOIN_BACK_STAGE_PLUS_APP_STEP_01_FIGMA_URL,
      ),
    ],
  }),
  cell(bsjCell('02', '08'), L.backStageTech, STEPS[1].id, 'Zoom/Pencil', {
    description: BEFORE_STUDENTS_JOIN_BACK_STAGE_ZOOM_PENCIL_STEP_02_DESCRIPTION,
  }),

  cell(bsjCell('01', '09'), L.support, STEPS[0].id, 'Dev Team\nDesign team', {
    description: SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(bsjCell('02', '09'), L.support, STEPS[1].id, 'Dev Team\nDesign team', {
    description: SUPPORT_ACTIONS_DESCRIPTION,
  }),
  cell(bsjCell('05', '09'), L.support, STEPS[4].id, 'Dev Team\nDesign team', {
    description: SUPPORT_ACTIONS_DESCRIPTION,
  }),
]

export const BEFORE_STUDENTS_JOIN_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: BEFORE_STUDENTS_JOIN_HAPPY_PATH_ID,
    name: 'Happy Path',
    description: 'Teachers and tutors prepare the session before students join.',
    note: null,
    path_type: 'happy',
  },
  layers: [...LAYERS],
  steps: [...STEPS],
  cells: BEFORE_STUDENTS_JOIN_CELLS,
  triggers: BEFORE_STUDENTS_JOIN_TRIGGERS,
}
