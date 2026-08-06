import { useEffect, useState } from 'react'
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
import { useSupabase } from '@/contexts/SupabaseProvider'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import {
  deletionImpact,
  deletePath,
  deleteScenario,
  removeLane,
  removeStep,
  type DeletionImpact,
  type DeletionKind,
} from '@/lib/authoringRpc'
import {
  DELETION_NOUNS,
  confirmationMatches,
  describeImpact,
} from '@/lib/deletionSafety'

export type DeletionTarget = {
  kind: DeletionKind
  /** The row to delete. For a lane this is the lane id used to read impact. */
  id: string
  /** Typed to confirm, and shown throughout. */
  label: string
  /** Lane and step deletes are scoped by their parent. */
  scenarioId?: string
  pathId?: string
}

/**
 * Confirm a destructive change by naming everything it destroys.
 *
 * The impact is read before the dialog can be confirmed, never estimated in
 * the client: a step delete cascades to every cell in that step across
 * every path, and then to the arrows on both ends of each. A dialog that
 * counted what it could see would undercount by design.
 *
 * Typing the name is the gate. It is the one interaction that cannot be done
 * by reflex, which is the point — everything here is unrecoverable except
 * through the archive, and some of it is unrecoverable full stop.
 */
export function DeleteStructureDialog({
  target,
  open,
  onOpenChange,
  onDeleted,
}: {
  target: DeletionTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: (archiveId: string) => void
}) {
  const { client } = useSupabase()
  const [impact, setImpact] = useState<DeletionImpact | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset during render rather than in the effect. Opening the dialog on a
  // second target must not paint one frame carrying the first target's counts
  // — a confirm dialog showing the wrong numbers is the whole failure this
  // component exists to prevent.
  const session = open && target ? `${target.kind}:${target.id}` : null
  const [lastSession, setLastSession] = useState(session)
  if (lastSession !== session) {
    setLastSession(session)
    setImpact(null)
    setError(null)
    setTyped('')
  }

  useEffect(() => {
    if (!open || !target || !client) return
    let cancelled = false
    deletionImpact(client, target.kind, target.id)
      .then((result) => {
        if (!cancelled) setImpact(result)
      })
      .catch((readError: unknown) => {
        if (cancelled) return
        setError(
          readError instanceof Error ? readError.message : String(readError),
        )
      })
    return () => {
      cancelled = true
    }
  }, [client, open, target])

  if (!target) return null

  const noun = DELETION_NOUNS[target.kind]
  const confirmed = confirmationMatches(typed, target.label)
  // Nothing may be confirmed before the impact has been read: the numbers are
  // the whole reason to ask.
  const ready = impact !== null && confirmed && !busy

  const handleDelete = async () => {
    if (!client || !ready) return
    setBusy(true)
    setError(null)
    try {
      let archiveId: string
      switch (target.kind) {
        case 'scenario':
          archiveId = await deleteScenario(client, target.id)
          break
        case 'path':
          archiveId = await deletePath(client, target.id)
          break
        case 'step':
          if (!target.pathId) throw new Error('A step delete needs its path.')
          archiveId = await removeStep(client, target.pathId, target.id)
          break
        case 'lane':
          if (!target.scenarioId) {
            throw new Error('A lane delete needs its blueprint.')
          }
          archiveId = await removeLane(client, target.scenarioId, target.label)
          break
      }
      invalidateQueries('lifecycle-phases')
      invalidateQueries('slices')
      // Path deletes must clear the paths catalog, lane removals the lane
      // picker; prefix matches are no-ops for the other kinds this dialog
      // handles.
      invalidateQueries('scenario-paths')
      invalidateQueries('lane-sources')
      onOpenChange(false)
      onDeleted?.(archiveId)
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : String(deleteError),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete {noun} “{target.label}”?</DialogTitle>
          <DialogDescription>
            This cannot be undone from the browser’s history. The archive keeps
            a copy, but slices that lose frames are only put back if their cells
            still have stored keys.
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto px-6"
          data-delete-impact=""
        >
          {impact === null && !error ? (
            <p className="text-xs text-muted-foreground">
              Counting what this would remove…
            </p>
          ) : null}

          {impact ? (
            <ul className="flex flex-col gap-1.5 text-sm text-foreground/80">
              {describeImpact(target.kind, impact).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}

          {impact ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">
                Type <span className="font-mono">{target.label}</span> to confirm
              </span>
              <Input
                value={typed}
                autoFocus
                onChange={(event) => setTyped(event.target.value)}
              />
            </label>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" aria-hidden />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!ready}
            onClick={handleDelete}
          >
            {busy ? 'Deleting…' : `Delete ${noun}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
