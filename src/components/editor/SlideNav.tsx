import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import {
  getMainSlides,
  getSlideById,
  getSlideDisplayLabel,
  getSubslides,
  type Slide,
} from '@/types/slides'

type SlideNavProps = {
  slides: Slide[]
  activeSlideId: string
  onSelect: (id: string) => void
}

type SlideNavRowProps = {
  displayLabel: string
  isActive: boolean
  onSelect: () => void
  isSubslide?: boolean
}

function SlideNavRow({
  displayLabel,
  isActive,
  onSelect,
  isSubslide,
}: SlideNavRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
        'hover:bg-accent',
        isActive && 'bg-accent font-medium text-foreground',
        !isActive && 'text-foreground/90',
        isSubslide && 'pl-9',
      )}
    >
      <span className="truncate">{displayLabel}</span>
    </button>
  )
}

export function SlideNav({ slides, activeSlideId, onSelect }: SlideNavProps) {
  const mains = getMainSlides(slides)
  const [openParents, setOpenParents] = useState<Set<string>>(new Set())

  useEffect(() => {
    const active = getSlideById(activeSlideId, slides)
    if (active?.parentId) {
      setOpenParents((prev) => new Set(prev).add(active.parentId!))
    }
  }, [activeSlideId, slides])

  const toggleParent = (parentId: string, open: boolean) => {
    setOpenParents((prev) => {
      const next = new Set(prev)
      if (open) next.add(parentId)
      else next.delete(parentId)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-0.5">
      {mains.map((main) => {
        const children = getSubslides(main.id, slides)
        const hasChildren = children.length > 0
        const isMainActive = activeSlideId === main.id
        const childActive = children.some((c) => c.id === activeSlideId)
        const isOpen = openParents.has(main.id)

        const mainLabel = getSlideDisplayLabel(main, slides)

        if (!hasChildren) {
          return (
            <SlideNavRow
              key={main.id}
              displayLabel={mainLabel}
              isActive={isMainActive}
              onSelect={() => onSelect(main.id)}
            />
          )
        }

        return (
          <Collapsible
            key={main.id}
            open={isOpen}
            onOpenChange={(open) => toggleParent(main.id, open)}
          >
            <div
              className={cn(
                'flex min-w-0 items-center rounded-md',
                (isMainActive || childActive) && 'bg-accent/60',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(main.id)}
                className={cn(
                  'min-w-0 flex-1 truncate rounded-md py-2 pl-3 text-left text-sm transition-colors',
                  'hover:bg-accent',
                  isMainActive && 'font-medium',
                )}
              >
                {mainLabel}
              </button>
              <CollapsibleTrigger
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors',
                  'hover:bg-accent hover:text-foreground',
                )}
                aria-label={
                  isOpen ? `Collapse ${mainLabel}` : `Expand ${mainLabel}`
                }
              >
                <ChevronRight
                  className={cn(
                    'size-4 transition-transform',
                    isOpen && 'rotate-90',
                  )}
                />
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="flex flex-col gap-0.5 pb-0.5">
              {children.map((child) => (
                <SlideNavRow
                  key={child.id}
                  displayLabel={getSlideDisplayLabel(child, slides)}
                  isActive={activeSlideId === child.id}
                  onSelect={() => onSelect(child.id)}
                  isSubslide
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}
