import { parseCellContentItems } from '@/lib/parseCellContent'
import type { BlueprintData, BlueprintLayer } from '@/types/blueprint'

/** Layers after which the standard service-blueprint interaction line is drawn. */
/** Layers whose cells list multiple items as inline pills (newline-separated content). */
export const PILL_CELL_LAYER_NAMES = [
  'Front Stage Tech',
  'Back Stage Tech',
  'Computer Systems',
] as const
export const VISUAL_LAYER_NAME = 'Visual' as const
export const VISUAL_ROW_MIN_HEIGHT = 132
export const VISUAL_ROW_MIN_HEIGHT_COMPACT = 108

export function shouldUsePillCellContent(layerName: string): boolean {
  return (PILL_CELL_LAYER_NAMES as readonly string[]).includes(layerName)
}

export function shouldUseVisualContent(layerName: string): boolean {
  return layerName === VISUAL_LAYER_NAME || layerName === 'Step Visual'
}

export const INTERACTION_LINE_AFTER_LAYER_NAMES = [
  'Regular Tutor',
  'Customer Actions',
] as const

/** Layers after which the visibility line is drawn (above backstage layers). */
export const VISIBILITY_LINE_AFTER_LAYER_NAMES = [
  'Front Stage Actions',
  'Front Stage Tech',
  'Frontstage Actions',
] as const

/** Layers after which the internal interaction line is drawn (onboarding-style blueprints). */
export const INTERNAL_INTERACTION_LINE_AFTER_LAYER_NAMES = [
  'Backstage Actions',
] as const

export function shouldShowInteractionLineAfter(layer: BlueprintLayer): boolean {
  return (INTERACTION_LINE_AFTER_LAYER_NAMES as readonly string[]).includes(
    layer.name,
  )
}

export function shouldShowVisibilityLineAfter(
  layer: BlueprintLayer,
  layers?: BlueprintLayer[],
): boolean {
  if (
    !(VISIBILITY_LINE_AFTER_LAYER_NAMES as readonly string[]).includes(
      layer.name,
    )
  ) {
    return false
  }

  // Application: Front Stage Actions sits above Front Stage Tech — visibility
  // line follows Front Stage Tech, not Front Stage Actions.
  if (layer.name === 'Front Stage Actions' && layers) {
    const index = layers.findIndex((entry) => entry.id === layer.id)
    const next = layers[index + 1]
    if (next?.name === 'Front Stage Tech') {
      return false
    }
  }

  // Warm-Up / In-session: Front Stage Tech sits above Front Stage Actions —
  // visibility line follows Front Stage Actions, not Front Stage Tech.
  if (layer.name === 'Front Stage Tech' && layers) {
    const index = layers.findIndex((entry) => entry.id === layer.id)
    const next = layers[index + 1]
    if (next?.name === 'Front Stage Actions') {
      return false
    }
  }

  return true
}

export function shouldShowInternalInteractionLineAfter(
  layer: BlueprintLayer,
): boolean {
  return (
    INTERNAL_INTERACTION_LINE_AFTER_LAYER_NAMES as readonly string[]
  ).includes(layer.name)
}

/** Light rule between swim lanes; omitted before interaction/visibility dividers. */
export function shouldShowLaneDividerAfter(
  layer: BlueprintLayer,
  layerIndex: number,
  layers: BlueprintLayer[],
): boolean {
  if (layerIndex >= layers.length - 1) return false
  if (shouldShowInteractionLineAfter(layer)) return false
  if (shouldShowVisibilityLineAfter(layer, layers)) return false
  if (shouldShowInternalInteractionLineAfter(layer)) return false
  return true
}

/** Layer row is immediately followed by a blueprint divider band. */
export function layerPrecedesBlueprintDivider(
  layer: BlueprintLayer,
  layers?: BlueprintLayer[],
): boolean {
  return (
    shouldShowInteractionLineAfter(layer) ||
    shouldShowVisibilityLineAfter(layer, layers) ||
    shouldShowInternalInteractionLineAfter(layer)
  )
}

export const INTERACTION_LINE_LABEL = 'INTERACTION LINE'
export const VISIBILITY_LINE_LABEL = 'VISIBILITY LINE'
export const INTERNAL_INTERACTION_LINE_LABEL = 'INTERNAL INTERACTION LINE'

export const BLUEPRINT_DIVIDER_ROW_HEIGHT = 28
/** Right inset so interaction / visibility lines stop before the board edge. */
export const BLUEPRINT_DIVIDER_LINE_END_INSET = 16
/** Transparent margin above the interaction line for the Regular Tutor loop arrow. */
export const BLUEPRINT_WRAP_CORRIDOR_MARGIN = 36
/** Space above the Regular Tutor row for Application discovery-rail arrows. */
export const BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN = 36

/** Application discovery triggers that span forward across Regular Tutor columns. */
export function triggersIncludeDiscoveryRail(
  triggers: ReadonlyArray<{ source_cell_id: string; target_cell_id: string }>,
): boolean {
  return triggers.some((trigger) => {
    const { source_cell_id: src, target_cell_id: tgt } = trigger
    return (
      src.includes('00000007') &&
      src.endsWith('03') &&
      tgt.includes('00000007') &&
      tgt.endsWith('03') &&
      src !== tgt
    )
  })
}

export function blueprintHasDiscoveryRailTriggers(
  data: BlueprintData,
): boolean {
  return triggersIncludeDiscoveryRail(data.triggers)
}

export function layerHasDiscoveryRailCorridor(
  layer: BlueprintLayer,
  data?: BlueprintData | readonly BlueprintData[],
  extraTriggers?: ReadonlyArray<{
    source_cell_id: string
    target_cell_id: string
  }>,
): boolean {
  if (layer.name !== 'Regular Tutor') return false
  if (data) {
    const blueprints = Array.isArray(data) ? data : [data]
    if (blueprints.some(blueprintHasDiscoveryRailTriggers)) return true
  }
  if (extraTriggers && triggersIncludeDiscoveryRail(extraTriggers)) {
    return true
  }
  return false
}

export function countDiscoveryRailCorridorMargins(
  layers: BlueprintLayer[],
  data: BlueprintData,
): number {
  return layers.filter((layer) =>
    layerHasDiscoveryRailCorridor(layer, data),
  ).length
}

export function countBlueprintDividerRows(layers: BlueprintLayer[]): number {
  return layers.filter(
    (layer) =>
      shouldShowInteractionLineAfter(layer) ||
      shouldShowVisibilityLineAfter(layer, layers) ||
      shouldShowInternalInteractionLineAfter(layer),
  ).length
}

export function countBlueprintWrapCorridorMargins(layers: BlueprintLayer[]): number {
  return layers.filter(shouldShowInteractionLineAfter).length
}

export const LAYER_COLUMN_WIDTH = 220
export const STEP_COLUMN_WIDTH = 220
/** Visible space between step columns where trigger arrows are drawn. */
export const STEP_COLUMN_GAP = 24

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
/** CanvasBlueprintArtboard inner wrapper (p-2). */
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
export const BLUEPRINT_CELL_GUTTER = 12
/** Default cell inner content padding (px-4 py-3). */
export const BLUEPRINT_CELL_INNER_X = 16
export const BLUEPRINT_CELL_INNER_Y = 12

const PILL_ITEM_HEIGHT = 44
const PILL_ITEM_HEIGHT_COMPACT = 34
const PILL_STACK_GAP = 10
const PILL_CELL_PADDING = BLUEPRINT_CELL_GUTTER * 2

/** Compare / service grid cell inner width (column minus horizontal shell padding). */
export function getBlueprintCellInnerWidth(compact = false): number {
  const shellPadX = compact ? 24 : 28
  return STEP_COLUMN_WIDTH - shellPadX
}

/** Line count including soft-wrap at the blueprint column width. */
export function getEffectiveLineCount(content: string, compact = false): number {
  const innerWidth = getBlueprintCellInnerWidth(compact)
  const charWidth = compact ? 6.5 : 7
  const charsPerLine = Math.max(6, Math.floor(innerWidth / charWidth))

  return content.split('\n').reduce((total, line) => {
    if (line.length === 0) return total + 1
    return total + Math.ceil(line.length / charsPerLine)
  }, 0)
}

function getTextBlockMinHeight(lineCount: number, compact = false): number {
  const base = compact ? BLUEPRINT_ROW_MIN_HEIGHT : BLUEPRINT_ROW_MIN_HEIGHT - 16
  if (lineCount <= 1) return base

  const lineHeight = compact ? 14 : 20
  const innerPadding = compact ? 20 : 24
  const wrappedHeight =
    BLUEPRINT_CELL_GUTTER * 2 + innerPadding + lineCount * lineHeight

  return Math.max(base, wrappedHeight)
}

export function getMaxPillCountInLayer(
  data: BlueprintData,
  layerId: string,
): number {
  let max = 0
  for (const cell of data.cells) {
    if (cell.layer_id === layerId && cell.content?.trim()) {
      max = Math.max(max, parseCellContentItems(cell.content).length)
    }
  }
  return max
}

export function getPillStackMinHeight(
  pillCount: number,
  compact = false,
): number {
  if (pillCount <= 0) return 0
  const itemHeight = compact ? PILL_ITEM_HEIGHT_COMPACT : PILL_ITEM_HEIGHT
  return (
    PILL_CELL_PADDING +
    pillCount * itemHeight +
    Math.max(0, pillCount - 1) * PILL_STACK_GAP
  )
}

function getMaxLineCountInLayer(
  data: BlueprintData,
  layerId: string,
  compact = false,
): number {
  let max = 1
  for (const cell of data.cells) {
    if (cell.layer_id === layerId && cell.content?.trim()) {
      max = Math.max(max, getEffectiveLineCount(cell.content, compact))
    }
  }
  return max
}

/** Minimum inner content height for a single cell (excludes compare shell padding). */
export function getCellContentMinHeight(
  layer: BlueprintLayer,
  content: string | undefined,
  compact = false,
): number {
  if (shouldUseVisualContent(layer.name)) {
    return compact
      ? VISUAL_ROW_MIN_HEIGHT_COMPACT
      : VISUAL_ROW_MIN_HEIGHT
  }

  if (!content?.trim()) return 0

  if (shouldUsePillCellContent(layer.name)) {
    return getPillStackMinHeight(
      parseCellContentItems(content).length,
      compact,
    )
  }

  const lineCount = Math.max(1, getEffectiveLineCount(content, compact))
  return getTextBlockMinHeight(lineCount, compact)
}

function getDefaultCellMinHeight(
  layer: BlueprintLayer,
  data: BlueprintData,
  compact = false,
): number {
  const base = compact ? BLUEPRINT_ROW_MIN_HEIGHT : BLUEPRINT_ROW_MIN_HEIGHT - 16
  const lineCount = getMaxLineCountInLayer(data, layer.id, compact)
  return Math.max(base, getTextBlockMinHeight(lineCount, compact))
}

export function getLayerRowMinHeight(
  layer: BlueprintLayer,
  data: BlueprintData,
  compact = false,
  options?: { fitVertically?: boolean },
): number {
  const fitVertically = options?.fitVertically ?? false
  const base = fitVertically && compact
    ? BLUEPRINT_ROW_MIN_HEIGHT_COMPACT
    : getDefaultCellMinHeight(layer, data, compact)

  if (shouldUseVisualContent(layer.name)) {
    return compact
      ? VISUAL_ROW_MIN_HEIGHT_COMPACT
      : VISUAL_ROW_MIN_HEIGHT
  }

  if (!shouldUsePillCellContent(layer.name)) return base

  const pillCount = getMaxPillCountInLayer(data, layer.id)
  return Math.max(base, getPillStackMinHeight(pillCount, compact))
}

export function getBlueprintGridMinHeight(
  data: BlueprintData,
  options?: { compact?: boolean; includeHeader?: boolean },
): number {
  const { compact = false, includeHeader = true } = options ?? {}
  const header = compact ? BLUEPRINT_HEADER_HEIGHT_COMPACT : BLUEPRINT_HEADER_HEIGHT
  const dividers =
    countBlueprintDividerRows(data.layers) * BLUEPRINT_DIVIDER_ROW_HEIGHT
  const wrapCorridorMargins =
    countBlueprintWrapCorridorMargins(data.layers) *
    BLUEPRINT_WRAP_CORRIDOR_MARGIN
  const discoveryRailCorridorMargins =
    countDiscoveryRailCorridorMargins(data.layers, data) *
    BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN
  const layerRows = data.layers.reduce(
    (sum, layer) => sum + getLayerRowMinHeight(layer, data, compact),
    0,
  )
  const rowCount =
    data.layers.length + countBlueprintDividerRows(data.layers)
  const rowGaps = Math.max(0, rowCount - 1) * BLUEPRINT_LAYER_ROW_GAP
  return (
    (includeHeader ? header : 0) +
    layerRows +
    dividers +
    wrapCorridorMargins +
    discoveryRailCorridorMargins +
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
