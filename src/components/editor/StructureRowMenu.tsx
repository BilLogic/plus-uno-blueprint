import { useState } from 'react'
import { Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  DeleteStructureDialog,
  type DeletionTarget,
} from '@/components/editor/DeleteStructureDialog'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useArchiveAvailable } from '@/hooks/useArchiveAvailable'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import {
  duplicatePath,
  renamePath,
  renamePhase,
  renameScenario,
} from '@/lib/authoringRpc'
import { deletionReadiness } from '@/lib/deletionSafety'
import { cn } from '@/lib/utils'

export type StructureKind = 'phase' | 'scenario' | 'path'

/**
 * The `⋯` on a phase, scenario or path row — rename, duplicate, delete.
 *
 * One component for all three because the *shape* is identical and the
 * differences are facts, not code paths: what can be duplicated (paths — the
 * only entity with a deep-copy operation), what can be deleted (paths and
 * scenarios — `delete_phase` does not exist yet, so a phase shows no delete
 * rather than a dead one), and which rename RPC to call.
 *
 * Hover-revealed like every other row action in this sidebar, and absent —
 * never disabled — for sessions that cannot write.
 */
export function StructureRowMenu({
  kind,
  id,
  name,
  scenarioId,
  className,
}: {
  kind: StructureKind
  id: string
  name: string
  /** Required for path deletes, which are scoped by their scenario. */
  scenarioId?: string
  className?: string
}) {
  const { client, canWrite } = useSupabase()
  const archiveAvailable = useArchiveAvailable()
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState<DeletionTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canWrite || !client) return null

  const canDelete =
    kind !== 'phase' && deletionReadiness(archiveAvailable).canDelete

  const duplicate = async () => {
    if (kind !== 'path' || busy) return
    setBusy(true)
    try {
      await duplicatePath(client, { sourcePathId: id, name: `${name} copy` })
      invalidateQueries('lifecycle-phases')
    } catch {
      // The row menu has nowhere to show prose; the session log records
      // nothing because nothing happened. The rename dialog handles its own.
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={`Actions for ${name}`}
              title={`Actions for ${name}`}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-sm',
                'opacity-0 transition-opacity duration-150',
                'text-sidebar-foreground/60 hover:bg-sidebar-hover hover:text-sidebar-accent-foreground',
                'focus-visible:opacity-100 focus-visible:outline-none',
                '[@media(pointer:coarse)]:opacity-100',
                className,
              )}
            >
              <MoreHorizontal className="size-3" aria-hidden />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="text-xs">
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            <Pencil className="size-3.5" aria-hidden />
            Rename
          </DropdownMenuItem>
          {kind === 'path' ? (
            <DropdownMenuItem disabled={busy} onClick={duplicate}>
              <Copy className="size-3.5" aria-hidden />
              Duplicate
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  setDeleting({
                    kind: kind === 'scenario' ? 'scenario' : 'path',
                    id,
                    label: name,
                    scenarioId,
                  })
                }
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete {kind}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog
        kind={kind}
        id={id}
        currentName={name}
        open={renaming}
        onOpenChange={(next) => {
          setRenaming(next)
          if (!next) setError(null)
        }}
        error={error}
        onError={setError}
      />

      <DeleteStructureDialog
        target={deleting}
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      />
    </>
  )
}

function RenameDialog({
  kind,
  id,
  currentName,
  open,
  onOpenChange,
  error,
  onError,
}: {
  kind: StructureKind
  id: string
  currentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  error: string | null
  onError: (message: string | null) => void
}) {
  const { client } = useSupabase()
  const [name, setName] = useState(currentName)
  const [busy, setBusy] = useState(false)

  // Re-seed from the row when the dialog opens — the field should start at
  // the name being changed, not at whatever a previous rename left behind.
  const [seededFor, setSeededFor] = useState<string | null>(null)
  if (open && seededFor !== id + currentName) {
    setSeededFor(id + currentName)
    setName(currentName)
  }

  const save = async () => {
    if (!client || busy || !name.trim() || name.trim() === currentName) {
      onOpenChange(false)
      return
    }
    setBusy(true)
    onError(null)
    try {
      if (kind === 'phase') await renamePhase(client, { phaseId: id, name })
      else if (kind === 'scenario')
        await renameScenario(client, { scenarioId: id, name })
      else await renamePath(client, { pathId: id, name })
      invalidateQueries('lifecycle-phases')
      onOpenChange(false)
    } catch (renameError) {
      onError(
        renameError instanceof Error ? renameError.message : String(renameError),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Rename {kind}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 px-6">
          <Input
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void save()
            }}
          />
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
            disabled={busy || !name.trim()}
            onClick={save}
          >
            {busy ? 'Renaming…' : 'Rename'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
