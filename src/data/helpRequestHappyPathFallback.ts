import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import { HELP_REQUEST_REGULAR_TUTOR_ONBOARDING_LINKS } from '@/data/onboardingModuleLinks'
import { mergeUrlLinks, techDescriptionLink } from '@/lib/blueprintTechDescriptions'
import {
  GOAL_SETTING_PARALLEL_LEAD_STEP_FRAMES,
  GOAL_SETTING_PARALLEL_PARTNER_STEP_FRAMES,
} from '@/data/goalSettingParallelSessionFrames'
import { GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION } from '@/data/goalSettingHappyPathFallback'
import {
  HELP_REQUEST_LEAVE_BREAKOUT_STEP_ID,
  HELP_REQUEST_PLUS_APP_STEP_06_DESCRIPTION,
  HELP_REQUEST_PLUS_APP_STEP_06_FIGMA_URL,
  HELP_REQUEST_PLUS_APP_STEP_06_FRAME,
  HELP_REQUEST_REGULAR_TUTOR_STEP_01_FRAME,
  HELP_REQUEST_REGULAR_TUTOR_STEP_02_FRAME,
  HELP_REQUEST_REGULAR_TUTOR_STEP_03_FRAME,
  HELP_REQUEST_REGULAR_TUTOR_STEP_04_FRAME,
  HELP_REQUEST_REGULAR_TUTOR_STEP_05_FRAME,
  HELP_REQUEST_REGULAR_TUTOR_STEP_06_FRAME,
  HELP_REQUEST_ZOOM_STEP_01_DESCRIPTION,
  HELP_REQUEST_ZOOM_STEP_02_DESCRIPTION,
  HELP_REQUEST_ZOOM_STEP_03_DESCRIPTION,
  HELP_REQUEST_ZOOM_STEP_04_DESCRIPTION,
  HELP_REQUEST_ZOOM_STEP_05_DESCRIPTION,
} from '@/data/helpRequestFrames'
import { getScenarioParallelNote } from '@/lib/scenarioParallelInfo'
import {
  buildParallelSessionPartnerLeadCells,
  buildParallelSessionPartnerLeadDependencies,
  PARALLEL_SESSION_PARTNER_CONTENT,
} from '@/data/parallelSessionPartnerLead'
import type {
  BlueprintCell,
  BlueprintCellDependency,
  BlueprintData,
} from '@/types/blueprint'

import { HELP_REQUEST_SCENARIO_ID } from '@/data/parallelSessionScenarioIds'

export { HELP_REQUEST_SCENARIO_ID }

export const HELP_REQUEST_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-00000000080d'

const STEP_VISUAL_LANE_ID = 'a0000000-0000-4000-8000-000000000860'

const LANES = [
  { id: STEP_VISUAL_LANE_ID, name: 'Storyboard', position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000867',
    name: 'Teacher',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000868',
    name: 'Lead Tutor',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000861',
    name: 'Regular Tutor',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000863',
    name: 'Front Stage Tech',
    position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000862',
    name: 'Front Stage Actions',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000865',
    name: 'Back Stage Tech',
    position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000864',
    name: 'Back Stage Actions',
    position: 7,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000866',
    name: 'Support Actions',
    position: 8,
  },
] as const

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000975',
    name: 'Receive help request',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000976',
    name: 'Finish conversation',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000977',
    name: 'Visit student',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000978',
    name: 'Resolve issue',
    position: 4,
  },
  {
    id: HELP_REQUEST_LEAVE_BREAKOUT_STEP_ID,
    name: 'Leave breakout room',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000979',
    name: 'Next student',
    position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000987',
    name: PARALLEL_SESSION_PARTNER_CONTENT[6]!,
    position: 7,
  },
] as const

const L = {
  visual: STEP_VISUAL_LANE_ID,
  partner: 'a0000000-0000-4000-8000-000000000867',
  lead: 'a0000000-0000-4000-8000-000000000868',
  regular: 'a0000000-0000-4000-8000-000000000861',
  frontStage: 'a0000000-0000-4000-8000-000000000862',
  frontStageTech: 'a0000000-0000-4000-8000-000000000863',
  backStage: 'a0000000-0000-4000-8000-000000000864',
  backStageTech: 'a0000000-0000-4000-8000-000000000865',
  support: 'a0000000-0000-4000-8000-000000000866',
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
      ? mergeUrlLinks(metadata.links ?? [], HELP_REQUEST_REGULAR_TUTOR_ONBOARDING_LINKS)
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

function hrCell(stepSlot: string, laneSuffix: string): string {
  return `a0000000-0000-4000-8000-0000001b${stepSlot}${laneSuffix}`
}

function hrDependency(dependencySlot: string): string {
  return `a0000000-0000-4000-8000-000000099${dependencySlot}`
}

function dependency(
  slot: string,
  fromStep: string,
  fromLane: string,
  toStep: string,
  toLane: string,
): BlueprintCellDependency {
  return {
    id: hrDependency(slot),
    source_cell_id: hrCell(fromStep, fromLane),
    target_cell_id: hrCell(toStep, toLane),
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
    hrCell(stepSlot, laneSuffix),
  dependencyId: (slot: string) => hrDependency(slot),
  partnerLaneId: L.partner,
  leadLaneId: L.lead,
  stepIdForColumn: (column: number) => STEPS[column - 1]!.id,
  leadStepPictures: GOAL_SETTING_PARALLEL_LEAD_STEP_FRAMES,
  partnerStepPictures: GOAL_SETTING_PARALLEL_PARTNER_STEP_FRAMES,
}

const HELP_REQUEST_PARTNER_LEAD_TRIGGERS =
  buildParallelSessionPartnerLeadDependencies(partnerLeadOptions)

const HELP_REQUEST_TRIGGERS: BlueprintCellDependency[] = [
  ...HELP_REQUEST_PARTNER_LEAD_TRIGGERS,
  ...rowDependencies('03', 50, 5),
  ...columnLaneDependencies('03', '06', 113, 6),
  dependency('060', '06', '03', '01', '03'),
]

const HELP_REQUEST_CELLS: BlueprintCell[] = [
  ...STEPS.map((step, index) =>
    cell(hrCell(String(index + 1).padStart(2, '0'), '10'), L.visual, step.id, ''),
  ),
  ...buildParallelSessionPartnerLeadCells(partnerLeadOptions),

  cell(hrCell('01', '03'), L.regular, STEPS[0].id, 'Tutor receives help request.', {
    frame: HELP_REQUEST_REGULAR_TUTOR_STEP_01_FRAME,
  }),
  cell(
    hrCell('02', '03'),
    L.regular,
    STEPS[1].id,
    'Finish current conversation in 1-2 minutes.',
    { frame: HELP_REQUEST_REGULAR_TUTOR_STEP_02_FRAME },
  ),
  cell(hrCell('03', '03'), L.regular, STEPS[2].id, 'Visit student requesting help.', {
    frame: HELP_REQUEST_REGULAR_TUTOR_STEP_03_FRAME,
  }),
  cell(hrCell('04', '03'), L.regular, STEPS[3].id, 'Resolve issue.', {
    frame: HELP_REQUEST_REGULAR_TUTOR_STEP_04_FRAME,
  }),
  cell(hrCell('05', '03'), L.regular, STEPS[4].id, 'Leave breakout room.', {
    frame: HELP_REQUEST_REGULAR_TUTOR_STEP_05_FRAME,
  }),
  cell(
    hrCell('06', '03'),
    L.regular,
    STEPS[5].id,
    'Return to the next student in sorted order set by researchers.',
    { frame: HELP_REQUEST_REGULAR_TUTOR_STEP_06_FRAME },
  ),

  cell(hrCell('01', '06'), L.frontStageTech, STEPS[0].id, 'Zoom', {
    summary: HELP_REQUEST_ZOOM_STEP_01_DESCRIPTION,
  }),
  cell(hrCell('02', '06'), L.frontStageTech, STEPS[1].id, 'Zoom', {
    summary: HELP_REQUEST_ZOOM_STEP_02_DESCRIPTION,
  }),
  cell(hrCell('03', '06'), L.frontStageTech, STEPS[2].id, 'Zoom', {
    summary: HELP_REQUEST_ZOOM_STEP_03_DESCRIPTION,
  }),
  cell(hrCell('04', '06'), L.frontStageTech, STEPS[3].id, 'Zoom', {
    summary: HELP_REQUEST_ZOOM_STEP_04_DESCRIPTION,
  }),
  cell(hrCell('05', '06'), L.frontStageTech, STEPS[4].id, 'Zoom', {
    summary: HELP_REQUEST_ZOOM_STEP_05_DESCRIPTION,
  }),
  cell(hrCell('06', '06'), L.frontStageTech, STEPS[5].id, 'PLUS App', {
    links: [
      techDescriptionLink(
        'PLUS App',
        HELP_REQUEST_PLUS_APP_STEP_06_DESCRIPTION,
        HELP_REQUEST_PLUS_APP_STEP_06_FRAME,
        HELP_REQUEST_PLUS_APP_STEP_06_FIGMA_URL,
      ),
    ],
  }),

  cell(
    hrCell('06', '07'),
    L.backStage,
    STEPS[5].id,
    'Researchers set student order.',
  ),

  cell(hrCell('06', '09'), L.support, STEPS[5].id, 'Dev Team\nDesign Team', {
    summary: GOAL_SETTING_SUPPORT_ACTIONS_DESCRIPTION,
  }),
]

export const HELP_REQUEST_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: HELP_REQUEST_HAPPY_PATH_ID,
    name: 'Resolved in the room',
    summary:
      'Tutors receive and resolve student help requests during the session.',
    note: getScenarioParallelNote(HELP_REQUEST_SCENARIO_ID),
    kind: 'happy',
    status: 'live',
  },
  lanes: [...LANES],
  steps: [...STEPS],
  cells: HELP_REQUEST_CELLS,
  dependencies: HELP_REQUEST_TRIGGERS,
}
