import { useEffect, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InlineNotice } from '@/components/ui/inline-notice'
import { useSupabase } from '@/contexts/SupabaseProvider'
import {
  tabKey,
  useViewState,
  type TabDescriptor,
} from '@/contexts/viewStateStore'
import { useSlices } from '@/hooks/useSlices'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import { deleteSlice } from '@/lib/sliceMutations'
import { cn } from '@/lib/utils'
import type { Slice } from '@/types/database'

function availableSlices(result: ReturnType<typeof useSlices>): Slice[] {
  switch (result.status) {
    case 'loading':
      return []
    case 'ready':
      return result.data
    case 'error':
      return result.fallback ?? []
  }
}

/**
 * Confirm-and-delete dialog shared by the tab strip and sidebar context
 * menus. Deletes the slice (frames cascade) and closes its tabs.
 */
export function DeleteSliceDialog({
  slice,
  open,
  onOpenChange,
}: {
  slice: { id: string; title: string } | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { client } = useSupabase()
  const { closeTabsForSlice } = useViewState()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!client || !slice || busy) return
    setBusy(true)
    setError(null)
    try {
      await deleteSlice(client, slice.id)
      // Drop the cached slice list ('slices:*') and the deleted slice's
      // detail ('slice:<id>') so every mounted list refetches.
      invalidateQueries('slices')
      invalidateQueries('slice:')
      closeTabsForSlice(slice.id)
      onOpenChange(false)
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : String(deleteError),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setError(null)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete slice</DialogTitle>
          <DialogDescription>
            “{slice?.title ?? 'This slice'}” and its frames will be deleted.
            Blueprint cells are never touched.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="px-6 pt-4">
            <InlineNotice variant="warning">{error}</InlineNotice>
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => {
              void handleDelete()
            }}
          >
            {busy ? 'Deleting…' : 'Delete slice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Tab strip above the shell main area. Holds only slice / present tabs (the
 * base blueprint view is not a tab) and renders nothing while no tab is
 * open; also resolves URL deep links once the slice list settles (pending
 * intent — never applied before the data exists). Slice tabs carry a
 * context menu with "Delete slice…" for writers.
 */
export function TabStrip() {
  const {
    tabs,
    activeKey,
    activateTab,
    closeTab,
    pendingUrlState,
    resolvePending,
  } = useViewState()
  const { canWrite } = useSupabase()
  const slices = useSlices()
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    title: string
  } | null>(null)

  useEffect(() => {
    if (pendingUrlState === null) return
    if (slices.status === 'loading') return
    resolvePending(availableSlices(slices).map((slice) => slice.id))
  }, [pendingUrlState, resolvePending, slices])

  if (tabs.length === 0) return null

  const titleById = new Map(
    availableSlices(slices).map((slice) => [slice.id, slice.title]),
  )

  const labelFor = (tab: TabDescriptor): string => {
    switch (tab.kind) {
      case 'slice':
        return `◇ ${titleById.get(tab.sliceId) ?? 'Slice'}`
      case 'present':
        return `▶ ${titleById.get(tab.sliceId) ?? 'Slice'}`
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Open views"
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-sidebar px-2 py-1.5"
    >
      {tabs.map((tab) => {
        const key = tabKey(tab)
        const active = key === activeKey
        const label = labelFor(tab)
        const tabElement = (
          <div
            key={key}
            className={cn(
              'flex shrink-0 items-center rounded-md border text-xs',
              active
                ? 'border-border bg-background shadow-sm'
                : 'border-transparent hover:bg-accent',
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => activateTab(key)}
              className={cn(
                'max-w-56 truncate px-2.5 py-1 font-medium',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </button>
            <button
              type="button"
              aria-label={`Close ${label}`}
              onClick={() => closeTab(key)}
              className="mr-1 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </div>
        )

        if (!canWrite) return tabElement

        return (
          <ContextMenu key={key}>
            <ContextMenuTrigger render={tabElement} />
            <ContextMenuContent>
              <ContextMenuItem
                variant="destructive"
                onClick={() =>
                  setDeleteTarget({
                    id: tab.sliceId,
                    title: titleById.get(tab.sliceId) ?? 'Slice',
                  })
                }
              >
                <Trash2 className="size-3.5" />
                Delete slice…
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )
      })}
      <DeleteSliceDialog
        slice={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      />
    </div>
  )
}
