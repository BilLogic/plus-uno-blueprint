import { EntityTitleAffordance } from '@/components/blueprint/EntityTitleAffordance'
import {
  BLUEPRINT_MENUBAR_DESCRIPTION_CLASS,
  BLUEPRINT_MENUBAR_IDENTITY_HEIGHT,
  BLUEPRINT_MENUBAR_TITLE_CLASS,
} from '@/components/editor/menubarHeaderLayout'
import { DeferredSkeleton } from '@/components/ui/deferred-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import type { EntityDetailKind } from '@/contexts/EntityDetailContext'
import { cn } from '@/lib/utils'

/**
 * How far along the identity is. The three settled `QueryResult` states, with
 * `ready` split by whether there is anything to name: a surface fed by props
 * is simply always ready.
 */
export type EntityHeaderStatus = 'loading' | 'ready' | 'error'

export type EntityHeaderProps = {
  kind: EntityDetailKind
  /** The row the title opens. Absent while loading, or when there is none. */
  id?: string | null
  /** What it is called. Absent for the same reasons. */
  label?: string | null
  /** What it is, under the name. Conditional at every call site. */
  summary?: string | null
  status?: EntityHeaderStatus
  /** The failure, in the SUMMARY slot. Read only when `status` is `error`. */
  message?: string | null
  className?: string
}

/**
 * The identity block's own skeleton session.
 *
 * Deliberately NOT `EDITOR_BOOT_HOLD_KEY`. That key is the shell's boot lane —
 * the sidebar and everything that lands with it — and sharing it would hold a
 * service query that has already answered behind a sidebar that has not. This
 * bar waits on one query and on nothing else.
 */
const ENTITY_HEADER_HOLD_KEY = 'entity-header'

/**
 * The two lines, as boxes rather than as text. `aria-hidden` because a
 * placeholder read aloud is a placeholder announced as content — the same
 * rule `EditorSidebarBootSkeleton` follows.
 */
function EntityHeaderSkeleton() {
  return (
    <div
      data-entity-header-skeleton=""
      aria-hidden
      className="flex w-full min-w-0 flex-col gap-0.5"
    >
      {/* The affordance's own box — a 20px `text-sm` line inside `py-0.5`, at
          its `px-1.5` inset — so the name lands where the space was held. */}
      <div className="flex h-6 items-center px-1.5">
        <Skeleton className="h-3.5 w-40 max-w-full rounded-sm" />
      </div>
      {/* The summary's 16px `text-xs` row, at the summary's own inset. */}
      <div className="flex h-4 items-center px-1.5">
        <Skeleton className="h-2.5 w-64 max-w-full rounded-sm" />
      </div>
    </div>
  )
}

/**
 * The identity block above the canvas: what this thing is called, and what
 * it is.
 *
 * ONE component for three surfaces — the service overview, a phase, a
 * scenario. The same block was written three times, and only one of the three
 * owned a query, which is exactly why only that one was broken (#234). It
 * takes a RESOLVED identity and never a query: the service surface unpacks
 * `useServiceSpec`, the phase and scenario surfaces unpack the props they
 * already hold, and this component never learns which is which.
 *
 * It reserves its height rather than sizing to it — see
 * `BLUEPRINT_MENUBAR_IDENTITY_HEIGHT`, which is where the number and the
 * argument live, because all three bars draw their geometry from that module.
 *
 * FOUR STATES, THREE PICTURES:
 *
 *   loading            the skeleton
 *   ready, an entity   the name and its summary
 *   ready, nothing     a present, empty bar — this deployment has no service
 *   error              a present bar, with the failure in the SUMMARY slot
 *
 * The failure goes in the summary slot and never the title slot. The title is
 * an interactive affordance — it opens the entity panel — so error text there
 * offers a control that leads nowhere.
 *
 * The summary is a row UNDER the title, inside the same block. Inline after a
 * separator it competed with the name for the same line and truncated first on
 * a narrow canvas; outside the block it lost the block's own
 * `max-w-[calc(100%-9rem)]` and `gap-0.5`, so the two lines sat at a different
 * rhythm from the identical bar one level down. `title` and not a tooltip:
 * this is truncated prose, and the full text is one click away in the panel
 * the name opens.
 */
export function EntityHeader({
  kind,
  id,
  label,
  summary,
  status = 'ready',
  message,
  className,
}: EntityHeaderProps) {
  // A failed query has no summary to print, and printing a stale one under a
  // bar that cannot say what it is showing is worse than printing nothing.
  const caption = status === 'error' ? (message ?? null) : (summary ?? null)

  return (
    <div
      data-entity-header=""
      className={cn(BLUEPRINT_MENUBAR_TITLE_CLASS, className)}
      style={{ height: BLUEPRINT_MENUBAR_IDENTITY_HEIGHT }}
    >
      <DeferredSkeleton
        loading={status === 'loading'}
        holdKey={ENTITY_HEADER_HOLD_KEY}
        skeleton={<EntityHeaderSkeleton />}
        className="flex w-full min-w-0 flex-col items-start gap-0.5"
      >
        {id && label ? (
          <EntityTitleAffordance kind={kind} id={id} label={label} />
        ) : null}
        {caption ? (
          <p
            data-entity-header-summary=""
            className={BLUEPRINT_MENUBAR_DESCRIPTION_CLASS}
            title={caption}
          >
            {caption}
          </p>
        ) : null}
      </DeferredSkeleton>
    </div>
  )
}
