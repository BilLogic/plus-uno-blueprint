import { parseCellContentItems } from '@/lib/parseCellContent'
import {
  BACKSTAGE_ACTIONS_ROLE,
  BACKSTAGE_TOUCHPOINTS_ROLE,
  CUSTOMER_ACTIONS_ROLE,
  FRONTSTAGE_ACTIONS_ROLE,
  FRONTSTAGE_TOUCHPOINTS_ROLE,
  getLayerRole,
  SUPPORT_ACTIONS_ROLE,
  STORYBOARD_ROLE,
} from '@/lib/laneRoles'
import {
  isParallelSessionLeadBottomWrapDependency,
  isParallelSessionPartnerWrapDependency,
} from '@/data/parallelSessionPartnerLead'
import type { BlueprintData, BlueprintLane } from '@/types/blueprint'

/** Minimal lane shape for role-driven layout checks. */
type LayerRoleSource = { name: string; role?: string | null }

/** Roles whose cells list multiple items as inline touchpoints (newline-separated content). */
export const TOUCHPOINT_CELL_LANE_ROLES = [
  FRONTSTAGE_TOUCHPOINTS_ROLE,
  BACKSTAGE_TOUCHPOINTS_ROLE,
] as const

/** Roles rendered as picture rows instead of text cells. */
export const STORYBOARD_LANE_ROLES = [STORYBOARD_ROLE] as const

/** 192px inner face at 4:3 plus the service/compare shell's vertical padding. */
export const STORYBOARD_ROW_MIN_HEIGHT = 176
export const STORYBOARD_ROW_MIN_HEIGHT_COMPACT = 168

/** Max height for the visual cell button inside a swimlane row (excludes shell padding). */
export function getStoryboardCellButtonMaxHeight(compact = false): number {
  const rowHeight = compact ? STORYBOARD_ROW_MIN_HEIGHT_COMPACT : STORYBOARD_ROW_MIN_HEIGHT
  const shellVerticalPad = compact ? 24 : 32
  return rowHeight - shellVerticalPad
}

export function shouldUseTouchpointCellContent(lane: LayerRoleSource): boolean {
  const role = getLayerRole(lane)
  return (
    role !== null && (TOUCHPOINT_CELL_LANE_ROLES as readonly string[]).includes(role)
  )
}

/** Which face a lane's cells wear — touchpoint stack, step visual, or plain cell. */
export type BlueprintCellVariant = 'default' | 'touchpoints' | 'storyboard'

/**
 * Whether a cell has anything to draw for its lane's variant. A visual cell
 * is decided by its pictures upstream, a touchpoint cell by having at least one
 * parsable item, a plain cell by non-blank content.
 */
export function hasBlueprintCellContent(
  content: string | undefined,
  variant: BlueprintCellVariant,
): boolean {
  if (variant === 'storyboard') return true
  if (!content?.trim()) return false
  if (variant === 'touchpoints') {
    return parseCellContentItems(content).length > 0
  }
  return true
}

export function shouldUseStoryboardContent(lane: LayerRoleSource): boolean {
  const role = getLayerRole(lane)
  return (
    role !== null && (STORYBOARD_LANE_ROLES as readonly string[]).includes(role)
  )
}

/** The standard service-blueprint interaction line follows the spine actor. */
export function shouldShowInteractionLineAfter(lane: BlueprintLane): boolean {
  return getLayerRole(lane) === CUSTOMER_ACTIONS_ROLE
}

/** The visibility line is drawn after frontstage lanes (above backstage lanes). */
export function shouldShowVisibilityLineAfter(
  lane: BlueprintLane,
  lanes?: BlueprintLane[],
): boolean {
  const role = getLayerRole(lane)
  if (role !== FRONTSTAGE_ACTIONS_ROLE && role !== FRONTSTAGE_TOUCHPOINTS_ROLE) {
    return false
  }

  // Frontstage tech can sit above frontstage actions — the visibility line
  // follows the actions lane, not the tech lane.
  if (role === FRONTSTAGE_TOUCHPOINTS_ROLE && lanes) {
    const index = lanes.findIndex((entry) => entry.id === lane.id)
    const next = lanes[index + 1]
    if (next && getLayerRole(next) === FRONTSTAGE_ACTIONS_ROLE) {
      return false
    }
  }

  return true
}

/**
 * Support handoff lanes, which sit below backstage actions.
 *
 * This used to compare `lane.name` against two English strings, because the
 * 36 support lanes in the database carried no role and nothing else
 * identified them. `lanes.name` is free-form in any language, so renaming or
 * translating one deleted a divider from the board with nothing reporting it.
 *
 * Those rows now carry `support_actions`, and the only name lookup left is
 * the one in `LEGACY_NAME_TO_ROLE`, which every lane in the hand-written
 * fallback blueprints already goes through because that data predates
 * `lane_role` entirely. So a name can still stand in for a missing role, in
 * exactly one declared place, rather than in a comparison local to this file
 * that no other divider had.
 */
function isSupportHandoffLayer(lane: LayerRoleSource): boolean {
  return getLayerRole(lane) === SUPPORT_ACTIONS_ROLE
}

/**
 * The internal interaction line marks the hand-off from backstage actions to
 * support systems / support actions, so it draws after a backstage-actions
 * lane only when a support handoff lane follows.
 */
export function shouldShowInternalInteractionLineAfter(
  lane: BlueprintLane,
  lanes?: BlueprintLane[],
): boolean {
  if (getLayerRole(lane) !== BACKSTAGE_ACTIONS_ROLE) return false
  if (!lanes) return false
  const index = lanes.findIndex((entry) => entry.id === lane.id)
  const next = lanes[index + 1]
  return next !== undefined && isSupportHandoffLayer(next)
}

/** Light rule between swim lanes; omitted before interaction/visibility dividers. */
export function shouldShowLaneDividerAfter(
  lane: BlueprintLane,
  layerIndex: number,
  lanes: BlueprintLane[],
): boolean {
  if (layerIndex >= lanes.length - 1) return false
  if (shouldShowInteractionLineAfter(lane)) return false
  if (shouldShowVisibilityLineAfter(lane, lanes)) return false
  if (shouldShowInternalInteractionLineAfter(lane, lanes)) return false
  return true
}

/** Lane row is immediately followed by a blueprint divider band. */
export function layerPrecedesBlueprintDivider(
  lane: BlueprintLane,
  lanes?: BlueprintLane[],
): boolean {
  return (
    shouldShowInteractionLineAfter(lane) ||
    shouldShowVisibilityLineAfter(lane, lanes) ||
    shouldShowInternalInteractionLineAfter(lane, lanes)
  )
}

// Service-blueprint canon: the dividers are the "line of …" boundaries.
export const INTERACTION_LINE_LABEL = 'LINE OF INTERACTION'
export const VISIBILITY_LINE_LABEL = 'LINE OF VISIBILITY'
export const INTERNAL_INTERACTION_LINE_LABEL = 'LINE OF INTERNAL INTERACTION'

export const BLUEPRINT_DIVIDER_ROW_HEIGHT = 28
/** Transparent margin above the interaction line for the Regular Tutor loop arrow. */
export const BLUEPRINT_WRAP_CORRIDOR_MARGIN = 36
/** Space above the Regular Tutor row for overhead-rail arrows (Discovery, Call-off, etc.). */
export const BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN = 36
/** Space at the top of the Regular Tutor row for in-lane loop-back arrows. */
export const BLUEPRINT_REGULAR_TUTOR_LOOP_CORRIDOR_MARGIN = 32

/** Regular Tutor cell ids that route forward connectors on the overhead rail. */
export const OVERHEAD_RAIL_REGULAR_TUTOR_CELL_PATTERN =
  /000000(?:07|72|17)(\d{2})03$/

/** Application discovery dependencies that span forward across Regular Tutor columns. */
export function dependenciesIncludeDiscoveryRail(
  dependencies: ReadonlyArray<{ source_cell_id: string; target_cell_id: string }>,
): boolean {
  return dependencies.some((dependency) => {
    const { source_cell_id: src, target_cell_id: tgt } = dependency
    return (
      OVERHEAD_RAIL_REGULAR_TUTOR_CELL_PATTERN.test(src) &&
      OVERHEAD_RAIL_REGULAR_TUTOR_CELL_PATTERN.test(tgt) &&
      src !== tgt
    )
  })
}

export function blueprintHasDiscoveryRailDependencies(
  data: BlueprintData,
): boolean {
  return dependenciesIncludeDiscoveryRail(data.dependencies)
}

export function layerHasDiscoveryRailCorridor(
  lane: BlueprintLane,
  data?: BlueprintData | readonly BlueprintData[],
  extraDependencies?: ReadonlyArray<{
    source_cell_id: string
    target_cell_id: string
  }>,
): boolean {
  if (lane.name !== 'Regular Tutor') return false
  if (data) {
    const blueprints = Array.isArray(data) ? data : [data]
    if (blueprints.some(blueprintHasDiscoveryRailDependencies)) return true
  }
  if (extraDependencies && dependenciesIncludeDiscoveryRail(extraDependencies)) {
    return true
  }
  return false
}

/*
  The teacher's lane, by name.

  It was called `Partner Action: Teacher` until 2026-08-20 — the lane's ROLE
  bolted onto the front of the person in it. `lane_role` and the stakeholder
  registry both hold the role now, so the label is just the person, and the
  helper that existed only to abbreviate the long form went with it.
*/
export const TEACHER_LANE_NAME = 'Teacher'

export function dependenciesIncludePartnerActionOverheadWrap(
  dependencies: ReadonlyArray<{ source_cell_id: string; target_cell_id: string }>,
): boolean {
  return dependencies.some((dependency) =>
    isParallelSessionPartnerWrapDependency(
      dependency.source_cell_id,
      dependency.target_cell_id,
    ),
  )
}

export function blueprintHasPartnerActionOverheadWrapDependencies(
  data: BlueprintData,
): boolean {
  return dependenciesIncludePartnerActionOverheadWrap(data.dependencies)
}

export function layerHasPartnerActionOverheadWrapCorridor(
  lane: BlueprintLane,
  data?: BlueprintData | readonly BlueprintData[],
  extraDependencies?: ReadonlyArray<{
    source_cell_id: string
    target_cell_id: string
  }>,
): boolean {
  if (lane.name !== TEACHER_LANE_NAME) return false
  if (data) {
    const blueprints = Array.isArray(data) ? data : [data]
    if (blueprints.some(blueprintHasPartnerActionOverheadWrapDependencies)) {
      return true
    }
  }
  if (extraDependencies && dependenciesIncludePartnerActionOverheadWrap(extraDependencies)) {
    return true
  }
  return false
}

export const LEAD_TUTOR_LAYER_NAME = 'Lead Tutor'

export function dependenciesIncludeLeadTutorBottomWrap(
  dependencies: ReadonlyArray<{ source_cell_id: string; target_cell_id: string }>,
): boolean {
  return dependencies.some((dependency) =>
    isParallelSessionLeadBottomWrapDependency(
      dependency.source_cell_id,
      dependency.target_cell_id,
    ),
  )
}

export function blueprintHasLeadTutorBottomWrapDependencies(
  data: BlueprintData,
): boolean {
  return dependenciesIncludeLeadTutorBottomWrap(data.dependencies)
}

export function layerHasLeadTutorBottomWrapCorridor(
  lane: BlueprintLane,
  data?: BlueprintData | readonly BlueprintData[],
  extraDependencies?: ReadonlyArray<{
    source_cell_id: string
    target_cell_id: string
  }>,
): boolean {
  if (lane.name !== LEAD_TUTOR_LAYER_NAME) return false
  if (data) {
    const blueprints = Array.isArray(data) ? data : [data]
    if (blueprints.some(blueprintHasLeadTutorBottomWrapDependencies)) {
      return true
    }
  }
  if (extraDependencies && dependenciesIncludeLeadTutorBottomWrap(extraDependencies)) {
    return true
  }
  return false
}

/** @deprecated Lead Tutor loops route below the row, not overhead. */
export function dependenciesIncludeLeadTutorOverheadWrap(
  dependencies: ReadonlyArray<{ source_cell_id: string; target_cell_id: string }>,
): boolean {
  return dependenciesIncludeLeadTutorBottomWrap(dependencies)
}

/** @deprecated Lead Tutor loops route below the row, not overhead. */
export function blueprintHasLeadTutorOverheadWrapDependencies(
  data: BlueprintData,
): boolean {
  return blueprintHasLeadTutorBottomWrapDependencies(data)
}

/** @deprecated Lead Tutor loops route below the row, not overhead. */
export function layerHasLeadTutorOverheadWrapCorridor(
  lane: BlueprintLane,
  data?: BlueprintData | readonly BlueprintData[],
  extraDependencies?: ReadonlyArray<{
    source_cell_id: string
    target_cell_id: string
  }>,
): boolean {
  return layerHasLeadTutorBottomWrapCorridor(lane, data, extraDependencies)
}

export function layerHasWrapCorridorBelow(
  lane: BlueprintLane,
  data?: BlueprintData | readonly BlueprintData[],
  extraDependencies?: ReadonlyArray<{
    source_cell_id: string
    target_cell_id: string
  }>,
): boolean {
  return (
    shouldShowInteractionLineAfter(lane) ||
    layerHasLeadTutorBottomWrapCorridor(lane, data, extraDependencies)
  )
}

const REGULAR_TUTOR_LAYER_CELL_ID_PATTERN = /(\d{2})03$/

export function isRegularTutorInLaneLoopDependency(
  sourceCellId: string,
  targetCellId: string,
): boolean {
  const sourceMatch = sourceCellId.match(REGULAR_TUTOR_LAYER_CELL_ID_PATTERN)
  const targetMatch = targetCellId.match(REGULAR_TUTOR_LAYER_CELL_ID_PATTERN)
  if (!sourceMatch || !targetMatch) return false

  const sourceStep = Number.parseInt(sourceMatch[1]!, 10)
  const targetStep = Number.parseInt(targetMatch[1]!, 10)
  return targetStep < sourceStep
}

export function dependenciesIncludeRegularTutorInLaneLoop(
  dependencies: ReadonlyArray<{ source_cell_id: string; target_cell_id: string }>,
): boolean {
  return dependencies.some((dependency) =>
    isRegularTutorInLaneLoopDependency(
      dependency.source_cell_id,
      dependency.target_cell_id,
    ),
  )
}

export function blueprintHasRegularTutorInLaneLoopDependencies(
  data: BlueprintData,
): boolean {
  return dependenciesIncludeRegularTutorInLaneLoop(data.dependencies)
}

export function layerHasRegularTutorInLaneLoopCorridor(
  lane: BlueprintLane,
  data?: BlueprintData | readonly BlueprintData[],
  extraDependencies?: ReadonlyArray<{
    source_cell_id: string
    target_cell_id: string
  }>,
): boolean {
  if (lane.name !== 'Regular Tutor') return false
  if (data) {
    const blueprints = Array.isArray(data) ? data : [data]
    if (blueprints.some(blueprintHasRegularTutorInLaneLoopDependencies)) {
      return true
    }
  }
  if (extraDependencies && dependenciesIncludeRegularTutorInLaneLoop(extraDependencies)) {
    return true
  }
  return false
}

export function countRegularTutorInLaneLoopCorridorMargins(
  lanes: BlueprintLane[],
  data?: BlueprintData,
): number {
  if (!data) return 0
  return lanes.filter((lane) =>
    layerHasRegularTutorInLaneLoopCorridor(lane, data),
  ).length
}

export function layerHasOverheadArrowCorridor(
  lane: BlueprintLane,
  data?: BlueprintData | readonly BlueprintData[],
  extraDependencies?: ReadonlyArray<{
    source_cell_id: string
    target_cell_id: string
  }>,
): boolean {
  return (
    layerHasDiscoveryRailCorridor(lane, data, extraDependencies) ||
    layerHasPartnerActionOverheadWrapCorridor(lane, data, extraDependencies)
  )
}

export function countDiscoveryRailCorridorMargins(
  lanes: BlueprintLane[],
  data: BlueprintData,
): number {
  return lanes.filter((lane) =>
    layerHasDiscoveryRailCorridor(lane, data),
  ).length
}

export function countBlueprintDividerRows(lanes: BlueprintLane[]): number {
  return lanes.filter(
    (lane) =>
      shouldShowInteractionLineAfter(lane) ||
      shouldShowVisibilityLineAfter(lane, lanes) ||
      shouldShowInternalInteractionLineAfter(lane, lanes),
  ).length
}

export function countBlueprintWrapCorridorMargins(
  lanes: BlueprintLane[],
  data?: BlueprintData,
): number {
  return lanes.filter(
    (lane) =>
      shouldShowInteractionLineAfter(lane) ||
      (data !== undefined &&
        layerHasLeadTutorBottomWrapCorridor(lane, data)),
  ).length
}

export const LAYER_COLUMN_WIDTH = 220
export const STEP_COLUMN_WIDTH = 220
/** Visible space between step columns where dependency arrows are drawn. */
export const STEP_COLUMN_GAP = 24
/** Left gutter on the white board so the play control clears Visual cells. */
export const STORYBOARD_PLAY_GUTTER = 28

export function getStepColumnLeft(stepIndex: number): number {
  return LAYER_COLUMN_WIDTH + stepIndex * (STEP_COLUMN_WIDTH + STEP_COLUMN_GAP)
}

export function getStepColumnRight(stepIndex: number): number {
  return getStepColumnLeft(stepIndex) + STEP_COLUMN_WIDTH
}

export function getStepColumnsWidth(stepCount: number): number {
  if (stepCount <= 0) return 0
  const gaps = Math.max(0, stepCount - 1)
  return stepCount * STEP_COLUMN_WIDTH + gaps * STEP_COLUMN_GAP
}

export const BLUEPRINT_ROW_MIN_HEIGHT = 96
/** Used only when fitVertically compresses rows into a fixed artboard. */
export const BLUEPRINT_ROW_MIN_HEIGHT_COMPACT = 60
export const BLUEPRINT_PADDING = 24
export const BLUEPRINT_HEADER_HEIGHT = 48
export const BLUEPRINT_HEADER_HEIGHT_COMPACT = 32
/** Gap between swim lanes and dividers (0 — lane borders handle separation). */
export const BLUEPRINT_LAYER_ROW_GAP = 0
/** Padding around the grid body for arrow overlay bleed (matches ARROW_VIEWPORT_PAD). */
export const BLUEPRINT_GRID_VIEWPORT_PAD = 13
/** Artboard inner wrapper (p-2; formerly CanvasBlueprintArtboard). */
export const BLUEPRINT_CANVAS_INNER_PADDING = 16
/** mb-2 below the compact path header row. */
export const BLUEPRINT_COMPACT_HEADER_GAP = 8
/** Scroll container border (1px each side). */
export const BLUEPRINT_CANVAS_SCROLL_BORDER = 2
/** Safety margin for wrapped cell text on canvas artboards. */
export const BLUEPRINT_ARTBOARD_HEIGHT_BUFFER = 32
/** Safety margin for horizontal grid bleed on canvas artboards. */
export const BLUEPRINT_ARTBOARD_WIDTH_BUFFER = 32

/** Outer gutter around each cell (Tailwind p-3 ≈ 12px per side). */
/**
 * Half the hit target for an insert affordance, on BOTH axes.
 *
 * Was declared separately in BlueprintColumnHandles and BlueprintLaneHandles,
 * same name and same value in two files — so a column insert 8px wide and a
 * lane insert 10px tall was a bug nothing would have caught.
 */
export const BLUEPRINT_INSERT_HIT_HALF = 8

export const BLUEPRINT_CELL_GUTTER = 12

/** Stable canvas face for narrative cells; complete prose lives in detail. */
export const NARRATIVE_CELL_HEIGHT = 128
export const NARRATIVE_CELL_HEIGHT_COMPACT = 96
/** Stable technology face; two label lines fit without changing row geometry. */
export const TOUCHPOINT_ITEM_HEIGHT = 52
export const TOUCHPOINT_ITEM_HEIGHT_COMPACT = 42
const TOUCHPOINT_STACK_GAP = 10
const TOUCHPOINT_CELL_PADDING = BLUEPRINT_CELL_GUTTER * 2

export function getMaxTouchpointCountInLane(
  data: BlueprintData,
  laneId: string,
): number {
  // Summed per *slot*, not maxed per cell: since the split a slot holds one
  // cell per touchpoint, and a row sized to the tallest single cell would be
  // one touchpoint tall over a stack of three.
  //
  // Placements where the cell has them, the text where it does not: a
  // name-only placement (#277) is a face the text never names, and a stack
  // sized from the text alone would clip it.
  const perStep = new Map<string, number>()
  for (const cell of data.cells) {
    if (cell.lane_id !== laneId) continue
    const count = cell.touchpoints?.length
      ? cell.touchpoints.length
      : cell.content?.trim()
        ? parseCellContentItems(cell.content).length
        : 0
    if (count > 0) perStep.set(cell.step_id, (perStep.get(cell.step_id) ?? 0) + count)
  }
  let max = 0
  for (const total of perStep.values()) max = Math.max(max, total)
  return max
}

export function getTouchpointStackMinHeight(
  touchpointCount: number,
  compact = false,
): number {
  if (touchpointCount <= 0) return 0
  const itemHeight = compact ? TOUCHPOINT_ITEM_HEIGHT_COMPACT : TOUCHPOINT_ITEM_HEIGHT
  return (
    TOUCHPOINT_CELL_PADDING +
    touchpointCount * itemHeight +
    Math.max(0, touchpointCount - 1) * TOUCHPOINT_STACK_GAP
  )
}

/** Minimum inner content height for a single cell (excludes compare shell padding). */
export function getCellContentMinHeight(
  lane: BlueprintLane,
  content: string | undefined,
  compact = false,
): number {
  if (shouldUseStoryboardContent(lane)) {
    return compact
      ? STORYBOARD_ROW_MIN_HEIGHT_COMPACT
      : STORYBOARD_ROW_MIN_HEIGHT
  }

  if (!content?.trim()) return 0

  if (shouldUseTouchpointCellContent(lane)) {
    return getTouchpointStackMinHeight(
      parseCellContentItems(content).length,
      compact,
    )
  }

  return compact ? NARRATIVE_CELL_HEIGHT_COMPACT : NARRATIVE_CELL_HEIGHT
}

function getDefaultCellMinHeight(
  _layer: BlueprintLane,
  _data: BlueprintData,
  compact = false,
): number {
  const faceHeight = compact
    ? NARRATIVE_CELL_HEIGHT_COMPACT
    : NARRATIVE_CELL_HEIGHT
  const shellPadding = compact ? 24 : 32
  return faceHeight + shellPadding
}

export function getLayerRowMinHeight(
  lane: BlueprintLane,
  data: BlueprintData,
  compact = false,
  options?: { fitVertically?: boolean },
): number {
  const fitVertically = options?.fitVertically ?? false
  const base = fitVertically && compact
    ? BLUEPRINT_ROW_MIN_HEIGHT_COMPACT
    : getDefaultCellMinHeight(lane, data, compact)

  if (shouldUseStoryboardContent(lane)) {
    return compact
      ? STORYBOARD_ROW_MIN_HEIGHT_COMPACT
      : STORYBOARD_ROW_MIN_HEIGHT
  }

  if (!shouldUseTouchpointCellContent(lane)) return base

  const touchpointCount = getMaxTouchpointCountInLane(data, lane.id)
  return Math.max(base, getTouchpointStackMinHeight(touchpointCount, compact))
}

export function getBlueprintGridMinHeight(
  data: BlueprintData,
  options?: { compact?: boolean; includeHeader?: boolean },
): number {
  const { compact = false, includeHeader = true } = options ?? {}
  const header = compact ? BLUEPRINT_HEADER_HEIGHT_COMPACT : BLUEPRINT_HEADER_HEIGHT
  const dividers =
    countBlueprintDividerRows(data.lanes) * BLUEPRINT_DIVIDER_ROW_HEIGHT
  const wrapCorridorMargins =
    countBlueprintWrapCorridorMargins(data.lanes, data) *
    BLUEPRINT_WRAP_CORRIDOR_MARGIN
  const discoveryRailCorridorMargins =
    countDiscoveryRailCorridorMargins(data.lanes, data) *
    BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN
  const regularTutorLoopCorridorMargins =
    countRegularTutorInLaneLoopCorridorMargins(data.lanes, data) *
    BLUEPRINT_REGULAR_TUTOR_LOOP_CORRIDOR_MARGIN
  const layerRows = data.lanes.reduce(
    (sum, lane) => sum + getLayerRowMinHeight(lane, data, compact),
    0,
  )
  const rowCount =
    data.lanes.length + countBlueprintDividerRows(data.lanes)
  const rowGaps = Math.max(0, rowCount - 1) * BLUEPRINT_LAYER_ROW_GAP
  return (
    (includeHeader ? header : 0) +
    layerRows +
    dividers +
    wrapCorridorMargins +
    discoveryRailCorridorMargins +
    regularTutorLoopCorridorMargins +
    rowGaps
  )
}

/** Gap between side-by-side blueprint grids on canvas. */
export const BLUEPRINT_CANVAS_COMPARE_GAP = 24
/** @deprecated Use BLUEPRINT_CANVAS_COMPARE_GAP */
export const BLUEPRINT_CANVAS_STACK_GAP = BLUEPRINT_CANVAS_COMPARE_GAP
/** PathMultiSelect fieldset + legend on canvas artboards. */
export const BLUEPRINT_PATH_FILTER_HEIGHT = 72
/** Scenario slide header in stack view (title, description, controls). */
export const BLUEPRINT_SCENARIO_HEADER_HEIGHT = 220
/** Compact scenario header on canvas artboards. */
export const BLUEPRINT_SCENARIO_HEADER_HEIGHT_COMPACT = 200

export type ArtboardSize = { width: number; height: number }

export function getBlueprintGridMinWidth(stepCount: number): number {
  return LAYER_COLUMN_WIDTH + getStepColumnsWidth(stepCount)
}

/** Pixel width of a compact ServiceBlueprintGrid (excluding artboard wrapper padding). */
export function getBlueprintCompactGridWidth(stepCount: number): number {
  return (
    getBlueprintGridMinWidth(stepCount) +
    BLUEPRINT_GRID_VIEWPORT_PAD * 2 +
    BLUEPRINT_CANVAS_SCROLL_BORDER
  )
}

/** Pixel height of a compact ServiceBlueprintGrid (excluding artboard wrapper padding). */
export function getBlueprintCompactGridHeight(data: BlueprintData): number {
  const header = BLUEPRINT_HEADER_HEIGHT_COMPACT + BLUEPRINT_COMPACT_HEADER_GAP
  const gridBody = getBlueprintGridMinHeight(data, {
    compact: true,
    includeHeader: false,
  })
  const scrollArea =
    gridBody + BLUEPRINT_GRID_VIEWPORT_PAD * 2 + BLUEPRINT_CANVAS_SCROLL_BORDER

  return header + scrollArea
}

/** Canvas artboard size sized to fit the full compact blueprint grid. */
export function getBlueprintArtboardSize(data: BlueprintData): ArtboardSize {
  const width =
    getBlueprintCompactGridWidth(data.steps.length) +
    BLUEPRINT_CANVAS_INNER_PADDING * 2 +
    BLUEPRINT_ARTBOARD_WIDTH_BUFFER
  const height = Math.max(
    480,
    getBlueprintCompactGridHeight(data) +
      BLUEPRINT_CANVAS_INNER_PADDING * 2 +
      BLUEPRINT_ARTBOARD_HEIGHT_BUFFER,
  )
  return { width, height }
}

/** Canvas artboard size for multiple side-by-side compact grids (e.g. Warm-Up path compare). */
export function getStackedCanvasArtboardSize(
  blueprints: BlueprintData[],
  options?: {
    includeScenarioHeader?: boolean
    compact?: boolean
  },
): ArtboardSize {
  if (blueprints.length === 0) {
    return { width: 960, height: 540 }
  }

  const includeScenarioHeader = options?.includeScenarioHeader ?? false
  const compact = options?.compact ?? false
  const headerHeight = includeScenarioHeader
    ? compact
      ? BLUEPRINT_SCENARIO_HEADER_HEIGHT_COMPACT
      : BLUEPRINT_SCENARIO_HEADER_HEIGHT
    : 0
  const gridWidths = blueprints.map(
    (data) =>
      getBlueprintCompactGridWidth(data.steps.length) +
      BLUEPRINT_CANVAS_INNER_PADDING,
  )
  const gridHeights = blueprints.map(
    (data) =>
      getBlueprintCompactGridHeight(data) + BLUEPRINT_CANVAS_INNER_PADDING,
  )

  const width = Math.max(
    ...blueprints.map(
      (data) =>
        getBlueprintCompactGridWidth(data.steps.length) +
        BLUEPRINT_CANVAS_INNER_PADDING +
        BLUEPRINT_ARTBOARD_WIDTH_BUFFER,
    ),
    compact && includeScenarioHeader ? 420 : 0,
  )

  const compareGapTotal =
    Math.max(0, blueprints.length - 1) * BLUEPRINT_CANVAS_COMPARE_GAP
  const stackedGridWidth =
    gridWidths.reduce((sum, gridWidth) => sum + gridWidth, 0) + compareGapTotal

  const totalWidth =
    Math.max(width, stackedGridWidth) +
    BLUEPRINT_CANVAS_INNER_PADDING +
    BLUEPRINT_ARTBOARD_WIDTH_BUFFER

  const filterHeight = headerHeight
  const height = Math.max(
    480,
    filterHeight +
      Math.max(...gridHeights) +
      BLUEPRINT_CANVAS_INNER_PADDING * 2 +
      BLUEPRINT_ARTBOARD_HEIGHT_BUFFER,
  )

  return { width: totalWidth, height }
}
