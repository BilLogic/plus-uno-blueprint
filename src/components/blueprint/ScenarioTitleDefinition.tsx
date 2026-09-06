import type { ReactElement } from 'react'
import { EntityDefinitionPopover } from '@/components/blueprint/EntityDefinitionPopover'
import type { NavItem } from '@/types/nav'

type ScenarioTitleDefinitionProps = {
  /** A phase slide's title says PHASE; a scenario's says SCENARIO. */
  kind?: 'phase' | 'scenario'
  /** The scenario whose note to carry, where the row has one. */
  slide?: Pick<NavItem, 'note'> | null
  children: ReactElement
}

/**
 * A slide header's title, carrying what a scenario IS and — where the row has
 * one — `scenarios.note`, the aside beside it. In this deployment that note
 * says which scenarios run alongside this one; it used to be three sentences
 * in TypeScript keyed on three hardcoded scenario ids (#326 S6, #396 Q38).
 *
 * It was `ScenarioParallelInfoTooltip`: an ⓘ parked before the title, whose
 * hover said "this scenario can run in parallel with…". That made ⓘ mean two
 * things in one app — four other components use it for *opens the panel* — and
 * #140 Q11 settled that it means only that. So the aside moves onto the word
 * it was about, where every other explanation in this app now lives, and the
 * glyph goes.
 *
 * It also stops being a tooltip, for the reason everything else did: a tooltip
 * never opens on touch, so on a phone the note was never readable at all.
 *
 * The description is deliberately not passed. Both slide headers print it as
 * prose directly under the title, and a popover repeating it would be two
 * mechanisms for one fact.
 */
export function ScenarioTitleDefinition({
  kind = 'scenario',
  slide,
  children,
}: ScenarioTitleDefinitionProps) {
  return (
    <EntityDefinitionPopover
      kind={kind}
      note={slide?.note ?? null}
      side="bottom"
    >
      {children}
    </EntityDefinitionPopover>
  )
}
