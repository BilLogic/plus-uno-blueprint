import type { ReactElement } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * One part of a definition: the word, and what it means.
 *
 * `eyebrow` is a category ("Path", "Staff", "Live") or an instance's own name
 * ("Happy Path", "Regular Tutor"). Both are set the same way, which is the
 * whole point — see `DefinitionCard`.
 */
export type DefinitionSection = {
  eyebrow: string
  body: string
  /**
   * True when `body` is the placeholder rather than authored prose. It changes
   * the BODY only; a section never heads itself differently.
   */
  unwritten?: boolean
}

/**
 * A definition, as ONE shape: sections, each an eyebrow above a body,
 * identically typeset and hairline-separated.
 *
 * One section is a term and its meaning. Two is a category then an instance —
 * PATH over what a path is, then this path's name over its own description.
 *
 * Three shapes shipped before #243 and this replaces all of them. The card
 * itself headed its category with a small-caps eyebrow and its instance with a
 * plain medium-weight name, which is two heading treatments inside one card
 * and is why it read as a one-off rather than as a pattern. `PanelTermLabel`,
 * `Field`'s hint and `PanelKindBadge`'s description opened a bare sentence
 * with no heading at all. `StatusBadge` used a Tooltip, which never opens on
 * touch.
 *
 * The `data-definition-*` attributes are the seam `definitionCard.test.tsx`
 * reads: "every section is typeset the same" is a claim about the rendered
 * sections and cannot be checked any other way.
 */
export function DefinitionCard({ sections }: { sections: DefinitionSection[] }) {
  return (
    <div data-definition-card="" className="flex flex-col">
      {sections.map((section, index) => (
        <div
          key={`${index}-${section.eyebrow}`}
          data-definition-section=""
          /* The hairline separates sections; it never heads one. */
          className={cn(
            'flex flex-col gap-1 px-3 py-2.5',
            index > 0 && 'border-t border-border',
          )}
        >
          {/* Small caps, so the word reads as a label on the sentence under it
              and not as another sentence competing with it. */}
          <span
            data-definition-eyebrow=""
            className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {section.eyebrow}
          </span>
          <span
            data-definition-body=""
            className={cn(
              'text-xs leading-relaxed text-foreground',
              section.unwritten && 'italic opacity-80',
            )}
          >
            {section.body}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * The card, hung off the thing it defines.
 *
 * A POPOVER and never a `Tooltip`, and that is a bug fix rather than a
 * preference. Base UI's `Tooltip` is `mouseOnly` with no press to fall back
 * on, so a definition put there is invisible on a phone — and this app has a
 * real phone posture (`useMobileShell`, a full-width bottom sheet). `Popover`
 * takes `openOnHover` for the pointer and keeps its own press for everyone
 * else: one mechanism reaching both readers.
 *
 * The trigger supplies `tabIndex`, so every definition is reachable by
 * keyboard focus. That is what makes the ⓘ removable: the icon was never what
 * made a definition reachable (#243).
 */
export function DefinitionPopover({
  sections,
  children,
  side = 'top',
  nativeButton = false,
  className,
}: {
  sections: DefinitionSection[]
  children: ReactElement
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** False for a `<span>` or a `<Badge>` trigger — Base UI warns otherwise. */
  nativeButton?: boolean
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={children}
        nativeButton={nativeButton}
        openOnHover
        delay={200}
        closeDelay={80}
      />
      <PopoverContent
        side={side}
        sideOffset={6}
        className={cn('w-auto max-w-xs gap-0 p-0 text-left', className)}
      >
        <DefinitionCard sections={sections} />
      </PopoverContent>
    </Popover>
  )
}
