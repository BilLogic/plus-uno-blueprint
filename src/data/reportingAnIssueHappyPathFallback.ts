import { REPORTING_AN_ISSUE_REGULAR_TUTOR_ONBOARDING_LINKS } from '@/data/onboardingModuleLinks'
import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import {
  REPORTING_AN_ISSUE_EMAIL_STEP_01_DESCRIPTION,
  REPORTING_AN_ISSUE_EMAIL_STEP_04_DESCRIPTION,
  REPORTING_AN_ISSUE_LEAD_TUTOR_STEP_01_PICTURE,
  REPORTING_AN_ISSUE_LEAD_TUTOR_STEP_03_PICTURE,
  REPORTING_AN_ISSUE_REGULAR_TUTOR_STEP_01_PICTURE,
  REPORTING_AN_ISSUE_REGULAR_TUTOR_STEP_03_PICTURE,
  REPORTING_AN_ISSUE_SLACK_STEP_01_DESCRIPTION,
  REPORTING_AN_ISSUE_SLACK_STEP_04_DESCRIPTION,
  REPORTING_AN_ISSUE_ZOOM_STEP_04_DESCRIPTION,
} from '@/data/reportingAnIssuePictures'
import { techDescriptionLink, mergeUrlLinks } from '@/lib/blueprintTechDescriptions'
import {
  EMAIL_TECH_LOGO,
  SLACK_TECH_LOGO,
  ZOOM_TECH_LOGO,
} from '@/lib/blueprintTechPictures'
import type {
  BlueprintCell,
  BlueprintCellDependency,
  BlueprintData,
} from '@/types/blueprint'

export const REPORTING_AN_ISSUE_SCENARIO_ID =
  'a0000000-0000-4000-8000-000000000207'

export const REPORTING_AN_ISSUE_HAPPY_PATH_ID =
  'a0000000-0000-4000-8000-00000000080f'

const STEP_VISUAL_LAYER_ID = 'a0000000-0000-4000-8000-000000000910'

const LAYERS = [
  { id: STEP_VISUAL_LAYER_ID, name: 'Storyboard', position: 0 },
  {
    id: 'a0000000-0000-4000-8000-000000000917',
    name: 'Lead Tutor',
    position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000911',
    name: 'Regular Tutor',
    position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000913',
    name: 'Front Stage Tech',
    position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000912',
    name: 'Front Stage Actions',
    position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000915',
    name: 'Back Stage Tech',
    position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000914',
    name: 'Back Stage Actions',
    position: 6,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000916',
    name: 'Support Actions',
    position: 7,
  },
] as const

const STEP_REACH_OUT = {
  id: 'a0000000-0000-4000-8000-000000000988',
  name: 'Reach out',
  position: 1,
} as const

const STEP_REQUEST_ASSISTANCE = {
  id: 'a0000000-0000-4000-8000-000000000991',
  name: 'Request assistance',
  position: 2,
} as const

const STEP_FOLLOW_UP = {
  id: 'a0000000-0000-4000-8000-000000000993',
  name: 'Follow up',
  position: 3,
} as const

const STEP_RESOLVE_CONCERN = {
  id: 'a0000000-0000-4000-8000-000000000990',
  name: 'Resolve concern',
  position: 4,
} as const

/** Visual column order: Reach out → Request assistance → Follow up → Resolve concern. */
const STEPS = [
  STEP_REACH_OUT,
  STEP_REQUEST_ASSISTANCE,
  STEP_FOLLOW_UP,
  STEP_RESOLVE_CONCERN,
] as const

const L = {
  visual: STEP_VISUAL_LAYER_ID,
  lead: 'a0000000-0000-4000-8000-000000000917',
  regular: 'a0000000-0000-4000-8000-000000000911',
  frontStage: 'a0000000-0000-4000-8000-000000000912',
  frontStageTech: 'a0000000-0000-4000-8000-000000000913',
  backStage: 'a0000000-0000-4000-8000-000000000914',
  backStageTech: 'a0000000-0000-4000-8000-000000000915',
  support: 'a0000000-0000-4000-8000-000000000916',
} as const

function cell(
  id: string,
  laneId: string,
  stepId: string,
  content: string,
  metadata: Partial<Pick<BlueprintCell, 'picture' | 'summary' | 'links'>> = {},
): BlueprintCell {
  const links =
    laneId === L.regular || laneId === L.lead
      ? mergeUrlLinks(metadata.links ?? [], REPORTING_AN_ISSUE_REGULAR_TUTOR_ONBOARDING_LINKS)
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

function issueCell(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-0000001d${stepSlot}${layerSuffix}`
}

function issueDependency(dependencySlot: string): string {
  return `a0000000-0000-4000-8000-000000098${dependencySlot}`
}

function dependency(
  slot: string,
  fromStep: string,
  fromLayer: string,
  toStep: string,
  toLayer: string,
): BlueprintCellDependency {
  return {
    id: issueDependency(slot),
    source_cell_id: issueCell(fromStep, fromLayer),
    target_cell_id: issueCell(toStep, toLayer),
  }
}

const REPORTING_AN_ISSUE_TRIGGERS: BlueprintCellDependency[] = [
  dependency('070', '01', '03', '01', '06'),
  dependency('074', '01', '02', '01', '06'),
  dependency('076', '01', '06', '01', '04'),
  dependency('078', '01', '04', '03', '04'),
  dependency('081', '01', '04', '02', '07'),
  dependency('077', '03', '04', '04', '06'),
  dependency('073', '04', '06', '04', '03'),
  dependency('075', '04', '06', '04', '02'),
  dependency('079', '04', '02', '02', '07'),
  dependency('080', '04', '03', '02', '07'),
]

const REPORTING_AN_ISSUE_CELLS: BlueprintCell[] = [
  cell(issueCell('01', '10'), L.visual, STEP_REACH_OUT.id, ''),
  cell(
    issueCell('01', '02'),
    L.lead,
    STEP_REACH_OUT.id,
    'Reach out to PLUS staff with any concerns.',
    { picture: REPORTING_AN_ISSUE_LEAD_TUTOR_STEP_01_PICTURE },
  ),
  cell(
    issueCell('01', '03'),
    L.regular,
    STEP_REACH_OUT.id,
    'Reach out to PLUS staff with any concerns.',
    { picture: REPORTING_AN_ISSUE_REGULAR_TUTOR_STEP_01_PICTURE },
  ),
  cell(
    issueCell('01', '04'),
    L.frontStage,
    STEP_REACH_OUT.id,
    'PLUS tutor supervisor team evaluates concern and reaches out as needed.',
  ),
  cell(
    issueCell('01', '06'),
    L.frontStageTech,
    STEP_REACH_OUT.id,
    'Slack, Email',
    {
      links: [
        techDescriptionLink(
          'Slack',
          REPORTING_AN_ISSUE_SLACK_STEP_01_DESCRIPTION,
          SLACK_TECH_LOGO,
        ),
        techDescriptionLink(
          'Email',
          REPORTING_AN_ISSUE_EMAIL_STEP_01_DESCRIPTION,
          EMAIL_TECH_LOGO,
        ),
      ],
    },
  ),

  // Cell-id slot "02" is historical (Resolve was once column 2); keep IDs stable.
  cell(issueCell('02', '10'), L.visual, STEP_RESOLVE_CONCERN.id, ''),
  cell(
    issueCell('02', '07'),
    L.backStage,
    STEP_RESOLVE_CONCERN.id,
    'PLUS supervisor team is able to resolve concern.',
  ),

  cell(issueCell('03', '10'), L.visual, STEP_REQUEST_ASSISTANCE.id, ''),
  cell(
    issueCell('03', '04'),
    L.frontStage,
    STEP_REQUEST_ASSISTANCE.id,
    'If needed, PLUS staff might request assistance.',
  ),

  cell(issueCell('04', '10'), L.visual, STEP_FOLLOW_UP.id, ''),
  cell(
    issueCell('04', '02'),
    L.lead,
    STEP_FOLLOW_UP.id,
    'Processes request and follows up on request.',
    { picture: REPORTING_AN_ISSUE_LEAD_TUTOR_STEP_03_PICTURE },
  ),
  cell(
    issueCell('04', '03'),
    L.regular,
    STEP_FOLLOW_UP.id,
    'Processes request and follows up on request.',
    { picture: REPORTING_AN_ISSUE_REGULAR_TUTOR_STEP_03_PICTURE },
  ),
  cell(
    issueCell('04', '06'),
    L.frontStageTech,
    STEP_FOLLOW_UP.id,
    'Slack, Email, Zoom',
    {
      links: [
        techDescriptionLink(
          'Slack',
          REPORTING_AN_ISSUE_SLACK_STEP_04_DESCRIPTION,
          SLACK_TECH_LOGO,
        ),
        techDescriptionLink(
          'Email',
          REPORTING_AN_ISSUE_EMAIL_STEP_04_DESCRIPTION,
          EMAIL_TECH_LOGO,
        ),
        techDescriptionLink(
          'Zoom',
          REPORTING_AN_ISSUE_ZOOM_STEP_04_DESCRIPTION,
          ZOOM_TECH_LOGO,
        ),
      ],
    },
  ),
]

export const REPORTING_AN_ISSUE_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: REPORTING_AN_ISSUE_HAPPY_PATH_ID,
    name: 'Standard',
    summary: 'Tutor reports an issue after tutoring session.',
    note: null,
    path_type: 'happy',
    status: 'live',
  },
  lanes: [...LAYERS],
  steps: [...STEPS],
  cells: REPORTING_AN_ISSUE_CELLS,
  dependencies: REPORTING_AN_ISSUE_TRIGGERS,
}
