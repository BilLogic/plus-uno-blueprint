import { EMPTY_CELL_METADATA } from '@/lib/cellMetadata'
import type {
  BlueprintCell,
  BlueprintCellTrigger,
  BlueprintData,
} from '@/types/blueprint'
import type { PathType } from '@/types/database'

/** Application phase → Discovery scenario (UI fallback until DB seed). */
export const APPLICATION_PHASE_ID = 'a0000000-0000-4000-8000-000000000101'
export const DISCOVERY_SCENARIO_ID = 'a0000000-0000-4000-8000-000000000121'
export const INTERVIEW_SCENARIO_ID = 'a0000000-0000-4000-8000-000000000122'
export const APPLICATION_HAPPY_PATH_ID = 'a0000000-0000-4000-8000-000000000700'
export const APPLICATION_SAD_PATH_ID = 'a0000000-0000-4000-8000-000000000701'

const STEPS = [
  {
    id: 'a0000000-0000-4000-8000-000000000711',
    name: 'Discovers PLUS',
    column_position: 1,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000712',
    name: 'Discovers PLUS',
    column_position: 2,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000713',
    name: 'Discovers PLUS',
    column_position: 3,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000714',
    name: 'Discovers PLUS',
    column_position: 4,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000715',
    name: 'Discovers PLUS',
    column_position: 5,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000716',
    name: 'Interested in joining PLUS',
    column_position: 6,
  },
] as const

type ApplicationDiscoveryPathConfig = {
  pathId: string
  pathName: string
  pathDescription: string
  pathType: PathType
  cellSlotPrefix: '07' | '72'
  triggerSlotPrefix: '078' | '728'
  finalRegularTutorContent: string
  layerIds: {
    visual: string
    regular: string
    frontStage: string
    frontStageTech: string
    backStage: string
    backStageTech: string
    support: string
  }
}

const HAPPY_PATH_CONFIG: ApplicationDiscoveryPathConfig = {
  pathId: APPLICATION_HAPPY_PATH_ID,
  pathName: 'Happy Path',
  pathDescription: 'Potential Tutors discover and want to join PLUS.',
  pathType: 'happy',
  cellSlotPrefix: '07',
  triggerSlotPrefix: '078',
  finalRegularTutorContent: 'Interested in joining PLUS',
  layerIds: {
    visual: 'a0000000-0000-4000-8000-000000000710',
    regular: 'a0000000-0000-4000-8000-000000000703',
    frontStage: 'a0000000-0000-4000-8000-000000000704',
    frontStageTech: 'a0000000-0000-4000-8000-000000000706',
    backStage: 'a0000000-0000-4000-8000-000000000707',
    backStageTech: 'a0000000-0000-4000-8000-000000000708',
    support: 'a0000000-0000-4000-8000-000000000709',
  },
}

const SAD_PATH_CONFIG: ApplicationDiscoveryPathConfig = {
  pathId: APPLICATION_SAD_PATH_ID,
  pathName: 'Sad Path',
  pathDescription:
    'Potential Tutors discover and are not interested in joining PLUS.',
  pathType: 'unhappy',
  cellSlotPrefix: '72',
  triggerSlotPrefix: '728',
  finalRegularTutorContent: 'Not Interested in joining PLUS',
  layerIds: {
    visual: 'a0000000-0000-4000-8000-000000000791',
    regular: 'a0000000-0000-4000-8000-000000000792',
    frontStage: 'a0000000-0000-4000-8000-000000000793',
    frontStageTech: 'a0000000-0000-4000-8000-000000000794',
    backStage: 'a0000000-0000-4000-8000-000000000795',
    backStageTech: 'a0000000-0000-4000-8000-000000000796',
    support: 'a0000000-0000-4000-8000-000000000797',
  },
}

function cell(
  id: string,
  layerId: string,
  stepId: string,
  content: string,
): BlueprintCell {
  return {
    id,
    layer_id: layerId,
    step_id: stepId,
    content,
    ...EMPTY_CELL_METADATA,
  }
}

function appCell(
  config: ApplicationDiscoveryPathConfig,
  stepSlot: string,
  layerSuffix: string,
): string {
  return `a0000000-0000-4000-8000-000000${config.cellSlotPrefix}${stepSlot}${layerSuffix}`
}

function appTrigger(
  config: ApplicationDiscoveryPathConfig,
  triggerSlot: string,
): string {
  return `a0000000-0000-4000-8000-000000${config.triggerSlotPrefix}${triggerSlot}`
}

function buildApplicationDiscoveryFallback(
  config: ApplicationDiscoveryPathConfig,
): BlueprintData {
  const L = config.layerIds

  const layers = [
    { id: L.visual, name: 'Visual', row_position: 0 },
    { id: L.regular, name: 'Regular Tutor', row_position: 1 },
    { id: L.frontStage, name: 'Front Stage Actions', row_position: 2 },
    { id: L.frontStageTech, name: 'Front Stage Tech', row_position: 3 },
    { id: L.backStage, name: 'Back Stage Actions', row_position: 4 },
    { id: L.backStageTech, name: 'Back Stage Tech', row_position: 5 },
    { id: L.support, name: 'Support Actions', row_position: 6 },
  ] as const

  const triggers: BlueprintCellTrigger[] = [
    {
      id: appTrigger(config, '001'),
      source_cell_id: appCell(config, '01', '04'),
      target_cell_id: appCell(config, '01', '03'),
    },
    {
      id: appTrigger(config, '002'),
      source_cell_id: appCell(config, '02', '07'),
      target_cell_id: appCell(config, '02', '06'),
    },
    {
      id: appTrigger(config, '004'),
      source_cell_id: appCell(config, '02', '06'),
      target_cell_id: appCell(config, '02', '03'),
    },
    {
      id: appTrigger(config, '003'),
      source_cell_id: appCell(config, '03', '07'),
      target_cell_id: appCell(config, '03', '06'),
    },
    {
      id: appTrigger(config, '005'),
      source_cell_id: appCell(config, '03', '06'),
      target_cell_id: appCell(config, '03', '03'),
    },
    {
      id: appTrigger(config, '006'),
      source_cell_id: appCell(config, '04', '04'),
      target_cell_id: appCell(config, '04', '03'),
    },
    {
      id: appTrigger(config, '007'),
      source_cell_id: appCell(config, '04', '04'),
      target_cell_id: appCell(config, '04', '06'),
    },
    {
      id: appTrigger(config, '008'),
      source_cell_id: appCell(config, '05', '06'),
      target_cell_id: appCell(config, '05', '03'),
    },
    {
      id: appTrigger(config, '009'),
      source_cell_id: appCell(config, '05', '07'),
      target_cell_id: appCell(config, '05', '08'),
    },
    {
      id: appTrigger(config, '010'),
      source_cell_id: appCell(config, '05', '08'),
      target_cell_id: appCell(config, '05', '06'),
    },
    {
      id: appTrigger(config, '011'),
      source_cell_id: appCell(config, '01', '03'),
      target_cell_id: appCell(config, '06', '03'),
    },
    {
      id: appTrigger(config, '012'),
      source_cell_id: appCell(config, '02', '03'),
      target_cell_id: appCell(config, '06', '03'),
    },
    {
      id: appTrigger(config, '013'),
      source_cell_id: appCell(config, '03', '03'),
      target_cell_id: appCell(config, '06', '03'),
    },
    {
      id: appTrigger(config, '014'),
      source_cell_id: appCell(config, '04', '03'),
      target_cell_id: appCell(config, '06', '03'),
    },
    {
      id: appTrigger(config, '015'),
      source_cell_id: appCell(config, '05', '03'),
      target_cell_id: appCell(config, '06', '03'),
    },
  ]

  const cells: BlueprintCell[] = [
    ...STEPS.map((step, stepIndex) =>
      cell(
        appCell(config, String(stepIndex + 1).padStart(2, '0'), '10'),
        L.visual,
        step.id,
        '',
      ),
    ),

    cell(appCell(config, '01', '03'), L.regular, STEPS[0].id, 'Discovers PLUS'),
    cell(
      appCell(config, '01', '04'),
      L.frontStage,
      STEPS[0].id,
      'Previous or Current PLUS Tutor might have informed about PLUS',
    ),

    cell(appCell(config, '02', '03'), L.regular, STEPS[1].id, 'Discovers PLUS'),
    cell(appCell(config, '02', '06'), L.frontStageTech, STEPS[1].id, 'Social Media'),
    cell(
      appCell(config, '02', '07'),
      L.backStage,
      STEPS[1].id,
      'Marketing Team creates social media posts and manages social platforms.',
    ),
    cell(appCell(config, '02', '08'), L.backStageTech, STEPS[1].id, 'Figma'),
    cell(appCell(config, '02', '09'), L.support, STEPS[1].id, 'Branding Guidelines'),

    cell(appCell(config, '03', '03'), L.regular, STEPS[2].id, 'Discovers PLUS'),
    cell(
      appCell(config, '03', '06'),
      L.frontStageTech,
      STEPS[2].id,
      'Marketing Website',
    ),
    cell(
      appCell(config, '03', '07'),
      L.backStage,
      STEPS[2].id,
      'Design Team manages content and messaging on the website. Dev Team implements website into code.',
    ),
    cell(
      appCell(config, '03', '08'),
      L.backStageTech,
      STEPS[2].id,
      'Figma\nDev Tools',
    ),
    cell(
      appCell(config, '03', '09'),
      L.support,
      STEPS[2].id,
      'Branding Guidelines, Design System',
    ),

    cell(appCell(config, '04', '03'), L.regular, STEPS[3].id, 'Discovers PLUS'),
    cell(
      appCell(config, '04', '04'),
      L.frontStage,
      STEPS[3].id,
      'Tutor Supervisor team meets prospective tutors at on-campus job fair',
    ),
    cell(
      appCell(config, '04', '06'),
      L.frontStageTech,
      STEPS[3].id,
      'Posters\nOn-campus booth',
    ),

    cell(appCell(config, '05', '03'), L.regular, STEPS[4].id, 'Discovers PLUS'),
    cell(appCell(config, '05', '06'), L.frontStageTech, STEPS[4].id, 'Handshake'),
    cell(
      appCell(config, '05', '07'),
      L.backStage,
      STEPS[4].id,
      'Tutor Supervisor Team posts job openings on handshake',
    ),
    cell(
      appCell(config, '05', '08'),
      L.backStageTech,
      STEPS[4].id,
      'Handshake Employer Profile',
    ),

    cell(
      appCell(config, '06', '03'),
      L.regular,
      STEPS[5].id,
      config.finalRegularTutorContent,
    ),
  ]

  return {
    path: {
      id: config.pathId,
      name: config.pathName,
      description: config.pathDescription,
      path_type: config.pathType,
    },
    layers: [...layers],
    steps: [...STEPS],
    cells,
    triggers,
  }
}

export const APPLICATION_HAPPY_PATH_FALLBACK =
  buildApplicationDiscoveryFallback(HAPPY_PATH_CONFIG)

export const APPLICATION_SAD_PATH_FALLBACK =
  buildApplicationDiscoveryFallback(SAD_PATH_CONFIG)
