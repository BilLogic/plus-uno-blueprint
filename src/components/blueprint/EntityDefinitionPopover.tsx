import type { ReactElement, RefObject } from 'react'
import {
  DefinitionPopover,
  type DefinitionSection,
} from '@/components/blueprint/DefinitionCard'
import {
  ENTITY_KIND_DEFINITIONS,
  instanceDescriptionText,
  type EntityKindTerm,
} from '@/lib/panelTerms'

type EntityDefinitionPopoverProps = {
  /** Which kind of thing the label names. Its definition is the first section. */
  kind: EntityKindTerm
  /** This instance's own description, if it has one. The second section's body. */
  description?: string | null
  /** This instance's name. It is the second section's eyebrow. */
  name?: string
  /**
   * Whether to print this instance's description under the hairline.
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
   * things; it is a fact about the same label, so it rides in the same card.
   */
  note?: string | null
  children: ReactElement
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** False for a `<span>` or a `<Badge>` trigger — Base UI warns otherwise. */
  nativeButton?: boolean
  className?: string
  /** Controlled open — for a header whose whole block owns the hover (#306). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Point the card at this element rather than the trigger. */
  anchor?: RefObject<Element | null> | Element | null
  /** Off when a surrounding block, not the trigger, opens on hover. */
  openOnHover?: boolean
  /** Hover open delay in ms. */
  delay?: number
}

/** The eyebrow an aside wears, so it is a section like every other one. */
const NOTE_EYEBROW = 'Note'

/**
 * What this kind of thing IS, hung off the label that names one of them.
 *
 * It is a `DefinitionCard` and nothing else since #243: this component's only
 * job is to turn a kind, an instance and an aside into SECTIONS. It used to
 * own the card's markup, and owning it is how the instance half drifted into a
 * plain medium-weight name while the category half wore a small-caps eyebrow —
 * two heading treatments in one card, on the three surfaces that render both.
 *
 * Several facts in one card, which is allowed: the KIND, then THIS INSTANCE,
 * then an aside. The standing prohibition is two mechanisms for one fact, not
 * one mechanism for several — and splitting them would put the definition of
 * "path" somewhere other than on the word "path".
 *
 * It was `PathDescriptionTooltip`. The name was already wrong before that
 * change — `ScenarioTitleBadge` and `PathLabelBadge` both funnel through it,
 * so it served phases and scenarios as well as paths — and it is wrong twice
 * over now that it is not a tooltip.
 */
export function EntityDefinitionPopover({
  kind,
  description,
  name,
  showDescription = false,
  note,
  children,
  side = 'top',
  nativeButton = false,
  className,
  open,
  onOpenChange,
  anchor,
  openOnHover,
  delay,
}: EntityDefinitionPopoverProps) {
  const term = ENTITY_KIND_DEFINITIONS[kind]
  const trimmedName = name?.trim()
  const noteText = note?.trim() || null

  const sections: DefinitionSection[] = [
    { eyebrow: term.label, body: term.definition },
  ]

  /*
    The instance section needs a NAME, because its eyebrow IS the name. A
    caller asking for a description with nothing to head it would get a
    headless section, which is the second heading treatment this card was
    flattened to remove — so it draws nothing instead.
  */
  if (showDescription && trimmedName) {
    sections.push({
      eyebrow: trimmedName,
      body: instanceDescriptionText(description),
      unwritten: !description?.trim(),
    })
  }

  if (noteText) {
    sections.push({ eyebrow: NOTE_EYEBROW, body: noteText })
  }

  return (
    <DefinitionPopover
      sections={sections}
      side={side}
      nativeButton={nativeButton}
      className={className}
      open={open}
      onOpenChange={onOpenChange}
      anchor={anchor}
      openOnHover={openOnHover}
      delay={delay}
    >
      {children}
    </DefinitionPopover>
  )
}
