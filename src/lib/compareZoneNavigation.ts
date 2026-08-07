import { resolveFocusCells, type FocusCellsResult } from '@/lib/canvasFocusCells'
import { compareZoneFocusCellIds, type CompareZone } from '@/lib/compareLedger'
import { setCompareActiveZone } from '@/lib/compareReviewStore'

/**
 * The one zone-activation gesture, shared by the divergence strip's
 * segments/stepper and the `jump_divergence` agent command: mark the zone
 * active in the store (the ledger's open accordion group derives from it)
 * and fly the camera to the zone's first divergent cells. Returns the
 * camera outcome, or null when no viewport serves the scenario.
 */
export function jumpToCompareZone(
  zone: CompareZone,
  slideId: string,
): FocusCellsResult | null {
  setCompareActiveZone(zone.index)
  const focusCells = resolveFocusCells(slideId)
  if (!focusCells) return null
  return focusCells(compareZoneFocusCellIds(zone))
}
