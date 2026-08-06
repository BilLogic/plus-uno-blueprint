import { useState } from 'react'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  DeleteStructureDialog,
  type DeletionTarget,
} from '@/components/editor/DeleteStructureDialog'
import { useCanvasModeValue } from '@/contexts/canvasModeContext'
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

export type StructureKind = 'phase' | 'scenario' | 'path'

/**
 * Right-click on a phase, scenario or path row — rename, duplicate, delete.
 *
 * This replaced the hover-revealed `⋯` button: the row's own hover state is
 * signal enough, and a per-row button was one more piece of chrome saying
 * what right-click already says. One component for all three kinds because
 * the *shape* is identical and the differences are facts, not code paths:
 * what can be duplicated (paths — the only entity with a deep-copy
 * operation), what can be deleted (paths and scenarios — `delete_phase`
 * does not exist yet, so a phase shows no delete rather than a dead one),
 * and which rename RPC to call.
 *
 * Renders children unwrapped — no menu at all — for sessions that cannot
 * write or surfaces in View mode.
 */
export function StructureRowContextMenu({
  kind,
  id,
  name,
  scenarioId,
  children,
}: {
  kind: StructureKind
  id: string
  name: string
  /** Required for path deletes, which are scoped by their scenario. */
  scenarioId?: string
  children: React.ReactNode
}) {
  const { client, canWrite } = useSupabase()
  const mode = useCanvasModeValue()
  const archiveAvailable = useArchiveAvailable()
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState<DeletionTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit mode only. Renaming and deleting are authoring, and View mode's
  // whole premise is that nothing on screen changes anything.
  if (!canWrite || !client || mode !== 'design') return <>{children}</>

  const canDelete =
    kind !== 'phase' && deletionReadiness(archiveAvailable).canDelete

  const duplicate = async () => {
    if (kind !== 'path' || busy) return
    setBusy(true)
    try {
      await duplicatePath(client, { sourcePathId: id, name: `${name} copy` })
      invalidateQueries('lifecycle-phases')
      invalidateQueries('scenario-paths')
    } catch {
      // The row menu has nowhere to show prose; the session log records
      // nothing because nothing happened. The rename dialog handles its own.
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger className="block w-full">
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="text-xs">
          <ContextMenuItem onClick={() => setRenaming(true)}>
            <Pencil className="size-3.5" aria-hidden />
            Rename
          </ContextMenuItem>
          {kind === 'path' ? (
            <ContextMenuItem disabled={busy} onClick={duplicate}>
              <Copy className="size-3.5" aria-hidden />
              Duplicate
            </ContextMenuItem>
          ) : null}
          {canDelete ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
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
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>

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

  // Re-seed on every open — the field starts at the name being changed, not
  // at whatever a cancelled edit left behind. Cleared on close rather than
  // keyed on id+name, which kept abandoned junk alive for the same row.
  const [seeded, setSeeded] = useState(false)
  if (open && !seeded) {
    setSeeded(true)
    setName(currentName)
  }
  if (!open && seeded) setSeeded(false)

  const save = async () => {
    // Busy is its own case: a second Enter mid-request must not dismiss the
    // dialog — the failure would then land in a closed dialog and resurface,
    // stale, on the next open.
    if (busy) return
    if (!client || !name.trim() || name.trim() === currentName) {
      onOpenChange(false)
      return
    }
    setBusy(true)
    onError(null)
    try {
      if (kind === 'phase')
        await renamePhase(client, {
          phaseId: id,
          name,
          previousName: currentName,
        })
      else if (kind === 'scenario')
        await renameScenario(client, {
          scenarioId: id,
          name,
          previousName: currentName,
        })
      else
        await renamePath(client, { pathId: id, name, previousName: currentName })
      invalidateQueries('lifecycle-phases')
      // The paths catalog caches under its own key; without this the
      // duplicate-source list and name-uniqueness check go stale forever
      // (staleTime is Infinity — revalidation is explicit-only).
      invalidateQueries('scenario-paths')
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
