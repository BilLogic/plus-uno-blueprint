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
import { PendingCanvasLoadingSkeleton } from '@/components/editor/EditorLoadingSkeletons'
import { NavbarZoomIndicator } from '@/components/editor/EditorZoomIndicator'
import { ServiceOverviewView } from '@/components/editor/ServiceOverviewView'
import { SliceHeaderBand } from '@/components/editor/SliceHeaderBand'
import { DeferredSkeleton } from '@/components/ui/deferred-skeleton'
import { DelayedSpinner } from '@/components/ui/spinner'
import { BLUEPRINT_THEME } from '@/lib/blueprintTheme'
import { EditorDetailScope } from '@/contexts/EditorContext'
import { SliceMembershipContext } from '@/contexts/sliceMembershipContext'
import { useViewState } from '@/contexts/viewStateStore'
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
  const {
    result,
    detail,
    items,
    scenarioResult,
    scenarioId,
    blueprint,
  } = useSliceBlueprint(sliceId)
  // One skeleton session for the whole slice → scenario → blueprints
  // waterfall: the stage that resolves the scenario and the canvas that
  // loads the blueprints hand the same skeleton back and forth.
  const skeletonHoldKey = `slice-tab:${sliceId}`

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

  if (!scenarioId && scenarioResult.status !== 'loading') {
    return (
      <SliceViewMessage>
        The cells in this slice could not be found in any blueprint.
      </SliceViewMessage>
    )
  }

  const header = (
    <SliceHeaderBand
      detail={detail}
      // Every cell reads as missing until the blueprint lands — the notice
      // stays out of the band rather than flashing a false count.
      missingCellCount={blueprint ? resolution.missingCellIds.length : 0}
      primaryAction={{
        label: 'Present',
        icon: Play,
        onClick: () => openTab({ kind: 'present', sliceId }),
      }}
    />
  )

  // Stage 2 — the owning scenario is still resolving, so the canvas cannot
  // mount yet. The header band paints immediately (the slice row is already
  // cached from the sidebar) and the canvas area holds the surface's one
  // skeleton, which the canvas below picks up unbroken once it mounts.
  if (!scenarioId) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        {header}
        <div
          className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
          style={{ backgroundColor: BLUEPRINT_THEME.viewportPad }}
        >
          <DeferredSkeleton
            loading
            holdKey={skeletonHoldKey}
            skeleton={<PendingCanvasLoadingSkeleton />}
          >
            {null}
          </DeferredSkeleton>
        </div>
      </div>
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
                skeletonHoldKey={skeletonHoldKey}
                soloScenarioId={scenarioId}
                renderHeader={() => header}
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
