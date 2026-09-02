import { Field } from '@/components/blueprint/panelShell'
import { PANEL_TEXT } from '@/lib/panelText'
import { StatusBadge } from '@/components/blueprint/StatusBadge'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useBlueprintCell } from '@/hooks/useBlueprintCell'

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
  // From the board, not a request — see useBlueprintCell.
  const cell = useBlueprintCell(cellId)

  if (!configured || !client || !cellId) return null
  if (!cell) return null

  const owner = cell.owner?.trim() ?? ''
  const perceived = cell.perceived_owner?.trim() ?? ''
  const status = cell.status
  if (!owner && !perceived && !status) return null

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1">
      {/* First, because it changes how everything under it should be read:
          a spec for something unbuilt is a proposal, not a description. */}
      {status ? (
        // Labelled like Summary, hint and all (#307): the Status field now
        // explains itself the way its neighbour does, rather than carrying a
        // bare label while Summary alone had a hint. "Status", not "State" —
        // one name for one property, the same word the paths picker and the
        // column use.
        <Field
          label="Status"
          hint="How far along the thing this cell describes is."
        >
          {/* A badge, not text: a governed six-value set the reader scans
              for. See docs/reference/panel-affordances.md § Badge or text. */}
          <StatusBadge status={status} />
        </Field>
      ) : null}
      {owner ? <OwnerCell label="Owner" value={owner} /> : null}
      {perceived ? <OwnerCell label="Perceived owner" value={perceived} /> : null}
    </div>
  )
}

/**
 * A free-text owner, labelled.
 *
 * It carried an optional `hint` that opened a bare-sentence popover on the
 * VALUE. Nothing ever passed one — both call sites below are label and value —
 * so it was a dead third shape of definition, and #243 retired that shape. If
 * an owner ever needs explaining, the explanation belongs on the label like
 * every other one, through `Field`'s hint.
 */
function OwnerCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={PANEL_TEXT.sectionLabel}>{label}</span>
      <span className={PANEL_TEXT.value}>{value}</span>
    </div>
  )
}
