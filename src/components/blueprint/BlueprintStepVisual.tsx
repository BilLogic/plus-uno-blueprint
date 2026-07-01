import { Camera } from 'lucide-react'
import { BlueprintCellButton } from '@/components/blueprint/BlueprintCellButton'
import { getVisualCellButtonMaxHeight } from '@/lib/blueprintLayout'
import { BLUEPRINT_CELL_PALETTE } from '@/lib/blueprintTheme'
import type { BlueprintCellSelection } from '@/types/blueprintCellDetail'
import { cn } from '@/lib/utils'

type BlueprintStepVisualProps = {
  compact?: boolean
  className?: string
  fill?: string
  selection?: BlueprintCellSelection
  cellId?: string
  stepIndex?: number
  opacity?: number
  pictures?: readonly string[]
  /** Larger walkthrough/presentation layout — images scale to fit without clipping. */
  presentation?: boolean
}

function VisualPictureStrip({
  pictures,
  className,
}: {
  pictures: readonly string[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 max-h-full w-full items-center justify-center gap-0.5 overflow-hidden',
        className,
      )}
    >
      {pictures.map((src, index) => (
        <div
          key={`${src}-${index}`}
          className="flex h-full min-h-0 max-h-full min-w-0 flex-1 items-center justify-center self-stretch overflow-hidden"
        >
          <img
            src={src}
            alt=""
            className="max-h-full max-w-full rounded-sm object-contain object-center"
          />
        </div>
      ))}
    </div>
  )
}

export function BlueprintStepVisual({
  compact = false,
  className,
  fill = BLUEPRINT_CELL_PALETTE.visual,
  selection,
  cellId,
  stepIndex,
  opacity,
  pictures,
  presentation = false,
}: BlueprintStepVisualProps) {
  const hasPictures = Boolean(pictures?.length)
  const ariaLabel = hasPictures
    ? `Step visuals for ${pictures!.length} users`
    : 'Image placeholder'
  const inlineMaxHeight = getVisualCellButtonMaxHeight(compact)

  if (presentation) {
    return (
      <div
        className={cn(
          'flex w-full items-stretch justify-center gap-2 rounded-xl p-3 ring-1 ring-border/60',
          'h-[min(16rem,35vh)] min-h-[12.5rem]',
          className,
        )}
        style={{ backgroundColor: fill }}
        role="img"
        aria-label={ariaLabel}
      >
        {hasPictures ? (
          <VisualPictureStrip pictures={pictures!} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <Camera
              className={cn(
                'shrink-0 text-muted-foreground',
                compact ? 'size-5' : 'size-6',
              )}
              aria-hidden
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <BlueprintCellButton
      fill={fill}
      compact={compact}
      variant="visual"
      className={cn(
        'h-full min-h-0 max-h-full w-full overflow-hidden',
        hasPictures && 'items-stretch justify-stretch p-1',
        className,
      )}
      style={{ maxHeight: inlineMaxHeight }}
      selection={selection}
      cellId={cellId}
      stepIndex={stepIndex}
      opacity={opacity}
      aria-label={ariaLabel}
    >
      {hasPictures ? (
        <VisualPictureStrip pictures={pictures!} />
      ) : (
        <Camera
          className={cn(
            'shrink-0 text-muted-foreground',
            compact ? 'size-5' : 'size-6',
          )}
          aria-hidden
        />
      )}
    </BlueprintCellButton>
  )
}
