import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CellContentEditor } from '@/components/blueprint/CellContentEditor'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCellContent } from '@/hooks/useCellContent'

/**
 * The owner pair, and the way into editing what a cell says.
 *
 * Owner and perceived owner are shown together and only when at least one is
 * set — side by side, because the interesting case is when they differ. That
 * gap is a finding: the person on the other side thinks they are dealing with
 * someone other than whoever is accountable.
 *
 * Editing covers the cell's text, description, owners and resources. Where the
 * cell *sits* is not here and never will be: that is structure, and structure
 * goes through the RPCs with a confirm behind it.
 */
export function CellContentSection({ cellId }: { cellId: string | null }) {
  const { client, configured, canWrite } = useSupabase()
  const result = useCellContent(configured ? cellId : null)
  const [editing, setEditing] = useState(false)

  if (!configured || !client || !cellId) return null
  if (result.status === 'loading') return null

  const cell = result.status === 'ready' ? result.data : null
  if (!cell) return null

  if (editing) {
    return (
      <CellContentEditor
        cellId={cellId}
        content={cell.content}
        description={cell.description ?? ''}
        owner={cell.owner ?? ''}
        perceivedOwner={cell.perceived_owner ?? ''}
        links={cell.links}
        onDone={() => setEditing(false)}
      />
    )
  }

  const owner = cell.owner?.trim() ?? ''
  const perceived = cell.perceived_owner?.trim() ?? ''
  const hasOwners = owner.length > 0 || perceived.length > 0

  if (!hasOwners && !canWrite) return null

  return (
    <div className="group/content flex flex-col gap-2">
      {hasOwners ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {owner ? <OwnerCell label="Owner" value={owner} /> : null}
          {perceived ? (
            <OwnerCell label="Perceived owner" value={perceived} />
          ) : null}
        </div>
      ) : null}
      {canWrite ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          // Revealed on hover, matching the spec block above it: a cell is
          // read far more often than it is edited.
          className="h-6 self-start px-2 text-xs text-muted-foreground opacity-0 transition-opacity group-hover/content:opacity-100 focus-visible:opacity-100 hover:text-foreground"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3" />
          {hasOwners ? 'Edit' : 'Edit text & resources'}
        </Button>
      ) : null}
    </div>
  )
}

function OwnerCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-sm text-foreground/80">{value}</span>
    </div>
  )
}
