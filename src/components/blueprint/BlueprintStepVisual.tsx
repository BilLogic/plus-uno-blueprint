import { BlueprintCellButton } from '@/components/blueprint/BlueprintCellButton'
import { getVisualCellButtonMaxHeight } from '@/lib/blueprintLayout'
import type { BlueprintLaneRole } from '@/lib/blueprintCellStyle'
import { hasEmbeddedVisualFrame } from '@/lib/visualWalkthrough'
import type { BlueprintCellSelection } from '@/types/blueprintCellDetail'
import { cn } from '@/lib/utils'
import { useEntityDetail } from '@/contexts/EntityDetailContext'
import type { CSSProperties } from 'react'

export type BlueprintStepVisualPicture = {
  picture: string
  label?: string
}

type BlueprintStepVisualProps = {
  compact?: boolean
  className?: string
  fill?: BlueprintLaneRole
  selection?: BlueprintCellSelection
  cellId?: string
  stepIndex?: number
  opacity?: number
  pictures?: readonly string[] | readonly BlueprintStepVisualPicture[]
  /**
   * The step this frame belongs to. With it, the cell opens the STEP panel
   * rather than a cell panel: the storyboard row's content IS the step —
   * its frames and its summary — and the cell panel could only describe it
   * through whichever other lane happened to supply the picture.
   */
  stepId?: string | null
  /** Larger walkthrough/presentation layout — images scale to fit without clipping. */
  presentation?: boolean
  'aria-describedby'?: string
}

function normalizePictures(
  pictures: readonly string[] | readonly BlueprintStepVisualPicture[],
): BlueprintStepVisualPicture[] {
  return pictures.map((entry) =>
    typeof entry === 'string' ? { picture: entry } : entry,
  )
}

function VisualPictureStrip({
  pictures,
  className,
}: {
  pictures: readonly BlueprintStepVisualPicture[]
  className?: string
}) {
  const showLabels =
    pictures.some((entry) => Boolean(entry.label?.trim()))

  return (
    <div
      className={cn(
        'flex h-full min-h-0 max-h-full w-full items-stretch justify-center gap-0.5 overflow-hidden',
        className,
      )}
    >
      {pictures.map((entry, index) => (
        <div
          key={`${entry.picture}-${entry.label ?? index}`}
          className="flex h-full min-h-0 max-h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 self-stretch overflow-hidden"
        >
          <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
            <img
              src={entry.picture}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn(
                'h-full w-full rounded-sm object-contain object-center',
                hasEmbeddedVisualFrame(entry.picture) && 'scale-[1.08]',
              )}
            />
          </div>
          {showLabels && entry.label?.trim() ? (
            <p className="w-full shrink-0 whitespace-nowrap px-0.5 text-center text-[8px] font-medium leading-none tracking-tight text-foreground/80">
              {entry.label}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/** Visual-lane cell: the screenshots for a step, laid out inside a cell face. */
export function BlueprintStepVisual({
  compact = false,
  className,
  fill = 'visual',
  selection,
  cellId,
  stepIndex,
  opacity,
  pictures,
  stepId,
  presentation = false,
  'aria-describedby': ariaDescribedBy,
}: BlueprintStepVisualProps) {
  const { openEntity, closeEntity, selection: entitySelection } =
    useEntityDetail()
  const displayPictures = normalizePictures(pictures ?? [])
  const hasRealPictures = displayPictures.length > 0
  // Counts what is actually here — images for one step, not people. The old
  // wording ("Step visuals for 1 users") got both halves wrong, and a screen
  // reader read it out on every visual cell on the board.
  const ariaLabel = hasRealPictures
    ? displayPictures.length === 1
      ? 'Step visual'
      : `Step visuals, ${displayPictures.length} images`
    : 'Empty step visual'
  const inlineMaxHeight = getVisualCellButtonMaxHeight(compact)

  // A caption without a frame renders NOTHING here, deliberately. The visual
  // row's face is its pictures; giving it a text mode would make `showCell`
  // learn a second reason to draw and would put prose in a picture row. A step
  // with a summary and no frame is read in the column header's hover card.
  if (!hasRealPictures) {
    return null
  }

  /*
    NO CAPTION ON THE CELL.

    `steps.summary` was briefly rendered here, under the frame. It is the
    right sentence in the wrong place: the storyboard row is a PICTURE row —
    its whole job is to be scannable at a glance — and prose under every frame
    turned it into a second text lane. The summary reads in the step panel,
    which this cell opens, and in the column header's card.
  */
  if (presentation) {
    return (
      <div
        className={cn(
          'flex w-full items-stretch justify-center gap-2 rounded-xl p-3 ring-1 ring-border-muted',
          'h-[min(16rem,35vh)] min-h-[12.5rem]',
          className,
        )}
        style={{ backgroundColor: 'var(--background-blueprint-cell)' }}
        role="img"
        aria-label={ariaLabel}
      >
        <VisualPictureStrip pictures={displayPictures} />
      </div>
    )
  }

  return (
    <BlueprintCellButton
      fill={fill}
      compact={compact}
      variant="visual"
      className={cn(
        'aspect-[4/3] h-auto min-h-0 max-h-full w-full max-w-full flex-none overflow-hidden',
        'items-stretch justify-stretch p-1',
        className,
      )}
      style={{
        maxHeight: inlineMaxHeight,
        '--background-blueprint-cell-panel': 'transparent',
      } as CSSProperties}
      selection={selection}
      cellId={cellId}
      onOpen={
        stepId
          ? () => {
              // Second click on the open step closes it — the same toggle a
              // cell panel gives, so the storyboard cell does not become the
              // one shape you cannot click twice.
              if (
                entitySelection?.kind === 'step' &&
                entitySelection.id === stepId
              ) {
                closeEntity()
                return
              }
              openEntity({ kind: 'step', id: stepId })
            }
          : undefined
      }
      stepIndex={stepIndex}
      opacity={opacity}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    >
      <VisualPictureStrip pictures={displayPictures} className="min-h-0 flex-1" />
    </BlueprintCellButton>
  )
}
