import { ARROW_VIEWPORT_PAD } from '@/lib/blueprintArrowGeometry'
import {
  BLUEPRINT_CANVAS_INNER_PADDING,
  BLUEPRINT_ARTBOARD_HEIGHT_BUFFER,
  BLUEPRINT_ARTBOARD_WIDTH_BUFFER,
  BLUEPRINT_DIVIDER_ROW_HEIGHT,
  BLUEPRINT_HEADER_HEIGHT_COMPACT,
  BLUEPRINT_LAYER_ROW_GAP,
  BLUEPRINT_ROW_MIN_HEIGHT,
  BLUEPRINT_ROW_MIN_HEIGHT_COMPACT,
  BLUEPRINT_WRAP_CORRIDOR_MARGIN,
  BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN,
  INTERACTION_LINE_LABEL,
  INTERNAL_INTERACTION_LINE_LABEL,
  VISIBILITY_LINE_LABEL,
  getCellContentMinHeight,
  getLayerRowMinHeight,
  getStepColumnsWidth,
  layerHasDiscoveryRailCorridor,
  shouldShowInteractionLineAfter,
  shouldShowInternalInteractionLineAfter,
  shouldShowLaneDividerAfter,
  shouldShowVisibilityLineAfter,
  type ArtboardSize,
} from '@/lib/blueprintLayout'
import {
  COMPARE_LAYER_COLLAPSED_HEIGHT,
  isBlueprintLayerCollapsed,
} from '@/lib/blueprintLayerCollapse'
import type { BlueprintData, BlueprintLayer } from '@/types/blueprint'
import type {
  IntegratedBlueprintCell,
  IntegratedBlueprintData,
  IntegratedBlueprintStep,
  IntegratedBlueprintTrigger,
} from '@/types/integratedBlueprint'

export type ComparePathArrowData = {
  triggers: IntegratedBlueprintTrigger[]
  cells: IntegratedBlueprintCell[]
  steps: IntegratedBlueprintStep[]
}

export function getComparePathArrowData(
  blueprint: BlueprintData,
): ComparePathArrowData {
  const { path, cells, triggers, steps } = blueprint

  return {
    steps: steps.map((step) => ({
      ...step,
      pathStepIds: { [path.id]: step.id },
    })),
    cells: cells.map((cell) => ({
      id: cell.id,
      layer_id: cell.layer_id,
      step_id: cell.step_id,
      path_id: path.id,
      path_type: path.path_type,
      content: cell.content,
      picture: cell.picture,
      description: cell.description,
      links: cell.links,
      opacity: 1,
    })),
    triggers: triggers.map((trigger) => ({
      id: trigger.id,
      source_cell_id: trigger.source_cell_id,
      target_cell_id: trigger.target_cell_id,
      path_id: path.id,
      path_type: path.path_type,
      opacity: 1,
    })),
  }
}

export const COMPARE_CARD_GAP = 20
export const COMPARE_CARD_PADDING_X = 12
export const COMPARE_LABEL_WIDTH = 192
export const COMPARE_PANEL_PADDING = 24
/** Extra inset on the right edge of the compare blueprint grid. */
export const COMPARE_PANEL_PADDING_RIGHT = 40
export const COMPARE_PATH_SECTION_TOP_INSET = 20
export const COMPARE_PATH_SECTION_INSET = 8
/** Space reserved above compare body rows for section title badges. */
export const COMPARE_PATH_IDENTITY_HEIGHT = COMPARE_PATH_SECTION_TOP_INSET
/** @deprecated Path info now lives in section frames, not a grid swim lane. */
export const COMPARE_PATH_HEADER_HEIGHT = COMPARE_PATH_SECTION_TOP_INSET
export const COMPARE_STEP_HEADER_HEIGHT = BLUEPRINT_HEADER_HEIGHT_COMPACT + 8
export const COMPARE_MIN_PANEL_WIDTH = 720
export const COMPARE_MIN_PANEL_HEIGHT = 480
export const COMPARE_RESIZE_HANDLE_SIZE = 16
/** Extra scroll space so the resize handle and card shadow do not cover the last row. */
export const COMPARE_PANEL_BOTTOM_INSET = COMPARE_RESIZE_HANDLE_SIZE + 16

/** Symmetric vertical inset inside compare scroll shells (resize handle + arrow bleed). */
export function getComparePanelScrollInsetY(): number {
  return (
    COMPARE_PANEL_BOTTOM_INSET / 2 + BLUEPRINT_ARTBOARD_HEIGHT_BUFFER / 2
  )
}

/** Vertical padding inside the compare panel scroll shell (top + bottom). */
export function getComparePanelScrollPaddingY(): number {
  return ARROW_VIEWPORT_PAD * 2 + getComparePanelScrollInsetY() * 2
}

export type CompareRowHeightSpec = {
  height: number
  wrapCorridorAbove?: boolean
  wrapCorridorBelow?: boolean
  kind?: 'path' | 'layer' | 'interaction' | 'visibility' | 'internalInteraction'
  collapsed?: boolean
}

export type BlueprintLabelRowSpec = {
  key: string
  label: string
  height: number
  kind: 'path' | 'layer' | 'interaction' | 'visibility' | 'internalInteraction'
  layer?: BlueprintLayer
  collapsed?: boolean
  wrapCorridorAbove?: boolean
  wrapCorridorBelow?: boolean
  showDividerBelow?: boolean
}

export function buildCompareRowSpecs(
  blueprints: BlueprintData[],
  compact = false,
  collapsedLayerIds: ReadonlySet<string> = new Set(),
): CompareRowHeightSpec[] {
  const layers = getCanonicalLayers(blueprints)
  const specs: CompareRowHeightSpec[] = []

  for (const layer of layers) {
    const collapsed = isBlueprintLayerCollapsed(layer.id, collapsedLayerIds)

    specs.push({
      kind: 'layer',
      collapsed,
      height: collapsed
        ? COMPARE_LAYER_COLLAPSED_HEIGHT
        : getSharedLayerRowHeight(layer, blueprints, compact),
      wrapCorridorAbove:
        !collapsed &&
        layerHasDiscoveryRailCorridor(layer, blueprints),
      wrapCorridorBelow:
        !collapsed && layerHasInteractionLine(layer),
    })

    if (!collapsed && layerHasInteractionLine(layer)) {
      specs.push({ kind: 'interaction', height: BLUEPRINT_DIVIDER_ROW_HEIGHT })
    }

    if (!collapsed && layerHasVisibilityLine(layer, layers)) {
      specs.push({ kind: 'visibility', height: BLUEPRINT_DIVIDER_ROW_HEIGHT })
    }

    if (!collapsed && layerHasInternalInteractionLine(layer)) {
      specs.push({
        kind: 'internalInteraction',
        height: BLUEPRINT_DIVIDER_ROW_HEIGHT,
      })
    }
  }

  return specs
}

export function getCanonicalLayers(blueprints: BlueprintData[]): BlueprintLayer[] {
  const source = blueprints[0]
  if (!source) return []
  return [...source.layers].sort((a, b) => a.row_position - b.row_position)
}

export function getCompareCellShellMinHeight(
  rowHeight: number,
  compact = false,
): number {
  const shellFloor = compact
    ? BLUEPRINT_ROW_MIN_HEIGHT_COMPACT
    : BLUEPRINT_ROW_MIN_HEIGHT
  return Math.max(rowHeight, shellFloor)
}

export function getCompareRowTrackHeight(row: {
  height: number
  wrapCorridorAbove?: boolean
  wrapCorridorBelow?: boolean
}): number {
  return (
    row.height +
    (row.wrapCorridorAbove ? BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN : 0) +
    (row.wrapCorridorBelow ? BLUEPRINT_WRAP_CORRIDOR_MARGIN : 0)
  )
}

/** Vertical shell padding on compare cells (Tailwind py-3 / py-4). */
export function getCompareCellShellPaddingY(compact = false): number {
  return compact ? 24 : 32
}

export function getSharedLayerRowHeight(
  layer: BlueprintLayer,
  blueprints: BlueprintData[],
  compact = false,
): number {
  if (blueprints.length === 0) return 0
  const shellPad = getCompareCellShellPaddingY(compact)
  const contentHeight = Math.max(
    ...blueprints.map((blueprint) =>
      getLayerRowMinHeight(layer, blueprint, compact),
    ),
  )
  return getCompareCellShellMinHeight(contentHeight + shellPad, compact)
}

export function getCompareRowTrackCss(
  row: CompareRowHeightSpec,
  options?: { fixedHeight?: boolean },
): string {
  const height = getCompareRowTrackHeight(row)
  if (row.kind === 'layer' && !row.collapsed && !options?.fixedHeight) {
    return `minmax(${height}px, max-content)`
  }
  return `${height}px`
}

export function getCompareCardWidth(
  stepCount: number,
  compact = false,
): number {
  const padding = compact ? COMPARE_CARD_PADDING_X * 2 : COMPARE_CARD_PADDING_X * 2 + 4
  return getStepColumnsWidth(stepCount) + padding
}

/** Full visual width of a divider band (label + gaps + path cards). */
export function getCompareDividerBandWidth(
  blueprints: BlueprintData[],
  compact = false,
): number {
  if (blueprints.length === 0) return COMPARE_LABEL_WIDTH

  const cardsWidth = blueprints.reduce(
    (sum, blueprint) => sum + getCompareCardWidth(blueprint.steps.length, compact),
    0,
  )

  return (
    COMPARE_LABEL_WIDTH +
    cardsWidth +
    blueprints.length * COMPARE_CARD_GAP
  )
}

export function getCompareGridBodyHeight(
  blueprints: BlueprintData[],
  compact = false,
  collapsedLayerIds: ReadonlySet<string> = new Set(),
): number {
  const rows = buildCompareRowSpecs(blueprints, compact, collapsedLayerIds)
  const trackHeights = rows.reduce(
    (sum, row) => sum + getCompareRowTrackHeight(row),
    0,
  )
  const bodyRowGaps = Math.max(0, rows.length - 1) * BLUEPRINT_LAYER_ROW_GAP

  return (
    COMPARE_PATH_SECTION_TOP_INSET +
    trackHeights +
    bodyRowGaps +
    COMPARE_PATH_SECTION_INSET
  )
}

export function getCompareGridWidth(
  blueprints: BlueprintData[],
  compact = false,
): number {
  if (blueprints.length === 0) return COMPARE_MIN_PANEL_WIDTH

  const cardsWidth = blueprints.reduce(
    (sum, blueprint, index) =>
      sum +
      getCompareCardWidth(blueprint.steps.length, compact) +
      (index > 0 ? COMPARE_CARD_GAP : 0),
    0,
  )

  return COMPARE_LABEL_WIDTH + cardsWidth + COMPARE_PANEL_PADDING + COMPARE_PANEL_PADDING_RIGHT
}

export function getCompareGridHeight(
  blueprints: BlueprintData[],
  compact = false,
): number {
  if (blueprints.length === 0) return COMPARE_MIN_PANEL_HEIGHT
  return (
    getCompareGridBodyHeight(blueprints, compact) +
    COMPARE_PANEL_PADDING * 2
  )
}

/** Panel size including scroll padding so arrows and grid are not clipped. */
export function getComparePanelWidth(
  blueprints: BlueprintData[],
  compact = false,
): number {
  return (
    getCompareGridWidth(blueprints, compact) +
    ARROW_VIEWPORT_PAD * 2 +
    (COMPARE_PANEL_PADDING_RIGHT - COMPARE_PANEL_PADDING)
  )
}

export function getComparePanelHeight(
  blueprints: BlueprintData[],
  compact = false,
): number {
  return (
    getCompareGridHeight(blueprints, compact) + getComparePanelScrollPaddingY()
  )
}

export function getSideBySideCompareArtboardSize(
  blueprints: BlueprintData[],
  options?: { compact?: boolean },
): ArtboardSize {
  const compact = options?.compact ?? false
  if (blueprints.length === 0) {
    return { width: 960, height: 540 }
  }

  return {
    width:
      getCompareGridWidth(blueprints, compact) +
      BLUEPRINT_CANVAS_INNER_PADDING * 2 +
      BLUEPRINT_ARTBOARD_WIDTH_BUFFER,
    height: Math.max(
      480,
      getCompareGridHeight(blueprints, compact) +
        BLUEPRINT_CANVAS_INNER_PADDING * 2 +
        BLUEPRINT_ARTBOARD_HEIGHT_BUFFER,
    ),
  }
}

export function layerHasDiscoveryRailCorridorAbove(
  layer: BlueprintLayer,
  blueprints: BlueprintData[],
): boolean {
  return layerHasDiscoveryRailCorridor(layer, blueprints)
}

export function layerHasInteractionLine(layer: BlueprintLayer): boolean {
  return shouldShowInteractionLineAfter(layer)
}

export function layerHasVisibilityLine(
  layer: BlueprintLayer,
  layers?: BlueprintLayer[],
): boolean {
  return shouldShowVisibilityLineAfter(layer, layers)
}

export function layerHasInternalInteractionLine(layer: BlueprintLayer): boolean {
  return shouldShowInternalInteractionLineAfter(layer)
}

export function getIntegratedLayerRowHeight(
  layer: BlueprintLayer,
  data: IntegratedBlueprintData,
  compact = false,
  options?: { fitVertically?: boolean },
): number {
  const shellPad = getCompareCellShellPaddingY(compact)
  const fitVertically = options?.fitVertically ?? false
  let maxSlotContent = 0

  for (const step of data.steps) {
    const slotCells = data.cells.filter(
      (cell) =>
        cell.layer_id === layer.id &&
        cell.step_id === step.id &&
        cell.content?.trim(),
    )
    if (slotCells.length === 0) continue

    const slotHeight = Math.max(
      ...slotCells.map((cell) =>
        getCellContentMinHeight(layer, cell.content, compact),
      ),
    )
    maxSlotContent = Math.max(maxSlotContent, slotHeight)
  }

  const contentFloor = fitVertically && compact
    ? BLUEPRINT_ROW_MIN_HEIGHT_COMPACT
    : compact
      ? BLUEPRINT_ROW_MIN_HEIGHT
      : BLUEPRINT_ROW_MIN_HEIGHT - 16
  const contentHeight = Math.max(maxSlotContent, contentFloor)

  return getCompareCellShellMinHeight(contentHeight + shellPad, compact)
}

export function buildIntegratedLabelRowSpecs(
  layers: BlueprintLayer[],
  data: IntegratedBlueprintData,
  compact = false,
  collapsedLayerIds: ReadonlySet<string> = new Set(),
  options?: { fitVertically?: boolean },
): BlueprintLabelRowSpec[] {
  const specs: BlueprintLabelRowSpec[] = []

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    const layer = layers[layerIndex]
    const collapsed = isBlueprintLayerCollapsed(layer.id, collapsedLayerIds)

    specs.push({
      key: layer.id,
      kind: 'layer',
      layer,
      label: layer.name,
      collapsed,
      height: collapsed
        ? COMPARE_LAYER_COLLAPSED_HEIGHT
        : getIntegratedLayerRowHeight(layer, data, compact, options),
      wrapCorridorAbove:
        !collapsed && layerHasDiscoveryRailCorridor(layer, undefined, data.triggers),
      wrapCorridorBelow: !collapsed && layerHasInteractionLine(layer),
      showDividerBelow: shouldShowLaneDividerAfter(layer, layerIndex, layers),
    })

    if (!collapsed && layerHasInteractionLine(layer)) {
      specs.push({
        key: `${layer.id}-interaction`,
        kind: 'interaction',
        label: INTERACTION_LINE_LABEL,
        height: BLUEPRINT_DIVIDER_ROW_HEIGHT,
      })
    }

    if (!collapsed && layerHasVisibilityLine(layer, layers)) {
      specs.push({
        key: `${layer.id}-visibility`,
        kind: 'visibility',
        label: VISIBILITY_LINE_LABEL,
        height: BLUEPRINT_DIVIDER_ROW_HEIGHT,
      })
    }

    if (!collapsed && layerHasInternalInteractionLine(layer)) {
      specs.push({
        key: `${layer.id}-internal-interaction`,
        kind: 'internalInteraction',
        label: INTERNAL_INTERACTION_LINE_LABEL,
        height: BLUEPRINT_DIVIDER_ROW_HEIGHT,
      })
    }
  }

  return specs
}

export function getIntegratedGridBodyHeight(
  layers: BlueprintLayer[],
  data: IntegratedBlueprintData,
  compact = false,
  collapsedLayerIds: ReadonlySet<string> = new Set(),
  options?: { fitVertically?: boolean },
): number {
  const rows = buildIntegratedLabelRowSpecs(
    layers,
    data,
    compact,
    collapsedLayerIds,
    options,
  )
  const trackHeights = rows.reduce(
    (sum, row) => sum + getCompareRowTrackHeight(row),
    0,
  )
  const rowGaps = Math.max(0, rows.length - 1) * BLUEPRINT_LAYER_ROW_GAP

  return (
    COMPARE_PATH_SECTION_TOP_INSET +
    trackHeights +
    rowGaps +
    COMPARE_PATH_SECTION_INSET
  )
}

export function getIntegratedContentCardWidth(
  stepCount: number,
  compact = false,
): number {
  return getCompareCardWidth(stepCount, compact)
}

export function getIntegratedGridMinWidth(
  stepCount: number,
  compact = false,
): number {
  return (
    COMPARE_LABEL_WIDTH +
    COMPARE_CARD_GAP +
    getIntegratedContentCardWidth(stepCount, compact) +
    COMPARE_PANEL_PADDING +
    COMPARE_PANEL_PADDING_RIGHT
  )
}

export function getIntegratedDividerBandWidth(
  stepCount: number,
  compact = false,
): number {
  return getIntegratedGridMinWidth(stepCount, compact)
}

export function getIntegratedGridHeight(
  layers: BlueprintLayer[],
  data: IntegratedBlueprintData,
  compact = false,
  collapsedLayerIds: ReadonlySet<string> = new Set(),
  options?: { fitVertically?: boolean },
): number {
  return (
    getIntegratedGridBodyHeight(
      layers,
      data,
      compact,
      collapsedLayerIds,
      options,
    ) +
    COMPARE_PANEL_PADDING * 2
  )
}

export function getIntegratedPanelWidth(
  stepCount: number,
  compact = false,
): number {
  return (
    getIntegratedGridMinWidth(stepCount, compact) +
    ARROW_VIEWPORT_PAD * 2 +
    (COMPARE_PANEL_PADDING_RIGHT - COMPARE_PANEL_PADDING)
  )
}

export function getIntegratedPanelHeight(
  layers: BlueprintLayer[],
  data: IntegratedBlueprintData,
  compact = false,
  collapsedLayerIds: ReadonlySet<string> = new Set(),
  options?: { fitVertically?: boolean },
): number {
  return (
    getIntegratedGridHeight(
      layers,
      data,
      compact,
      collapsedLayerIds,
      options,
    ) + getComparePanelScrollPaddingY()
  )
}

/** Canvas artboard size sized to fit a compact integrated blueprint grid. */
export function getIntegratedCanvasArtboardSize(
  data: IntegratedBlueprintData,
  options?: {
    compact?: boolean
    collapsedLayerIds?: ReadonlySet<string>
  },
): ArtboardSize {
  const compact = options?.compact ?? false
  const layers = [...data.layers].sort((a, b) => a.row_position - b.row_position)
  const panelHeight = getIntegratedPanelHeight(
    layers,
    data,
    compact,
    options?.collapsedLayerIds ?? new Set(),
  )
  const panelWidth = getIntegratedPanelWidth(data.steps.length, compact)

  /** Matches Tailwind `p-3` on CanvasBlueprintArtboard. */
  const canvasArtboardPadding = 24

  return {
    width: panelWidth + canvasArtboardPadding * 2,
    height: Math.max(480, panelHeight + canvasArtboardPadding * 2),
  }
}
