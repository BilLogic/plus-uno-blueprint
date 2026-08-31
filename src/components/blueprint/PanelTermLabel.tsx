import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { DEFINED_LABEL_CUE, PANEL_TEXT } from '@/lib/panelText'
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
 * and hovering the word you do not recognise is where anyone looks first. ⓘ
 * means one thing in this app and it is "opens the panel" (#140 Q11).
 *
 * A POPOVER and not a `Tooltip`, since #140, and this was a live bug rather
 * than a preference. Base UI's tooltip opens on hover and on focus and on
 * nothing else — it is `mouseOnly` with no press to fall back on — so on the
 * phone posture this app actually has (`useMobileShell`, a full-width bottom
 * sheet) all six of these definitions were unreachable. `Popover` takes
 * `openOnHover` for the pointer and keeps its own press for everyone else.
 *
 * `cursor-help`, the dotted cue, the focus ring, the popover — what an
 * explained label wears. The dotted underline is the `<abbr>` idiom and it is
 * the only one of the four a touch reader can see. No hover colour: it is not
 * clickable, and a surface that repaints under the pointer says it is. The
 * trigger supplies `tabIndex` — a definition on a bare `<span>` cannot be
 * reached by keyboard at all, which is the same failure as touch with a
 * different cause (docs/reference/panel-affordances.md § Hover is never the
 * only way in).
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
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        openOnHover
        delay={200}
        closeDelay={80}
        render={
          <span
            className={cn(
              PANEL_TEXT.sectionLabel,
              'w-fit cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              DEFINED_LABEL_CUE,
              className,
            )}
          />
        }
      >
        {term}
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-64 p-3 text-xs leading-relaxed">
        {definition}
      </PopoverContent>
    </Popover>
  )
}
