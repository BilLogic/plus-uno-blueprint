import { useState } from 'react'
import {
  PanelEmpty,
  PanelFooterControls,
  PanelFooterHost,
  PanelHeader,
  PanelIdentity,
  PanelKindBadge,
} from '@/components/blueprint/panelShell'
import { ServicePanelLoading } from '@/components/blueprint/panelLoading'
import { PanelTextareaField } from '@/components/blueprint/PanelTextareaField'
import { useServiceSpec, type ServiceSpec } from '@/hooks/useServiceSpec'
import { usePanelFooterHost } from '@/hooks/usePanelFooterHost'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCanvasModeValue } from '@/contexts/canvasModeContext'
import {
  updateBusinessModel,
  updateServiceSummary,
} from '@/lib/serviceSpecMutations'

export const SERVICE_PANEL_FOOTER_ID = 'service-panel-footer'

/**
 * The service's own properties — its sentence, and its business model.
 *
 * Pinned on 2026-08-20 with the service tier and unpinned on 2026-08-21. It is
 * the fourth caller of the same shell the lane, phase and scenario panels use,
 * which is the point: three callers exercised a parameterised shell as well as
 * four, and adding the fourth needed no change to it.
 *
 * No Contents tab, per the plan: the service's children are six phases already
 * listed in the sidebar, and duplicating navigation inside a properties panel
 * is noise.
 */
export function ServicePanel({ onClose }: { onClose: () => void }) {
  const result = useServiceSpec(null)
  const service = result.status === 'ready' ? result.data : null

  return (
    <>
      <PanelHeader
        crumbs={[]}
        title="Service properties"
        description="What this service is, and how it is funded"
        closeLabel="Close service properties"
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 blueprint-scroll">
        {service ? (
          <ServicePanelBody key={service.id} service={service} onDone={onClose} />
        ) : result.status === 'error' ? (
          <p className="text-sm text-muted-foreground">
            The service could not be loaded.
          </p>
        ) : (
          <ServicePanelLoading />
        )}
      </div>
      <PanelFooterHost id={SERVICE_PANEL_FOOTER_ID} />
    </>
  )
}

type FormState = {
  summary: string
  funding: string
  pricing: string
  deliveryCost: string
  revenueModel: string
  partners: string
}

function buildBaseline(service: ServiceSpec): FormState {
  return {
    summary: service.summary,
    funding: service.funding,
    pricing: service.pricing,
    deliveryCost: service.deliveryCost,
    revenueModel: service.revenueModel,
    partners: service.partners,
  }
}

/** Nothing an author has said about the service yet. */
function isServiceEmpty(form: FormState): boolean {
  return Object.values(form).every((value) => !value.trim())
}

function ServicePanelBody({
  service,
  onDone,
}: {
  service: ServiceSpec
  onDone: () => void
}) {
  const { client, canWrite } = useSupabase()
  const canEdit = useCanvasModeValue() === 'design' && canWrite

  // Frozen at mount, like every other panel: the query keeps tracking the
  // database, and a revert landing mid-edit would let Save write it back.
  const [baseline] = useState<FormState>(buildBaseline(service))
  const [form, setForm] = useState<FormState>(baseline)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const footerHost = usePanelFooterHost(SERVICE_PANEL_FOOTER_ID)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const summaryChanged = form.summary !== baseline.summary
  const modelChanged =
    form.funding !== baseline.funding ||
    form.pricing !== baseline.pricing ||
    form.deliveryCost !== baseline.deliveryCost ||
    form.revenueModel !== baseline.revenueModel ||
    form.partners !== baseline.partners
  const changed = summaryChanged || modelChanged

  if (isServiceEmpty(baseline) && !canEdit) {
    return <PanelEmpty subject="service" />
  }

  const handleSave = async () => {
    if (!client || busy || !changed) return
    setBusy(true)
    setError(null)
    try {
      // Two rows, two ledger entries — the summary and the business model
      // revert separately, and one "edited the service" entry could not put
      // either back on its own.
      if (summaryChanged) {
        await updateServiceSummary(
          client,
          service.id,
          form.summary,
          baseline.summary,
        )
      }
      if (modelChanged) {
        await updateBusinessModel(client, service.id, form, baseline)
      }
      invalidateQueries(`service-spec:first`)
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex flex-col gap-4"
      data-panel-editor=""
      data-busy={busy || undefined}
    >
      <PanelIdentity
        badge={<PanelKindBadge label="Service" />}
        title={service.name}
        // The one relationship a reader cannot see from the canvas: how much
        // board there is. The phases themselves are in the sidebar.
        meta={`${service.phaseCount} phases · ${service.scenarioCount} scenarios`}
      />

      <PanelTextareaField
        label="Summary"
        hint="What this service is, in the words a newcomer needs."
        value={form.summary}
        rows={3}
        disabled={!canEdit}
        onChange={(next) => set('summary', next)}
      />

      <PanelTextareaField
        label="Funding"
        hint="Where the money to run it comes from."
        value={form.funding}
        rows={2}
        disabled={!canEdit}
        onChange={(next) => set('funding', next)}
      />
      <PanelTextareaField
        label="Pricing"
        hint="What the recipient pays, if anything."
        value={form.pricing}
        rows={2}
        disabled={!canEdit}
        onChange={(next) => set('pricing', next)}
      />
      <PanelTextareaField
        label="Delivery cost"
        hint="What one unit of the service costs to deliver."
        value={form.deliveryCost}
        rows={2}
        disabled={!canEdit}
        onChange={(next) => set('deliveryCost', next)}
      />
      <PanelTextareaField
        label="Revenue model"
        hint="How it sustains itself over time."
        value={form.revenueModel}
        rows={2}
        disabled={!canEdit}
        onChange={(next) => set('revenueModel', next)}
      />
      <PanelTextareaField
        label="Partners"
        hint="Who outside the organisation it depends on."
        value={form.partners}
        rows={2}
        disabled={!canEdit}
        onChange={(next) => set('partners', next)}
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
