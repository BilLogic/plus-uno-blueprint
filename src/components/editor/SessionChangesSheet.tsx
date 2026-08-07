import { useSyncExternalStore, useEffect, useState } from 'react'
import { Check, Crosshair, History, Undo2 } from 'lucide-react'
import { IconTooltip } from '@/components/editor/IconTooltip'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
      // Evidence caches under its own key with explicit-only revalidation;
      // without this, undoing "Added evidence" keeps rendering the deleted
      // row in an open Evidence tab for the rest of the session.
      invalidateQueries(`evidence:${cellId}`)
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
            throw new Error(`Undo failed and nothing changed: ${message}`, {
              cause: error,
            })
          }
        },
      }),
      registerAgentUiCommand({
        name: 'keep_all_changes',
        description:
          "Accept the session's changes (clears the change sheet). Refused when the session holds destructive changes — those need the human's own confirm.",
        run: () => {
          if (sessionHasDestructive(changes))
            return 'This session contains destructive changes — the human must confirm those in the Changes sheet themselves.'
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
  const { client } = useSupabase()
  /** `'save'` = the destructive-save gate; `'revert'` = the Revert all gate. */
  const [confirming, setConfirming] = useState<'save' | 'revert' | null>(null)
  const [reverting, setReverting] = useState(false)
  /** What Revert all could not take back — named, never silently dropped. */
  const [leftBehind, setLeftBehind] = useState<string[]>([])
  useUndoHotkey(changes)

  if (changes.length === 0) return null

  const destructive = sessionHasDestructive(changes)
  const groups = groupChanges(changes)
  const revertible = changes.filter((entry) => entry.revert)
  const unrevertible = changes.length - revertible.length

  // A path id is only nameable if the canvas has that blueprint loaded. When it
  // does not — the change was made somewhere since navigated away from — the
  // group says so rather than printing a uuid.
  const pathLabel = (pathId: string | null): string => {
    if (!pathId) return 'This service'
    const blueprint = detail?.blueprints.find((entry) => entry.path.id === pathId)
    return blueprint ? blueprint.path.name : 'Elsewhere in this service'
  }

  const save = () => {
    if (destructive && confirming !== 'save') {
      setConfirming('save')
      return
    }
    clearSession()
    setConfirming(null)
  }

  /**
   * Take back everything this session can take back.
   *
   * Newest first, one at a time, through the very same `revertEntry` the row
   * button and ⌘Z use — so the in-flight guard, the `forgetChange`, and every
   * cache invalidation are the ones already proven. Sequential rather than
   * `Promise.all` because these inverses are ordered: a cell added into a lane
   * added in the same session has to go before the lane does.
   *
   * Entries with no captured inverse (a `delete_slice` has no archive to
   * restore from) are not reverted and not dropped — they stay in the list and
   * get named underneath it. A revert that throws is treated the same way: the
   * run continues, and the failure is reported by name rather than leaving the
   * user to diff the list against their memory.
   */
  const revertAll = async () => {
    if (!client || reverting) return
    setConfirming(null)
    setLeftBehind([])
    setReverting(true)
    const failed: string[] = []
    try {
      for (const entry of [...changes].reverse()) {
        if (!entry.revert) {
          failed.push(describeChange(entry))
          continue
        }
        try {
          await revertEntry(client, entry)
        } catch (error) {
          console.error('[authoring] revert all failed on an entry:', error)
          failed.push(describeChange(entry))
        }
      }
    } finally {
      setReverting(false)
    }
    setLeftBehind(failed)
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
        {/*
          No tooltip. "Changes 2" beside a history icon already says what the
          button is, and the only thing a tooltip could add — "opens a list" —
          is what one click teaches for good.
        */}
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Review ${changes.length} changes`}
              className="pointer-events-auto h-7 shrink-0 gap-1.5 border border-primary/30 bg-primary/10 px-2.5 text-xs text-primary hover:bg-primary/15 hover:text-primary"
            >
              <History className="size-3.5" aria-hidden />
              Changes
              <span className="tabular-nums">{changes.length}</span>
            </Button>
          }
        />

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
              {changes.length} change{changes.length === 1 ? '' : 's'}
            </p>
            {/*
              The one thing the interface cannot teach by itself: these writes
              already landed, so Save is not a write — it is the moment the way
              back closes. Everything else the header used to say (that a list
              is a list, that reverting is possible) the rows demonstrate.
            */}
            <p className="mt-0.5 text-2xs text-muted-foreground">
              Already saved — Save just clears the list.
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {groups.map((group) => (
              <div key={group.pathId ?? 'service'} className="px-1 py-1">
                {/*
                  The group label separates; with one group there is nothing to
                  separate it from, and "THIS SERVICE" over the entire list is a
                  heading for the obvious.
                */}
                {groups.length > 1 ? (
                  <p className="px-2 py-1 text-3xs font-medium tracking-wide text-muted-foreground uppercase">
                    {pathLabel(group.pathId)}
                  </p>
                ) : null}
                {group.entries.map((entry) => (
                  <ChangeRow key={entry.id} entry={entry} />
                ))}
              </div>
            ))}
          </div>

          {/*
            Three footers, one row. Idle offers both exits; each confirm state
            replaces the whole row so there is never a live Save sitting beside
            a question about reverting.
          */}
          <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2">
            {confirming === 'revert' ? (
              <>
                <p className="min-w-0 flex-1 text-2xs text-foreground">
                  Take back {revertible.length} change
                  {revertible.length === 1 ? '' : 's'}?
                  {unrevertible > 0
                    ? ` ${unrevertible} can’t be taken back.`
                    : ''}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs"
                  onClick={() => setConfirming(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-7 shrink-0 px-2.5 text-xs"
                  onClick={() => void revertAll()}
                >
                  Revert all
                </Button>
              </>
            ) : confirming === 'save' ? (
              <>
                <p className="min-w-0 flex-1 text-2xs text-foreground">
                  Deletes become permanent.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs"
                  onClick={() => setConfirming(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
                  onClick={save}
                >
                  <Check className="size-3.5" aria-hidden />
                  Keep changes
                </Button>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1" />
                {revertible.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground"
                    disabled={reverting}
                    onClick={() => setConfirming('revert')}
                  >
                    <Undo2
                      className={cn('size-3.5', reverting && 'animate-pulse')}
                      aria-hidden
                    />
                    {reverting ? 'Reverting…' : 'Revert all'}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
                  disabled={reverting}
                  onClick={save}
                >
                  <Check className="size-3.5" aria-hidden />
                  Save
                </Button>
              </>
            )}
          </div>

          {/*
            Only ever rendered when something survived Revert all — the entries
            it names are still in the list above, so this says which of the
            remaining rows are there because they could not go, not because the
            run stopped early.
          */}
          {leftBehind.length > 0 ? (
            <div className="border-t border-border/60 px-3 py-2">
              <p className="text-2xs text-destructive">
                Not taken back: {leftBehind.join('; ')}
              </p>
            </div>
          ) : null}
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
            className="shrink-0 text-3xs text-primary"
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
          <IconTooltip label="Scroll the board to this cell">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Show me where"
              onClick={() => scrollBlueprintCellIntoView(cellId)}
              className="text-muted-foreground opacity-0 group-hover/change:opacity-100 focus-visible:opacity-100"
            >
              <Crosshair aria-hidden />
            </Button>
          </IconTooltip>
        ) : null}
        {entry.revert ? (
          <IconTooltip label="Revert this change">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Revert this change"
              disabled={busy}
              onClick={() => void revert()}
              className="text-muted-foreground opacity-0 group-hover/change:opacity-100 focus-visible:opacity-100"
            >
              <Undo2 className={cn(busy && 'animate-pulse')} aria-hidden />
            </Button>
          </IconTooltip>
        ) : null}
      </div>
      {error ? (
        <p className="mt-0.5 text-3xs text-destructive">{error}</p>
      ) : null}
    </div>
  )
}
