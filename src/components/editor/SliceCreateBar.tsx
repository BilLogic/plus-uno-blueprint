import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InlineNotice } from '@/components/ui/inline-notice'
import { Input } from '@/components/ui/input'
import { useSliceDraftOptional } from '@/contexts/sliceDraftContext'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useViewState } from '@/contexts/viewStateStore'
import { useSlices } from '@/hooks/useSlices'
import { createSliceFromCells } from '@/lib/sliceMutations'

/**
 * Floating bar (bottom-center) shown while blueprint cells are
 * multi-selected. Creates a slice from the selection — one slice_items frame
 * with the cells in grid order (step order, then selection order) — and
 * opens its tab.
 */
export function SliceCreateBar() {
  const draft = useSliceDraftOptional()
  const { client } = useSupabase()
  const { openTab } = useViewState()
  const slices = useSlices()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!draft || !client) return null
  const count = draft.selectedCells.size
  if (count === 0) return null

  const nextPosition =
    slices.status === 'ready'
      ? slices.data.reduce((max, slice) => Math.max(max, slice.position), 0) + 1
      : 1

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !title.trim()) return
    setBusy(true)
    setError(null)

    // Grid order: step column first, insertion order as the tiebreaker.
    const cellIds = [...draft.selectedCells.entries()]
      .map(([cellId, stepIndex], insertionIndex) => ({
        cellId,
        stepIndex,
        insertionIndex,
      }))
      .sort(
        (a, b) =>
          a.stepIndex - b.stepIndex || a.insertionIndex - b.insertionIndex,
      )
      .map((entry) => entry.cellId)

    try {
      const slice = await createSliceFromCells(client, {
        title: title.trim(),
        cellIds,
        position: nextPosition,
      })
      draft.clear()
      setDialogOpen(false)
      setTitle('')
      openTab({ kind: 'slice', sliceId: slice.id })
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : String(createError),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-md">
          <span className="text-xs font-medium text-foreground">
            {count} {count === 1 ? 'cell' : 'cells'}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setError(null)
              setDialogOpen(true)
            }}
          >
            Create slice
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={draft.clear}
          >
            Clear
          </Button>
        </div>
      </div>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setError(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create slice</DialogTitle>
            <DialogDescription>
              {count} selected {count === 1 ? 'cell' : 'cells'} become one
              slice you can caption and present.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3 px-6 py-4"
            onSubmit={(event) => {
              void handleCreate(event)
            }}
          >
            <Input
              required
              autoFocus
              placeholder="Slice title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-label="Slice title"
            />
            {error ? (
              <InlineNotice variant="warning">{error}</InlineNotice>
            ) : null}
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Creating…' : 'Create slice'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
