import {
  BLUEPRINT_CELL_BORDER_COLOR,
  cellToken,
  type BlueprintCellFamily,
} from '@/lib/blueprintCellStyle'
import { getTechPillFamily } from '@/lib/techPillColors'

export type TechPillStyle = {
  backgroundColor: string
  color: string
  borderColor: string
}

/** Step 400 — one paler than the step-500 lane a pill sits in. */
const TECH_PILL_SURFACE_STEP = 400

export function getTechPillFamilyFor(
  item: string,
  chosen?: BlueprintCellFamily,
): BlueprintCellFamily {
  return getTechPillFamily(item, chosen)
}

export function getTechPillStyle(item: string): TechPillStyle {
  const family = getTechPillFamily(item)
  return {
    backgroundColor: `var(--color-${family}-${TECH_PILL_SURFACE_STEP})`,
    color: cellToken(family, 1200),
    borderColor: BLUEPRINT_CELL_BORDER_COLOR,
  }
}
