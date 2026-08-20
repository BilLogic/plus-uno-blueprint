import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import {
  STEP_PANEL_FOOTER_ID,
  PanelFooterHost,
  PanelHeader,
  PanelIdentity,
  PanelKindBadge,
  PanelLoading,
} from '@/components/blueprint/panelShell'
import { PanelTextareaField } from '@/components/blueprint/PanelTextareaField'
import { useStepSpec, type StepSpec } from '@/hooks/useStepSpec'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import { invalidateCanvasBlueprintsForScenario } from '@/hooks/useCanvasBlueprints'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCanvasModeValue } from '@/contexts/canvasModeContext'
import { updateStepSummary } from '@/lib/stepSpecMutations'

/**
 * The step: one moment, read across every lane.
 *
 * `summary` is the only editable field, and it is the one the storyboard row
 * has always needed — the sentence that makes a column legible without
 * reading five cells, rendered as the caption under the frame. This panel is
 * where it is written, which is why a storyboard cell opens here rather than
 * into a cell panel describing some other lane's text.
 */
export function StepPanel({
  stepId,
  onClose,
}: {
  stepId: string
  onClose: () => void
}) {
  const result = useStepSpec(stepId)
  const step = result.status === 'ready' ? result.data : null

  return (
    <>
      <PanelHeader
        crumbs={[step?.phaseName ?? '', step?.scenarioName ?? 'Step']}
        title="Step properties"
        description="What this moment is, across every lane"
        closeLabel="Close step properties"
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 blueprint-scroll">
        {step ? (
          <StepPanelBody key={step.id} step={step} onDone={onClose} />
        ) : result.status === 'error' ? (
          <p className="text-sm text-muted-foreground">
            That step could not be loaded.
          </p>
        ) : (
          <PanelLoading />
        )}
      </div>
      <PanelFooterHost id={STEP_PANEL_FOOTER_ID} />
    </>
  )
}

function StepPanelBody({
  step,
  onDone,
}: {
  step: StepSpec
  onDone: () => void
}) {
  const { client, canWrite } = useSupabase()
  const canEdit = useCanvasModeValue() === 'design' && canWrite

  const [baseline] = useState(step.summary)
  const [summary, setSummary] = useState(baseline)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [footerHost, setFooterHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot DOM lookup of the portal host; it only exists after the panel's first commit
    setFooterHost(document.getElementById(STEP_PANEL_FOOTER_ID))
  }, [])

  const changed = summary !== baseline

  const handleSave = async () => {
    if (!client || busy || !changed) return
    setBusy(true)
    setError(null)
    try {
      await updateStepSummary(client, step.id, summary, baseline)
      invalidateQueries(`step-spec:${step.id}`)
      // The summary is ALSO the storyboard caption, so the grid holding it is
      // now stale — this is the one panel whose save changes the canvas.
      invalidateCanvasBlueprintsForScenario(step.scenarioId)
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not save.')
    } finally {
      setBusy(false)
    }
  }

  /*
    The meta line says only what a reader could not already see.
    "column 1 of 1 path" is both of those things — the column is on screen and
    the path is in the breadcrumb — so a step that sits where you would expect
    reports its cell count and nothing else. A step that sits at DIFFERENT
    columns on different paths is the one case worth a sentence, and it gets
    the list below as well.
  */
  const distinct = new Set(step.positions.map((entry) => entry.position))
  const positionLabel =
    step.positions.length === 0
      ? 'in no path yet'
      : distinct.size > 1
        ? `different columns on ${step.positions.length} paths`
        : step.positions.length > 1
          ? `${step.positions.length} paths`
          : null

  return (
    <div
      className="flex flex-col gap-4"
      data-panel-editor=""
      data-busy={busy || undefined}
    >
      <PanelIdentity
        badge={<PanelKindBadge label="Step" />}
        title={step.name}
        meta={[
          `${step.cellCount} cell${step.cellCount === 1 ? '' : 's'}`,
          positionLabel,
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      <PanelTextareaField
        label="Summary"
        hint="What happens in this moment, across every lane. Shown as the caption under the storyboard frame."
        placeholder="e.g. The student picks a slot; the system holds it 10 minutes."
        value={summary}
        rows={3}
        disabled={!canEdit}
        onChange={setSummary}
      />

      {distinct.size > 1 ? (
        <div className="flex flex-col gap-1">
          <span className="text-2xs font-medium text-muted-foreground">
            Columns
          </span>
          <ul className="flex flex-col gap-0.5">
            {step.positions.map((entry) => (
              <li
                key={`${entry.pathName}-${entry.position}`}
                className="text-sm text-foreground/80"
              >
                <span className="font-medium text-foreground">
                  {entry.pathName}
                </span>{' '}
                · column {entry.position + 1}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {canEdit
        ? (() => {
            const controls = (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !changed}
                  onClick={handleSave}
                >
                  {busy ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={onDone}
                >
                  Cancel
                </Button>
              </div>
            )
            return footerHost ? createPortal(controls, footerHost) : controls
          })()
        : null}
    </div>
  )
}
