import { EntityHeader } from '@/components/blueprint/EntityHeader'
import {
  BLUEPRINT_MENUBAR_FLAT_CLASS,
  BLUEPRINT_MENUBAR_HEADER_CLASS,
  BLUEPRINT_NAVBAR_BAR_CLASS,
} from '@/components/editor/menubarHeaderLayout'
import {
  useCollapsedNavSummary,
  useSidebarCollapsedState,
} from '@/contexts/sidebarCollapsedContext'
import { useServiceSpec } from '@/hooks/useServiceSpec'
import { cn } from '@/lib/utils'

/**
 * The overview's title bar — the service, and the way into its properties.
 *
 * The overview deliberately had no bar: "a bar holding only a repeated title
 * read as a broken fragment", and plan 003 declined the sidebar's Service row
 * for the same reason — it "has no second job waiting on it". Opening the
 * service panel is that second job.
 *
 * The structure is `SlideStickyHeader` + `PhaseMenubarHeader` exactly, one
 * level up, because that IS the template:
 *
 *   docked bar          border, sidebar surface, px-4, items-center
 *     menubar row       min-h-9, flat, flex-1
 *       EntityHeader    the title AND the summary, shared with both
 *       right cluster   empty at this level; the phase header's controls
 *                       belong to a phase
 *
 * This is the one bar of the three that owns a query, which is why it is the
 * one that was broken. It used to `return null` while `useServiceSpec` was in
 * flight, so it had no height at all and the canvas below it jumped when the
 * data landed — while every other boot surface reserves its space first
 * (`EditorShell`: "the aside takes its full width in the same commit the
 * canvas mounts, so the frame is fixed from the first painted frame").
 *
 * The bar is now always here. `EntityHeader` holds the height and picks the
 * picture; this component's whole job is to hand it the four-state query as a
 * resolved identity — and, at the two widths where the sidebar takes the
 * space back, to answer for it (#239).
 */
export function ServiceOverviewHeader() {
  const result = useServiceSpec()
  // `useServiceSpec` is `QueryResult<ServiceSpec | null>`, so `ready` can
  // carry null data — a deployment with no service recorded yet. That is a
  // different fact from a failure, and the bar draws it differently.
  const service = result.status === 'ready' ? result.data : null
  const { collapsed, overlayInset } = useSidebarCollapsedState()

  /*
    Collapsed: the floating navbar carries this bar's identity instead, and
    this bar draws nothing — one chrome lane at any width, which is what
    `SlideStickyHeader` and `SliceHeaderBand` already do and what the service
    bar had no reference to at all, so its title was simply lost.

    ONLY the name. The summary is deliberately not handed over: the collapsed
    strip is sized for one line, and the summary is prose that would either
    push it past the canvas or truncate the name it exists to carry.

    Above the early return, and so is `useServiceSpec` — the query stays
    subscribed for the whole collapse. Expanding therefore restores a bar
    whose content is already in the cache, with no second skeleton (the
    read policy behind that is `QUERY_DEFAULTS`, pinned by #237's remount
    test).
  */
  useCollapsedNavSummary(collapsed && service ? { title: service.name } : null)
  if (collapsed) return null

  return (
    <div
      data-editor-navbar
      className={cn('flex items-center gap-3', BLUEPRINT_NAVBAR_BAR_CLASS)}
      /*
        The overlay's share of the row, given up rather than drawn under.

        On a narrow viewport the aside goes out of the flow and draws over
        this column at `z-20`, which used to leave the left half of this bar
        underneath the panel — a title that reads as half a title. The left
        edge follows the aside's rendered width instead, so the panel keeps
        the shape it has at every width and the bar surrenders only the space
        that is genuinely not its while the panel is open.

        A margin and not padding: the bar's own `px-4` gutter has to survive,
        and what moves is where the bar STARTS, not where its content starts
        inside it. Inline and in pixels because the width is a runtime number
        the reader can drag — there is no class for "however wide the reader
        left it".
      */
      style={overlayInset > 0 ? { marginLeft: overlayInset } : undefined}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className={cn(
          BLUEPRINT_MENUBAR_HEADER_CLASS,
          'min-w-0 flex-1',
          BLUEPRINT_MENUBAR_FLAT_CLASS,
        )}
      >
        <EntityHeader
          kind="service"
          id={service?.id}
          label={service?.name}
          summary={service?.summary}
          status={result.status}
          message={result.status === 'error' ? result.message : null}
        />
      </div>
      {/* The phase header's right cluster holds compare controls, which
          belong to a phase. Kept as the same slot so the two bars stay one
          shape when something earns a place here. */}
      <div className="flex shrink-0 items-center gap-2" />
    </div>
  )
}
