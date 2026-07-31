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
import { SliceScreenComposer } from '@/components/editor/SliceScreenComposer'
import { groupCells } from '@/lib/sliceGrouping'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useViewState } from '@/contexts/viewStateStore'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import { findFirstLifecycleId } from '@/lib/lifecycle'
import { createSlice } from '@/lib/sliceMutations'
import {
  SLICE_TYPES,
  validateDraftSlice,
  type DraftFrame,
  type SliceType,
} from '@/lib/sliceValidation'

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
  const [sliceType, setSliceType] = useState<SliceType>('custom')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Screens are seeded one-per-cell and then shaped by hand. Re-seeded
  // whenever the selection changes underneath an open dialog.
  const [screens, setScreens] = useState<DraftFrame[]>(() =>
    groupCells(cellIds, 'per-cell'),
  )
  const [seededFrom, setSeededFrom] = useState(cellIds)
  if (seededFrom !== cellIds) {
    setSeededFrom(cellIds)
    setScreens(groupCells(cellIds, 'per-cell'))
  }

  const reset = () => {
    setTitle('')
    setDescription('')
    setSliceType('custom')
    setError(null)
  }

  const problems = validateDraftSlice({
    title,
    description,
    sliceType,
    // Always blank: the field is gone, and the column stays nullable
    // until a migration drops it.
    actor: '',
    frames: screens,
  })

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
        actor: '',
        cellIds,
        frames: screens,
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
            you picked them. Group them into screens below — one screen is one
            view in presentation.
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
          {/*
            No Actor field. It was asked for, stored, and read by nothing —
            no header, no slide, no sidebar row — so it took a decision from
            the author and gave nothing back. For a journey slice the actor is
            already the lane its cells sit in, which is on screen; asking again
            only invites the two to disagree. If a label is wanted later it
            should be derived from those lanes, not typed.
          */}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-foreground">
                Screens
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                Quick group:
                {([
                  ['per-cell', 'per cell'],
                  ['per-step', 'per step'],
                  ['single', 'all in one'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="rounded px-1 underline-offset-2 hover:text-foreground hover:underline"
                    onClick={() => setScreens(groupCells(cellIds, value))}
                  >
                    {label}
                  </button>
                ))}
              </span>
            </div>
            <SliceScreenComposer screens={screens} onChange={setScreens} />
          </div>

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
            disabled={busy || problems.length > 0 || cellIds.length === 0}
            onClick={handleCreate}
          >
            {busy ? 'Creating…' : 'Create slice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
