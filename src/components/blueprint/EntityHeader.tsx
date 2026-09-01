import { EntityTitleAffordance } from '@/components/blueprint/EntityTitleAffordance'
import {
  BLUEPRINT_MENUBAR_DESCRIPTION_CLASS,
  BLUEPRINT_MENUBAR_TITLE_CLASS,
} from '@/components/editor/menubarHeaderLayout'
import type { EntityDetailKind } from '@/contexts/EntityDetailContext'
import { cn } from '@/lib/utils'

export type EntityHeaderProps = {
  kind: EntityDetailKind
  /** The row the title opens. */
  id: string
  /** What it is called. */
  label: string
  /** What it is, under the name. Conditional at every call site. */
  summary?: string | null
  className?: string
}

/**
 * The identity block above the canvas: what this thing is called, and what
 * it is.
 *
 * ONE component for three surfaces — the service overview, a phase, a
 * scenario. The same block was written three times, and only one of the three
 * owned a query, which is exactly why only that one was broken (#234). It
 * takes a RESOLVED identity and never a query: the service surface unpacks
 * `useServiceSpec`, the phase and scenario surfaces unpack the props they
 * already hold, and this component never learns which is which.
 *
 * The summary is a row UNDER the title, inside the same block. Inline after a
 * separator it competed with the name for the same line and truncated first on
 * a narrow canvas; outside the block it lost the block's own
 * `max-w-[calc(100%-9rem)]` and `gap-0.5`, so the two lines sat at a different
 * rhythm from the identical bar one level down. `title` and not a tooltip:
 * this is truncated prose, and the full text is one click away in the panel
 * the name opens.
 */
export function EntityHeader({
  kind,
  id,
  label,
  summary,
  className,
}: EntityHeaderProps) {
  return (
    <div
      data-entity-header=""
      className={cn(BLUEPRINT_MENUBAR_TITLE_CLASS, className)}
    >
      <EntityTitleAffordance kind={kind} id={id} label={label} />
      {summary ? (
        <p
          data-entity-header-summary=""
          className={BLUEPRINT_MENUBAR_DESCRIPTION_CLASS}
          title={summary}
        >
          {summary}
        </p>
      ) : null}
    </div>
  )
}
