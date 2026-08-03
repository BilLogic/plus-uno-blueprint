import { useSyncExternalStore, useState } from 'react'
import { Flag, Check, Crosshair } from 'lucide-react'
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
import {
  clearSession,
  describeChange,
  groupChanges,
  sessionHasDestructive,
  sessionSnapshot,
  subscribeToSession,
  type ChangeEntry,
} from '@/lib/authoringSession'
import { scrollBlueprintCellIntoView } from '@/lib/blueprintCellConnections'
import { cn } from '@/lib/utils'

/** Server snapshot for SSR — there is no session before hydration. */
const EMPTY: ChangeEntry[] = []

function useSessionChanges(): ChangeEntry[] {
  return useSyncExternalStore(subscribeToSession, sessionSnapshot, () => EMPTY)
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
                    aria-label={`${changes.length} unsaved changes`}
                    className="pointer-events-auto h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Flag className="size-3.5" aria-hidden />
                    <span className="tabular-nums">{changes.length}</span>
                  </Button>
                }
              />
            }
          />
          <TooltipContent side="top" className="text-xs">
            See what you have changed
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

      {/*
        Save is also in the bar, not only in the sheet: while anything is
        unsaved it should be the most prominent thing there, and reaching it
        must not require opening a list first.
      */}
      {/* Tinted, not filled — nothing in this bar is a filled button. It is
          still the loudest thing here, because it is the only control that
          appears at all while something is unsaved. */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Save ${changes.length} changes`}
        onClick={save}
        className="pointer-events-auto h-7 shrink-0 gap-1.5 border border-primary/30 bg-primary/10 px-2.5 text-xs text-primary hover:bg-primary/15 hover:text-primary"
      >
        <Check className="size-3.5" aria-hidden />
        Save changes
      </Button>
    </>
  )
}

function ChangeRow({ entry }: { entry: ChangeEntry }) {
  const cellId =
    typeof entry.args.cell_id === 'string'
      ? entry.args.cell_id
      : typeof entry.args.source_cell_id === 'string'
        ? entry.args.source_cell_id
        : null

  return (
    <div
      className={cn(
        'group/change flex items-center gap-2 rounded-md px-2 py-1.5',
        'hover:bg-muted/60',
      )}
    >
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
    </div>
  )
}
