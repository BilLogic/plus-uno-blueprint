import type { BlueprintLayer } from '@/types/blueprint'
import { shouldShowVisibilityLineAfter } from '@/lib/blueprintLayout'

export const BLUEPRINT_THEME = {
  canvas: '#FAFAF8',
  canvasBorder: '#E8E4DF',
  divider: '#B8B4AE',
  dividerLabel: '#9A9690',
  dividerBg: '#F5F4F1',
  cellText: '#3D3A36',
  cellEmpty: '#C4C0BA',
  headerText: '#2C2A27',
  /** Thin rules between swim lanes. */
  laneDivider: '#F3F2EF',
  /** Trigger arrows and chevron tips. */
  arrow: '#86868B',
} as const

export type BlueprintLayerStyle = {
  lane: string
  laneLabel: string
  label: string
  accent: string
  accentMuted: string
}

const LAYER_STYLES: Record<string, BlueprintLayerStyle> = {
  'Partner Action: Teacher': {
    lane: '#E8F4F4',
    laneLabel: '#DDEDED',
    label: '#3D6666',
    accent: '#5C8585',
    accentMuted: '#A8CACA',
  },
  'Lead Tutor': {
    lane: '#E3F0F0',
    laneLabel: '#D6E8E8',
    label: '#3A6161',
    accent: '#557E7E',
    accentMuted: '#A0C4C4',
  },
  'Regular Tutor': {
    lane: '#DDEBEB',
    laneLabel: '#D0E3E3',
    label: '#375C5C',
    accent: '#4F7777',
    accentMuted: '#98BABA',
  },
  'Front Stage Tech': {
    lane: '#F0EBF6',
    laneLabel: '#E8E0F0',
    label: '#5C4F6E',
    accent: '#7A6A94',
    accentMuted: '#C4B8D4',
  },
  'Tutor Resources': {
    lane: '#F5F0E8',
    laneLabel: '#EDE6DA',
    label: '#6B5F4A',
    accent: '#8A7A62',
    accentMuted: '#D4C8B0',
  },
  'Front Stage Actions': {
    lane: '#F5EBEB',
    laneLabel: '#EDE0E0',
    label: '#6E5252',
    accent: '#946B6B',
    accentMuted: '#D4B8B8',
  },
  'Back Stage Actions': {
    lane: '#F0E5E5',
    laneLabel: '#E8D8D8',
    label: '#664A4A',
    accent: '#875F5F',
    accentMuted: '#C8AAAA',
  },
  'Back Stage Tech': {
    lane: '#EBE5F2',
    laneLabel: '#E0D8EC',
    label: '#564D66',
    accent: '#726682',
    accentMuted: '#B8AEC8',
  },
  'Support Actions': {
    lane: '#F2EDE3',
    laneLabel: '#EAE2D4',
    label: '#5F5748',
    accent: '#7A7260',
    accentMuted: '#C8C0B0',
  },
}

const FRONTSTAGE_FALLBACK: BlueprintLayerStyle = {
  lane: '#E8F0F0',
  laneLabel: '#DCE8E8',
  label: '#3D5555',
  accent: '#5A7575',
  accentMuted: '#A8BFBF',
}

const BACKSTAGE_FALLBACK: BlueprintLayerStyle = {
  lane: '#F0EAE8',
  laneLabel: '#E8DED8',
  label: '#5A4F48',
  accent: '#7A6A62',
  accentMuted: '#C4B4AC',
}

export type BlueprintZone = 'frontstage' | 'backstage'

export function getBlueprintLayerStyle(
  layerName: string,
  zone: BlueprintZone,
): BlueprintLayerStyle {
  return (
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
    shouldShowVisibilityLineAfter(entry),
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
