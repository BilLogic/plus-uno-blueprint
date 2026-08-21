import { PANEL_TEXT } from '@/lib/panelText'
import { StatusBadge } from '@/components/blueprint/StatusBadge'
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
  /*
    `live` shows nothing, here as everywhere else.

    It used to show nothing because the column was NULL on 879 cells and this
    guard skipped it. The column is `not null default 'live'` now, so without
    an explicit test every one of those cells would carry a "State: Live" row —
    a label repeated 879 times that tells the reader what they already assume,
    and by the second panel it has taught them to skip the one place status
    actually says something.
  */
  const status = cell.status === 'live' ? null : cell.status
  if (!owner && !perceived && !status) return null

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1">
      {/* First, because it changes how everything under it should be read:
          a spec for something unbuilt is a proposal, not a description. */}
      {status ? (
        <div className="flex flex-col gap-0.5">
          {/* "Status", not "State" — one name for one property. The paths
              picker calls it status, the column is called status, and a
              second word for it is a second thing to learn. */}
          <span className={PANEL_TEXT.sectionLabel}>Status</span>
          {/* A badge, not text: a governed six-value set the reader scans
              for. See docs/reference/panel-affordances.md § Badge or text. */}
          <StatusBadge status={status} />
        </div>
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
