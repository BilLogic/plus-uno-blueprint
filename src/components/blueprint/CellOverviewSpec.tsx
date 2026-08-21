import { DeferredSkeleton } from '@/components/ui/deferred-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { PANEL_TEXT } from '@/lib/panelText'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCellSpec } from '@/hooks/useCellSpec'
import { parseValueProps } from '@/lib/valueProps'

function SpecSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className={PANEL_TEXT.sectionLabel}>
        {title}
      </h3>
      <p className={cn('whitespace-pre-wrap', PANEL_TEXT.value)}>{text}</p>
    </section>
  )
}

type CellOverviewSpecProps = {
  /** Canonical (resolved) cell id; null when the cell is fallback-only. */
  cellId: string | null
}

/**
 * FUNCTION / FORM / VALUE spec block in the panel's inline overview,
 * read-only. Sections render only when authored; without a database (or for
 * fallback-only cells) the block stays hidden entirely.
 *
 * Editing lives in `CellPanelEditor` — the panel's one form, one Save.
 */
export function CellOverviewSpec({ cellId }: CellOverviewSpecProps) {
  const { client, configured } = useSupabase()
  const specResult = useCellSpec(configured ? cellId : null)

  if (!configured || !client || !cellId) return null
  /*
    A deferred skeleton, not a bare `return null`.

    Reserving space unconditionally was the old bug: most cells have no spec
    at all, so the block (and the tab row under it) grew for ~250ms and
    collapsed again on EVERY cell switch. `DeferredSkeleton` holds for exactly
    that long before painting, so a fast query still renders nothing — and a
    slow one now says "loading" instead of looking empty, which is the
    consistency the panels needed.
  */
  if (specResult.status !== 'ready') {
    return (
      <DeferredSkeleton
        loading
        skeleton={
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        }
      >
        {null}
      </DeferredSkeleton>
    )
  }

  const spec = specResult.data
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
        <section className="flex flex-col gap-1">
          <h3 className={PANEL_TEXT.sectionLabel}>
            Value
          </h3>
          <ul className="flex flex-col gap-1">
            {valueProps.map((entry, index) => (
              <li key={index} className="text-sm leading-snug text-foreground/80">
                <span className="font-medium text-foreground">{entry.for}</span>
                {entry.for && entry.value ? ' — ' : ''}
                {entry.value}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
