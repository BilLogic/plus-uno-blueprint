import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type MouseEvent,
} from 'react'
import { ServiceBlueprintGrid } from '@/components/blueprint/ServiceBlueprintGrid'
import { SliceFocusOverlay } from '@/components/blueprint/SliceFocusOverlay'
import { SliceMembershipContext } from '@/contexts/sliceMembershipContext'
import { useScenarioBlueprint } from '@/hooks/useScenarioBlueprint'
import { useSlice, type SliceDetail } from '@/hooks/useSlice'
import { useSliceScenarioId } from '@/hooks/useSliceScenarioId'
import {
  orderedSliceCellIds,
  pickBlueprintForCells,
  resolveSliceCells,
} from '@/lib/sliceCells'
import { cn } from '@/lib/utils'

type SliceFocusContextValue = {
  focused: boolean
  setFocused: (focused: boolean) => void
}

/** Per-view focus state — local to the slice tab, never global. */
const SliceFocusContext = createContext<SliceFocusContextValue | null>(null)

function useSliceFocus(): SliceFocusContextValue {
  const context = useContext(SliceFocusContext)
  if (!context) {
    throw new Error('useSliceFocus must be used within SliceView')
  }
  return context
}

type SliceViewProps = {
  sliceId: string
}

export function SliceView({ sliceId }: SliceViewProps) {
  const result = useSlice(sliceId)
  const detail: SliceDetail | null =
    result.status === 'ready'
      ? result.data
      : result.status === 'error'
        ? result.fallback
        : null

  const items = useMemo(
    () => [...(detail?.items ?? [])].sort((a, b) => a.position - b.position),
    [detail],
  )
  const cellIds = useMemo(() => orderedSliceCellIds(items), [items])

  const scenarioResult = useSliceScenarioId(cellIds)
  const scenarioId =
    scenarioResult.status === 'ready'
      ? scenarioResult.data
      : scenarioResult.status === 'error'
        ? (scenarioResult.fallback ?? undefined)
        : undefined

  const { allBlueprints, loading: blueprintLoading } =
    useScenarioBlueprint(scenarioId)

  const blueprint = useMemo(
    () => pickBlueprintForCells(allBlueprints, cellIds),
    [allBlueprints, cellIds],
  )
  const resolution = useMemo(
    () => resolveSliceCells(blueprint, items),
    [blueprint, items],
  )

  const [focused, setFocused] = useState(true)
  const focusValue = useMemo(() => ({ focused, setFocused }), [focused])

  // Clicking a member cell (re-)focuses; clicking anywhere else in the grid
  // lifts the scrim. Badges and member outlines stay either way.
  const handleGridAreaClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target =
        event.target instanceof HTMLElement ? event.target : null
      setFocused(Boolean(target?.closest('[data-slice-member]')))
    },
    [],
  )

  if (result.status === 'loading') {
    return <SliceViewMessage>Loading slice…</SliceViewMessage>
  }

  if (!detail) {
    // The slice may have been deleted (possibly by another session) — close
    // any tabs pointing at it is left to the tab menu; show the message.
    return (
      <SliceViewMessage>
        {result.status === 'error'
          ? `This slice could not be loaded: ${result.message}`
          : 'This slice could not be loaded.'}
      </SliceViewMessage>
    )
  }

  const loadingBlueprint =
    scenarioResult.status === 'loading' || blueprintLoading

  return (
    <SliceFocusContext.Provider value={focusValue}>
      <SliceMembershipContext.Provider value={resolution.memberCellIds}>
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">
              <span aria-hidden>◇ </span>
              {detail.slice.title}
            </h2>
            {detail.slice.description && (
              <p className="text-xs text-muted-foreground">
                {detail.slice.description}
              </p>
            )}
            <span className="ml-auto flex items-center gap-2">
              {resolution.missingCellIds.length > 0 && (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {resolution.missingCellIds.length}{' '}
                  {resolution.missingCellIds.length === 1 ? 'cell' : 'cells'} no
                  longer in the blueprint
                </span>
              )}
            </span>
          </header>

          <div className="relative min-h-0 flex-1">
            <div
              className="h-full overflow-auto p-4"
              data-slice-focus={focused ? 'focused' : 'idle'}
              onClick={handleGridAreaClick}
            >
              {blueprint ? (
                <ServiceBlueprintGrid
                  data={blueprint}
                  focusOverlay={
                    <SliceFocusOverlay
                      blueprint={blueprint}
                      placements={resolution.placements}
                      focused={focused}
                    />
                  }
                />
              ) : (
                <p className="p-6 text-sm text-muted-foreground">
                  {loadingBlueprint
                    ? 'Loading blueprint…'
                    : 'The cells in this slice could not be found in any blueprint.'}
                </p>
              )}
            </div>
            {blueprint && <SliceFocusPill />}
          </div>
        </div>
      </SliceMembershipContext.Provider>
    </SliceFocusContext.Provider>
  )
}

function SliceFocusPill() {
  const { focused, setFocused } = useSliceFocus()

  return (
    <button
      type="button"
      aria-pressed={focused}
      onClick={(event) => {
        event.stopPropagation()
        setFocused(!focused)
      }}
      className={cn(
        'absolute bottom-4 left-4 z-50 rounded-full border px-3 py-1.5 text-xs font-medium shadow-md transition-colors',
        focused
          ? 'border-transparent bg-foreground text-background'
          : 'border-border bg-card text-foreground hover:bg-accent',
      )}
    >
      <span aria-hidden>◇ </span>
      Slice focus
    </button>
  )
}

function SliceViewMessage({ children }: { children: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
