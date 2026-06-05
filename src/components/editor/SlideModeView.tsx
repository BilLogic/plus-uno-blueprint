import { BlueprintSlideContent } from '@/components/blueprint/BlueprintSlideContent'
import { ZoomPanViewport } from '@/components/editor/ZoomPanViewport'
import { useEditor } from '@/contexts/EditorContext'
import { SlideNav } from '@/components/editor/SlideNav'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

export function SlideModeView() {
  const {
    slides,
    activeSlideId,
    setActiveSlideId,
    activeSlide,
    slidesLoading,
    slidesError,
  } = useEditor()

  return (
    <div className="flex h-full min-h-0 flex-1">
      <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-muted/30">
        <nav
          className="flex flex-1 flex-col overflow-y-auto p-2"
          aria-label="Phase navigation"
        >
          {slidesError && (
            <Alert variant="destructive" className="mb-2">
              <AlertTitle className="text-xs">Phases</AlertTitle>
              <AlertDescription className="text-xs">{slidesError}</AlertDescription>
            </Alert>
          )}
          {slidesLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <SlideNav
              slides={slides}
              activeSlideId={activeSlideId}
              onSelect={setActiveSlideId}
            />
          )}
        </nav>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/50 p-4 md:p-6">
        {slidesLoading ? (
          <Skeleton className="min-h-0 flex-1" />
        ) : (
          <ZoomPanViewport
            resetKey={activeSlideId}
            className="rounded-lg border border-border shadow-sm"
          >
            <div className="p-4 md:p-6">
              <BlueprintSlideContent slide={activeSlide} slides={slides} />
            </div>
          </ZoomPanViewport>
        )}
      </div>
    </div>
  )
}
