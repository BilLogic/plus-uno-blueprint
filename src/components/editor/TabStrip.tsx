import { useEffect, useState } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HomeNavButton, WorkspaceBadges } from '@/components/editor/EditorChrome'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useEditor } from '@/contexts/EditorContext'
import { useSupabase } from '@/contexts/SupabaseProvider'
import {
  tabKey,
  useViewState,
  type TabDescriptor,
} from '@/contexts/viewStateStore'
import { useSliceBlueprint } from '@/hooks/useSliceBlueprint'
import { useSlices } from '@/hooks/useSlices'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import { suppressCanvasResizeRefit } from '@/lib/canvasChromeResize'
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
            <Alert variant="warning">
              <AlertTriangle className="size-3.5" aria-hidden />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
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
 * Seeds the base blueprint view from a `?slice=` deep link (nav plan D5).
 * The slice's scenario is only known after the slice, its cells, and their
 * owning scenario resolve, so this waits for `useSliceBlueprint` rather than
 * seeding from the URL. Nothing here touches the open tab's camera: the tab
 * covers the base view, so this only decides where closing it lands.
 */
function DeepLinkBaseSeed({ sliceId }: { sliceId: string }) {
  const { scenarioId } = useSliceBlueprint(sliceId)
  const { seedBaseSelection } = useEditor()

  useEffect(() => {
    if (scenarioId === undefined) return
    seedBaseSelection(scenarioId)
  }, [scenarioId, seedBaseSelection])

  return null
}

/** A deep link that named a slice which no longer exists. */
function MissingSliceNotice({ onDismiss }: { onDismiss: () => void }) {
  // The notice occupies layout above the canvas; that height change is
  // chrome moving, not the user navigating.
  useEffect(() => {
    suppressCanvasResizeRefit()
    return () => suppressCanvasResizeRefit()
  }, [])

  return (
    <div className="shrink-0 border-b border-border bg-sidebar px-2 py-1.5">
      <Alert variant="warning" className="items-center">
        <AlertTriangle className="size-3.5" aria-hidden />
        <AlertDescription className="text-xs">
          That link points to a slice that no longer exists — it may have been
          deleted.
        </AlertDescription>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1.5 right-1.5"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <X className="size-3" />
        </Button>
      </Alert>
    </div>
  )
}

/**
 * Tab strip above the shell main area. Holds Home plus the slice / present
 * tabs (the base blueprint view is not a tab), and always renders: Home lives
 * here rather than in the sidebar so it never competes with the disclosure
 * chevrons, and so the way back to the overview stays in the same place
 * whether the sidebar is open, collapsed or presenting.
 *
 * It also resolves URL deep links once the slice list settles (pending intent
 * — never applied before the data exists), seeds the base view from one, and
 * reports a link whose slice is gone. Slice tabs carry a context menu with
 * "Delete slice…" for writers.
 */
export function TabStrip({
  isOverview,
  onHome,
  onBase,
}: {
  /** The overview canvas is the current view, with no tab covering it. */
  isOverview: boolean
  onHome: () => void
  /** Activate the base blueprint view (deactivate any tab). */
  onBase: () => void
}) {
  const {
    tabs,
    activeKey,
    activateTab,
    closeTab,
    pendingUrlState,
    resolvePending,
    missingSliceId,
    dismissMissingSlice,
  } = useViewState()
  const { canWrite } = useSupabase()
  const slices = useSlices()
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    title: string
  } | null>(null)

  // The boot deep link's slice, captured before `resolvePending` clears it.
  const [bootSliceId] = useState(() =>
    pendingUrlState !== null && pendingUrlState.kind !== 'blueprint'
      ? pendingUrlState.sliceId
      : null,
  )

  useEffect(() => {
    if (pendingUrlState === null) return
    if (slices.status === 'loading') return
    resolvePending(availableSlices(slices).map((slice) => slice.id))
  }, [pendingUrlState, resolvePending, slices])

  const notice =
    missingSliceId !== null ? (
      <MissingSliceNotice onDismiss={dismissMissingSlice} />
    ) : null
  const seed =
    bootSliceId !== null && missingSliceId === null ? (
      <DeepLinkBaseSeed sliceId={bootSliceId} />
    ) : null

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
    <>
      {notice}
      {seed}
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-sidebar px-2 py-1.5">
        {/* Home sits at the far left so it lines up with the rail's icon
            column directly below it. */}
        <HomeNavButton isActive={isOverview} onClick={onHome} size="icon-sm" />
        <div
          role="tablist"
          aria-label="Open views"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        >
          {/* The workspace is a PERMANENT tab, not a title: same chrome as
              slice tabs, active whenever no tab covers the base view, and —
              deliberately — no close button. It replaces the old clickable
              heading, which read as a bug. */}
          <div
            className={cn(
              'flex shrink-0 items-center rounded-md border text-xs',
              activeKey === null
                ? 'border-border bg-background shadow-sm'
                : 'border-transparent hover:bg-accent',
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeKey === null}
              onClick={onBase}
              className={cn(
                'max-w-56 truncate px-2.5 py-1 font-medium',
                activeKey === null ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              Uno Blueprint
            </button>
          </div>
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
        </div>
        {/* Environment badges (authoring / edit preview) keep their home in
            the top nav, at the quiet end of the strip. */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <WorkspaceBadges />
        </div>
        <DeleteSliceDialog
          slice={deleteTarget}
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
        />
      </div>
    </>
  )
}
