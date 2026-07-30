import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { Info, Play } from 'lucide-react'
import { VisualWalkthroughShell } from '@/components/blueprint/VisualWalkthroughShell'
import {
  ServiceOverviewView,
  type OverviewHeaderRenderProps,
} from '@/components/editor/ServiceOverviewView'
import { NavbarZoomIndicator } from '@/components/editor/EditorZoomIndicator'
import { StackHeaderFilterMenu } from '@/components/editor/StackHeaderFilterMenu'
import { Button } from '@/components/ui/button'
import { DelayedSpinner } from '@/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EditorDetailScope, useEditor } from '@/contexts/EditorContext'
import { SliceMembershipContext } from '@/contexts/sliceMembershipContext'
import { useViewState } from '@/contexts/viewStateStore'
import { useScenarioBlueprint } from '@/hooks/useScenarioBlueprint'
import { useSlice, type SliceDetail } from '@/hooks/useSlice'
import { useSliceScenarioId } from '@/hooks/useSliceScenarioId'
import {
  orderedSliceCellIds,
  pickBlueprintForCells,
  resolveSliceCells,
} from '@/lib/sliceCells'
import { cn } from '@/lib/utils'
import { getSlideDisplayLabel } from '@/types/nav'

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
  const { slides } = useEditor()
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

  const scenarioSlide = scenarioId
    ? (slides.find((slide) => slide.id === scenarioId) ?? null)
    : null
  const scenarioLabel = scenarioSlide
    ? getSlideDisplayLabel(scenarioSlide, slides)
    : null

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
                renderHeader={(header) => (
                  <SliceTabHeader
                    detail={detail}
                    scenarioLabel={scenarioLabel}
                    missingCellCount={resolution.missingCellIds.length}
                    onPresent={() => openTab({ kind: 'present', sliceId })}
                    header={header}
                  />
                )}
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
 * Consolidated single-row slice-tab header, docked under the tab strip in
 * place of the embedded view's own menubar header: slice identity on the
 * left, scenario context + the shared Paths field in the middle, Reset View
 * and Present on the right. Wired to the same path-filter and zoom-chrome
 * state the embedded header used (via `renderHeader` / zoom chrome context).
 */
function SliceTabHeader({
  detail,
  scenarioLabel,
  missingCellCount,
  onPresent,
  header,
}: {
  detail: SliceDetail
  scenarioLabel: string | null
  missingCellCount: number
  onPresent: () => void
  header: OverviewHeaderRenderProps
}) {
  return (
    <div
      data-editor-navbar
      className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-sidebar px-4"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-0 shrink items-center gap-2">
        <h2 className="min-w-0 truncate text-sm font-semibold">
          <span aria-hidden>◇ </span>
          {detail.slice.title}
        </h2>
        <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-px text-[10px] leading-tight text-muted-foreground">
          {detail.slice.slice_type}
        </span>
        {detail.slice.description && (
          <Tooltip>
            <TooltipTrigger
              className={cn(
                'inline-flex size-4 shrink-0 items-center justify-center rounded-full',
                'border-0 bg-transparent p-0 text-muted-foreground shadow-none outline-none',
                'transition-colors hover:text-foreground',
                'focus-visible:ring-1 focus-visible:ring-ring',
              )}
              aria-label="Slice description"
            >
              <Info className="size-3.5" aria-hidden />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              {detail.slice.description}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="h-4 w-px shrink-0 bg-border" aria-hidden />

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {scenarioLabel && (
          <span className="shrink-0 text-[13px] font-medium text-muted-foreground">
            {scenarioLabel}
          </span>
        )}
        <StackHeaderFilterMenu
          paths={header.paths}
          selectedPathIds={header.selectedPathIds}
          onTogglePath={header.onTogglePath}
          showPathTooltips
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {missingCellCount > 0 && (
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {missingCellCount} {missingCellCount === 1 ? 'cell' : 'cells'} no
            longer in the blueprint
          </span>
        )}
        <NavbarZoomIndicator />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onPresent}
        >
          <Play className="size-3" aria-hidden />
          Present
        </Button>
      </div>
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
