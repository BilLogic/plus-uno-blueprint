import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Diamond, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateSliceDialog } from '@/components/editor/CreateSliceDialog'
import { CellPickContext, type CellPickApi } from '@/contexts/cellPickContext'
import { useSupabase } from '@/contexts/SupabaseProvider'

/**
 * Cmd/shift-click a cell to start collecting cells for a new slice.
 *
 * Selection order is the slice's order — the first cell picked is frame 1 —
 * so this keeps an array, not a set. Picking is available on any canvas the
 * user can see; the floating bar only appears once something is picked, so
 * the affordance costs nothing until it is used.
 *
 * A slice tab in edit mode overrides this provider with its own picker
 * (nearest context wins), which is why edit mode can use plain clicks
 * without this one having to know about it.
 */
export function SliceDraftProvider({ children }: { children: ReactNode }) {
  const { canWrite } = useSupabase()
  const [picked, setPicked] = useState<string[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)

  const toggle = useCallback((cellId: string) => {
    setPicked((current) =>
      current.includes(cellId)
        ? current.filter((id) => id !== cellId)
        : [...current, cellId],
    )
  }, [])

  const api = useMemo<CellPickApi>(
    () => ({
      plainClick: false,
      isPicked: (cellId) => picked.includes(cellId),
      orderOf: (cellId) => {
        const index = picked.indexOf(cellId)
        return index === -1 ? undefined : index + 1
      },
      toggle,
    }),
    [picked, toggle],
  )

  // Readers cannot create slices, so they never get the picking behavior —
  // a cmd-click that silently does nothing is worse than no affordance.
  if (!canWrite) return <>{children}</>

  return (
    <CellPickContext.Provider value={api}>
      {children}
      {picked.length > 0 ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center"
          data-canvas-nav=""
        >
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-1.5 shadow-lg">
            <span className="px-2 text-xs text-muted-foreground">
              {picked.length} cell{picked.length === 1 ? '' : 's'} picked
            </span>
            <Button
              type="button"
              size="sm"
              className="h-7 rounded-full text-xs"
              onClick={() => setDialogOpen(true)}
            >
              <Diamond className="size-3" />
              Create slice
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Clear selection"
              className="rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setPicked([])}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
      <CreateSliceDialog
        cellIds={picked}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {
          setPicked([])
          setDialogOpen(false)
        }}
      />
    </CellPickContext.Provider>
  )
}
