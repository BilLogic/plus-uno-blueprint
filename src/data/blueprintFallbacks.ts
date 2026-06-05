import { applyBlueprintDisplayFilters } from '@/lib/applyBlueprintDisplayFilters'
import type {
  BlueprintCell,
  BlueprintCellTrigger,
  BlueprintData,
} from '@/types/blueprint'

/** Warm-Up scenario from supabase/seed.sql */
export const WARM_UP_SCENARIO_ID = 'a0000000-0000-4000-8000-000000000203'

export const WARM_UP_HAPPY_PATH_ID = 'a0000000-0000-4000-8000-000000000300'
export const WARM_UP_ALTERNATE_PATH_ID = 'a0000000-0000-4000-8000-000000000350'
export const WARM_UP_SAD_PATH_ID = 'a0000000-0000-4000-8000-000000000360'

const WARM_UP_STEP_3_ID = 'a0000000-0000-4000-8000-000000000313'
/** Sad-path-only step after the shared first four happy steps. */
export const WARM_UP_SAD_STEP_5_ID = 'a0000000-0000-4000-8000-000000000319'
export const WARM_UP_SAD_STEP_6_ID = 'a0000000-0000-4000-8000-000000000320'

const PATH_ID = WARM_UP_HAPPY_PATH_ID

const LAYERS = [
  { id: 'a0000000-0000-4000-8000-000000000301', name: 'Partner Action: Teacher', row_position: 1 },
  { id: 'a0000000-0000-4000-8000-000000000302', name: 'Lead Tutor', row_position: 2 },
  { id: 'a0000000-0000-4000-8000-000000000303', name: 'Regular Tutor', row_position: 3 },
  { id: 'a0000000-0000-4000-8000-000000000306', name: 'Front Stage Tech', row_position: 4 },
  { id: 'a0000000-0000-4000-8000-000000000305', name: 'Tutor Resources', row_position: 5 },
  { id: 'a0000000-0000-4000-8000-000000000304', name: 'Front Stage Actions', row_position: 6 },
  { id: 'a0000000-0000-4000-8000-000000000307', name: 'Back Stage Actions', row_position: 7 },
  { id: 'a0000000-0000-4000-8000-000000000308', name: 'Back Stage Tech', row_position: 8 },
  { id: 'a0000000-0000-4000-8000-000000000309', name: 'Support Actions', row_position: 9 },
] as const

const STEPS = [
  { id: 'a0000000-0000-4000-8000-000000000311', name: 'Enter Breakout Room', column_position: 1 },
  { id: 'a0000000-0000-4000-8000-000000000312', name: 'Greet Student', column_position: 2 },
  { id: 'a0000000-0000-4000-8000-000000000313', name: 'Ask Student to Share Screen', column_position: 3 },
  { id: 'a0000000-0000-4000-8000-000000000314', name: 'Remind Student They Can Ask for Help', column_position: 4 },
  { id: 'a0000000-0000-4000-8000-000000000315', name: 'Mark Student Present', column_position: 5 },
  { id: 'a0000000-0000-4000-8000-000000000316', name: 'Select Engagement level', column_position: 6 },
  { id: 'a0000000-0000-4000-8000-000000000317', name: 'Mark Student Helped', column_position: 7 },
  { id: 'a0000000-0000-4000-8000-000000000318', name: 'Move to Next Student', column_position: 8 },
] as const

const WARM_UP_SAD_STEP_5 = {
  id: WARM_UP_SAD_STEP_5_ID,
  name: 'PLUS App Not Working',
  column_position: 5,
} as const

const WARM_UP_SAD_STEP_6 = {
  id: WARM_UP_SAD_STEP_6_ID,
  name: 'Unable to Complete Warm-Up',
  column_position: 6,
} as const

const L = {
  partner: 'a0000000-0000-4000-8000-000000000301',
  lead: 'a0000000-0000-4000-8000-000000000302',
  regular: 'a0000000-0000-4000-8000-000000000303',
  tutorResources: 'a0000000-0000-4000-8000-000000000305',
  frontTech: 'a0000000-0000-4000-8000-000000000306',
  support: 'a0000000-0000-4000-8000-000000000309',
} as const

const TUTOR_RESOURCES_STEP =
  'Onboarding & Lessons Modules'
const FRONT_STAGE_TECH_STEP = 'Zoom/Pencil\nPLUS App\nSlack'
const SUPPORT_STEP = 'Dev Team\nDesign team'
const SUPPORT_STEP_8 =
  'Researchers set student order\nDev Team\nDesign team'

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
  }
}

const WARM_UP_CELLS: BlueprintCell[] = [
  cell('a0000000-0000-4000-8000-000000040101', L.partner, STEPS[0].id, 'Circulate and quietly observe the students'),
  cell('a0000000-0000-4000-8000-000000040102', L.lead, STEPS[0].id, 'Rename students to match roster name'),
  cell('a0000000-0000-4000-8000-000000040103', L.regular, STEPS[0].id, 'Enter Breakout room'),
  cell(
    'a0000000-0000-4000-8000-000000040105',
    L.tutorResources,
    STEPS[0].id,
    'Onboarding & Lessons Modules',
  ),
  cell(
    'a0000000-0000-4000-8000-000000040106',
    L.frontTech,
    STEPS[0].id,
    'Zoom/Pencil\nPLUS App\nSlack',
  ),
  cell('a0000000-0000-4000-8000-000000040109', L.support, STEPS[0].id, 'Dev Team\nDesign team'),
  cell(
    'a0000000-0000-4000-8000-000000040201',
    L.partner,
    STEPS[1].id,
    'Remind students to keep working while waiting',
  ),
  cell('a0000000-0000-4000-8000-000000040202', L.lead, STEPS[1].id, 'Add any un-rostered students to attendance list'),
  cell('a0000000-0000-4000-8000-000000040203', L.regular, STEPS[1].id, 'Greet student'),
  cell('a0000000-0000-4000-8000-000000040205', L.tutorResources, STEPS[1].id, TUTOR_RESOURCES_STEP),
  cell('a0000000-0000-4000-8000-000000040206', L.frontTech, STEPS[1].id, FRONT_STAGE_TECH_STEP),
  cell('a0000000-0000-4000-8000-000000040209', L.support, STEPS[1].id, SUPPORT_STEP),
  cell(
    'a0000000-0000-4000-8000-000000040301',
    L.partner,
    STEPS[2].id,
    'Checks if all students are in the correct breakout room',
  ),
  cell('a0000000-0000-4000-8000-000000040302', L.lead, STEPS[2].id, 'Manually assign unpaired students to available tutors'),
  cell('a0000000-0000-4000-8000-000000040303', L.regular, STEPS[2].id, 'Ask them to share screen'),
  cell('a0000000-0000-4000-8000-000000040305', L.tutorResources, STEPS[2].id, TUTOR_RESOURCES_STEP),
  cell('a0000000-0000-4000-8000-000000040306', L.frontTech, STEPS[2].id, FRONT_STAGE_TECH_STEP),
  cell('a0000000-0000-4000-8000-000000040309', L.support, STEPS[2].id, SUPPORT_STEP),
  cell(
    'a0000000-0000-4000-8000-000000040403',
    L.regular,
    STEPS[3].id,
    'Remind them that they can ask for help on content and support',
  ),
  cell('a0000000-0000-4000-8000-000000040405', L.tutorResources, STEPS[3].id, TUTOR_RESOURCES_STEP),
  cell('a0000000-0000-4000-8000-000000040406', L.frontTech, STEPS[3].id, FRONT_STAGE_TECH_STEP),
  cell('a0000000-0000-4000-8000-000000040409', L.support, STEPS[3].id, SUPPORT_STEP),
  cell('a0000000-0000-4000-8000-000000040503', L.regular, STEPS[4].id, 'Mark them as present'),
  cell('a0000000-0000-4000-8000-000000040505', L.tutorResources, STEPS[4].id, TUTOR_RESOURCES_STEP),
  cell('a0000000-0000-4000-8000-000000040506', L.frontTech, STEPS[4].id, FRONT_STAGE_TECH_STEP),
  cell('a0000000-0000-4000-8000-000000040509', L.support, STEPS[4].id, SUPPORT_STEP),
  cell('a0000000-0000-4000-8000-000000040603', L.regular, STEPS[5].id, 'Select Engagement level'),
  cell('a0000000-0000-4000-8000-000000040605', L.tutorResources, STEPS[5].id, TUTOR_RESOURCES_STEP),
  cell('a0000000-0000-4000-8000-000000040606', L.frontTech, STEPS[5].id, FRONT_STAGE_TECH_STEP),
  cell('a0000000-0000-4000-8000-000000040609', L.support, STEPS[5].id, SUPPORT_STEP),
  cell('a0000000-0000-4000-8000-000000040703', L.regular, STEPS[6].id, 'Mark them as helped'),
  cell('a0000000-0000-4000-8000-000000040705', L.tutorResources, STEPS[6].id, TUTOR_RESOURCES_STEP),
  cell('a0000000-0000-4000-8000-000000040706', L.frontTech, STEPS[6].id, FRONT_STAGE_TECH_STEP),
  cell('a0000000-0000-4000-8000-000000040709', L.support, STEPS[6].id, SUPPORT_STEP),
  cell('a0000000-0000-4000-8000-000000040803', L.regular, STEPS[7].id, 'Move on to the next student in sorted order set by researchers'),
  cell('a0000000-0000-4000-8000-000000040805', L.tutorResources, STEPS[7].id, TUTOR_RESOURCES_STEP),
  cell('a0000000-0000-4000-8000-000000040806', L.frontTech, STEPS[7].id, FRONT_STAGE_TECH_STEP),
  cell('a0000000-0000-4000-8000-000000040809', L.support, STEPS[7].id, SUPPORT_STEP_8),
]

const WARM_UP_TRIGGERS: BlueprintCellTrigger[] = [
  {
    id: 'a0000000-0000-4000-8000-000000050108',
    source_cell_id: 'a0000000-0000-4000-8000-000000040101',
    target_cell_id: 'a0000000-0000-4000-8000-000000040201',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050109',
    source_cell_id: 'a0000000-0000-4000-8000-000000040102',
    target_cell_id: 'a0000000-0000-4000-8000-000000040202',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050110',
    source_cell_id: 'a0000000-0000-4000-8000-000000040201',
    target_cell_id: 'a0000000-0000-4000-8000-000000040301',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050111',
    source_cell_id: 'a0000000-0000-4000-8000-000000040202',
    target_cell_id: 'a0000000-0000-4000-8000-000000040302',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050101',
    source_cell_id: 'a0000000-0000-4000-8000-000000040103',
    target_cell_id: 'a0000000-0000-4000-8000-000000040203',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050102',
    source_cell_id: 'a0000000-0000-4000-8000-000000040203',
    target_cell_id: 'a0000000-0000-4000-8000-000000040303',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050103',
    source_cell_id: 'a0000000-0000-4000-8000-000000040303',
    target_cell_id: 'a0000000-0000-4000-8000-000000040403',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050104',
    source_cell_id: 'a0000000-0000-4000-8000-000000040403',
    target_cell_id: 'a0000000-0000-4000-8000-000000040503',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050105',
    source_cell_id: 'a0000000-0000-4000-8000-000000040503',
    target_cell_id: 'a0000000-0000-4000-8000-000000040603',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050106',
    source_cell_id: 'a0000000-0000-4000-8000-000000040603',
    target_cell_id: 'a0000000-0000-4000-8000-000000040703',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050107',
    source_cell_id: 'a0000000-0000-4000-8000-000000040703',
    target_cell_id: 'a0000000-0000-4000-8000-000000040803',
  },
  {
    id: 'a0000000-0000-4000-8000-000000050112',
    source_cell_id: 'a0000000-0000-4000-8000-000000040803',
    target_cell_id: 'a0000000-0000-4000-8000-000000040103',
  },
]

export const WARM_UP_HAPPY_PATH_FALLBACK: BlueprintData = {
  path: {
    id: PATH_ID,
    name: 'Happy Path',
    path_type: 'happy',
  },
  layers: [...LAYERS],
  steps: [...STEPS],
  cells: WARM_UP_CELLS,
  triggers: WARM_UP_TRIGGERS,
}

function mapHappyCellId(id: string): string {
  return id.replace('00000004', '00000006')
}

function mapHappyLayerId(id: string): string {
  return id.replace('00000003', '00000004')
}

function mapHappyTriggerId(id: string): string {
  return id.replace('00000005', '00000007')
}

function mapSadCellId(id: string): string {
  return id.replace('00000004', '00000008')
}

function mapSadLayerId(id: string): string {
  return id.replace('00000003', '00000005')
}

function mapSadTriggerId(id: string): string {
  return id.replace('00000005', '00000009')
}

const WARM_UP_ALTERNATE_TRIGGERS: BlueprintCellTrigger[] = [
  ...WARM_UP_TRIGGERS.filter(
    (t) =>
      t.id !== 'a0000000-0000-4000-8000-000000050102' &&
      t.id !== 'a0000000-0000-4000-8000-000000050103' &&
      t.id !== 'a0000000-0000-4000-8000-000000050110' &&
      t.id !== 'a0000000-0000-4000-8000-000000050111',
  ).map((t) => ({
    id: mapHappyTriggerId(t.id),
    source_cell_id: mapHappyCellId(t.source_cell_id),
    target_cell_id: mapHappyCellId(t.target_cell_id),
  })),
  {
    id: 'a0000000-0000-4000-8000-000000070102',
    source_cell_id: 'a0000000-0000-4000-8000-000000060203',
    target_cell_id: 'a0000000-0000-4000-8000-000000060403',
  },
]

const WARM_UP_ALTERNATE_STEPS = STEPS.filter(
  (step) => step.id !== WARM_UP_STEP_3_ID,
).map((step, index) => ({
  ...step,
  column_position: index + 1,
}))

const WARM_UP_SAD_STEPS = [
  STEPS[0],
  STEPS[1],
  STEPS[2],
  STEPS[3],
  WARM_UP_SAD_STEP_5,
  WARM_UP_SAD_STEP_6,
]

const SAD_PATH_LAYER_SUFFIXES = ['03', '05', '06', '09'] as const

const HAPPY_CELL_BY_ID = new Map(WARM_UP_CELLS.map((cell) => [cell.id, cell]))

function happyCellId(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-00000004${stepSlot}${layerSuffix}`
}

function sadCellId(stepSlot: string, layerSuffix: string): string {
  return `a0000000-0000-4000-8000-00000008${stepSlot}${layerSuffix}`
}

function addSadPathSlotCells(
  cells: BlueprintCell[],
  sadSlot: string,
  happySlot: string,
  stepId: string,
  contentOverrides: Partial<Record<(typeof SAD_PATH_LAYER_SUFFIXES)[number], string>> = {},
): void {
  for (const suffix of SAD_PATH_LAYER_SUFFIXES) {
    const source = HAPPY_CELL_BY_ID.get(happyCellId(happySlot, suffix))
    if (!source?.content.trim()) continue

    cells.push({
      id: sadCellId(sadSlot, suffix),
      layer_id: mapSadLayerId(source.layer_id),
      step_id: stepId,
      content: contentOverrides[suffix] ?? source.content,
    })
  }
}

function buildSadPathCells(): BlueprintCell[] {
  const cells: BlueprintCell[] = []

  for (const cell of WARM_UP_CELLS) {
    const stepSlot = cell.id.slice(-4, -2)
    if (stepSlot >= '05' && stepSlot <= '08') continue

    cells.push({
      ...cell,
      id: mapSadCellId(cell.id),
      layer_id: mapSadLayerId(cell.layer_id),
    })
  }

  addSadPathSlotCells(cells, '05', '05', WARM_UP_SAD_STEP_5_ID, {
    '03':
      'PLUS app is not working properly and tutor is unable to update student data.',
  })
  addSadPathSlotCells(cells, '06', '06', WARM_UP_SAD_STEP_6_ID, {
    '03': 'Unable to complete warm up phase.',
  })

  return cells
}

const WARM_UP_SAD_END_TRIGGER_IDS = new Set([
  'a0000000-0000-4000-8000-000000050106',
  'a0000000-0000-4000-8000-000000050107',
  'a0000000-0000-4000-8000-000000050112',
])

function buildSadPathTriggers(): BlueprintCellTrigger[] {
  return WARM_UP_TRIGGERS.filter(
    (trigger) => !WARM_UP_SAD_END_TRIGGER_IDS.has(trigger.id),
  ).map((trigger) => ({
    id: mapSadTriggerId(trigger.id),
    source_cell_id: mapSadCellId(trigger.source_cell_id),
    target_cell_id: mapSadCellId(trigger.target_cell_id),
  }))
}

export const WARM_UP_ALTERNATE_PATH_FALLBACK: BlueprintData = {
  path: {
    id: WARM_UP_ALTERNATE_PATH_ID,
    name: 'Alternate Path',
    path_type: 'alternative',
  },
  layers: LAYERS.map((layer) => ({
    ...layer,
    id: mapHappyLayerId(layer.id),
  })),
  steps: WARM_UP_ALTERNATE_STEPS,
  cells: WARM_UP_CELLS.filter((cell) => cell.step_id !== WARM_UP_STEP_3_ID).map(
    (cell) => ({
      ...cell,
      id: mapHappyCellId(cell.id),
      layer_id: mapHappyLayerId(cell.layer_id),
    }),
  ),
  triggers: WARM_UP_ALTERNATE_TRIGGERS,
}

export const WARM_UP_SAD_PATH_FALLBACK: BlueprintData = {
  path: {
    id: WARM_UP_SAD_PATH_ID,
    name: 'Sad Path',
    path_type: 'unhappy',
  },
  layers: LAYERS.map((layer) => ({
    ...layer,
    id: mapSadLayerId(layer.id),
  })),
  steps: WARM_UP_SAD_STEPS,
  cells: buildSadPathCells(),
  triggers: buildSadPathTriggers(),
}

const FALLBACK_BY_PATH: Record<string, BlueprintData> = {
  [WARM_UP_HAPPY_PATH_ID]: WARM_UP_HAPPY_PATH_FALLBACK,
  [WARM_UP_ALTERNATE_PATH_ID]: WARM_UP_ALTERNATE_PATH_FALLBACK,
  [WARM_UP_SAD_PATH_ID]: WARM_UP_SAD_PATH_FALLBACK,
}

const FALLBACK_PATHS_BY_SCENARIO: Record<
  string,
  Array<{ id: string; name: string; path_type: BlueprintData['path']['path_type'] }>
> = {
  [WARM_UP_SCENARIO_ID]: [
    {
      id: WARM_UP_HAPPY_PATH_FALLBACK.path.id,
      name: WARM_UP_HAPPY_PATH_FALLBACK.path.name,
      path_type: WARM_UP_HAPPY_PATH_FALLBACK.path.path_type,
    },
    {
      id: WARM_UP_ALTERNATE_PATH_FALLBACK.path.id,
      name: WARM_UP_ALTERNATE_PATH_FALLBACK.path.name,
      path_type: WARM_UP_ALTERNATE_PATH_FALLBACK.path.path_type,
    },
    {
      id: WARM_UP_SAD_PATH_FALLBACK.path.id,
      name: WARM_UP_SAD_PATH_FALLBACK.path.name,
      path_type: WARM_UP_SAD_PATH_FALLBACK.path.path_type,
    },
  ],
}

const FALLBACK_BY_SCENARIO: Record<string, BlueprintData> = {
  [WARM_UP_SCENARIO_ID]: WARM_UP_HAPPY_PATH_FALLBACK,
}

export function getFallbackPathsForScenario(
  scenarioId: string | undefined,
): Array<{ id: string; name: string; path_type: BlueprintData['path']['path_type'] }> {
  if (!scenarioId) return []
  return FALLBACK_PATHS_BY_SCENARIO[scenarioId] ?? []
}

export function getBlueprintFallback(
  scenarioId: string | undefined,
  pathId?: string | null,
): BlueprintData | null {
  let data: BlueprintData | null = null
  if (pathId && FALLBACK_BY_PATH[pathId]) {
    data = FALLBACK_BY_PATH[pathId]
  } else if (scenarioId) {
    data = FALLBACK_BY_SCENARIO[scenarioId] ?? null
  }
  return data
    ? applyBlueprintDisplayFilters(data, scenarioId, pathId ?? data.path.id)
    : null
}

export function getFallbackBlueprintsForScenarios(
  scenarioIds: string[],
): Map<string, BlueprintData> {
  const map = new Map<string, BlueprintData>()
  for (const id of scenarioIds) {
    const data = getBlueprintFallback(id)
    if (data) map.set(id, data)
  }
  return map
}
