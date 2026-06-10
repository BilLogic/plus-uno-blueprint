import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import {
  getParentSlide,
  getSlideDisplayLabel,
  getSlideSequenceNav,
  isSubslide,
  type Slide,
} from '@/types/slides'
import { cn } from '@/lib/utils'

type SequenceNavPreviewProps = {
  direction: 'prev' | 'next'
  slide: Slide | null
  slides: Slide[]
  disabled: boolean
  onClick: () => void
  className?: string
}

function SequenceNavPreview({
  direction,
  slide,
  slides,
  disabled,
  onClick,
  className,
}: SequenceNavPreviewProps) {
  const isPrev = direction === 'prev'
  const Icon = isPrev ? ChevronLeft : ChevronRight
  const actionLabel = isPrev ? 'Previous' : 'Next'
  const title = slide ? getSlideDisplayLabel(slide, slides) : null
  const parent = slide && isSubslide(slide) ? getParentSlide(slide, slides) : undefined
  const subtitle = parent ? getSlideDisplayLabel(parent, slides) : slide ? 'Phase' : null

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={title ? `${actionLabel}: ${title}` : `${actionLabel} (unavailable)`}
      data-canvas-nav=""
      className={cn(
        'group z-30 flex max-w-[min(11rem,28vw)] items-center gap-2 rounded-lg border border-border bg-background/95 px-2.5 py-2 shadow-sm backdrop-blur-sm transition-colors',
        'hover:bg-accent/60 disabled:pointer-events-none disabled:opacity-40',
        isPrev ? 'absolute bottom-3 left-3' : 'absolute bottom-3 right-3',
        className,
      )}
    >
      {isPrev ? (
        <>
          <Icon
            className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
            aria-hidden
          />
          <span className="min-w-0 text-left">
            <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {actionLabel}
            </span>
            {title ? (
              <>
                <span className="block truncate text-sm font-medium leading-tight text-foreground">
                  {title}
                </span>
                {subtitle ? (
                  <span className="block truncate text-xs leading-tight text-muted-foreground">
                    {subtitle}
                  </span>
                ) : null}
              </>
            ) : null}
          </span>
        </>
      ) : (
        <>
          <span className="min-w-0 text-right">
            <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {actionLabel}
            </span>
            {title ? (
              <>
                <span className="block truncate text-sm font-medium leading-tight text-foreground">
                  {title}
                </span>
                {subtitle ? (
                  <span className="block truncate text-xs leading-tight text-muted-foreground">
                    {subtitle}
                  </span>
                ) : null}
              </>
            ) : null}
          </span>
          <Icon
            className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
            aria-hidden
          />
        </>
      )}
    </button>
  )
}

export function EditorSequenceNav() {
  const { slides, activeSlideId, setActiveSlideId } = useEditor()
  const { prev, next } = getSlideSequenceNav(activeSlideId, slides)

  return (
    <>
      <SequenceNavPreview
        direction="prev"
        slide={prev}
        slides={slides}
        disabled={!prev}
        onClick={() => prev && setActiveSlideId(prev.id)}
      />
      <SequenceNavPreview
        direction="next"
        slide={next}
        slides={slides}
        disabled={!next}
        onClick={() => next && setActiveSlideId(next.id)}
      />
    </>
  )
}
