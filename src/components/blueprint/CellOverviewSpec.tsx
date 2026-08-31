import type { ReactNode } from 'react'
import { PANEL_TEXT } from '@/lib/panelText'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useBlueprintCell } from '@/hooks/useBlueprintCell'
import { parseValueProps } from '@/lib/valueProps'

/**
 * One spec block: its label, and what is under it.
 *
 * `children` rather than only `text` because the value propositions are a
 * list and the other two are prose, and the LABEL is the part that has to be
 * identical — it is the word a reader takes to an engineer, so all three go
 * through one component rather than one of them hand-rolling its own heading.
 */
function SpecSection({
  title,
  text,
  children,
}: {
  title: string
  text?: string
  children?: ReactNode
}) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className={PANEL_TEXT.sectionLabel}>
        {title}
      </h3>
      {text !== undefined ? (
        <p className={cn('whitespace-pre-wrap', PANEL_TEXT.value)}>{text}</p>
      ) : null}
      {children}
    </section>
  )
}

type CellOverviewSpecProps = {
  /** Canonical (resolved) cell id; null when the cell is fallback-only. */
  cellId: string | null
}

/**
 * FUNCTION / FORM / VALUE PROPOSITION spec block in the panel's inline overview,
 * read-only. Sections render only when authored; without a database (or for
 * fallback-only cells) the block stays hidden entirely.
 *
 * Editing lives in `CellPanelEditor` — the panel's one form, one Save.
 */
export function CellOverviewSpec({ cellId }: CellOverviewSpecProps) {
  const { client, configured } = useSupabase()
  const cell = useBlueprintCell(cellId)

  if (!configured || !client || !cellId) return null

  /*
    No skeleton, because nothing loads.

    There used to be a `DeferredSkeleton` here, holding 250ms before painting
    so that the block did not grow and collapse on every cell switch — a good
    fix for a query that should not have existed. The board carries the spec
    columns now, so this renders in the same commit as the panel around it
    and there is no frame in which it could be empty.
  */
  const spec = cell
  const functionText = spec?.function?.trim() ?? ''
  const formText = spec?.form?.trim() ?? ''
  const valueProps = parseValueProps(spec?.value_props ?? null)
  const hasAnySpec =
    functionText.length > 0 || formText.length > 0 || valueProps.length > 0
  if (!hasAnySpec) return null

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-(--motion-fade)">
      {functionText ? <SpecSection title="Function" text={functionText} /> : null}
      {formText ? <SpecSection title="Form" text={formText} /> : null}
      {valueProps.length > 0 ? (
        <SpecSection title="Value proposition">
          <ul className="flex flex-col gap-1">
            {valueProps.map((entry, index) => (
              <li key={index} className="text-sm leading-snug text-foreground/80">
                <span className="font-medium text-foreground">{entry.for}</span>
                {entry.for && entry.value ? ' — ' : ''}
                {entry.value}
              </li>
            ))}
          </ul>
        </SpecSection>
      ) : null}
    </div>
  )
}
