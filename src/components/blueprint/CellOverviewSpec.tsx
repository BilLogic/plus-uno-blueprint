import { DeferredSkeleton } from '@/components/ui/deferred-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCellSpec } from '@/hooks/useCellSpec'
import { parseValueProps } from '@/lib/valueProps'

function SpecSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <p className="text-sm whitespace-pre-wrap text-foreground/80">{text}</p>
    </section>
  )
}

type CellOverviewSpecProps = {
  /** Canonical (resolved) cell id; null when the cell is fallback-only. */
  cellId: string | null
}

/**
 * Read-only FUNCTION / FORM / VALUE spec block in the panel's inline
 * overview. Sections render only when authored; without a database (or for
 * fallback-only cells) the block stays hidden quietly.
 */
export function CellOverviewSpec({ cellId }: CellOverviewSpecProps) {
  const { client, configured } = useSupabase()
  const specResult = useCellSpec(configured ? cellId : null)

  if (!configured || !client || !cellId) return null

  const loading = specResult.status === 'loading'
  const spec = specResult.status === 'ready' ? specResult.data : null
  const functionText = spec?.function?.trim() ?? ''
  const formText = spec?.form?.trim() ?? ''
  const valueProps = parseValueProps(spec?.value_props ?? null)
  const hasAnySpec =
    functionText.length > 0 || formText.length > 0 || valueProps.length > 0

  if (!loading && !hasAnySpec) return null

  return (
    // The block reserves its height while the query is in flight, so the
    // open drawer never reflows under the reader mid-read.
    <DeferredSkeleton loading={loading} skeleton={<CellSpecLoadingSkeleton />}>
      <div className="flex flex-col gap-3">
        {functionText ? <SpecSection title="Function" text={functionText} /> : null}
        {formText ? <SpecSection title="Form" text={formText} /> : null}
        {valueProps.length > 0 ? (
          <section className="flex flex-col gap-1">
            <h3 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Value
            </h3>
            <ul className="flex flex-col gap-1">
              {valueProps.map((entry, index) => (
                <li key={index} className="text-sm leading-snug text-foreground/80">
                  <span className="font-medium text-foreground">
                    {entry.for}
                  </span>
                  {entry.for && entry.value ? ' — ' : ''}
                  {entry.value}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </DeferredSkeleton>
  )
}

/** Two spec sections' worth of reserved height. */
function CellSpecLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {[0, 1].map((index) => (
        <div key={index} className="flex flex-col gap-1">
          <Skeleton className="h-2.5 w-16 rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-4/5 rounded-full" />
        </div>
      ))}
    </div>
  )
}
