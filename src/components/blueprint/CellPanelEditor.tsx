import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { OwnerTagSelect } from '@/components/blueprint/OwnerTagSelect'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCellContent } from '@/hooks/useCellContent'
import { useCellSpec } from '@/hooks/useCellSpec'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import { upsertCell } from '@/lib/authoringRpc'
import { updateCellContent } from '@/lib/cellContentMutations'
import { updateCellSpec } from '@/lib/cellSpecMutations'
import { parseValueProps, type ValueProp } from '@/lib/valueProps'

/** Where a not-yet-created cell would go — the draft the editor writes on Save. */
export type DraftCellTarget = {
  pathId: string
  layerId: string
  stepId: string
  layerName: string
  stepName: string
  stepIndex: number
  scenarioName?: string
  phaseName?: string
}

/** Label with its explanation folded into a hover tooltip, not inline text. */
function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  const labelText = (
    <span className="w-fit text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
      {label}
    </span>
  )
  return (
    <div className="flex flex-col gap-1">
      {hint ? (
        <Tooltip>
          <TooltipTrigger render={labelText} />
          <TooltipContent side="left">{hint}</TooltipContent>
        </Tooltip>
      ) : (
        labelText
      )}
      {children}
    </div>
  )
}

type FormState = {
  text: string
  description: string
  owner: string
  perceivedOwner: string
  functionText: string
  formText: string
  valueProps: ValueProp[]
}

/**
 * The whole cell in one form, one Save.
 *
 * This replaced two stacked editors (text/owners and function/form/value)
 * that each carried their own Save and Cancel — four buttons for one cell,
 * and a Save that only saved half of what was on screen. Here Save writes
 * everything that changed and Cancel discards everything, at page level.
 *
 * Two modes share the form: editing an existing cell, and a **draft** — a
 * cell that does not exist yet. The draft writes *nothing* until Save; a
 * cancelled draft never touches the database. That is the fix for creation
 * feeling broken: the row used to be written first and filled in later.
 */
export function CellPanelEditor({
  cellId,
  draft,
  fallbackDescription = '',
  onDone,
}: {
  /** Existing cell to edit; null when creating from a draft target. */
  cellId: string | null
  draft?: DraftCellTarget
  /**
   * What the panel displays as this cell's description when the column is
   * empty (tech cells keep prose in `links`). Seeded into the field so the
   * editor shows the same text the reader saw — saving moves it into the
   * column, which takes precedence from then on.
   */
  fallbackDescription?: string
  onDone: () => void
}) {
  const { configured } = useSupabase()
  const contentResult = useCellContent(configured && cellId ? cellId : null)
  const specResult = useCellSpec(configured && cellId ? cellId : null)

  if (cellId) {
    if (contentResult.status === 'loading' || specResult.status === 'loading') {
      return null
    }
    const content = contentResult.status === 'ready' ? contentResult.data : null
    const spec = specResult.status === 'ready' ? specResult.data : null
    if (!content) return null

    return (
      <CellPanelEditorForm
        key={cellId}
        cellId={cellId}
        draft={undefined}
        initial={{
          text: content.content,
          description: content.description ?? fallbackDescription,
          owner: content.owner ?? '',
          perceivedOwner: content.perceived_owner ?? '',
          functionText: spec?.function ?? '',
          formText: spec?.form ?? '',
          valueProps: parseValueProps(spec?.value_props ?? null),
        }}
        onDone={onDone}
      />
    )
  }

  if (!draft) return null
  return (
    <CellPanelEditorForm
      key={`${draft.layerId}:${draft.stepId}`}
      cellId={null}
      draft={draft}
      initial={{
        text: '',
        description: '',
        owner: '',
        perceivedOwner: '',
        functionText: '',
        formText: '',
        valueProps: [],
      }}
      onDone={onDone}
    />
  )
}

function CellPanelEditorForm({
  cellId,
  draft,
  initial,
  onDone,
}: {
  cellId: string | null
  draft: DraftCellTarget | undefined
  initial: FormState
  onDone: () => void
}) {
  const { client } = useSupabase()
  const [form, setForm] = useState<FormState>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const blocked = !form.text.trim()

  const contentChanged =
    form.text !== initial.text ||
    form.description !== initial.description ||
    form.owner !== initial.owner ||
    form.perceivedOwner !== initial.perceivedOwner
  const specChanged =
    form.functionText !== initial.functionText ||
    form.formText !== initial.formText ||
    JSON.stringify(form.valueProps) !== JSON.stringify(initial.valueProps)

  const handleSave = async () => {
    if (!client || busy || blocked) return
    setBusy(true)
    setError(null)
    try {
      let targetId = cellId
      if (!targetId) {
        // The draft becomes real here and only here. Cancel never writes.
        targetId = await upsertCell(client, {
          pathId: draft!.pathId,
          layerId: draft!.layerId,
          stepId: draft!.stepId,
          content: form.text.trim(),
        })
      }

      if (contentChanged || !cellId) {
        await updateCellContent(
          client,
          targetId,
          {
            content: form.text,
            description: form.description,
            owner: form.owner,
            perceivedOwner: form.perceivedOwner,
          },
          cellId
            ? {
                content: initial.text,
                description: initial.description,
                owner: initial.owner,
                perceivedOwner: initial.perceivedOwner,
              }
            : undefined,
        )
      }
      if (specChanged) {
        await updateCellSpec(
          client,
          targetId,
          {
            function: form.functionText,
            form: form.formText,
            valueProps: form.valueProps,
          },
          cellId
            ? {
                function: initial.functionText,
                form: initial.formText,
                valueProps: initial.valueProps,
              }
            : undefined,
        )
      }

      invalidateQueries('lifecycle-phases')
      invalidateQueries('canvas-blueprints')
      invalidateQueries(`cell-content:${targetId}`)
      invalidateQueries(`cell-spec:${targetId}`)
      onDone()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3" data-cell-panel-editor="">
      <Field label="Text" hint="What this cell says on the grid.">
        <Input
          value={form.text}
          autoFocus={cellId === null}
          onChange={(event) => set('text', event.target.value)}
        />
      </Field>

      <Field label="Description" hint="The longer version, for the panel.">
        <textarea
          value={form.description}
          rows={3}
          onChange={(event) => set('description', event.target.value)}
          className="w-full resize-y rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Owner" hint="The team accountable for this moment.">
          <OwnerTagSelect
            value={form.owner}
            ariaLabel="Owner"
            onChange={(value) => set('owner', value)}
          />
        </Field>
        <Field
          label="Perceived owner"
          hint="Who the person on the other side thinks they are dealing with. A gap between the two is a finding."
        >
          <OwnerTagSelect
            value={form.perceivedOwner}
            ariaLabel="Perceived owner"
            onChange={(value) => set('perceivedOwner', value)}
          />
        </Field>
      </div>

      <Field label="Function" hint="What this cell has to accomplish.">
        <textarea
          value={form.functionText}
          rows={2}
          onChange={(event) => set('functionText', event.target.value)}
          className="w-full resize-y rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </Field>
      <Field label="Form" hint="How it comes across.">
        <textarea
          value={form.formText}
          rows={2}
          onChange={(event) => set('formText', event.target.value)}
          className="w-full resize-y rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </Field>

      <Field label="Value" hint="Who gets what from it.">
        <div className="flex flex-col gap-1.5">
          {form.valueProps.map((entry, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <Input
                value={entry.for}
                placeholder="For…"
                className="h-7 w-24 shrink-0 text-xs"
                onChange={(event) =>
                  set(
                    'valueProps',
                    form.valueProps.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, for: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <Input
                value={entry.value}
                placeholder="…gets this"
                className="h-7 min-w-0 flex-1 text-xs"
                onChange={(event) =>
                  set(
                    'valueProps',
                    form.valueProps.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, value: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Remove value"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  set(
                    'valueProps',
                    form.valueProps.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 self-start px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() =>
              set('valueProps', [...form.valueProps, { for: '', value: '' }])
            }
          >
            <Plus className="size-3" />
            Add value
          </Button>
        </div>
      </Field>

      {blocked ? (
        <p className="text-xs text-muted-foreground">
          · A cell needs text — an empty one reads as a gap in the grid.
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2 border-t border-border/60 pt-3">
        <Button type="button" size="sm" disabled={busy || blocked} onClick={handleSave}>
          {busy ? 'Saving…' : cellId ? 'Save' : 'Create cell'}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
