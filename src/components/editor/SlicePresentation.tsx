import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { ChevronLeft, ChevronRight, CornerUpLeft } from 'lucide-react'
import { SliceHeaderBand } from '@/components/editor/SliceHeaderBand'
import { DelayedSpinner } from '@/components/ui/spinner'
import { useViewState } from '@/contexts/viewStateStore'
import { useSliceBlueprint } from '@/hooks/useSliceBlueprint'
import { buildCellLookup, getCellAt } from '@/lib/normalizeBlueprint'
import { resolveBlueprintCellId } from '@/lib/resolveBlueprintCellId'
import {
  parseSliceIllustration,
  resolveSliceFramePictures,
  sliceIllustrationUrl,
} from '@/lib/sliceCells'
import { cn } from '@/lib/utils'
import type { BlueprintCell, BlueprintData } from '@/types/blueprint'
import type { SliceItem } from '@/types/database'

const CELL_SNIPPET_MAX_LENGTH = 60

function cellSnippet(cell: BlueprintCell | undefined): string {
  if (!cell) return 'Removed cell'
  const firstLine = cell.content.split('\n')[0]?.trim() ?? ''
  if (firstLine.length === 0) return 'Untitled cell'
  return firstLine.length > CELL_SNIPPET_MAX_LENGTH
    ? `${firstLine.slice(0, CELL_SNIPPET_MAX_LENGTH - 1)}…`
    : firstLine
}

type SlicePresentationProps = {
  sliceId: string
  /**
   * Exit request. The shell owns it because leaving is a shell-wide move:
   * the sidebar re-expands in step with the stage fading out, and the tab
   * only switches once that has played (tabs unmount on switch, so the
   * outgoing animation has to happen while this tab is still mounted).
   */
  onReturn: () => void
  /** True while the shell is playing the exit animation. */
  leaving?: boolean
}

/**
 * Presentation tab: a dark full-bleed stage (the root carries the `.dark`
 * token class regardless of app theme) with the illustration as the star
 * when present, caption as headline, cell chips as a subtle bottom row, a
 * dim mini-map locator bottom-right, and a filmstrip of cells bracketed per
 * frame. Frames render synchronously from the cached useSlice data —
 * navigation never refetches. Keyboard is scoped to the container (tabIndex
 * + onKeyDown, no window listeners); the frame mirrors to the URL via the
 * debounced ViewStateContext mechanism.
 *
 * The slice header band rides at the top of the stage in dark tokens, with
 * Return where the focus tab shows Present — presentation is a mode of the
 * slice, not a separate screen.
 */
export function SlicePresentation({
  sliceId,
  onReturn,
  leaving = false,
}: SlicePresentationProps) {
  const { openTab, reportPresentFrame, restoredFrame, consumeRestoredFrame } =
    useViewState()

  const {
    result,
    detail,
    items,
    cellIds,
    blueprint,
    scenarioResult,
    blueprintsLoading,
  } = useSliceBlueprint(sliceId)
  const cellById = useMemo(
    () =>
      new Map((blueprint?.cells ?? []).map((cell) => [cell.id, cell])),
    [blueprint],
  )
  const memberCellIds = useMemo(
    () => new Set(cellIds.map(resolveBlueprintCellId)),
    [cellIds],
  )

  const [frame, setFrame] = useState(() =>
    restoredFrame && restoredFrame.sliceId === sliceId
      ? restoredFrame.frame
      : 0,
  )

  // The deep-link frame is one-shot: consume it after the initial read so
  // reopening this present tab later starts at frame 0.
  useEffect(() => {
    if (restoredFrame) consumeRestoredFrame()
  }, [restoredFrame, consumeRestoredFrame])
  const frameCount = items.length
  const clampedFrame =
    frameCount === 0 ? 0 : Math.min(Math.max(0, frame), frameCount - 1)
  const item = items[clampedFrame]

  useEffect(() => {
    reportPresentFrame(clampedFrame)
  }, [clampedFrame, reportPresentFrame])

  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Only the active tab mounts, so mount focus covers tab activation.
    containerRef.current?.focus()
  }, [])

  const goToFrame = useCallback(
    (next: number) => {
      if (frameCount === 0) return
      setFrame(Math.min(Math.max(0, next), frameCount - 1))
    },
    [frameCount],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        goToFrame(clampedFrame - 1)
        break
      case 'ArrowRight':
        event.preventDefault()
        goToFrame(clampedFrame + 1)
        break
      case 'Home':
        event.preventDefault()
        goToFrame(0)
        break
      case 'End':
        event.preventDefault()
        goToFrame(frameCount - 1)
        break
    }
  }

  const openSliceTab = useCallback(
    () => openTab({ kind: 'slice', sliceId }),
    [openTab, sliceId],
  )

  const returnAction = {
    label: 'Return',
    icon: CornerUpLeft,
    onClick: onReturn,
  }

  // All-or-nothing: the stage waits for the blueprint too, otherwise every
  // cell chip paints "Removed cell" for a beat before the cells land.
  if (
    result.status === 'loading' ||
    scenarioResult.status === 'loading' ||
    blueprintsLoading
  ) {
    return (
      <div className="dark flex h-full bg-background">
        <DelayedSpinner />
      </div>
    )
  }

  if (!detail) {
    return (
      <PresentationMessage>
        {result.status === 'error'
          ? `This slice could not be loaded: ${result.message}`
          : 'This slice could not be loaded.'}
      </PresentationMessage>
    )
  }

  if (frameCount === 0 || !item) {
    return (
      <div
        className="dark flex h-full min-h-0 flex-col bg-background text-foreground"
        data-presentation-root=""
        data-leaving={leaving ? '' : undefined}
      >
        <SliceHeaderBand detail={detail} primaryAction={returnAction} />
        <div
          className="flex min-h-0 flex-1 items-center justify-center p-8"
          data-presentation-stage=""
        >
          <div className="max-w-sm text-center">
            <p className="text-2xl font-semibold">
              <span aria-hidden>▶ </span>
              {detail.slice.title}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              This slice has no frames yet.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Stage media resolution: an authored illustration wins; otherwise fall
  // back to the frame's own cell pictures (member cells first, then the
  // Visual-lane cell of the same step); no media → title-slide layout.
  const illustration = parseSliceIllustration(item.illustration)
  const framePictures = illustration
    ? []
    : resolveSliceFramePictures(blueprint, item).slice(0, 3)
  const stageMedia: string[] = illustration
    ? [sliceIllustrationUrl(illustration)]
    : framePictures
  const frameCellIds = new Set(item.cell_ids.map(resolveBlueprintCellId))
  const caption = item.caption ?? detail.slice.title

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      aria-label={`${detail.slice.title} presentation`}
      className="dark relative flex h-full min-h-0 flex-col bg-background text-foreground outline-none"
      data-presentation-root=""
      data-leaving={leaving ? '' : undefined}
    >
      {/* Persists across slice ⇄ presentation — the band is the one constant,
          so the switch reads as a mode change on one object. */}
      <SliceHeaderBand detail={detail} primaryAction={returnAction} />

      {/* Stage — mini-map anchors bottom-right of this box, above the filmstrip. */}
      <div
        className="relative flex min-h-0 flex-1 flex-col"
        data-presentation-stage=""
      >
        <div className="flex min-h-0 flex-1 items-stretch gap-2 px-4 pt-5">
          <FrameNavButton
            direction="prev"
            disabled={clampedFrame === 0}
            onClick={() => goToFrame(clampedFrame - 1)}
          />

          <div className="min-w-0 flex-1 overflow-y-auto px-2">
            <div className="flex min-h-full flex-col items-center justify-center gap-4 py-4 text-center">
              <p className="font-mono text-[11px] font-medium tracking-[0.2em] text-muted-foreground/70 tabular-nums uppercase">
                Frame {clampedFrame + 1} of {frameCount}
              </p>
              {stageMedia.length > 0 ? (
                <>
                  {/* Media is the star — large centered area; multiple cell
                      pictures in one frame sit side by side. */}
                  <div className="flex max-w-full items-center justify-center gap-4">
                    {stageMedia.map((src) => (
                      <img
                        key={src}
                        src={src}
                        alt={caption}
                        className={cn(
                          'max-h-[60vh] w-auto rounded-lg object-contain',
                          stageMedia.length > 1
                            ? 'min-w-0 bg-card/40 p-2'
                            : 'max-w-full',
                        )}
                        style={
                          stageMedia.length > 1
                            ? {
                                maxWidth: `${Math.floor(94 / stageMedia.length)}%`,
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                  <h2 className="max-w-3xl text-2xl font-semibold text-balance">
                    {caption}
                  </h2>
                  {item.narrative && (
                    <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                      {item.narrative}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {/* No illustration: title-slide layout, no card frame. */}
                  <h2 className="mt-6 max-w-3xl text-3xl font-semibold text-balance">
                    {caption}
                  </h2>
                  {item.narrative && (
                    <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
                      {item.narrative}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <FrameNavButton
            direction="next"
            disabled={clampedFrame === frameCount - 1}
            onClick={() => goToFrame(clampedFrame + 1)}
          />
        </div>

        {/* Cell chips — subtle row at the bottom of the stage. */}
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 px-24 pt-3 pb-4">
          {item.cell_ids.map((cellId) => (
            <button
              key={cellId}
              type="button"
              onClick={openSliceTab}
              title="Open in slice focus view"
              className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {cellSnippet(cellById.get(resolveBlueprintCellId(cellId)))}
            </button>
          ))}
        </div>

        {blueprint && (
          <PresentationMiniMap
            blueprint={blueprint}
            memberCellIds={memberCellIds}
            frameCellIds={frameCellIds}
          />
        )}
      </div>

      {frameCount > 1 && (
        <PresentationFilmstrip
          items={items}
          activeFrame={clampedFrame}
          cellById={cellById}
          onSelect={goToFrame}
        />
      )}
    </div>
  )
}

function FrameNavButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'prev' ? 'Previous frame' : 'Next frame'}
      className="flex w-10 shrink-0 items-center justify-center self-center rounded-md border border-border bg-card py-6 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      <Icon className="size-5" />
    </button>
  )
}

function PresentationFilmstrip({
  items,
  activeFrame,
  cellById,
  onSelect,
}: {
  items: readonly SliceItem[]
  activeFrame: number
  cellById: ReadonlyMap<string, BlueprintCell>
  onSelect: (frame: number) => void
}) {
  // Cumulative cell-order offsets so squares number continuously across frames.
  const orderOffsets: number[] = []
  let runningTotal = 0
  for (const item of items) {
    orderOffsets.push(runningTotal)
    runningTotal += item.cell_ids.length
  }

  return (
    <div
      className="shrink-0 overflow-x-auto border-t border-border px-6 py-4"
      data-presentation-filmstrip=""
    >
      {/* Centered to match the stage; `w-max mx-auto` keeps centering while the
          strip stays scrollable when frames overflow the viewport. */}
      <div className="mx-auto flex w-max items-start gap-6">
        {items.map((item, index) => {
          const active = index === activeFrame
          return (
            <div
              key={item.id}
              className={cn(
                'flex shrink-0 flex-col gap-2 border-t-2 pt-2',
                active ? 'border-foreground' : 'border-border',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(index)}
                className={cn(
                  'max-w-48 truncate text-left text-xs font-medium',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {item.caption ?? `Frame ${index + 1}`}
              </button>
              <div className="flex gap-1.5">
                {item.cell_ids.map((cellId, cellIndex) => {
                  const order = (orderOffsets[index] ?? 0) + cellIndex + 1
                  const cell = cellById.get(resolveBlueprintCellId(cellId))
                  return (
                    <button
                      key={`${cellId}-${order}`}
                      type="button"
                      onClick={() => onSelect(index)}
                      title={cellSnippet(cell)}
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-semibold tabular-nums transition-colors',
                        active
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border bg-muted text-muted-foreground hover:bg-accent',
                        !cell && 'border-dashed opacity-60',
                      )}
                    >
                      {order}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PresentationMiniMap({
  blueprint,
  memberCellIds,
  frameCellIds,
}: {
  blueprint: BlueprintData
  memberCellIds: ReadonlySet<string>
  frameCellIds: ReadonlySet<string>
}) {
  const layers = useMemo(
    () => [...blueprint.layers].sort((a, b) => a.row_position - b.row_position),
    [blueprint.layers],
  )
  const cellLookup = useMemo(
    () => buildCellLookup(blueprint.cells),
    [blueprint.cells],
  )

  return (
    <div
      aria-hidden
      className="absolute right-3 bottom-2 z-10 rounded-md border border-border bg-card/80 p-1.5 opacity-40 transition-opacity duration-150 hover:opacity-100"
    >
      <div className="flex flex-col gap-px">
        {layers.map((layer) => (
          <div key={layer.id} className="flex gap-px">
            {blueprint.steps.map((step) => {
              const cell = getCellAt(cellLookup, layer.id, step.id)
              const isMember = cell !== undefined && memberCellIds.has(cell.id)
              const isCurrent = cell !== undefined && frameCellIds.has(cell.id)
              return (
                <div
                  key={step.id}
                  className={cn(
                    'h-1 w-2 rounded-[1px]',
                    isCurrent
                      ? 'bg-foreground'
                      : isMember
                        ? 'bg-foreground/40'
                        : cell
                          ? 'bg-border'
                          : 'bg-transparent',
                  )}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function PresentationMessage({ children }: { children: string }) {
  return (
    <div className="dark flex h-full items-center justify-center bg-background p-8">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
