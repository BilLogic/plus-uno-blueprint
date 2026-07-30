import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { Play } from 'lucide-react'
import { VisualWalkthroughShell } from '@/components/blueprint/VisualWalkthroughShell'
import { NavbarZoomIndicator } from '@/components/editor/EditorZoomIndicator'
import { ServiceOverviewView } from '@/components/editor/ServiceOverviewView'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DelayedSpinner } from '@/components/ui/spinner'
import { EditorDetailScope } from '@/contexts/EditorContext'
import { SliceMembershipContext } from '@/contexts/sliceMembershipContext'
import { useViewState } from '@/contexts/viewStateStore'
import type { SliceDetail } from '@/hooks/useSlice'
import { useSliceBlueprint } from '@/hooks/useSliceBlueprint'
import { resolveSliceCells } from '@/lib/sliceCells'
import { cn } from '@/lib/utils'

/**
 * Chrome that must neither re-focus nor de-focus the slice when clicked:
 * the cell detail panel, navbar, canvas nav, zoom chrome, and any open
 * walkthrough modal.
 */
const FOCUS_CLICK_IGNORE =
  '[data-cell-detail-panel], [data-editor-navbar], [data-canvas-nav], [data-zoom-indicator], [data-annotation-toolbar], [data-visual-walkthrough-modal]'

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
  const { openTab } = useViewState()
  const { result, detail, items, scenarioResult, scenarioId, blueprint } =
    useSliceBlueprint(sliceId)

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

  // Click vs drag discrimination: a drag-pan also fires a click on pointer
  // up, which must not toggle the focus dim. Track the pointer-down origin
  // (capture phase, before the viewport handles it) and treat anything that
  // moved more than a few pixels as a drag.
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null)
  const handleFocusPointerDownCapture = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      pointerOrigin.current = { x: event.clientX, y: event.clientY }
    },
    [],
  )

  // Clicking a member cell (re-)focuses; clicking elsewhere on the canvas
  // lifts the dim. Capture phase, because interactive cells stop click
  // propagation before it would bubble here.
  const handleFocusClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const origin = pointerOrigin.current
      pointerOrigin.current = null
      if (
        origin &&
        Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 5
      ) {
        // Drag-pan, not a click — leave the focus state alone.
        return
      }

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
    return <DelayedSpinner />
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
    if (scenarioResult.status === 'loading') {
      return <DelayedSpinner />
    }
    return (
      <SliceViewMessage>
        The cells in this slice could not be found in any blueprint.
      </SliceViewMessage>
    )
  }

  return (
    <SliceMembershipContext.Provider value={membership}>
      <div
        className="relative flex h-full min-h-0 min-w-0 flex-col"
        data-slice-focus={focused ? 'focused' : 'idle'}
        onPointerDownCapture={handleFocusPointerDownCapture}
        onClickCapture={handleFocusClickCapture}
      >
        <EditorDetailScope slideId={scenarioId}>
          <VisualWalkthroughShell>
            <div
              className="absolute inset-0 flex min-h-0 flex-col"
              data-editor-view
            >
              <ServiceOverviewView
                loadingVariant="spinner"
                soloScenarioId={scenarioId}
                renderHeader={() => (
                  <SliceTabHeader
                    detail={detail}
                    missingCellCount={resolution.missingCellIds.length}
                    onPresent={() => openTab({ kind: 'present', sliceId })}
                  />
                )}
                floatingChrome={
                  <div className="rounded-full border border-border bg-card px-1 shadow-sm">
                    <NavbarZoomIndicator />
                  </div>
                }
              />
            </div>
          </VisualWalkthroughShell>
        </EditorDetailScope>
        {!focused && <SliceRefocusPill onRefocus={() => setFocused(true)} />}
      </div>
    </SliceMembershipContext.Provider>
  )
}

/**
 * Slice header band, docked full-width under the tab strip in place of the
 * embedded view's own menubar header. Two rows, non-collapsible: slice
 * identity (◇ title + type badge) with Present on the far right, then the
 * slice description as an always-visible subtitle (em-dash when empty —
 * authoring should require a description going forward), with the
 * missing-cells notice beside it when nonzero.
 */
function SliceTabHeader({
  detail,
  missingCellCount,
  onPresent,
}: {
  detail: SliceDetail
  missingCellCount: number
  onPresent: () => void
}) {
  const description = detail.slice.description?.trim()

  return (
    <div
      data-editor-navbar
      className="flex w-full shrink-0 items-center gap-3 border-b border-border bg-sidebar px-4 py-2"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 truncate text-sm font-semibold">
            <span aria-hidden>◇ </span>
            {detail.slice.title}
          </h2>
          <Badge variant="secondary" className="shrink-0">
            {detail.slice.slice_type}
          </Badge>
        </div>
        <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {description || '—'}
          </p>
          {missingCellCount > 0 && (
            <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
              {missingCellCount} {missingCellCount === 1 ? 'cell' : 'cells'} no
              longer in the blueprint
            </span>
          )}
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        className="shrink-0 gap-1.5"
        onClick={onPresent}
      >
        <Play className="size-3" aria-hidden />
        Present
      </Button>
    </div>
  )
}

/**
 * Floating refocus affordance at the bottom-center of the canvas, visible
 * only while de-focused. Carries `data-canvas-nav` so the outside-click
 * capture treats it as chrome (clicking it must not re-run de-focus logic).
 */
function SliceRefocusPill({ onRefocus }: { onRefocus: () => void }) {
  return (
    // bottom-16 clears the annotation toolbar docked at the bottom center.
    <div
      className="pointer-events-none absolute inset-x-0 bottom-16 z-30 flex justify-center"
      data-canvas-nav=""
    >
      <button
        type="button"
        onClick={onRefocus}
        className={cn(
          'pointer-events-auto flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5',
          'text-xs font-medium text-muted-foreground shadow-md transition-colors',
          'hover:bg-accent hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        )}
      >
        <span aria-hidden>○</span>
        Showing all
        <span aria-hidden className="text-muted-foreground/60">
          ·
        </span>
        <span aria-hidden>⤺</span>
        Back to slice
      </button>
    </div>
  )
}

function SliceViewMessage({ children }: { children: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
