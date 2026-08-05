import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { DraftCellTarget } from '@/components/blueprint/CellPanelEditor'
import type { BlueprintCellSelection } from '@/types/blueprintCellDetail'
import type { BlueprintData } from '@/types/blueprint'
import {
  getBlueprintCellConnections,
  getBlueprintForPath,
} from '@/lib/blueprintCellConnections'
import {
  shouldUsePillCellContent,
  shouldUseVisualContent,
} from '@/lib/blueprintLayout'
import { registerAgentUiContext } from '@/lib/agent/uiBridge'
import { resolveBlueprintCellId } from '@/lib/resolveBlueprintCellId'

export type BlueprintCellPreviewHover = {
  cellId: string
  techItem?: string | null
}

type BlueprintCellDetailContextValue = {
  enabled: boolean
  blueprints: BlueprintData[]
  selection: BlueprintCellSelection | null
  selectCell: (selection: BlueprintCellSelection) => void
  clearSelection: () => void
  /**
   * A cell being *created*: the panel opens on this target with an empty
   * form, and nothing is written until Save. Mutually exclusive with
   * `selection` — a draft is not a cell yet.
   */
  draftCell: DraftCellTarget | null
  openDraftCell: (draft: DraftCellTarget) => void
  isOpen: boolean
  selectedCellIds: ReadonlySet<string>
  directlyConnectedCellIds: ReadonlySet<string>
  setPreviewHover: (preview: BlueprintCellPreviewHover | null) => void
}

const BlueprintCellDetailContext =
  createContext<BlueprintCellDetailContextValue | null>(null)

// Hover state lives in its own context: it changes on every pointer move over
// the dependency table, and keeping it inside the main context value re-renders
// every cell in every mounted grid per hover.
const BlueprintCellHoverContext =
  createContext<BlueprintCellPreviewHover | null>(null)

type BlueprintCellDetailProviderProps = {
  children: ReactNode
  /** Clears the open panel when the active scenario or slide changes. */
  resetKey?: string
  enabled?: boolean
  blueprints?: BlueprintData[]
}

export function BlueprintCellDetailProvider({
  children,
  resetKey,
  enabled = false,
  blueprints = [],
}: BlueprintCellDetailProviderProps) {
  const [selection, setSelection] = useState<BlueprintCellSelection | null>(null)
  const [draftCell, setDraftCell] = useState<DraftCellTarget | null>(null)
  const [previewHover, setPreviewHover] =
    useState<BlueprintCellPreviewHover | null>(null)

  useEffect(() => {
    setSelection(null)
    setDraftCell(null)
    setPreviewHover(null)
  }, [resetKey])

  // Tell the agent's UI-context collector which cell the human has open in
  // the side panel — the panel mounts under the canvas, out of the agent
  // panel's React reach, so this goes through the module bridge.
  useEffect(() => {
    if (!selection) return
    return registerAgentUiContext('cell-panel', () => {
      const cells = selection.paths
        .map((entry) => `${entry.pathName}: ${entry.cellId}`)
        .join('; ')
      return `Cell panel open: "${selection.paths[0]?.content ?? selection.stepName}" — layer "${selection.layerName}", step "${selection.stepName}" (#${selection.stepIndex}), scenario "${selection.scenarioName}". Cell ids by path: ${cells}`
    })
  }, [selection])

  const selectCell = useCallback((next: BlueprintCellSelection) => {
    setSelection(next)
    setDraftCell(null)
    setPreviewHover(null)
  }, [])

  const openDraftCell = useCallback((next: DraftCellTarget) => {
    setDraftCell(next)
    setSelection(null)
    setPreviewHover(null)
  }, [])

  const clearSelection = useCallback(() => {
    setSelection(null)
    setDraftCell(null)
    setPreviewHover(null)
  }, [])

  const cellEmphasis = useMemo(() => {
    const selectedCellIds = new Set<string>()
    const directlyConnectedCellIds = new Set<string>()

    if (!selection) {
      return { selectedCellIds, directlyConnectedCellIds }
    }

    const skipHighlightZone = shouldUseVisualContent({
      name: selection.layerName,
    })

    for (const path of selection.paths) {
      const resolvedCellId = resolveBlueprintCellId(path.cellId)
      selectedCellIds.add(path.cellId)
      selectedCellIds.add(resolvedCellId)

      if (skipHighlightZone) continue

      const blueprint = getBlueprintForPath(blueprints, path.pathId)
      if (!blueprint) continue

      const connections = getBlueprintCellConnections(
        blueprint,
        resolvedCellId,
      )
      for (const connection of [
        ...connections.incoming,
        ...connections.outgoing,
      ]) {
        directlyConnectedCellIds.add(connection.cellId)
        directlyConnectedCellIds.add(
          resolveBlueprintCellId(connection.cellId),
        )
      }

      // The dependency table also includes technology in the selected step,
      // even when no explicit trigger connects it to the active cell.
      const techLayerIds = new Set(
        blueprint.layers
          .filter((layer) => shouldUsePillCellContent(layer))
          .map((layer) => layer.id),
      )
      for (const cell of blueprint.cells) {
        if (
          cell.step_id !== selection.stepId ||
          !techLayerIds.has(cell.layer_id)
        ) {
          continue
        }
        directlyConnectedCellIds.add(cell.id)
        directlyConnectedCellIds.add(resolveBlueprintCellId(cell.id))
      }
    }

    return { selectedCellIds, directlyConnectedCellIds }
  }, [blueprints, selection])

  const value = useMemo(
    () => ({
      enabled,
      blueprints,
      selection,
      selectCell,
      clearSelection,
      draftCell,
      openDraftCell,
      isOpen: enabled && (selection !== null || draftCell !== null),
      selectedCellIds: cellEmphasis.selectedCellIds,
      directlyConnectedCellIds: cellEmphasis.directlyConnectedCellIds,
      setPreviewHover,
    }),
    [
      enabled,
      blueprints,
      selection,
      selectCell,
      clearSelection,
      draftCell,
      openDraftCell,
      cellEmphasis,
    ],
  )

  return (
    <BlueprintCellDetailContext.Provider value={value}>
      <BlueprintCellHoverContext.Provider value={previewHover}>
        {children}
      </BlueprintCellHoverContext.Provider>
    </BlueprintCellDetailContext.Provider>
  )
}

/** Hover preview only — subscribe here instead of the main context so hover
 * changes don't re-render selection consumers. */
export function useBlueprintCellPreviewHover() {
  return useContext(BlueprintCellHoverContext)
}

export function useBlueprintCellDetail() {
  const context = useContext(BlueprintCellDetailContext)
  if (!context) {
    throw new Error(
      'useBlueprintCellDetail must be used within BlueprintCellDetailProvider',
    )
  }
  return context
}

export function useBlueprintCellDetailOptional() {
  return useContext(BlueprintCellDetailContext)
}
