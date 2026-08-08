import { useEffect, useMemo, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { DelayedSpinner } from '@/components/ui/spinner'
import { useCanvasBlueprints } from '@/hooks/useCanvasBlueprints'
import { registerAgentUiContext } from '@/lib/agent/uiBridge'
import {
  buildScenarioReaderModel,
  type ReaderLaneEntry,
  type ReaderStep,
} from '@/lib/scenarioReader'
import { cn } from '@/lib/utils'
import type { BlueprintCell, BlueprintLayer } from '@/types/blueprint'
import { ordinalLabel } from '@/types/nav'

/**
 * The phone's reading of a blueprint: the 2-D board folded into a 1-D
 * journey. Time (the desktop's horizontal axis) becomes vertical scroll —
 * scrolling down IS moving forward through the steps — and the lane axis
 * survives inside each step as two bands split by the line of visibility.
 *
 * View-only by design: every user on mobile gets the visitor experience.
 * Cells open a bottom sheet with the cell's content; nothing here writes.
 */

type OpenCell = {
  cell: BlueprintCell
  layer: BlueprintLayer
  step: ReaderStep
}

/** Step ordinal in the reader's time-marker register — mono, uppercase,
 * letter-spaced. Steps ARE an ordered sequence, so the number is
 * information, not decoration. */
function StepEyebrow({ index, name }: { index: number; name: string }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur-sm">
      <p className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {ordinalLabel(index, name)}
      </p>
    </div>
  )
}

function LaneBand({
  entries,
  onOpenCell,
}: {
  entries: ReaderLaneEntry[]
  /** The band knows lanes and cells; which STEP it sits in is the caller's
   * business — the closure carries it. */
  onOpenCell: (cell: BlueprintCell, layer: BlueprintLayer) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {entries.map(({ layer, cells }) => {
        // Visual-only cells carry their content as a picture; a cell with
        // neither text nor picture is invisible on the canvas and stays
        // invisible here. A lane whose cells all vanish vanishes with them.
        const visible = cells.filter(
          (cell) => cell.content.trim() !== '' || cell.picture,
        )
        if (visible.length === 0) return null
        return (
          <div key={layer.id} className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {layer.name}
            </p>
            {visible.map((cell) => (
              <button
                key={cell.id}
                type="button"
                data-blueprint-cell={cell.id}
                data-blueprint-cell-interactive=""
                onClick={() => onOpenCell(cell, layer)}
                className={cn(
                  'w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left',
                  'text-sm text-foreground shadow-xs',
                  'transition-colors duration-(--motion-micro) motion-reduce:transition-none',
                  'active:bg-accent',
                )}
              >
                {cell.content.trim() !== '' ? cell.content : null}
                {cell.content.trim() === '' && cell.picture ? (
                  <img
                    src={cell.picture}
                    alt={`${layer.name} visual`}
                    loading="lazy"
                    decoding="async"
                    className="max-h-40 w-full rounded-md object-contain"
                  />
                ) : null}
                {cell.description ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                    {cell.description}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}

/** The bottom sheet a cell opens — the visitor read surface. Registers the
 * `cell-panel` UI-context contributor while open, so the agent's
 * `open_cell_panel` verification and `get_ui_state` stay truthful on the
 * reader too. */
function ReaderCellSheet({
  open,
  onClose,
}: {
  open: OpenCell | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    return registerAgentUiContext(
      'cell-panel',
      () =>
        `Cell panel (mobile reader): showing "${open.cell.content}" in lane "${open.layer.name}", step ${open.step.index} "${open.step.name}".`,
    )
  }, [open])

  // The ghost: content rendered during the exit animation. Clearing on
  // `onClose` alone would blank the sheet the instant it starts leaving —
  // an empty popover sliding off screen on every close.
  const [ghost, setGhost] = useState<OpenCell | null>(null)
  if (open && ghost !== open) setGhost(open)
  const shown = open ?? ghost
  // Picture-only cells have empty content — the sheet still needs an
  // accessible name, and the image IS the content, so it gets a real alt.
  const pictureOnly = shown !== null && shown.cell.content.trim() === ''
  const sheetTitle = shown
    ? pictureOnly
      ? `${shown.layer.name} visual`
      : shown.cell.content
    : ''

  return (
    <Drawer
      open={open !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      onOpenChangeComplete={(next) => {
        if (!next) setGhost(null)
      }}
      swipeDirection="down"
      // Peek ↔ full: opens at the reading height, drags up for the whole
      // cell, drags down past the peek to close. The handle is the cue.
      snapPoints={[0.45, 1]}
      defaultSnapPoint={0.45}
      showSwipeHandle
    >
      <DrawerContent className="border-t border-border/80 bg-popover">
        {shown ? (
          <div className="flex min-h-0 flex-col overflow-y-auto px-4 pb-8">
            <DrawerHeader className="px-0 pb-2">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {ordinalLabel(shown.step.index, shown.step.name)} ·{' '}
                {shown.layer.name}
              </p>
              <DrawerTitle className="text-left text-base">
                {sheetTitle}
              </DrawerTitle>
            </DrawerHeader>
            {shown.cell.description ? (
              <p className="text-sm text-muted-foreground">
                {shown.cell.description}
              </p>
            ) : null}
            {shown.cell.picture ? (
              <img
                src={shown.cell.picture}
                alt={pictureOnly ? sheetTitle : ''}
                loading="lazy"
                decoding="async"
                className="mt-3 w-full rounded-lg border border-border object-contain"
              />
            ) : null}
            {shown.cell.links.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {shown.cell.links.map((link, index) =>
                  link.url ? (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <span
                      key={index}
                      className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {link.label}
                    </span>
                  ),
                )}
              </div>
            ) : null}
            <p className="mt-6 text-xs text-muted-foreground">
              Viewing only — editing is available on desktop.
            </p>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  )
}

export function MobileScenarioReader({ scenarioId }: { scenarioId: string }) {
  const { blueprintsByScenario, pathsByScenario, blueprintsByPathId, loading } =
    useCanvasBlueprints(useMemo(() => [scenarioId], [scenarioId]))
  const paths = pathsByScenario.get(scenarioId) ?? []
  const preferred = blueprintsByScenario.get(scenarioId) ?? null

  // Path choice is reader-local and resets with the scenario. `null` means
  // "the preferred path" (the same one the desktop canvas leads with).
  // Render-time reset, not an effect — same idiom as the shell's tab latch.
  const [pathId, setPathId] = useState<string | null>(null)
  const [pathScenarioId, setPathScenarioId] = useState(scenarioId)
  if (pathScenarioId !== scenarioId) {
    setPathScenarioId(scenarioId)
    setPathId(null)
  }
  const blueprint =
    (pathId ? blueprintsByPathId.get(pathId) : null) ?? preferred

  const model = useMemo(
    () => (blueprint ? buildScenarioReaderModel(blueprint) : null),
    [blueprint],
  )
  const [openCell, setOpenCell] = useState<OpenCell | null>(null)

  if (loading && !model) {
    return (
      <div className="flex h-full items-center justify-center">
        <DelayedSpinner className="size-5 text-muted-foreground" />
      </div>
    )
  }
  if (!model) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-center text-sm text-muted-foreground">
          This scenario has no blueprint yet. Pick another from the menu.
        </p>
      </div>
    )
  }

  const stepName = (stepId: string) =>
    model.steps.find((step) => step.id === stepId)?.name ?? ''

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-4 pb-8">
      {paths.length > 1 ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto py-3">
          {paths.map((path) => {
            const active = path.id === (pathId ?? model.pathId)
            return (
              <button
                key={path.id}
                type="button"
                aria-pressed={active}
                onClick={() => setPathId(path.id)}
                className={cn(
                  'min-h-8 shrink-0 rounded-full border px-3 py-1 text-xs',
                  'transition-colors duration-(--motion-micro) motion-reduce:transition-none',
                  active
                    ? 'border-foreground/40 bg-foreground text-background'
                    : 'border-border bg-card text-muted-foreground',
                )}
              >
                {path.name}
              </button>
            )
          })}
        </div>
      ) : null}

      <ol className="flex flex-col">
        {model.steps.map((step) => (
          <li key={step.id} className="flex flex-col">
            <StepEyebrow index={step.index} name={step.name} />
            <div className="flex flex-col gap-3 py-3">
              <LaneBand
                entries={step.frontstage}
                onOpenCell={(cell, layer) => setOpenCell({ cell, layer, step })}
              />
              {step.frontstage.length > 0 && step.backstage.length > 0 ? (
                // The line of visibility — the blueprint's most load-bearing
                // convention, preserved inside every step.
                <div
                  className="flex items-center gap-2"
                  role="separator"
                  aria-label="Line of visibility"
                >
                  {/* AT reads the separator's label once; the visible text
                      and rules are presentation. */}
                  <div
                    aria-hidden
                    className="h-px flex-1 border-t border-dashed border-border"
                  />
                  <span
                    aria-hidden
                    className="text-3xs uppercase tracking-wider text-muted-foreground"
                  >
                    line of visibility
                  </span>
                  <div
                    aria-hidden
                    className="h-px flex-1 border-t border-dashed border-border"
                  />
                </div>
              ) : null}
              <LaneBand
                entries={step.backstage}
                onOpenCell={(cell, layer) => setOpenCell({ cell, layer, step })}
              />
              {step.triggersTo.length > 0 ? (
                // The desktop's trigger arrow, rotated with the time axis:
                // a vertical connector naming where this step leads.
                <div className="flex items-center gap-1.5 self-center text-xs text-muted-foreground">
                  <ArrowDown aria-hidden className="size-3.5" />
                  <span>
                    triggers {step.triggersTo.map(stepName).filter(Boolean).join(', ')}
                  </span>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <ReaderCellSheet open={openCell} onClose={() => setOpenCell(null)} />
    </div>
  )
}
