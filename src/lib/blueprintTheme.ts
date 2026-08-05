import type { BlueprintLayer } from '@/types/blueprint'
import { RADIX_LIGHT } from '@/lib/radixLight'
import {
  shouldShowInteractionLineAfter,
  shouldShowVisibilityLineAfter,
} from '@/lib/blueprintLayout'

export const BLUEPRINT_THEME = {
  /** Blueprint content surface — path sections, cells, swim lanes. */
  canvas: '#FFFFFF',
  canvasDark: '#1C1C1E',
  /** Blueprint shell — label column, panel padding, compare chrome. */
  labelRail: '#E8E8ED',
  labelRailDark: '#1C1C1E',
  canvasBorder: '#D4D4DA',
  divider: '#AEAEB2',
  dividerLabel: '#8E8E93',
  /** Figma-style interaction / visibility line tag. */
  dividerTagBg: '#3A3A3C',
  dividerLine: '#3A3A3C',
  dividerBg: '#E8E8ED',
  cellText: '#273036',
  cellEmpty: '#C7C7CC',
  headerText: '#1C1C1E',
  /** Thin rules between swim lanes — light grey, visible on canvas and label rail. */
  laneDivider: '#DCDCE1',
  arrow: '#8E8E93',
  /** Side-by-side compare path sections (Figma-style grouping). */
  sectionFill: '#FFFFFF',
  sectionBorder: '#D4D4DA',
  /** Service overview canvas phase sections — slate blue tuned for #F4F4F4 viewport. */
  phaseSectionColor: '#B6C7D2',
  phaseSectionFill: '#D9E4EA',
  /** Outermost slide/canvas workspace — sits behind blueprint panels. */
  viewportPad: '#F4F4F4',
  /** Scenario title badge on gray compare panels — darker than labelRail. */
  panelScenarioBadgeFill: '#C2C2C8',
  panelScenarioBadgeText: '#2C2C2E',
  /** Hover accents for interactive canvas chrome. */
  phaseSectionFillHover: '#C5D6E0',
  phaseSectionBorderHover: '#9AADBE',
  phaseSectionBadgeHover: '#9AADBE',
  panelLabelRailHover: '#DDDFE4',
  panelBorderHover: '#BABAC4',
  panelScenarioBadgeFillHover: '#B0B0B8',
  panelCanvasHover: '#F4F4F7',
  panelSectionFillHover: '#F4F4F7',
} as const

/** Set on interactive compare panels; children inherit label-rail hover. */
export const BLUEPRINT_PANEL_LABEL_RAIL_VAR = '--blueprint-panel-label-rail'
/** White swimlane / path section surfaces inside interactive panels. */
export const BLUEPRINT_PANEL_CANVAS_VAR = '--blueprint-panel-canvas'
export const BLUEPRINT_PANEL_SECTION_FILL_VAR = '--blueprint-panel-section-fill'
/** Divider row backgrounds (interaction / visibility bands). */
export const BLUEPRINT_PANEL_DIVIDER_BG_VAR = '--blueprint-panel-divider-bg'
/** Cell tint strength when an interactive panel is hovered (0–1). */
export const BLUEPRINT_PANEL_CELL_HOVER_VAR = '--blueprint-panel-cell-hover'

export function blueprintPanelLabelRailColor(
  fallback: string = BLUEPRINT_THEME.labelRail,
): string {
  return `var(${BLUEPRINT_PANEL_LABEL_RAIL_VAR}, ${fallback})`
}

export function blueprintPanelCanvasColor(
  fallback: string = BLUEPRINT_THEME.canvas,
): string {
  return `var(${BLUEPRINT_PANEL_CANVAS_VAR}, ${fallback})`
}

export function blueprintPanelSectionFillColor(
  fallback: string = BLUEPRINT_THEME.sectionFill,
): string {
  return `var(${BLUEPRINT_PANEL_SECTION_FILL_VAR}, ${fallback})`
}

export function blueprintPanelDividerBgColor(
  fallback: string = BLUEPRINT_THEME.dividerBg,
): string {
  return `var(${BLUEPRINT_PANEL_DIVIDER_BG_VAR}, ${fallback})`
}

export function getBlueprintPanelHoverCssVars(): Record<string, string> {
  return {
    [BLUEPRINT_PANEL_LABEL_RAIL_VAR]: BLUEPRINT_THEME.panelLabelRailHover,
    [BLUEPRINT_PANEL_CANVAS_VAR]: BLUEPRINT_THEME.panelCanvasHover,
    [BLUEPRINT_PANEL_SECTION_FILL_VAR]: BLUEPRINT_THEME.panelSectionFillHover,
    [BLUEPRINT_PANEL_DIVIDER_BG_VAR]: BLUEPRINT_THEME.panelLabelRailHover,
    [BLUEPRINT_PANEL_CELL_HOVER_VAR]: '1',
  }
}

/**
 * Layer fills — Radix step 500 across seven hues plus a neutral.
 *
 * Previously eight hand-picked pastels with no shared construction, which left
 * them unevenly saturated: chartreuse was vivid enough to read as a highlight
 * while powder blue was nearly white. Step 500 is the Radix "component
 * surface" step, so every lane now sits at the same perceptual weight and every
 * one of them clears 15:1 against the black cell text.
 *
 * The key names are kept — they are the vocabulary the lane map and Figma both
 * use — but each now points at a scale step rather than a one-off value. Lime
 * exists in colors.css only for `chartreuse`: the families Supabase ships leave
 * a gap between amber (40°) and green (140°), and folding that lane into yellow
 * would have put it next to `cream`.
 */
export const BLUEPRINT_CELL_PALETTE = {
  powderBlue: RADIX_LIGHT.blue500,
  chartreuse: RADIX_LIGHT.lime500,
  peach: RADIX_LIGHT.orange500,
  lavender: RADIX_LIGHT.violet500,
  cream: RADIX_LIGHT.amber500,
  mint: RADIX_LIGHT.green500,
  blush: RADIX_LIGHT.pink500,
  visual: RADIX_LIGHT.slate500,
  charcoal: '#000000',
} as const

export type BlueprintLayerStyle = {
  lane: string
  laneLabel: string
  label: string
  accent: string
  accentMuted: string
}

/** Label column text tones — reference blueprint swimlane labels. */
export const BLUEPRINT_LABEL_TEXT = {
  frontstage: '#2D5A58',
  customerFacing: '#5C4E62',
  backstage: '#4F4B47',
} as const

export type BlueprintLabelSection =
  | 'frontstage'
  | 'customerFacing'
  | 'backstage'

export function getBlueprintLabelSection(
  layer: BlueprintLayer,
  layers: BlueprintLayer[],
): BlueprintLabelSection {
  if (isBackstageBlueprintLayer(layer, layers)) {
    return 'backstage'
  }

  const layerIndex = layers.findIndex((entry) => entry.id === layer.id)
  const interactionAfterIndex = layers.findIndex((entry) =>
    shouldShowInteractionLineAfter(entry),
  )
  const visibilityAfterIndex = layers.findIndex((entry) =>
    shouldShowVisibilityLineAfter(entry, layers),
  )

  if (
    interactionAfterIndex !== -1 &&
    layerIndex > interactionAfterIndex &&
    (visibilityAfterIndex === -1 || layerIndex <= visibilityAfterIndex)
  ) {
    return 'customerFacing'
  }

  return 'frontstage'
}

export function getBlueprintLabelTextColor(
  section: BlueprintLabelSection,
): string {
  switch (section) {
    case 'frontstage':
      return BLUEPRINT_LABEL_TEXT.frontstage
    case 'customerFacing':
      return BLUEPRINT_LABEL_TEXT.customerFacing
    case 'backstage':
      return BLUEPRINT_LABEL_TEXT.backstage
  }
}

function cellStyleFromFill(
  fill: string,
  label: string = BLUEPRINT_LABEL_TEXT.frontstage,
): BlueprintLayerStyle {
  const { charcoal } = BLUEPRINT_CELL_PALETTE
  return {
    lane: fill,
    laneLabel: fill,
    label,
    accent: charcoal,
    accentMuted: fill,
  }
}

const LAYER_STYLES: Record<string, BlueprintLayerStyle> = {
  Visual: cellStyleFromFill(BLUEPRINT_CELL_PALETTE.visual),
  'Step Visual': cellStyleFromFill(BLUEPRINT_CELL_PALETTE.visual),
  'Partner Action: Teacher': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.powderBlue,
    BLUEPRINT_LABEL_TEXT.frontstage,
  ),
  'Lead Tutor': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.mint,
    BLUEPRINT_LABEL_TEXT.frontstage,
  ),
  'Regular Tutor': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.mint,
    BLUEPRINT_LABEL_TEXT.frontstage,
  ),
  'Front Stage Tech': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.lavender,
    BLUEPRINT_LABEL_TEXT.customerFacing,
  ),
  'Front Stage Actions': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.blush,
    BLUEPRINT_LABEL_TEXT.customerFacing,
  ),
  'Tutor Resources': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.cream,
    BLUEPRINT_LABEL_TEXT.customerFacing,
  ),
  'Back Stage Actions': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.blush,
    BLUEPRINT_LABEL_TEXT.backstage,
  ),
  'Back Stage Tech': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.lavender,
    BLUEPRINT_LABEL_TEXT.backstage,
  ),
  'Support Actions': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.cream,
    BLUEPRINT_LABEL_TEXT.backstage,
  ),
  'Physical Evidence': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.powderBlue,
    BLUEPRINT_LABEL_TEXT.frontstage,
  ),
  'Customer Actions': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.mint,
    BLUEPRINT_LABEL_TEXT.frontstage,
  ),
  'Frontstage Actions': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.lavender,
    BLUEPRINT_LABEL_TEXT.customerFacing,
  ),
  'Backstage Actions': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.peach,
    BLUEPRINT_LABEL_TEXT.backstage,
  ),
  'Tech Support Actions': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.peach,
    BLUEPRINT_LABEL_TEXT.backstage,
  ),
  'Management Actions': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.peach,
    BLUEPRINT_LABEL_TEXT.backstage,
  ),
  'Computer Systems': cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.mint,
    BLUEPRINT_LABEL_TEXT.backstage,
  ),
}

const FRONTSTAGE_FALLBACK: BlueprintLayerStyle = cellStyleFromFill(
  BLUEPRINT_CELL_PALETTE.cream,
  BLUEPRINT_LABEL_TEXT.frontstage,
)

const BACKSTAGE_FALLBACK: BlueprintLayerStyle = cellStyleFromFill(
  BLUEPRINT_CELL_PALETTE.cream,
  BLUEPRINT_LABEL_TEXT.backstage,
)

/**
 * Canonical cell fills keyed by `layer_role` — the intentional coloring system.
 * Roles are locale-independent, so non-English lane labels still color correctly
 * (name-keyed `LAYER_STYLES` above is the legacy fallback for pre-role content).
 */
const ROLE_STYLES: Record<string, BlueprintLayerStyle> = {
  visual: cellStyleFromFill(BLUEPRINT_CELL_PALETTE.visual),
  step_visual: cellStyleFromFill(BLUEPRINT_CELL_PALETTE.visual),
  journey_stage: cellStyleFromFill(BLUEPRINT_CELL_PALETTE.visual),
  physical_evidence: cellStyleFromFill(BLUEPRINT_CELL_PALETTE.powderBlue),
  customer_actions: cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.mint,
    BLUEPRINT_LABEL_TEXT.frontstage,
  ),
  frontstage_tech: cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.lavender,
    BLUEPRINT_LABEL_TEXT.customerFacing,
  ),
  frontstage_actions: cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.blush,
    BLUEPRINT_LABEL_TEXT.customerFacing,
  ),
  backstage_actions: cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.peach,
    BLUEPRINT_LABEL_TEXT.backstage,
  ),
  backstage_tech: cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.powderBlue,
    BLUEPRINT_LABEL_TEXT.backstage,
  ),
  support_systems: cellStyleFromFill(
    BLUEPRINT_CELL_PALETTE.cream,
    BLUEPRINT_LABEL_TEXT.backstage,
  ),
}

export type BlueprintZone = 'frontstage' | 'backstage'

export function getBlueprintLayerStyle(
  layerName: string,
  zone: BlueprintZone,
  role?: string | null,
): BlueprintLayerStyle {
  return (
    (role ? ROLE_STYLES[role] : undefined) ??
    LAYER_STYLES[layerName] ??
    (zone === 'backstage' ? BACKSTAGE_FALLBACK : FRONTSTAGE_FALLBACK)
  )
}

export function getBlueprintZoneColor(zone: BlueprintZone): string {
  return zone === 'backstage'
    ? BACKSTAGE_FALLBACK.accent
    : FRONTSTAGE_FALLBACK.accent
}

export function isBackstageBlueprintLayer(
  layer: BlueprintLayer,
  layers: BlueprintLayer[],
): boolean {
  const visibilityAfterIndex = layers.findIndex((entry) =>
    shouldShowVisibilityLineAfter(entry, layers),
  )
  if (visibilityAfterIndex === -1) return false
  const layerIndex = layers.findIndex((entry) => entry.id === layer.id)
  return layerIndex > visibilityAfterIndex
}

export function getBlueprintLayerZone(
  layer: BlueprintLayer,
  layers: BlueprintLayer[],
): BlueprintZone {
  return isBackstageBlueprintLayer(layer, layers) ? 'backstage' : 'frontstage'
}
