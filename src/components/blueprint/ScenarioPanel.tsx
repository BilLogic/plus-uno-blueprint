import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  SCENARIO_PANEL_FOOTER_ID,
  PanelFooterHost,
  PanelHeader,
  PanelIdentity,
  PanelKindBadge,
  PanelLoading,
} from '@/components/blueprint/panelShell'
import { PanelHint } from '@/components/blueprint/PanelHint'
import { PanelTextareaField } from '@/components/blueprint/PanelTextareaField'
import { useScenarioSpec, type ScenarioSpec } from '@/hooks/useScenarioSpec'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCanvasModeValue } from '@/contexts/canvasModeContext'
import {
  updatePathSpec,
  updateScenarioSummary,
} from '@/lib/scenarioSpecMutations'
import { PATH_TYPE_LABELS } from '@/lib/pathTypeTheme'

/**
 * The scenario's properties — and the only surface its PATHS have.
 *
 * The scenario itself owns one editable field, which on its own would not earn
 * a drawer. Its paths are why this exists: 38 of them across the blueprint,
 * each owning `summary` (when this route applies) and `note` (the author's
 * aside), and a path is a label rather than a shape, so there is nowhere on
 * the canvas to hang an affordance for it.
 */
export function ScenarioPanel({
  scenarioId,
  onClose,
}: {
  scenarioId: string
  onClose: () => void
}) {
  const result = useScenarioSpec(scenarioId)
  const scenario = result.status === 'ready' ? result.data : null

  return (
    <>
      <PanelHeader
        crumbs={[scenario?.phaseName ?? 'Scenario']}
        title="Scenario properties"
        description="Summary, and the paths in this scenario"
        closeLabel="Close scenario properties"
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 blueprint-scroll">
        {scenario ? (
          <ScenarioPanelBody
            key={scenario.id}
            scenario={scenario}
            onDone={onClose}
          />
        ) : result.status === 'error' ? (
          <p className="text-sm text-muted-foreground">
            That scenario could not be loaded.
          </p>
        ) : (
          <PanelLoading />
        )}
      </div>
      <PanelFooterHost id={SCENARIO_PANEL_FOOTER_ID} />
    </>
  )
}

/** "1 path" / "2 paths" — the panels' one counting voice. */
function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

type PathForm = { summary: string; note: string }
type FormState = {
  summary: string
  paths: Record<string, PathForm>
}

function buildBaseline(scenario: ScenarioSpec): FormState {
  return {
    summary: scenario.summary,
    paths: Object.fromEntries(
      scenario.paths.map((path) => [
        path.id,
        { summary: path.summary, note: path.note },
      ]),
    ),
  }
}

function ScenarioPanelBody({
  scenario,
  onDone,
}: {
  scenario: ScenarioSpec
  onDone: () => void
}) {
  const { client, canWrite } = useSupabase()
  const canEdit = useCanvasModeValue() === 'design' && canWrite

  const [baseline] = useState<FormState>(() => buildBaseline(scenario))
  const [form, setForm] = useState<FormState>(baseline)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // One path open at a time — the ledger's step-groups precedent. A scenario
  // averages under two paths, so this is about keeping `note` from competing
  // with `summary` for attention rather than about saving space.
  const [openPath, setOpenPath] = useState<string[]>(
    scenario.paths[0] ? [scenario.paths[0].id] : [],
  )
  const [footerHost, setFooterHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot DOM lookup of the portal host; it only exists after the panel's first commit
    setFooterHost(document.getElementById(SCENARIO_PANEL_FOOTER_ID))
  }, [])

  const setPath = (pathId: string, key: keyof PathForm, value: string) =>
    setForm((current) => ({
      ...current,
      paths: {
        ...current.paths,
        [pathId]: { ...current.paths[pathId], [key]: value },
      },
    }))

  const changedPaths = scenario.paths.filter((path) => {
    const now = form.paths[path.id]
    const was = baseline.paths[path.id]
    return now.summary !== was.summary || now.note !== was.note
  })
  const summaryChanged = form.summary !== baseline.summary
  const changed = summaryChanged || changedPaths.length > 0

  const handleSave = async () => {
    if (!client || busy || !changed) return
    setBusy(true)
    setError(null)
    try {
      // One ledger entry per row that actually moved: the scenario and each
      // path are separate rows with separate reverts, and a single "edited the
      // scenario" entry could not put any one of them back.
      if (summaryChanged) {
        await updateScenarioSummary(
          client,
          scenario.id,
          form.summary,
          baseline.summary,
        )
      }
      for (const path of changedPaths) {
        await updatePathSpec(
          client,
          path.id,
          form.paths[path.id],
          baseline.paths[path.id],
        )
      }
      invalidateQueries(`scenario-spec:${scenario.id}`)
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
        badge={<PanelKindBadge label="Scenario" />}
        title={scenario.name}
        meta={`${plural(scenario.paths.length, 'path')} · ${plural(
          scenario.stepCount,
          'step',
        )} · ${plural(scenario.cellCount, 'cell')}`}
      />

      <PanelTextareaField
        label="Summary"
        hint="The situation this blueprint covers."
        value={form.summary}
        rows={2}
        disabled={!canEdit}
        onChange={(next) =>
          setForm((current) => ({ ...current, summary: next }))
        }
      />

      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1 text-2xs font-medium text-muted-foreground">
          Paths
          {/* Why the layout control is absent, said once, on request —
              rather than a tinted banner explaining it on every open. */}
          <PanelHint label="Where the layout is set">
            How the paths are laid out — one at a time, side by side, merged —
            is a view preference, set by the compare control on the canvas. A
            properties panel is the wrong place to change what you are
            currently looking at.
          </PanelHint>
        </span>
        <Accordion value={openPath} onValueChange={setOpenPath}>
          {scenario.paths.map((path) => (
            <AccordionItem key={path.id} value={path.id}>
              <AccordionTrigger className="w-full min-w-0 gap-1.5 py-2 hover:no-underline">
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {path.name}
                  </span>
                  <span className="shrink-0 text-2xs font-normal text-muted-foreground">
                    {PATH_TYPE_LABELS[path.pathType]}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-3 pb-3">
                  <PanelTextareaField
                    label="Route"
                    hint="When this route applies — the condition that puts someone on it."
                    placeholder="e.g. the student joins on time"
                    value={form.paths[path.id].summary}
                    rows={2}
                    disabled={!canEdit}
                    onChange={(next) => setPath(path.id, 'summary', next)}
                  />
                  {/*
                    The note is the author's aside, and it is styled quieter so
                    it can never be mistaken for a fact about the service. That
                    distinction is the whole reason the two columns both exist.
                  */}
                  <PanelTextareaField
                    label="Author note"
                    hint="An aside — an open question, provenance, working state. Not a fact about the service."
                    placeholder="e.g. confirm the 10-minute hold with ops"
                    value={form.paths[path.id].note}
                    rows={2}
                    disabled={!canEdit}
                    onChange={(next) => setPath(path.id, 'note', next)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

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
