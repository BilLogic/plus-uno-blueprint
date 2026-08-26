import { BlueprintCellButton } from '@/components/blueprint/BlueprintCellButton'
import { getVisualCellButtonMaxHeight } from '@/lib/blueprintLayout'
import type { BlueprintLaneRole } from '@/lib/blueprintCellStyle'
import { hasEmbeddedVisualFrame } from '@/lib/visualWalkthrough'
import type { BlueprintCellSelection } from '@/types/blueprintCellDetail'
import { cn } from '@/lib/utils'
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
              /*
                `w-auto`, not `w-full`, and that is the whole fix for the
                corners.

                `border-radius` clips the IMG BOX. Stretched to the full cell
                the box is wider than the picture — measured on a 300x272
                screenshot in a 546x372 box, `object-contain` paints it 410
                wide and letterboxes 68px each side — so the radius rounds
                empty space and the artwork keeps square corners inside a
                cell rounded at 10px. Selection is where it shows, because the
                ring draws a crisp rounded outline right around a square
                block.

                Sized to its own aspect the box IS the picture, so the radius
                lands on the artwork's corners. `max-w-full` keeps a picture
                wider than the cell from overflowing; that one letterboxes
                top and bottom instead, which is the same problem in the
                other axis and is why this is a `min`, not a fix for every
                shape.

                And the radius is the CONCENTRIC one, not a token picked by
                eye. A rounded box inset inside another looks wrong unless its
                radius is the outer radius MINUS THE INSET. `rounded-sm` is
                `--radius - 4px`, one pixel proud of that here — invisible
                while the cell face is near-transparent, and obvious the moment
                selection paints an opaque fill behind the picture, because the
                gap pinches at the corners. That is why hover looked right and
                selection did not.

                Spelled out of the same tokens the cell is built from, so it
                cannot drift: `--radius-lg` is what the cell's `rounded-lg`
                resolves to, `--spacing` is what its `p-1` resolves to, and the
                `1px` is its border, which is a literal in the button's own
                class with no token behind it. Change the cell's rounding or
                padding and the picture follows.
              */
              className={cn(
                'h-full w-auto max-w-full rounded-[calc(var(--radius-lg)-var(--spacing)-1px)] object-contain object-center',
                hasEmbeddedVisualFrame(entry.picture) && 'scale-[1.08]',
              )}
            />
          </div>
          {showLabels && entry.label?.trim() ? (
            <p className="w-full shrink-0 whitespace-nowrap px-0.5 text-center text-5xs font-medium leading-none tracking-tight text-foreground/80">
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
  presentation = false,
  'aria-describedby': ariaDescribedBy,
}: BlueprintStepVisualProps) {
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
    which the column header opens, and in that header's hover card.

    AND THE CELL SELECTS ITSELF. It briefly opened the STEP panel instead, on
    the argument that the storyboard row's content IS the step. It is not:
    the frame is a cell, with its own id, its own links and its own place in
    a slice, and a click that silently selected a different object left no
    way to reach any of that. The step is one click away on its column
    header, which is what a column header is for.
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
      stepIndex={stepIndex}
      opacity={opacity}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    >
      <VisualPictureStrip pictures={displayPictures} className="min-h-0 flex-1" />
    </BlueprintCellButton>
  )
}
