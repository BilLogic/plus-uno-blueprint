import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { SLIDE_ARTBOARD_WIDTH } from '@/lib/slideLayout'
import { useEditor } from '@/contexts/EditorContext'
import { getSlideDisplayLabel, isSubslide, type Slide } from '@/types/slides'
import { Badge } from '@/components/ui/badge'

type SlideArtboardProps = {
  slide: Slide
  isActive?: boolean
  onSelect?: () => void
  className?: string
  style?: CSSProperties
  variant?: 'viewport' | 'canvas'
}

export function SlideArtboard({
  slide,
  isActive = false,
  onSelect,
  className,
  style,
  variant = 'viewport',
}: SlideArtboardProps) {
  const { slides } = useEditor()
  const displayLabel = getSlideDisplayLabel(slide, slides)

  return (
    <button
      type="button"
      data-canvas-artboard
      data-slide-id={slide.id}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
      className={cn(
        'relative flex items-center justify-center rounded-sm border bg-card text-left shadow-sm transition-[box-shadow,border-color]',
        variant === 'viewport' && 'aspect-video w-full max-w-5xl',
        variant === 'canvas' && 'shrink-0',
        isActive
          ? 'border-primary ring-2 ring-primary/25'
          : 'border-border hover:border-muted-foreground/40',
        className,
      )}
      style={
        variant === 'canvas'
          ? { width: SLIDE_ARTBOARD_WIDTH, ...style }
          : style
      }
      aria-label={displayLabel}
      aria-current={isActive ? 'true' : undefined}
    >
      <div className="pointer-events-none flex flex-col items-center gap-2">
        {isSubslide(slide) && (
          <Badge variant="secondary" className="text-[10px] font-normal">
            Scenario
          </Badge>
        )}
        <span className="text-base font-medium text-foreground">{displayLabel}</span>
      </div>
    </button>
  )
}
