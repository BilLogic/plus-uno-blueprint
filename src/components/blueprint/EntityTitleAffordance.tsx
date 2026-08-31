import { Info } from 'lucide-react'
import { EntityDefinitionPopover } from '@/components/blueprint/EntityDefinitionPopover'
import { DEFINED_LABEL_CUE } from '@/lib/panelText'
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
 * The title and the ⓘ were ONE control until #140, with "View details" in
 * their shared hover slot. That slot is the only place a definition can hang
 * off the name of the thing the reader is looking at, and it was spending it
 * on a sentence the ⓘ already says. So the block now holds two targets: the
 * NAME explains what a service, a phase or a scenario is, and everything else
 * — an invisible opener filling the block, marked by the ⓘ — opens the panel.
 *
 * The block, not the glyph, is still the target for opening: a separate 24px
 * icon button would make the title look inert and hide the affordance in
 * twenty-four pixels, which is the failure the one-control version was written
 * against. What changed is that the word itself now answers a different
 * question, so it stops being part of that target.
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
      <EntityDefinitionPopover kind={kind} side="bottom">
        <h2
          className={cn(
            BLUEPRINT_MENUBAR_TITLE_TEXT_CLASS,
            'relative z-10 w-fit cursor-help rounded-sm outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring/50',
            DEFINED_LABEL_CUE,
          )}
        >
          {label}
        </h2>
      </EntityDefinitionPopover>
      {/* Always drawn, never a target of its own: it marks the block behind
          it. Hidden until hover, it was a control no touch reader could see
          (#140 Q11). */}
      <Info
        className={cn(
          'pointer-events-none relative z-10 size-3.5 shrink-0 text-muted-foreground/60',
          'transition-colors duration-(--motion-micro)',
          'group-hover/entity-title:text-foreground',
        )}
        aria-hidden
      />
    </div>
  )
}
