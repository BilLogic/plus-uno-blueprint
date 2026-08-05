import {
  BLUEPRINT_CELL_BORDER_COLOR,
  type TouchpointTone,
} from '@/lib/blueprintCellStyle'
import { getTouchpointTone } from '@/lib/techPillColors'

export type TechPillStyle = {
  backgroundColor: string
  color: string
  borderColor: string
}

export function getTechPillToneFor(
  item: string,
  chosen?: TouchpointTone,
): TouchpointTone {
  return getTouchpointTone(item, chosen)
}

/**
 * Reads the properties the `[data-blueprint-tone]` rule already set, so a pill
 * face rendered outside a Button matches its tone exactly.
 */
export function getTechPillStyle(): TechPillStyle {
  return {
    backgroundColor: 'var(--blueprint-cell-bg)',
    color: 'var(--blueprint-cell-text)',
    borderColor: BLUEPRINT_CELL_BORDER_COLOR,
  }
}
