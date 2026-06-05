import { parseCellContentItems } from '@/lib/parseCellContent'
import type { BlueprintData, BlueprintLayer } from '@/types/blueprint'

/** Layers after which the standard service-blueprint interaction line is drawn. */
/** Layers whose cells list multiple items as inline pills (newline-separated content). */
export const PILL_CELL_LAYER_NAMES = ['Front Stage Tech'] as const

export function shouldUsePillCellContent(layerName: string): boolean {
  return (PILL_CELL_LAYER_NAMES as readonly string[]).includes(layerName)
}

export const INTERACTION_LINE_AFTER_LAYER_NAMES = ['Regular Tutor'] as const

/** Layers after which the visibility line is drawn (above backstage layers). */
export const VISIBILITY_LINE_AFTER_LAYER_NAMES = [
  'Front Stage Actions',
] as const

export function shouldShowInteractionLineAfter(layer: BlueprintLayer): boolean {
  return (INTERACTION_LINE_AFTER_LAYER_NAMES as readonly string[]).includes(
    layer.name,
  )
}

export function shouldShowVisibilityLineAfter(layer: BlueprintLayer): boolean {
  return (VISIBILITY_LINE_AFTER_LAYER_NAMES as readonly string[]).includes(
    layer.name,
  )
}

/** Light rule between swim lanes; omitted before interaction/visibility dividers. */
export function shouldShowLaneDividerAfter(
  layer: BlueprintLayer,
  layerIndex: number,
  layers: BlueprintLayer[],
): boolean {
  if (layerIndex >= layers.length - 1) return false
  if (shouldShowInteractionLineAfter(layer)) return false
  if (shouldShowVisibilityLineAfter(layer)) return false
  return true
}

export const INTERACTION_LINE_LABEL = 'INTERACTION LINE'
export const VISIBILITY_LINE_LABEL = 'VISIBILITY LINE'

export const BLUEPRINT_DIVIDER_ROW_HEIGHT = 28
/** Transparent margin above the interaction line for the Regular Tutor loop arrow. */
export const BLUEPRINT_WRAP_CORRIDOR_MARGIN = 36

export function countBlueprintDividerRows(layers: BlueprintLayer[]): number {
  return layers.filter(
    (layer) =>
      shouldShowInteractionLineAfter(layer) ||
      shouldShowVisibilityLineAfter(layer),
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
/** Tailwind gap-1 between swim lanes and dividers. */
export const BLUEPRINT_LAYER_ROW_GAP = 4
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

function getMaxLineCountInLayer(data: BlueprintData, layerId: string): number {
  let max = 1
  for (const cell of data.cells) {
    if (cell.layer_id === layerId && cell.content?.trim()) {
      max = Math.max(max, cell.content.split('\n').length)
    }
  }
  return max
}

function getDefaultCellMinHeight(
  layer: BlueprintLayer,
  data: BlueprintData,
  compact = false,
): number {
  const base = compact ? BLUEPRINT_ROW_MIN_HEIGHT : BLUEPRINT_ROW_MIN_HEIGHT - 16
  const lineCount = getMaxLineCountInLayer(data, layer.id)
  if (lineCount <= 1) return base

  const lineHeight = compact ? 14 : 20
  const innerPadding = compact ? 20 : 24
  const wrappedHeight =
    BLUEPRINT_CELL_GUTTER * 2 + innerPadding + lineCount * lineHeight

  return Math.max(base, wrappedHeight)
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
    BLUEPRINT_CANVAS_INNER_PADDING +
    BLUEPRINT_ARTBOARD_WIDTH_BUFFER
  const height = Math.max(
    480,
    getBlueprintCompactGridHeight(data) +
      BLUEPRINT_CANVAS_INNER_PADDING +
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
      BLUEPRINT_CANVAS_INNER_PADDING +
      BLUEPRINT_ARTBOARD_HEIGHT_BUFFER,
  )

  return { width: totalWidth, height }
}
