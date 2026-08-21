import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  SCENARIO_PANEL_FOOTER_ID,
  PanelFooterControls,
  PanelFooterHost,
  PanelHeader,
  PanelIdentity,
  PanelKindBadge,
  PanelLoading,
} from '@/components/blueprint/panelShell'
import { PanelHint } from '@/components/blueprint/PanelHint'
import { PanelTextareaField } from '@/components/blueprint/PanelTextareaField'
import { useScenarioSpec, type ScenarioSpec } from '@/hooks/useScenarioSpec'
import { usePanelFooterHost } from '@/hooks/usePanelFooterHost'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCanvasModeValue } from '@/contexts/canvasModeContext'
import {
  updatePathSpec,
  updateScenarioSummary,
} from '@/lib/scenarioSpecMutations'
import { getPathTypeSuffixIfNeeded } from '@/lib/pathTypeTheme'
import { PANEL_TEXT } from '@/lib/panelText'
import type { PathType } from '@/types/database'
import { cn } from '@/lib/utils'

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

/**
 * The path-type word to show beside a path's name, or null to show nothing.
 *
 * `named` is not a kind of path — it is what a path is called when it has no
 * archetype, so printing "Named path" beside "Set Goals" tells the reader
 * nothing they could act on. And a path literally called "Happy Path" does
 * not need "Happy path" repeated after it. `getPathTypeSuffixIfNeeded`
 * already encodes both rules for the compare labels; this is the same call.
 */
function pathTypeSuffix(path: { name: string; pathType: PathType }): string | null {
  return getPathTypeSuffixIfNeeded({ name: path.name, path_type: path.pathType })
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
  // The first path opens; the rest are one click away and stay open once
  // opened. A scenario averages under two paths, so nothing here is a space
  // problem.
  const [openPath, setOpenPath] = useState<string[]>(
    scenario.paths[0] ? [scenario.paths[0].id] : [],
  )
  const footerHost = usePanelFooterHost(SCENARIO_PANEL_FOOTER_ID)

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
        // The paths are listed below and the steps are the columns on screen;
        // counting them again is noise. Nothing here earns the line.
        meta=""
      />

      {/* Directly under the title. It is the scenario's own sentence — what
          this whole board is about — and a reader arrives wanting it before
          they want the routes through it. It sat under the paths on the
          argument that the paths are why the drawer exists; that was right
          about the paths and wrong about the order, because an accordion of
          six routes pushes the one sentence describing all of them out of
          sight. */}
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
        <span className={cn('flex items-center gap-1', PANEL_TEXT.sectionLabel)}>
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
        {/* Several open at once: comparing two routes is the reason to read
            this panel, and an accordion that closes one to open the next
            makes that impossible. */}
        <Accordion multiple value={openPath} onValueChange={setOpenPath}>
          {scenario.paths.map((path) => (
            <AccordionItem key={path.id} value={path.id}>
              <AccordionTrigger className="w-full min-w-0 gap-1.5 py-2 hover:no-underline">
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {path.name}
                  </span>
                  {/* The type only when it ADDS something. `named` says
                      nothing (it is the absence of an archetype, not a kind),
                      and "Happy Path — Happy path" repeats the name back at
                      the reader. Same rule the overview frames already use. */}
                  {pathTypeSuffix(path) ? (
                    <span className="shrink-0 text-2xs font-normal text-muted-foreground">
                      {pathTypeSuffix(path)}
                    </span>
                  ) : null}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-3 pb-3">
                  <PanelTextareaField
                    label="Applies when"
                    hint="The condition that puts someone on this route rather than another."
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
