import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconTooltip } from '@/components/editor/IconTooltip'
import {
  Field,
  LANE_PANEL_FOOTER_ID,
  PanelFooterControls,
  PanelFooterHost,
  PanelHeader,
  PanelIdentity,
  PanelKindBadge,
  PanelLoading,
} from '@/components/blueprint/panelShell'
import { PanelHint } from '@/components/blueprint/PanelHint'
import { PANEL_TEXT } from '@/lib/panelText'
import { StakeholderSelect } from '@/components/blueprint/StakeholderSelect'
import { useLaneSpec, type LaneSpec } from '@/hooks/useLaneSpec'
import { useOwnerTags } from '@/hooks/useOwnerTags'
import { usePanelFooterHost } from '@/hooks/usePanelFooterHost'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCanvasModeValue } from '@/contexts/canvasModeContext'
import { updateLaneSpec } from '@/lib/laneSpecMutations'
import { describeLaneRole, getLayerRole } from '@/lib/laneRoles'
import { getBlueprintLayerStyle } from '@/lib/blueprintTheme'

/**
 * The lane's properties: who owns it, what it is measured by, what it runs on.
 *
 * Three columns that have been writable since July and have never had a
 * surface. The panel is deliberately lean — no evidence, resources or
 * dependency tabs, because `evidence.cell_id`, `cells.links` and
 * `cell_dependencies` all key on a CELL and a lane has no link to any of them.
 */
export function LanePanel({
  laneId,
  onClose,
}: {
  laneId: string
  onClose: () => void
}) {
  const result = useLaneSpec(laneId)
  const lane = result.status === 'ready' ? result.data : null

  return (
    <>
      <PanelHeader
        // Where the lane is, not what it is — the name is the heading below.
        // Same division as the cell panel, whose crumb ends at the step and
        // whose title is the cell's own text.
        crumbs={[lane?.phaseName ?? '', lane?.scenarioName ?? '']}
        title="Lane properties"
        description="Owner, KPIs and tools for the selected lane"
        closeLabel="Close lane properties"
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 blueprint-scroll">
        {lane ? (
          <LanePanelBody key={lane.id} lane={lane} onDone={onClose} />
        ) : result.status === 'error' ? (
          <p className="text-sm text-muted-foreground">
            That lane could not be loaded.
          </p>
        ) : (
          <PanelLoading />
        )}
      </div>
      <PanelFooterHost id={LANE_PANEL_FOOTER_ID} />
    </>
  )
}

type FormState = {
  ownerTeam: string
  kpis: string[]
  tools: string[]
  stakeholderId: string | null
}

function LanePanelBody({
  lane,
  onDone,
}: {
  lane: LaneSpec
  onDone: () => void
}) {
  const { client, canWrite } = useSupabase()
  // View mode presents everything read-only, exactly as the cell panel does.
  const canEdit = useCanvasModeValue() === 'design' && canWrite
  const ownerTagsResult = useOwnerTags()
  const ownerTags =
    ownerTagsResult.status === 'ready' ? ownerTagsResult.data : []

  // Frozen at mount, for the same reason the cell editor freezes its baseline:
  // the query keeps tracking the database, and a revert landing mid-edit would
  // otherwise let Save write the reverted values straight back.
  const [baseline] = useState<FormState>({
    ownerTeam: lane.ownerTeam,
    kpis: lane.kpis,
    tools: lane.tools,
    stakeholderId: lane.stakeholderId,
  })
  const [form, setForm] = useState<FormState>(baseline)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const footerHost = usePanelFooterHost(LANE_PANEL_FOOTER_ID)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const changed =
    form.stakeholderId !== baseline.stakeholderId ||
    form.ownerTeam !== baseline.ownerTeam ||
    JSON.stringify(form.kpis) !== JSON.stringify(baseline.kpis) ||
    JSON.stringify(form.tools) !== JSON.stringify(baseline.tools)

  const handleSave = async () => {
    if (!client || busy || !changed) return
    setBusy(true)
    setError(null)
    try {
      await updateLaneSpec(client, lane.siblingLaneIds, form, baseline)
      invalidateQueries(`lane-spec:${lane.id}`)
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not save.')
    } finally {
      setBusy(false)
    }
  }

  const fanOut = lane.siblingLaneIds.length
  const resolvedRole = getLayerRole({ name: lane.name, role: lane.role })
  /*
    The badge takes its colour the same way a CELL does — through
    `getBlueprintLayerStyle`, whose `.lane` is the key blueprint.css paints
    from. The zone argument only decides the fallback for a lane with neither
    a role nor a known name, and the panel has no lane stack to read a zone
    from, so it asks for the frontstage fallback: a grey-ish chip on an
    unclassified lane, rather than a wrong-family colour.
  */
  const laneRole = getBlueprintLayerStyle(lane.name, 'frontstage', lane.role)
    .lane

  return (
    <div
      className="flex flex-col gap-4"
      data-panel-editor=""
      // Read by every dismiss path: closing mid-save reads as "cancelled"
      // while the write lands anyway.
      data-busy={busy || undefined}
    >
      <PanelIdentity
        badge={<PanelKindBadge label="Lane" laneRole={laneRole} />}
        title={lane.name}
        /*
          A cell count told the reader nothing they came here to learn. What
          IS worth a line is the one surprise this panel holds: an edit here
          moves several rows. Nothing else, and nothing at all when it does
          not apply.
        */
        meta={
          canEdit && fanOut > 1 ? (
            <>
              <span className="whitespace-nowrap">
                Edits apply to all {fanOut} “{lane.name}” lanes
              </span>{' '}
              <PanelHint label="What a save touches">
                A lane row belongs to one path, so “{lane.name}” is {fanOut}{' '}
                rows in {lane.scenarioName}. Saving writes all of them —
                otherwise the same lane would claim a different owner
                depending on which path you were looking at.
              </PanelHint>
            </>
          ) : (
            ''
          )
        }
      >
        {/* The role in words, not the enum key: `frontstage_actions` is a
            rendering contract, and a reader of this panel is being asked
            whether the KPI below matches what the lane DOES. Resolved through
            the legacy name map first — most rows predate `lane_role` and
            carry null, and saying "no blueprint role" about a lane the canvas
            draws the interaction line under would be a lie. */}
        <p className={PANEL_TEXT.meta}>{describeLaneRole(resolvedRole)}</p>
      </PanelIdentity>

      <Field
        label="Stakeholder"
        hint="Which member of the service's cast this lane is. Structural rows — tech, support, storyboard — have nobody."
      >
        <StakeholderSelect
          value={form.stakeholderId}
          disabled={!canEdit}
          onChange={(next) => set('stakeholderId', next)}
        />
      </Field>

      <Field
        label="Owner team"
        hint="The team accountable for this lane. A cell can override it."
      >
        {canEdit ? (
          <>
            <Input
              value={form.ownerTeam}
              // A datalist suggests, never blocks — same treatment as the
              // cell panel's owner field, and the same vocabulary behind it.
              list="lane-owner-tags"
              className="h-7 text-xs"
              onChange={(event) => set('ownerTeam', event.target.value)}
            />
            <datalist id="lane-owner-tags">
              {ownerTags.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          </>
        ) : (
          // A disabled empty input reads as a broken control. Read-only is
          // prose, the same as every other value in these panels.
          <p className={PANEL_TEXT.value}>
            {form.ownerTeam || (
              <span className="text-muted-foreground">
                Not specified — no team recorded for this lane.
              </span>
            )}
          </p>
        )}
      </Field>

      <StringListField
        label="KPIs"
        hint="How this lane is measured. One per row."
        addLabel="Add a KPI"
        removeLabel="Remove KPI"
        placeholder="e.g. session completion"
        values={form.kpis}
        disabled={!canEdit}
        onChange={(next) => set('kpis', next)}
      />

      <StringListField
        label="Tools"
        hint="What this lane runs on. One per row."
        addLabel="Add a tool"
        removeLabel="Remove tool"
        placeholder="e.g. Zoom"
        values={form.tools}
        disabled={!canEdit}
        onChange={(next) => set('tools', next)}
      />

      {canEdit ? (
        <PanelFooterControls
          footerHost={footerHost}
          busy={busy}
          changed={changed}
          error={error}
          onSave={handleSave}
          onCancel={onDone}
        />
      ) : null}
    </div>
  )
}

/**
 * A list of short strings, one per row — the `kpis` and `tools` jsonb arrays.
 *
 * Row shape copied from the cell panel's value_props editor: same `h-7`, same
 * `text-xs`, same ghost remove button, same self-start add button that says
 * what it adds rather than showing a bare ＋.
 */
function StringListField({
  label,
  hint,
  addLabel,
  removeLabel,
  placeholder,
  values,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  addLabel: string
  removeLabel: string
  placeholder: string
  values: string[]
  disabled: boolean
  onChange: (next: string[]) => void
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-col gap-1.5">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Input
              value={value}
              placeholder={placeholder}
              disabled={disabled}
              className="h-7 min-w-0 flex-1 text-xs"
              onChange={(event) =>
                onChange(
                  values.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item,
                  ),
                )
              }
            />
            {disabled ? null : (
              <IconTooltip label={removeLabel}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={removeLabel}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    onChange(values.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  <X className="size-3" />
                </Button>
              </IconTooltip>
            )}
          </div>
        ))}
        {values.length === 0 && disabled ? (
          <p className="text-sm text-muted-foreground">None recorded.</p>
        ) : null}
        {disabled ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 self-start px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onChange([...values, ''])}
          >
            <Plus className="size-3" />
            {addLabel}
          </Button>
        )}
      </div>
    </Field>
  )
}
