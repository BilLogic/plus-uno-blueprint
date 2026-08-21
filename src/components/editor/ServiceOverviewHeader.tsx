import { EntityTitleAffordance } from '@/components/blueprint/EntityTitleAffordance'
import {
  BLUEPRINT_MENUBAR_DESCRIPTION_CLASS,
  BLUEPRINT_MENUBAR_FLAT_CLASS,
  BLUEPRINT_MENUBAR_HEADER_CLASS,
  BLUEPRINT_MENUBAR_TITLE_CLASS,
  BLUEPRINT_NAVBAR_BAR_CLASS,
} from '@/components/editor/menubarHeaderLayout'
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
 *       title block     flex-col — the title AND the summary live in here
 *       right cluster   empty at this level; the phase header's controls
 *                       belong to a phase
 *
 * The summary goes INSIDE the title block, not beside it. Putting it outside
 * (as an earlier pass did) turned the menubar row into a column and dropped
 * the block's own `max-w-[calc(100%-9rem)]` and `gap-0.5`, so the two lines
 * sat at a different rhythm from the identical bar one level down.
 *
 * Renders nothing until the service resolves. No skeleton on purpose: one
 * line above a canvas already drawing its own placeholder, and a bar that
 * flickers in over it would be the loudest thing on a loading screen.
 */
export function ServiceOverviewHeader() {
  const result = useServiceSpec(null)
  const service = result.status === 'ready' ? result.data : null
  if (!service) return null

  return (
    <div
      data-editor-navbar
      className={cn('flex items-center gap-3', BLUEPRINT_NAVBAR_BAR_CLASS)}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className={cn(
          BLUEPRINT_MENUBAR_HEADER_CLASS,
          'min-w-0 flex-1',
          BLUEPRINT_MENUBAR_FLAT_CLASS,
        )}
      >
        <div className={BLUEPRINT_MENUBAR_TITLE_CLASS}>
          <EntityTitleAffordance
            kind="service"
            id={service.id}
            label={service.name}
          />
          {service.summary ? (
            <p
              className={BLUEPRINT_MENUBAR_DESCRIPTION_CLASS}
              title={service.summary}
            >
              {service.summary}
            </p>
          ) : null}
        </div>
      </div>
      {/* The phase header's right cluster holds compare controls, which
          belong to a phase. Kept as the same slot so the two bars stay one
          shape when something earns a place here. */}
      <div className="flex shrink-0 items-center gap-2" />
    </div>
  )
}
