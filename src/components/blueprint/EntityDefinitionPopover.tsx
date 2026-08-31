import { useCallback, useState, type ReactElement } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  ENTITY_KIND_DEFINITIONS,
  instanceDescriptionText,
  type EntityKindTerm,
} from '@/lib/panelTerms'
import { cn } from '@/lib/utils'

/** Below this on-screen height the label is treated as zoomed-out / too small to read. */
const SMALL_LABEL_HEIGHT_PX = 18

type EntityDefinitionPopoverProps = {
  /** Which kind of thing the label names. Its definition is the first fact. */
  kind: EntityKindTerm
  /** This instance's own description, if it has one. The second fact. */
  description?: string | null
  /** This instance's name, printed above its description when it is worth repeating. */
  name?: string
  /** When true, the name is always shown; otherwise only when the trigger truncates it. */
  showName?: boolean
  /**
   * Whether to print this instance's description under the rule.
   *
   * Off by default, and that default is the standing prohibition rather than
   * shyness: a menubar title and a slide header already print the description
   * as prose beside the name, and a popover repeating it would be two
   * mechanisms for one fact. It goes on where the label is ALONE on the board —
   * a path badge, a phase frame's label, a compare panel's label — and there
   * the empty case renders the placeholder, because "nobody has written this
   * yet" is a message and it is the one that gets it written.
   */
  showDescription?: boolean
  /**
   * A further note about THIS instance — the parallel-scenario aside is the
   * only one. It used to hang off an ⓘ inside the badge, which made ⓘ mean two
   * things; it is a fact about the same label, so it rides in the same popover.
   */
  note?: string | null
  children: ReactElement
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** False for a `<span>` or a `<Badge>` trigger — Base UI warns otherwise. */
  nativeButton?: boolean
  className?: string
}

/**
 * What this kind of thing IS, hung off the label that names one of them.
 *
 * A POPOVER and not a `Tooltip`, and that is the bug this component was
 * extracted to fix rather than a preference. Base UI's `Tooltip` never opens
 * on touch — `useHoverReferenceInteraction` is `mouseOnly` there with no press
 * to fall back on — so every definition in this app was invisible on a phone,
 * on a shell that has a real phone posture. `Popover` takes `openOnHover` for
 * the pointer and keeps its own press for everyone else, which is one
 * mechanism reaching both readers rather than two mechanisms for one fact.
 *
 * Two facts in one popover, which is allowed: the KIND above a rule, THIS
 * INSTANCE below it. The standing prohibition is two mechanisms for one fact,
 * not one mechanism for two — and splitting them would put the definition of
 * "path" somewhere other than on the word "path".
 *
 * It was `PathDescriptionTooltip`. The name was already wrong before this
 * change — `ScenarioTitleBadge` and `PathLabelBadge` both funnel through it,
 * so it served phases and scenarios as well as paths — and it is wrong twice
 * over now that it is not a tooltip.
 */
export function EntityDefinitionPopover({
  kind,
  description,
  name,
  showName = false,
  showDescription = false,
  note,
  children,
  side = 'top',
  nativeButton = false,
  className,
}: EntityDefinitionPopoverProps) {
  const [includeName, setIncludeName] = useState(false)
  const term = ENTITY_KIND_DEFINITIONS[kind]
  const text = instanceDescriptionText(description)
  const hasDescription = Boolean(description?.trim())
  const noteText = note?.trim() || null

  const updateIncludeName = useCallback(
    (element: HTMLElement) => {
      setIncludeName(
        Boolean(name?.trim()) &&
          element.getBoundingClientRect().height < SMALL_LABEL_HEIGHT_PX,
      )
    },
    [name],
  )

  /*
    A rule under a sentence with blank space below it is a promise of content
    that never arrives, so the instance half renders only where there is one.
  */
  const showInstance = showDescription || noteText !== null

  return (
    <Popover>
      <PopoverTrigger
        render={children}
        nativeButton={nativeButton}
        openOnHover
        delay={200}
        closeDelay={80}
        onPointerEnter={(event) => updateIncludeName(event.currentTarget)}
        onFocus={(event) => updateIncludeName(event.currentTarget)}
      />
      <PopoverContent
        side={side}
        sideOffset={6}
        className={cn('w-auto max-w-xs gap-0 p-0 text-left', className)}
      >
        <div className="flex flex-col gap-1 px-3 py-2.5">
          {/* Small caps, so the kind reads as a category and not as another
              sentence competing with the one under it. */}
          <span className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
            {term.label}
          </span>
          <span className="text-xs leading-relaxed text-foreground">
            {term.definition}
          </span>
        </div>
        {showInstance ? (
          <div className="flex flex-col gap-1 border-t border-border px-3 py-2.5">
            {(includeName || showName) && name ? (
              <span className="text-xs font-medium text-foreground">{name}</span>
            ) : null}
            {showDescription ? (
              <span
                className={cn(
                  'text-xs leading-relaxed text-muted-foreground',
                  !hasDescription && 'italic opacity-80',
                )}
              >
                {text}
              </span>
            ) : null}
            {noteText ? (
              <span className="text-xs leading-relaxed text-muted-foreground">
                {noteText}
              </span>
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
