import { EntityDefinitionPopover } from '@/components/blueprint/EntityDefinitionPopover'
import { BLUEPRINT_MENUBAR_TITLE_TEXT_CLASS } from '@/components/editor/menubarHeaderLayout'
import {
  useEntityDetail,
  type EntityDetailKind,
} from '@/contexts/EntityDetailContext'
import { cn } from '@/lib/utils'

/**
 * The canvas title, what that kind of thing IS, and the way into what is
 * behind it.
 *
 * The title and an ⓘ were ONE control until #140, with "View details" in
 * their shared hover slot. That slot is the only place a definition can hang
 * off the name of the thing the reader is looking at, and it was spending it
 * on a sentence the glyph already said. So the block now holds two targets:
 * the NAME explains what a service, a phase or a scenario is, and everything
 * else — an invisible opener filling the block — opens the panel.
 *
 * The block is the target for opening, and since #243 there is no glyph
 * marking it. A separate 24px icon button would make the title look inert and
 * hide the affordance in twenty-four pixels, which is the failure the
 * one-control version was written against; the block is full-size on any
 * input, so the mark was decoration on a target nobody could miss.
 *
 * A TITLE, not a badge. The filled badge made the name of the thing you are
 * looking at read as a tag on something else, and the slice header band —
 * which is the same job on the same chrome lane — sets its title as plain
 * semibold text with the summary beneath it. One shape for one job.
 */
export function EntityTitleAffordance({
  kind,
  id,
  label,
  className,
}: {
  kind: EntityDetailKind
  id: string
  label: string
  className?: string
}) {
  const { toggleEntity, selection } = useEntityDetail()
  const open = selection?.kind === kind && selection.id === id

  return (
    <div
      data-entity-title=""
      data-open={open ? '' : undefined}
      className={cn(
        'group/entity-title relative flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5',
        'transition-colors duration-(--motion-micro)',
        'hover:bg-sidebar-accent data-open:bg-sidebar-accent',
        'has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring/50',
        className,
      )}
    >
      <button
        type="button"
        // Says what it does, and which — several of these exist per screen.
        aria-label={`View details: ${label}`}
        aria-pressed={open}
        data-entity-title-affordance=""
        className="absolute inset-0 rounded-md outline-none"
        onClick={(event) => {
          event.stopPropagation()
          toggleEntity({ kind, id })
        }}
      />
      {/* No dotted rule and no help cursor. The focus ring stays, because it
          is the one of the three that a keyboard reader needs rather than a
          mark announcing to everyone that this word is defined (#243). */}
      <EntityDefinitionPopover kind={kind} side="bottom">
        <h2
          className={cn(
            BLUEPRINT_MENUBAR_TITLE_TEXT_CLASS,
            'relative z-10 w-fit rounded-sm outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring/50',
          )}
        >
          {label}
        </h2>
      </EntityDefinitionPopover>
      {/* The ⓘ that marked the opener is GONE (#243).

          It was introduced because a hover-only control is invisible to a
          touch reader. That reasoning is void here: the opener is the block
          itself, which is a full-size target on any input, and the definition
          beside it is a Popover that opens on touch. The icon was never what
          made either of them reachable, and a resting page carrying a glyph
          beside every named thing is what the ticket set out to remove. */}
    </div>
  )
}
