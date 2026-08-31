import { useEffect, useRef, useState } from 'react'
import { Inbox, Trash2 } from 'lucide-react'
import { registerAgentUiContext } from '@/lib/agent/uiBridge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSupabase } from '@/contexts/SupabaseProvider'
import {
  invalidateUnplacedQueue,
  useUnplacedTouchpointDetails,
} from '@/hooks/useUnplacedTouchpointDetails'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import {
  discardTouchpointDetail,
  placeTouchpointDetail,
} from '@/lib/unplacedTouchpointMutations'
import { queueHeadline, type UnplacedDetail } from '@/lib/unplacedTouchpointDetails'
import { cn, errorMessage } from '@/lib/utils'

/**
 * The touchpoint details nobody has placed, as a list somebody works through.
 *
 * Fifty-seven of the 117 authored details name a touchpoint their own cell
 * does not show. They cannot be placed automatically: assigning one to the
 * touchpoint its label resembles would create a placement on a cell whose text
 * does not name it, which is the guess that produced them. So this surface
 * lists — the name that matched nothing, the words and picture attached to it,
 * what the cell actually shows, and where that cell is — and every decision is
 * a click a person makes.
 *
 * IT RENDERS AT ZERO. `SessionChangesSheet` beside it disappears when its list
 * empties, and that is right for a list of things you just did. It is wrong
 * here: "everything is placed" and "the queue never loaded" would be the same
 * picture, and being indistinguishable from silence is how half the authored
 * content went missing for months. So the count is always on the bar, and an
 * empty queue says so in words.
 */
export function UnplacedDetailsSheet() {
  const queue = useUnplacedTouchpointDetails()
  const { client, canWrite } = useSupabase()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const details: UnplacedDetail[] =
    queue.status === 'ready'
      ? queue.data
      : queue.status === 'error'
        ? (queue.fallback ?? [])
        : []
  const failed = queue.status === 'error'
  const loading = queue.status === 'loading'
  const canAct = canWrite && client !== null

  /*
    Agent parity, the read half. `get_ui_state` gains a line for the queue, so
    an agent asked "is any authored detail unreachable" answers from the same
    number the person is looking at instead of guessing. It reports at zero for
    the same reason the button does: "none waiting" is a fact worth grounding
    an answer on, and silence is not.

    The write half is deliberately absent. Placing a detail is a judgement
    about which touchpoint somebody meant, and an agent making that judgement is the
    guess this whole ticket exists to refuse.

    Ref-snapshotted, registered once: the contributor must stay stable across
    renders while still reading current values — the shape `SessionChangesSheet`
    and `EditorShell` both use.
  */
  const queueContext = loading
    ? 'unplaced touchpoint details: still loading'
    : failed
      ? 'unplaced touchpoint details: the queue could not be read'
      : `unplaced touchpoint details: ${details.length} waiting` +
        (details.length > 0
          ? `, across ${new Set(details.map((detail) => detail.cellId)).size} cell(s)`
          : '')
  const queueContextRef = useRef(queueContext)
  useEffect(() => {
    queueContextRef.current = queueContext
  })
  useEffect(
    () =>
      registerAgentUiContext('unplaced-details', () => queueContextRef.current),
    [],
  )

  const run = async (id: string, work: () => Promise<unknown>) => {
    if (busy) return
    setBusy(id)
    setError(null)
    try {
      await work()
      invalidateUnplacedQueue()
      // Placing writes onto a placement the board draws, so the board is stale
      // too — the panel would keep showing the summary the placement had.
      invalidateQueries('canvas-blueprints')
    } catch (thrown) {
      setError(errorMessage(thrown))
    } finally {
      setBusy(null)
    }
  }

  // Nothing on the bar while the read is in flight: a "0" that is really
  // "not yet" is the same lie in the other direction. After every hook, so the
  // agent contributor above stays registered across the loading flip.
  if (loading) return null

  /*
    A failed read is not an empty queue, and the two must never wear the same
    face. `queueHeadline(0)` would say "No unplaced touchpoint details" over a
    list nobody managed to fetch, which is the exact sentence this surface
    exists to stop being said falsely.
  */
  const headline = failed
    ? 'The unplaced queue could not be read'
    : queueHeadline(details.length)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={headline}
            className={cn(
              'pointer-events-auto h-7 shrink-0 gap-1.5 border px-2.5 text-xs',
              details.length > 0
                ? 'border-warning-500 bg-warning/10 text-warning-600 hover:bg-warning/20'
                : 'border-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <Inbox className="size-3.5" aria-hidden />
            Unplaced
            <span className="tabular-nums">{failed ? '—' : details.length}</span>
          </Button>
        }
      />

      {/* Upward, like everything anchored to this bar. */}
      <DropdownMenuContent
        side="top"
        align="end"
        className="w-96 p-0 text-xs"
        data-unplaced-sheet=""
      >
        <div className="border-b border-muted px-3 py-2">
          <p className="font-medium text-foreground">{headline}</p>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            {failed
              ? 'So this is not the answer to “is anything unreachable”. Reload.'
              : details.length === 0
                ? 'Every detail somebody wrote is attached to a touchpoint its cell shows.'
                : 'Each names a touchpoint its cell does not show. Put it on one the cell does, or throw it away.'}
          </p>
        </div>

        {details.length > 0 ? (
          <div className="max-h-80 overflow-y-auto py-1">
            {details.map((detail) => (
              <QueueRow
                key={detail.id}
                detail={detail}
                busy={busy === detail.id}
                disabled={!canAct || (busy !== null && busy !== detail.id)}
                onPlace={(touchpointId) =>
                  void run(detail.id, () =>
                    placeTouchpointDetail(client!, detail.id, touchpointId),
                  )
                }
                onDiscard={() =>
                  void run(detail.id, () =>
                    discardTouchpointDetail(client!, detail.id),
                  )
                }
              />
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="border-t border-muted px-3 py-2 text-2xs text-destructive">
            {error}
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * One waiting detail, and the two things that can happen to it.
 *
 * The three facts on the row are the ones the decision needs and no others:
 * the name that failed, the writing it is carrying, and what the cell shows.
 * A target button per touchpoint rather than a select, because a cell holds
 * one or two of them and a dropdown to choose between two is a click bought
 * with a click.
 */
function QueueRow({
  detail,
  busy,
  disabled,
  onPlace,
  onDiscard,
}: {
  detail: UnplacedDetail
  busy: boolean
  disabled: boolean
  onPlace: (touchpointId: string) => void
  onDiscard: () => void
}) {
  return (
    <div className="border-b border-muted/60 px-3 py-2 last:border-b-0">
      <p className="font-medium text-foreground">{detail.name || 'Unnamed detail'}</p>
      <p className="mt-0.5 text-3xs tracking-wide text-muted-foreground uppercase">
        {detail.where}
      </p>

      {detail.summary ? (
        <p className="mt-1 line-clamp-3 text-2xs text-muted-foreground">
          {detail.summary}
        </p>
      ) : null}
      {detail.screenshot ? (
        <p className="mt-1 text-2xs text-muted-foreground">Carries a screenshot.</p>
      ) : null}

      <p className="mt-1.5 text-2xs text-muted-foreground">
        {detail.shows.length > 0 ? (
          <>This cell shows: {detail.shows.join(', ')}</>
        ) : (
          <>This cell shows nothing.</>
        )}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {detail.targets.length > 0 ? (
          detail.targets.map((target) => (
            <Button
              key={target.touchpointId}
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || disabled}
              className="h-6 px-2 text-2xs"
              onClick={() => onPlace(target.touchpointId)}
            >
              Place on {target.name}
            </Button>
          ))
        ) : (
          /*
            No target and no invented one. The cell displays no touchpoint, so
            there is nowhere for this to go until somebody edits the cell's
            text — and saying that is the honest answer. Offering to create the
            touchpoint here is exactly the guess this ticket refuses.
          */
          <span className="text-2xs text-muted-foreground">
            Nowhere to place it — this cell shows no touchpoint.
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || disabled}
          aria-label={`Discard ${detail.name}`}
          className="ml-auto h-6 gap-1 px-2 text-2xs text-muted-foreground hover:text-destructive"
          onClick={onDiscard}
        >
          <Trash2 className="size-3" aria-hidden />
          Discard
        </Button>
      </div>
    </div>
  )
}
