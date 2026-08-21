import { PANEL_TEXT } from '@/lib/panelText'
import {
  ENTITY_STATUS_LABEL,
  ENTITY_STATUS_MEANING,
} from '@/lib/entityStatus'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCellContent } from '@/hooks/useCellContent'

/**
 * The owner pair, read-only.
 *
 * Owner and perceived owner are shown together and only when at least one is
 * set — side by side, because the interesting case is when they differ. That
 * gap is a finding: the person on the other side thinks they are dealing with
 * someone other than whoever is accountable.
 *
 * Editing does not live here anymore: in Edit mode the panel swaps this
 * section for `CellPanelEditor`, one form with one Save for the whole cell.
 */
export function CellContentSection({ cellId }: { cellId: string | null }) {
  const { client, configured } = useSupabase()
  const result = useCellContent(configured ? cellId : null)

  if (!configured || !client || !cellId) return null
  if (result.status !== 'ready') return null

  const cell = result.data
  if (!cell) return null

  const owner = cell.owner?.trim() ?? ''
  const perceived = cell.perceived_owner?.trim() ?? ''
  if (!owner && !perceived && !cell.status) return null

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1">
      {/* First, because it changes how everything under it should be read:
          a spec for something unbuilt is a proposal, not a description. */}
      {cell.status ? (
        <OwnerCell
          label="State"
          value={ENTITY_STATUS_LABEL[cell.status]}
          hint={ENTITY_STATUS_MEANING[cell.status]}
        />
      ) : null}
      {owner ? <OwnerCell label="Owner" value={owner} /> : null}
      {perceived ? <OwnerCell label="Perceived owner" value={perceived} /> : null}
    </div>
  )
}

function OwnerCell({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  const body = <span className={PANEL_TEXT.value}>{value}</span>
  return (
    <div className="flex flex-col gap-0.5">
      <span className={PANEL_TEXT.sectionLabel}>
        {label}
      </span>
      {hint ? (
        <Tooltip>
          <TooltipTrigger render={<span className={PANEL_TEXT.value}>{value}</span>} />
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            {hint}
          </TooltipContent>
        </Tooltip>
      ) : (
        body
      )}
    </div>
  )
}
