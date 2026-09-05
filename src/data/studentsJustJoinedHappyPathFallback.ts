import { mergeUrlLinks } from '@/lib/blueprintTechDescriptions'
import { STUDENTS_JUST_JOINED_REGULAR_TUTOR_ONBOARDING_LINKS } from '@/data/onboardingModuleLinks'
import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import {
  STUDENTS_JUST_JOINED_PARTNER_STEP_01_FRAME,
  STUDENTS_JUST_JOINED_PARTNER_STEP_02_FRAME,
  STUDENTS_JUST_JOINED_PARTNER_STEP_03_FRAME,
  STUDENTS_JUST_JOINED_LEAD_TUTOR_STEP_01_FRAME,
  STUDENTS_JUST_JOINED_LEAD_TUTOR_STEP_02_FRAME,
  STUDENTS_JUST_JOINED_LEAD_TUTOR_STEP_03_FRAME,
  STUDENTS_JUST_JOINED_REGULAR_TUTOR_STEP_03_FRAME,
  STUDENTS_JUST_JOINED_ZOOM_STEP_01_DESCRIPTION,
  STUDENTS_JUST_JOINED_ZOOM_STEP_02_DESCRIPTION,
  STUDENTS_JUST_JOINED_ZOOM_STEP_03_DESCRIPTION,
} from '@/data/studentsJustJoinedFrames'
import { ZOOM_TECH_LOGO } from '@/lib/blueprintTechPictures'
import type {
  BlueprintCell,
  BlueprintCellDependency,
  BlueprintData,
} from '@/types/blueprint'

export const STUDENTS_JUST_JOINED_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000202'

export const STUDENTS_JUST_JOINED_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-00000000080b'

const STEP_VISUAL_LANE_ID = 'a0000000-0000-4000-8000-000000002020'

const LANES = [
  { id: STEP_VISUAL_LANE_ID, name: 'Storyboard', position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000002021',
    name: 'Teacher',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002022',
    name: 'Lead Tutor',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002023',
    name: 'Regular Tutor',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002025',
    name: 'Front Stage Tech',
    position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002024',
    name: 'Front Stage Actions',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002027',
    name: 'Back Stage Tech',
    position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002026',
    name: 'Back Stage Actions',
    position: 7,
  },
  {
    id: 'a0000000-0000-4000-8000-000000002028',
    name: 'Support Actions',
    position: 8,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000960',
    name: 'Students join',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000961',
    name: 'Share screen and log in',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000962',
    name: 'Raise hand for help',
    position: 3,
  },
] as const

const L = {
  visual: STEP_VISUAL_LANE_ID,
  partner: 'a0000000-0000-4000-8000-000000002021',
  lead: 'a0000000-0000-4000-8000-000000002022',
  regular: 'a0000000-0000-4000-8000-000000002023',
  frontStage: 'a0000000-0000-4000-8000-000000002024',
  frontStageTech: 'a0000000-0000-4000-8000-000000002025',
  backStage: 'a0000000-0000-4000-8000-000000002026',
  backStageTech: 'a0000000-0000-4000-8000-000000002027',
  support: 'a0000000-0000-4000-8000-000000002028',
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
      ? mergeUrlLinks(metadata.links ?? [], STUDENTS_JUST_JOINED_REGULAR_TUTOR_ONBOARDING_LINKS)
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

function sjjCell(stepSlot: string, laneSuffix: string): string {
  return `a0000000-0000-4000-8000-00000019${stepSlot}${laneSuffix}`
}

function sjjDependency(dependencySlot: string): string {
  return `a0000000-0000-4000-8000-000000097${dependencySlot}`
}

function dependency(
  slot: string,
  fromStep: string,
  fromLane: string,
  toStep: string,
  toLane: string,
): BlueprintCellDependency {
  return {
    id: sjjDependency(slot),
    source_cell_id: sjjCell(fromStep, fromLane),
    target_cell_id: sjjCell(toStep, toLane),
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

const STUDENTS_JUST_JOINED_TRIGGERS: BlueprintCellDependency[] = [
  ...rowDependencies('01', 1, 2),
  ...rowDependencies('02', 10, 2),
  dependency('020', '03', '02', '03', '03'),
  dependency('031', '01', '02', '01', '06'),
  dependency('032', '02', '02', '02', '06'),
  dependency('030', '03', '03', '03', '06'),
]

const STUDENTS_JUST_JOINED_CELLS: BlueprintCell[] = [
  ...STEPS.map((step, index) =>
    cell(sjjCell(String(index + 1).padStart(2, '0'), '10'), L.visual, step.id, ''),
  ),

  cell(
    sjjCell('01', '01'),
    L.partner,
    STEPS[0].id,
    'Remind students that tutors support multiple students and wait time is normal.',
    { frame: STUDENTS_JUST_JOINED_PARTNER_STEP_01_FRAME },
  ),
  cell(
    sjjCell('02', '01'),
    L.partner,
    STEPS[1].id,
    'Ask students to share screen and log into math software.',
    { frame: STUDENTS_JUST_JOINED_PARTNER_STEP_02_FRAME },
  ),
  cell(
    sjjCell('03', '01'),
    L.partner,
    STEPS[2].id,
    "Show students how to use the 'raise hand' emoji to let tutors know when they need help.",
    { frame: STUDENTS_JUST_JOINED_PARTNER_STEP_03_FRAME },
  ),

  cell(sjjCell('01', '02'), L.lead, STEPS[0].id, 'Greet students as they join.', {
    frame: STUDENTS_JUST_JOINED_LEAD_TUTOR_STEP_01_FRAME,
  }),
  cell(sjjCell('02', '02'), L.lead, STEPS[1].id, 'Mute students if necessary.', {
    frame: STUDENTS_JUST_JOINED_LEAD_TUTOR_STEP_02_FRAME,
  }),
  cell(
    sjjCell('03', '02'),
    L.lead,
    STEPS[2].id,
    'Ping tutor if they missed moving student to breakout room for late joiners.',
    { frame: STUDENTS_JUST_JOINED_LEAD_TUTOR_STEP_03_FRAME },
  ),

  cell(
    sjjCell('03', '03'),
    L.regular,
    STEPS[2].id,
    'Move student to breakout room.',
    { frame: STUDENTS_JUST_JOINED_REGULAR_TUTOR_STEP_03_FRAME },
  ),

  cell(sjjCell('01', '06'), L.frontStageTech, STEPS[0].id, 'Zoom', {
    frame: ZOOM_TECH_LOGO,
    summary: STUDENTS_JUST_JOINED_ZOOM_STEP_01_DESCRIPTION,
  }),
  cell(sjjCell('02', '06'), L.frontStageTech, STEPS[1].id, 'Zoom', {
    frame: ZOOM_TECH_LOGO,
    summary: STUDENTS_JUST_JOINED_ZOOM_STEP_02_DESCRIPTION,
  }),
  cell(sjjCell('03', '06'), L.frontStageTech, STEPS[2].id, 'Zoom', {
    frame: ZOOM_TECH_LOGO,
    summary: STUDENTS_JUST_JOINED_ZOOM_STEP_03_DESCRIPTION,
  }),
]

export const STUDENTS_JUST_JOINED_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: STUDENTS_JUST_JOINED_HAPPY_PATH_ID,
    name: 'Full room, on time',
    summary:
      'Teachers and tutors welcome students as they join the session.',
    note: null,
    kind: 'happy',
    status: 'live',
  },
  lanes: [...LANES],
  steps: [...STEPS],
  cells: STUDENTS_JUST_JOINED_CELLS,
  dependencies: STUDENTS_JUST_JOINED_TRIGGERS,
}
