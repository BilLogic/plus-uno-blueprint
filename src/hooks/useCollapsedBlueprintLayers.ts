import { BLUEPRINT_LAYER_COLLAPSE_ENABLED } from '@/lib/blueprintLayerCollapse'
import { useCallback, useState } from 'react'

const EMPTY_COLLAPSED_LAYERS = new Set<string>()

export function useCollapsedBlueprintLayers() {
  const [collapsedLayerIds, setCollapsedLayerIds] = useState(
    () => new Set<string>(),
  )

  const toggleLayer = useCallback((laneId: string) => {
    if (!BLUEPRINT_LAYER_COLLAPSE_ENABLED) return

    setCollapsedLayerIds((current) => {
      const next = new Set(current)
      if (next.has(laneId)) {
        next.delete(laneId)
      } else {
        next.add(laneId)
      }
      return next
    })
  }, [])

  const isLayerCollapsed = useCallback(
    (laneId: string) =>
      BLUEPRINT_LAYER_COLLAPSE_ENABLED && collapsedLayerIds.has(laneId),
    [collapsedLayerIds],
  )

  return {
    collapsedLayerIds: BLUEPRINT_LAYER_COLLAPSE_ENABLED
      ? collapsedLayerIds
      : EMPTY_COLLAPSED_LAYERS,
    toggleLayer,
    isLayerCollapsed,
  }
}
