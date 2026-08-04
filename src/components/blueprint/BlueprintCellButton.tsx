import { Button } from '@/components/ui/button'
import {
  useBlueprintCellDetailOptional,
  useBlueprintCellPreviewHover,
} from '@/contexts/BlueprintCellDetailContext'
import { useCanvasAnnotationsOptional } from '@/contexts/canvasAnnotationContext'
import { useCellPick } from '@/contexts/cellPickContext'
import { clickPicks, pickModeForClick } from '@/lib/cellPickGrammar'
import { useSliceMembership } from '@/contexts/sliceMembershipContext'
import {
  blueprintCellButtonClassName,
  getBlueprintCellInteractionStyle,
} from '@/lib/blueprintCellStyle'
import { isSameBlueprintCellSelection } from '@/lib/blueprintCellSelection'
import { resolveBlueprintCellId } from '@/lib/resolveBlueprintCellId'
import type { BlueprintCellSelection } from '@/types/blueprintCellDetail'
import { cn } from '@/lib/utils'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'

type BlueprintCellButtonProps = {
  /** Layer or pill pastel fill — drives button background while keeping shadcn interaction states. */
  fill: string
  compact?: boolean
  className?: string
  style?: CSSProperties
  selection?: BlueprintCellSelection
  cellId?: string
  stepIndex?: number
  variant?: 'cell' | 'pill' | 'visual'
  opacity?: number
  /**
   * Whether this button may carry the slice sequence badge. Tech pills share
   * their cell's id, so pill call sites pass `index === 0` to badge the
   * first pill only; plain cell faces leave the default (true).
   */
  sliceSequenceBadge?: boolean
  children: ReactNode
  'aria-label'?: string
  'data-blueprint-tech-pill'?: string
}

/**
 * The selection as it stood before the last single click, so a double-click
 * can put it back exactly.
 *
 * Module level because the two clicks of a pair are two separate renders.
 * Keyed by the actual DOM element — the first version keyed on cell id, and
 * tech pills share their cell's id, so pill A then pill B half a second apart
 * read as a "double-click" and silently toggled the cell. The element cannot
 * lie about which thing was clicked.
 */
let lastClick: {
  el: EventTarget | null
  snapshot: readonly string[] | null
} = { el: null, snapshot: null }

export function BlueprintCellButton({
  fill,
  compact = false,
  className,
  style,
  selection,
  cellId,
  stepIndex = -1,
  variant = 'cell',
  opacity,
  sliceSequenceBadge = true,
  children,
  'aria-label': ariaLabel,
  'data-blueprint-tech-pill': techPillLabel,
}: BlueprintCellButtonProps) {
  const detail = useBlueprintCellDetailOptional()
  const isInteractive = Boolean(detail?.enabled && selection && detail)
  const isActive =
    isInteractive &&
    isSameBlueprintCellSelection(detail!.selection, selection!)
  const resolvedCellId = cellId ? resolveBlueprintCellId(cellId) : null
  const isSelectedCell = Boolean(
    detail?.selection &&
      cellId &&
      (detail.selectedCellIds.has(cellId) ||
        (resolvedCellId && detail.selectedCellIds.has(resolvedCellId))),
  )
  const isDirectlyConnected = Boolean(
    detail?.selection &&
      cellId &&
      (detail.directlyConnectedCellIds.has(cellId) ||
        (resolvedCellId &&
          detail.directlyConnectedCellIds.has(resolvedCellId))),
  )
  const sliceMembership = useSliceMembership()
  const isSliceMember = Boolean(
    sliceMembership &&
      cellId &&
      (sliceMembership.memberCellIds.has(cellId) ||
        (resolvedCellId && sliceMembership.memberCellIds.has(resolvedCellId))),
  )
  // Checking `sliceMembership && cellId` directly (not via isSliceMember)
  // lets TypeScript narrow both — no non-null assertions.
  const sliceSequence =
    sliceMembership && cellId && isSliceMember && sliceSequenceBadge
      ? (sliceMembership.sequenceByCellId.get(cellId) ??
        (resolvedCellId
          ? sliceMembership.sequenceByCellId.get(resolvedCellId)
          : undefined))
      : undefined
  // Slice membership and picking both key on the canonical cell id, so
  // integrated-view overlay ids resolve to the same cell as the base grid.
  const pick = useCellPick()
  // Optional, not asserted: this button also renders inside the portalled
  // detail drawer, which is outside CanvasAnnotationProvider. The throwing
  // hook there was an app-wide white screen (see canvasAnnotationContext).
  const annotationTool = useCanvasAnnotationsOptional()?.tool ?? null
  const pickCellId = resolvedCellId ?? cellId ?? null
  const pickOrder = pick && pickCellId ? pick.orderOf(pickCellId) : undefined
  const isPicked = Boolean(pick && pickCellId && pick.isPicked(pickCellId))
  const preview = useBlueprintCellPreviewHover()
  const previewCellId = preview?.cellId
    ? resolveBlueprintCellId(preview.cellId)
    : null
  const matchesPreviewCell = Boolean(
    preview &&
      cellId &&
      (preview.cellId === cellId ||
        previewCellId === cellId ||
        (resolvedCellId != null &&
          (preview.cellId === resolvedCellId ||
            previewCellId === resolvedCellId))),
  )
  const isPreviewHover = Boolean(
    matchesPreviewCell &&
      (techPillLabel
        ? preview?.techItem === techPillLabel
        : !preview?.techItem),
  )
  const emphasis = !detail?.selection
    ? undefined
    : isActive
      ? 'active'
      : isSelectedCell || isDirectlyConnected
        ? 'connected'
        : 'unrelated'

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!isInteractive) return
    // Focus mode: ignore cells in dimmed (inactive) phases/scenarios.
    if (event.currentTarget.closest('[data-canvas-focus-dimmed]')) return
    event.stopPropagation()
    // Picking a cell for a slice takes precedence over opening the panel:
    // in edit mode every click picks, elsewhere only cmd/shift-click does,
    // so ordinary reading of the blueprint is unaffected.
    // Hand means the canvas is being moved, not read: a click that lands at
    // the end of a pan must not also change the selection.
    if (annotationTool === 'hand') return
    // The grammar lives in one place — see `cellPickGrammar` for what each
    // modifier means and where it departs from Figma, and why.
    /*
      Double-click opens the cell — read `event.detail`, which is the
      browser's own per-element click count. `onDoubleClick` never fired
      (the prop does not survive base-ui's Button), and a hand-rolled timer
      keyed by cell id treated two different pills of one cell as a pair.

      A double-click is a read, and a read must not change the selection.
      The first click of the pair has already picked by the time the second
      arrives, so the second *restores the snapshot* taken before the first —
      exact order, exact positions — rather than "undoing" with a toggle,
      which would re-append the cell at the end and quietly reorder the
      slice being built. Restore only where the picker gathers: a slice edit
      session's picks mean "move between frames" and have no replace mode.
    */
    if (event.detail >= 2) {
      if (
        pick?.gathers &&
        lastClick.el === event.currentTarget &&
        lastClick.snapshot
      ) {
        pick.pickMany(lastClick.snapshot, 'replace')
      }
      lastClick = { el: null, snapshot: null }
      detail!.selectCell(selection!)
      return
    }

    lastClick = {
      el: event.currentTarget,
      snapshot: pick ? [...pick.picked] : null,
    }

    if (pickCellId && pick && clickPicks(event, pick.plainClick)) {
      pick.pick(pickCellId, pickModeForClick(event, pick.gathers ?? false))
      return
    }
    detail!.selectCell(selection!)
  }


  const surfaceStyle = {
    ...getBlueprintCellInteractionStyle(fill),
    ...(opacity != null && opacity < 1 ? { opacity } : undefined),
    ...style,
  } as CSSProperties

  const buttonVariant = variant === 'pill' ? 'blueprintPill' : 'blueprint'

  return (
    <Button
      type="button"
      variant={buttonVariant}
      data-blueprint-cell-anchor=""
      {...(cellId ? { 'data-blueprint-cell': cellId } : {})}
      data-step-index={stepIndex}
      {...(techPillLabel ? { 'data-blueprint-tech-pill': techPillLabel } : {})}
      aria-label={ariaLabel}
      aria-pressed={isInteractive ? isActive : undefined}
      data-blueprint-cell-emphasis={emphasis}
      {...(isSliceMember ? { 'data-slice-member': '' } : {})}
      {...(isPicked ? { 'data-slice-picked': '' } : {})}
      {...(isPreviewHover ? { 'data-blueprint-cell-preview-hover': '' } : {})}
      {...(isInteractive ? { 'data-blueprint-cell-interactive': '' } : {})}
      onClick={isInteractive ? handleClick : undefined}
      tabIndex={isInteractive ? 0 : -1}
      className={cn(
        blueprintCellButtonClassName({ compact, variant, className }),
        variant === 'cell' && 'min-h-[80px]',
        variant === 'visual' &&
          'min-h-0 h-full max-h-full overflow-hidden',
        !isInteractive && 'pointer-events-none cursor-default',
        (sliceSequence !== undefined || isPicked) && 'relative overflow-visible',
      )}
      style={surfaceStyle}
    >
      {/* Pick order wins the badge slot while picking: during selection the
          number the user cares about is the one they are building, not the
          one the saved slice already has. */}
      {isPicked && pickOrder !== undefined ? (
        <span
          aria-hidden
          data-slice-pick-badge=""
          className="absolute -top-2 -left-2 z-10 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground shadow-sm"
        >
          {pickOrder}
        </span>
      ) : sliceSequence !== undefined ? (
        <span
          aria-hidden
          data-slice-sequence-badge=""
          className="absolute -top-2 -left-2 z-10 grid size-5 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background shadow-sm"
        >
          {sliceSequence}
        </span>
      ) : null}
      {children}
    </Button>
  )
}
