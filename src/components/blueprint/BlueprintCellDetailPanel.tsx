import { useEffect } from 'react'
import { X } from 'lucide-react'
import { BlueprintStepVisual } from '@/components/blueprint/BlueprintStepVisual'
import { Button } from '@/components/ui/button'
import { useBlueprintCellDetail } from '@/contexts/BlueprintCellDetailContext'
import { shouldUseVisualContent } from '@/lib/blueprintLayout'
import { cn } from '@/lib/utils'

export function BlueprintCellDetailPanel() {
  const { selection, clearSelection, isOpen } = useBlueprintCellDetail()

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSelection()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearSelection, isOpen])

  if (!isOpen || !selection) return null

  const isVisualLayer = shouldUseVisualContent(selection.layerName)
  const cellContent =
    selection.paths[0]?.content.trim() ||
    selection.techItem ||
    ''

  return (
    <div
      data-cell-detail-panel=""
      className={cn(
        'pointer-events-none absolute z-30',
        'top-18 right-4 bottom-14 w-[22%] min-w-[11rem] max-w-[18rem]',
        'md:right-8',
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <aside
        role="dialog"
        aria-modal="false"
        aria-label="Cell details"
        className="pointer-events-auto relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-3 top-3 z-10 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Close cell details"
          onClick={clearSelection}
        >
          <X />
        </Button>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 pr-12 blueprint-scroll">
          {isVisualLayer ? (
            <BlueprintStepVisual className="border-solid" />
          ) : (
            <p className="text-sm whitespace-pre-wrap text-foreground">
              {cellContent || (
                <span className="text-muted-foreground">No content</span>
              )}
            </p>
          )}
        </div>
      </aside>
    </div>
  )
}
