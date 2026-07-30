import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useViewState } from '@/contexts/viewStateStore'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import { findFirstLifecycleId } from '@/lib/lifecycle'
import { createSlice } from '@/lib/sliceMutations'
import { SLICE_TYPES, type SliceType } from '@/lib/sliceValidation'

/** What each type is for, in the words someone picking one would use. */
const TYPE_HINTS: Record<SliceType, string> = {
  journey: 'One actor’s experience, start to finish',
  step: 'One moment, across every lane',
  lane: 'One lane, across the whole scenario',
  cell: 'A single cell, read closely',
  custom: 'Exactly the cells you picked',
}

/**
 * Title, subtitle and type for a slice being created from picked cells.
 *
 * Both title and subtitle are asked for, not just the title: the header band
 * renders both, and a slice with no subtitle reads as unfinished in
 * presentation. The type decides which sidebar group it lands in.
 */
export function CreateSliceDialog({
  cellIds,
  open,
  onOpenChange,
  onCreated,
}: {
  cellIds: readonly string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { client } = useSupabase()
  const { openTab } = useViewState()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [actor, setActor] = useState('')
  const [sliceType, setSliceType] = useState<SliceType>('custom')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setTitle('')
    setDescription('')
    setActor('')
    setSliceType('custom')
    setError(null)
  }

  const handleCreate = async () => {
    if (!client || busy || !title.trim()) return
    setBusy(true)
    setError(null)
    try {
      const lifecycleId = await findFirstLifecycleId(client)
      if (!lifecycleId) {
        throw new Error('No service lifecycle found to attach this slice to.')
      }
      const slice = await createSlice(client, {
        lifecycleId,
        title,
        description,
        sliceType,
        actor,
        cellIds,
      })
      invalidateQueries('slices')
      reset()
      onCreated()
      // Land in the slice's own tab — the point of creating it is to look
      // at it, and the tab is also where it gets edited.
      openTab({ kind: 'slice', sliceId: slice.id })
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : String(createError),
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New slice</DialogTitle>
          <DialogDescription>
            {cellIds.length} cell{cellIds.length === 1 ? '' : 's'}, in the order
            you picked them. You can regroup them into frames after it opens.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Title</span>
            <Input
              value={title}
              autoFocus
              placeholder="Tutor warm-up journey"
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Subtitle</span>
            <Input
              value={description}
              placeholder="What this slice shows, and who it is for"
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">
              Actor <span className="text-muted-foreground">(optional)</span>
            </span>
            <Input
              value={actor}
              placeholder="Regular Tutor"
              onChange={(event) => setActor(event.target.value)}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Type</span>
            <ToggleGroup
              value={[sliceType]}
              onValueChange={(value) => {
                const next = value[0]
                if (typeof next === 'string') setSliceType(next as SliceType)
              }}
              className="flex-wrap justify-start gap-1"
            >
              {SLICE_TYPES.map((type) => (
                <ToggleGroupItem key={type} value={type} className="h-7 px-2.5 text-xs">
                  {type}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">{TYPE_HINTS[sliceType]}</p>
          </div>

          {error ? (
            <Alert variant="warning">
              <AlertTriangle className="size-3.5" aria-hidden />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !title.trim() || cellIds.length === 0}
            onClick={handleCreate}
          >
            {busy ? 'Creating…' : 'Create slice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
