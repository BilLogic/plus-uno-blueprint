import { useSyncExternalStore, useEffect, useState } from 'react'
import { Check, Crosshair, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useBlueprintCellDetailOptional } from '@/contexts/BlueprintCellDetailContext'
import { registerAgentUiCommand } from '@/lib/agent/uiCommands'
import {
  clearSession,
  describeChange,
  forgetChange,
  groupChanges,
  sessionHasDestructive,
  sessionSnapshot,
  subscribeToSession,
  type ChangeEntry,
} from '@/lib/authoringSession'
import { scrollBlueprintCellIntoView } from '@/lib/blueprintCellConnections'
import { executeRevert } from '@/lib/revertChange'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { cn } from '@/lib/utils'

/** Server snapshot for SSR — there is no session before hydration. */
const EMPTY: ChangeEntry[] = []

function useSessionChanges(): ChangeEntry[] {
  return useSyncExternalStore(subscribeToSession, sessionSnapshot, () => EMPTY)
}

/**
 * Entries with a revert currently executing. Module-level and shared by the
 * row button and ⌘Z on purpose: `forgetChange` only runs after the network
 * resolves, so without this a second trigger in that window re-reverts the
 * same entry — for a creation, that is `delete_cell` twice.
 */
const revertsInFlight = new Set<string>()

/** Revert one entry and clean up after it — shared by the row and ⌘Z. */
async function revertEntry(
  client: NonNullable<ReturnType<typeof useSupabase>['client']>,
  entry: ChangeEntry,
): Promise<void> {
  if (revertsInFlight.has(entry.id)) return
  revertsInFlight.add(entry.id)
  try {
    await executeRevert(client, entry)
    // The change is gone from the database, so it leaves the list — and the
    // grid re-reads, because every revert is structural or content-bearing.
    forgetChange(entry.id)
    invalidateQueries('lifecycle-phases')
    invalidateQueries('canvas-blueprints')
    const cellId =
      typeof entry.args.cell_id === 'string' ? entry.args.cell_id : null
    if (cellId) {
      invalidateQueries(`cell-content:${cellId}`)
      invalidateQueries(`cell-spec:${cellId}`)
    }
  } finally {
    revertsInFlight.delete(entry.id)
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  )
}

/**
 * ⌘Z reverts the most recent change that captured an inverse.
 *
 * Scoped away from text fields — inside an input the browser's own undo is
 * the one people mean. Skips entries with no inverse (deletes) rather than
 * silently doing nothing forever: the newest revertible change is the
 * answer to "undo" even when a non-revertible one landed after it.
 */
function useUndoHotkey(changes: ChangeEntry[]) {
  const { client } = useSupabase()

  useEffect(() => {
    if (!client || changes.length === 0) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z')
        return
      if (event.shiftKey || event.altKey) return
      if (isEditableTarget(event.target)) return
      // One undo at a time. Key repeat fires long before the network
      // resolves; letting each press grab "the next entry" would rip
      // through the whole session on one held key.
      if (revertsInFlight.size > 0) return
      const last = changes.findLast((entry) => entry.revert)
      if (!last) return
      event.preventDefault()
      void revertEntry(client, last).catch((error) => {
        console.error('[authoring] ⌘Z revert failed:', error)
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [changes, client])

  // Agent parity: the same undo the ⌘Z path runs, plus "keep changes".
  useEffect(() => {
    if (!client) return
    const unregister = [
      registerAgentUiCommand({
        name: 'undo_last_change',
        description:
          "Undo the newest revertible change of this session (same as ⌘Z). One at a time. Note this reverts whatever is newest — INCLUDING the human's own edit if theirs came last; say whose change you are undoing before firing it.",
        // Reverting a creation runs delete_cell / delete_scenario /
        // delete_path. That is data, not interface — so it counts as a
        // write everywhere writes are counted.
        mutates: true,
        run: async () => {
          if (revertsInFlight.size > 0) return 'An undo is already in flight — wait for it.'
          const last = changes.findLast((entry) => entry.revert)
          if (!last) return 'Nothing revertible in this session.'
          // Awaited, not fire-and-forget: a rejected revert used to reach
          // the console only, while the model was told it had succeeded
          // and reported that to the user.
          try {
            await revertEntry(client, last)
            return `Reverted: ${describeChange(last)}`
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new Error(`Undo failed and nothing changed: ${message}`)
          }
        },
      }),
      registerAgentUiCommand({
        name: 'keep_all_changes',
        description:
          "Accept the session's changes (clears the change sheet). Refused when the session holds destructive changes — those need the human's own confirm.",
        run: () => {
          if (sessionHasDestructive(changes))
            return 'This session contains destructive changes — the human must confirm those in the Save changes sheet themselves.'
          clearSession()
          return 'Changes kept; the change sheet is clear.'
        },
      }),
    ]
    return () => unregister.forEach((fn) => fn())
  }, [changes, client])
}

/**
 * What has changed since Edit was turned on, and the way to keep it.
 *
 * Appears only once something has changed — a permanent Save on a canvas that
 * has already saved everything is a control that lies at rest.
 *
 * It replaces undo and redo rather than joining them. Undo is positional; this
 * is addressable. Having added a step, a lane and a cell, wanting the lane back
 * should not mean undoing two things you meant to keep. (Per-row revert lands
 * with the inverse operations; the list itself is what carries the value now.)
 */
export function SessionChangesSheet() {
  const changes = useSessionChanges()
  const detail = useBlueprintCellDetailOptional()
  const [confirming, setConfirming] = useState(false)
  useUndoHotkey(changes)

  if (changes.length === 0) return null

  const destructive = sessionHasDestructive(changes)
  const groups = groupChanges(changes)

  // A path id is only nameable if the canvas has that blueprint loaded. When it
  // does not — the change was made somewhere since navigated away from — the
  // group says so rather than printing a uuid.
  const pathLabel = (pathId: string | null): string => {
    if (!pathId) return 'This service'
    const blueprint = detail?.blueprints.find((entry) => entry.path.id === pathId)
    return blueprint ? blueprint.path.name : 'Elsewhere in this service'
  }

  const save = () => {
    if (destructive && !confirming) {
      setConfirming(true)
      return
    }
    clearSession()
    setConfirming(false)
  }

  /*
    One control, not two. The flag counter and the Save button used to sit
    side by side — the same fact (unsaved changes exist) wearing two faces.
    Now Save changes *is* the trigger: clicking it opens the list above,
    where the changes are reviewed, individually reverted, and confirmed —
    the same pattern as slice creation's popup. Saving requires seeing what
    is being kept.
  */
  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Review and save ${changes.length} changes`}
                    className="pointer-events-auto h-7 shrink-0 gap-1.5 border border-primary/30 bg-primary/10 px-2.5 text-xs text-primary hover:bg-primary/15 hover:text-primary"
                  >
                    <Check className="size-3.5" aria-hidden />
                    Save changes
                    <span className="tabular-nums">{changes.length}</span>
                  </Button>
                }
              />
            }
          />
          <TooltipContent side="top" className="text-xs">
            Review what changed, then save
          </TooltipContent>
        </Tooltip>

        {/*
          Upward, like everything anchored to this bar: it sits on the bottom
          edge of the window, so a menu hanging down is clipped — and growing up
          over the canvas puts the list beside the cells it names.
        */}
        <DropdownMenuContent
          side="top"
          align="end"
          className="w-80 p-0 text-xs"
          data-session-sheet=""
        >
          <div className="border-b border-border/60 px-3 py-2">
            <p className="font-medium text-foreground">
              {changes.length} unsaved change{changes.length === 1 ? '' : 's'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Already saved to the database — this list is how you can still
              take them back.
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {groups.map((group) => (
              <div key={group.pathId ?? 'service'} className="px-1 py-1">
                <p className="px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {pathLabel(group.pathId)}
                </p>
                {group.entries.map((entry) => (
                  <ChangeRow key={entry.id} entry={entry} />
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2">
            {confirming ? (
              <>
                <p className="min-w-0 flex-1 text-[11px] text-foreground">
                  Deletes in this session can no longer be undone.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                {destructive
                  ? 'This session includes a delete.'
                  : 'Everything here can still be found in the list.'}
              </p>
            )}
            <Button
              type="button"
              size="sm"
              className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
              onClick={save}
            >
              <Check className="size-3.5" aria-hidden />
              {confirming ? 'Keep changes' : 'Save'}
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

function ChangeRow({ entry }: { entry: ChangeEntry }) {
  const { client } = useSupabase()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cellId =
    typeof entry.args.cell_id === 'string'
      ? entry.args.cell_id
      : typeof entry.args.source_cell_id === 'string'
        ? entry.args.source_cell_id
        : null

  const revert = async () => {
    if (!client || busy) return
    setBusy(true)
    setError(null)
    try {
      await revertEntry(client, entry)
    } catch (revertError) {
      setError(
        revertError instanceof Error ? revertError.message : String(revertError),
      )
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'group/change flex flex-col rounded-md px-2 py-1.5',
        'hover:bg-muted/60',
      )}
    >
      <div className="flex items-center gap-2">
        {/* ✦ marks a change the canvas agent made. Nothing else differs —
            same revert, same Save gate; the badge is the entire distinction. */}
        {entry.author === 'agent' ? (
          <span
            className="shrink-0 text-[10px] text-primary"
            title="Made by the agent"
            aria-label="Made by the agent"
          >
            ✦
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-foreground/85">
          {describeChange(entry)}
        </span>
        {cellId ? (
          <button
            type="button"
            aria-label="Show me where"
            title="Show me where"
            onClick={() => scrollBlueprintCellIntoView(cellId)}
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/change:opacity-100 focus-visible:opacity-100 hover:text-foreground"
          >
            <Crosshair className="size-3" aria-hidden />
          </button>
        ) : null}
        {entry.revert ? (
          <button
            type="button"
            aria-label="Revert this change"
            title="Revert this change"
            disabled={busy}
            onClick={() => void revert()}
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/change:opacity-100 focus-visible:opacity-100 hover:text-foreground disabled:opacity-40"
          >
            <Undo2
              className={cn('size-3', busy && 'animate-pulse')}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-0.5 text-[10px] text-destructive">{error}</p>
      ) : null}
    </div>
  )
}
