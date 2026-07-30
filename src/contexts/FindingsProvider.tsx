import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  FindingsPanelContext,
  type FindingsPanelContextValue,
} from '@/contexts/findingsPanelContext'
import { useFindings } from '@/hooks/useFindings'
import { resolveBlueprintCellId } from '@/lib/resolveBlueprintCellId'
import type { BlueprintData } from '@/types/blueprint'
import type { Finding } from '@/types/database'

type FindingsProviderProps = {
  /** Blueprints currently rendered on the canvas — resolves finding cells. */
  blueprints: readonly BlueprintData[]
  children: ReactNode
}

/**
 * Owns the findings query (one fetch shared by the toggle badge and the
 * panel), the drawer open state, and the focused finding whose cells get the
 * slice-focus treatment on the current grid.
 */
export function FindingsProvider({
  blueprints,
  children,
}: FindingsProviderProps) {
  const [open, setOpenState] = useState(false)
  const [focused, setFocused] = useState<{
    id: string
    cellIds: readonly string[]
  } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const findings = useFindings(undefined, reloadToken)

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next)
    if (!next) setFocused(null)
  }, [])

  const focusFinding = useCallback((finding: Finding | null) => {
    setFocused(
      finding ? { id: finding.id, cellIds: finding.cell_ids } : null,
    )
  }, [])

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  const knownCellIds = useMemo(() => {
    const known = new Set<string>()
    for (const blueprint of blueprints) {
      for (const cell of blueprint.cells) known.add(cell.id)
    }
    return known
  }, [blueprints])

  const focusMemberCellIds = useMemo(() => {
    if (!focused) return null
    const member = new Set<string>()
    for (const cellId of focused.cellIds) {
      member.add(cellId)
      member.add(resolveBlueprintCellId(cellId))
    }
    return member
  }, [focused])

  const value = useMemo<FindingsPanelContextValue>(
    () => ({
      open,
      setOpen,
      findings,
      reload,
      focusedFindingId: focused?.id ?? null,
      focusFinding,
      focusMemberCellIds,
      knownCellIds,
    }),
    [
      open,
      setOpen,
      findings,
      reload,
      focused,
      focusFinding,
      focusMemberCellIds,
      knownCellIds,
    ],
  )

  return (
    <FindingsPanelContext.Provider value={value}>
      {children}
    </FindingsPanelContext.Provider>
  )
}
