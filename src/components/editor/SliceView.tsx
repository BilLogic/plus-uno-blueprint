import { useCallback, useMemo, useState, type MouseEvent } from 'react'
import { VisualWalkthroughShell } from '@/components/blueprint/VisualWalkthroughShell'
import { ServiceOverviewView } from '@/components/editor/ServiceOverviewView'
import { EditorDetailScope } from '@/contexts/EditorContext'
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

/**
 * Chrome that must neither re-focus nor de-focus the slice when clicked:
 * the cell detail panel, navbar, canvas nav, zoom chrome, the focus pill
 * itself, and any open walkthrough modal.
 */
const FOCUS_CLICK_IGNORE =
  '[data-cell-detail-panel], [data-editor-navbar], [data-canvas-nav], [data-zoom-indicator], [data-annotation-toolbar], [data-slice-focus-pill], [data-visual-walkthrough-modal]'

type SliceViewProps = {
  sliceId: string
}

/**
 * Slice focus tab — the normal blueprint detail view (same zoom/pan canvas,
 * same cell panel) opened on the slice's scenario, with slice membership
 * applied on top: non-member cells dim via the `data-slice-focus` container
 * attribute + CSS, member cells carry outlines and sequence badges
 * (BlueprintCellButton reads SliceMembershipContext).
 */
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

  // Fetched only to resolve membership (badges, tombstones) — the canvas
  // itself renders through the normal view's own blueprint pipeline.
  const { allBlueprints } = useScenarioBlueprint(scenarioId)
  const blueprint = useMemo(
    () => pickBlueprintForCells(allBlueprints, cellIds),
    [allBlueprints, cellIds],
  )
  const resolution = useMemo(
    () => resolveSliceCells(blueprint, items),
    [blueprint, items],
  )
  const membership = useMemo(
    () => ({
      memberCellIds: resolution.memberCellIds,
      sequenceByCellId: resolution.sequenceByCellId,
    }),
    [resolution],
  )

  const [focused, setFocused] = useState(true)

  // Clicking a member cell (re-)focuses; clicking elsewhere on the canvas
  // lifts the dim. Capture phase, because interactive cells stop click
  // propagation before it would bubble here.
  const handleFocusClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (!target) return
      if (target.closest('[data-slice-member]')) {
        setFocused(true)
        return
      }
      if (target.closest(FOCUS_CLICK_IGNORE)) return
      setFocused(false)
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

  if (!scenarioId) {
    return (
      <SliceViewMessage>
        {scenarioResult.status === 'loading'
          ? 'Loading slice…'
          : 'The cells in this slice could not be found in any blueprint.'}
      </SliceViewMessage>
    )
  }

  return (
    <SliceMembershipContext.Provider value={membership}>
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-semibold">
            <span aria-hidden>◇ </span>
            {detail.slice.title}
          </h2>
          <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-px text-[10px] leading-tight text-muted-foreground">
            {detail.slice.slice_type}
          </span>
          {detail.slice.description && (
            <p className="min-w-0 text-xs text-muted-foreground">
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

        <div
          className="relative min-h-0 min-w-0 flex-1"
          data-slice-focus={focused ? 'focused' : 'idle'}
          onClickCapture={handleFocusClickCapture}
        >
          <EditorDetailScope slideId={scenarioId}>
            <VisualWalkthroughShell>
              <div
                className="absolute inset-0 flex min-h-0 flex-col"
                data-editor-view
              >
                <ServiceOverviewView />
              </div>
            </VisualWalkthroughShell>
          </EditorDetailScope>
          <SliceFocusPill focused={focused} onToggle={setFocused} />
        </div>
      </div>
    </SliceMembershipContext.Provider>
  )
}

function SliceFocusPill({
  focused,
  onToggle,
}: {
  focused: boolean
  onToggle: (focused: boolean) => void
}) {
  return (
    <button
      type="button"
      data-slice-focus-pill=""
      aria-pressed={focused}
      onClick={(event) => {
        event.stopPropagation()
        onToggle(!focused)
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
