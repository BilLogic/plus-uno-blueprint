import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CellSpecEditor } from '@/components/blueprint/CellSpecEditor'
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
 * FUNCTION / FORM / VALUE spec block in the panel's inline overview —
 * read-only for viewers, editable in place for writers.
 *
 * Sections render only when authored. Without a database (or for
 * fallback-only cells) the block stays hidden entirely: there is nothing to
 * read and nowhere to write it.
 */
export function CellOverviewSpec({ cellId }: CellOverviewSpecProps) {
  const { client, configured, canWrite } = useSupabase()
  const specResult = useCellSpec(configured ? cellId : null)
  const [editing, setEditing] = useState(false)

  if (!configured || !client || !cellId) return null

  const loading = specResult.status === 'loading'
  const spec = specResult.status === 'ready' ? specResult.data : null
  const functionText = spec?.function?.trim() ?? ''
  const formText = spec?.form?.trim() ?? ''
  const valueProps = parseValueProps(spec?.value_props ?? null)
  const hasAnySpec =
    functionText.length > 0 || formText.length > 0 || valueProps.length > 0

  // Nothing is rendered while the query is in flight — not even a reserved
  // placeholder. Most cells have no spec at all, so reserving space meant the
  // block (and everything below it, including the tab row) grew for ~250 ms
  // and then collapsed again on *every* cell switch. Waiting costs one
  // downward push when a spec does land; reserving cost a bounce every time.
  if (loading) return null

  if (editing) {
    return (
      <CellSpecEditor
        cellId={cellId}
        spec={spec}
        onDone={() => setEditing(false)}
      />
    )
  }

  if (!hasAnySpec) {
    // The affordance is the only thing that tells a writer this cell *can*
    // carry a spec — without it the feature is invisible on exactly the
    // cells that need it most.
    if (!canWrite) return null
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 self-start px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setEditing(true)}
      >
        <Pencil className="size-3" />
        Specify function &amp; form
      </Button>
    )
  }

  return (
    <div className="group/spec flex flex-col gap-3 animate-in fade-in duration-200">
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
                <span className="font-medium text-foreground">{entry.for}</span>
                {entry.for && entry.value ? ' — ' : ''}
                {entry.value}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {canWrite ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          // Revealed on hover of the block, like the sidebar chevrons: the
          // spec is usually read, not edited.
          className="h-6 self-start px-2 text-xs text-muted-foreground opacity-0 transition-opacity group-hover/spec:opacity-100 focus-visible:opacity-100 hover:text-foreground"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3" />
          Edit
        </Button>
      ) : null}
    </div>
  )
}
