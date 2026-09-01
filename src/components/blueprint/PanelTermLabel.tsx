import { DefinitionPopover } from '@/components/blueprint/DefinitionCard'
import { PANEL_TEXT } from '@/lib/panelText'
import { cn } from '@/lib/utils'

/**
 * What this app's own words mean, hung off the words themselves.
 *
 * A dozen section labels named a concept — `Dependencies`, `Evidence`,
 * `Resources`, `Summary` — and said nothing about it, on the assumption
 * that a reader who has the panel open already knows the vocabulary. The
 * people who most need a blueprint are the ones who do not.
 *
 * No ⓘ beside the label: the label IS the word whose meaning is in question,
 * and hovering the word you do not recognise is where anyone looks first.
 *
 * A `DefinitionCard` since #243, and not the bare sentence it opened with.
 * The sentence had no heading, so it had to open by restating the label it
 * hung from — "Storyboard — the frames for each step" — and it was a third
 * shape beside the two-section card and `StatusBadge`'s tooltip. With the term
 * as the section's eyebrow the definition can start with the definition, and
 * every explained word in the app opens the same way.
 *
 * No dotted rule and no `cursor-help`. Both were marks announcing that this
 * word is defined; #243 removed them everywhere, on the trade that discovery
 * gets quieter in a tool used daily. What is NOT traded away is reach: the
 * popover trigger supplies `tabIndex`, so the definition is gettable by
 * keyboard, and a popover opens on touch where a tooltip does not
 * (docs/reference/panel-affordances.md § Hover is never the only way in).
 */
export function PanelTermLabel({
  term,
  definition,
  className,
}: {
  term: string
  definition: string
  className?: string
}) {
  return (
    <DefinitionPopover
      sections={[{ eyebrow: term, body: definition }]}
      side="bottom"
    >
      <span
        className={cn(
          PANEL_TEXT.sectionLabel,
          'w-fit rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          className,
        )}
      >
        {term}
      </span>
    </DefinitionPopover>
  )
}
