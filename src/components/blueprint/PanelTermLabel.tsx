import { DefinitionPopover } from '@/components/blueprint/DefinitionCard'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * A word this app made up, as a BADGE, with what it means behind it.
 *
 * It was a section label with a definition on it, and so were eleven others —
 * `Status`, `Summary`, `Position`, `Paths`, `Dependencies`, `Resources`. Those
 * are ordinary English in a form, and a definition on every label teaches that
 * hovering is worth doing about eleven times before it teaches anything. They
 * lost theirs in #244. What is left here is the vocabulary a reader could not
 * guess: a storyboard, a touchpoint.
 *
 * A BADGE and not a label, because that is the shape this app already gives a
 * word drawn from a vocabulary rather than typed by an author — a path's kind,
 * a cell's status, a lane's stakeholder. The rule is then checkable rather
 * than tasteful, which is the point of it: `scripts/tests/`
 * `a-definition-hangs-off-a-badge.test.mjs` asks what a definition is attached
 * to, not whether a word feels like jargon.
 *
 * `outline`, so the badge reads as a caption over its value rather than as a
 * second fact beside it. The instance underneath keeps its own tone, and the
 * two are never the same colour.
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
      <Badge
        data-panel-term-badge=""
        variant="outline"
        className={cn('font-normal text-muted-foreground', className)}
      >
        {term}
      </Badge>
    </DefinitionPopover>
  )
}
