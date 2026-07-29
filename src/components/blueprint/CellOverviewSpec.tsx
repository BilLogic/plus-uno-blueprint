import { useState } from 'react'
import { Pencil, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineNotice } from '@/components/ui/inline-notice'
import { Input } from '@/components/ui/input'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCellSpec } from '@/hooks/useCellSpec'
import { updateWithConcurrency } from '@/lib/mutations'
import {
  parseValueProps,
  serializeValueProps,
  type ValueProp,
} from '@/lib/valueProps'

type SpecDraft = {
  functionText: string
  formText: string
  valueProps: ValueProp[]
}

function SpecSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <p className="text-sm whitespace-pre-wrap text-foreground/80">{text}</p>
    </section>
  )
}

type CellOverviewSpecProps = {
  /** Canonical (resolved) cell id; null when the cell is fallback-only. */
  cellId: string | null
}

/**
 * FUNCTION / FORM / VALUE spec block on the panel Overview tab. Sections are
 * hidden until authored; writers get one "✎ specify" affordance (or a hover
 * pencil once authored) that opens inline editing against the granted cell
 * columns via the concurrency helper.
 */
export function CellOverviewSpec({ cellId }: CellOverviewSpecProps) {
  const { client, configured, canWrite } = useSupabase()
  const [reloadToken, setReloadToken] = useState(0)
  const specResult = useCellSpec(configured ? cellId : null, reloadToken)
  const [draft, setDraft] = useState<SpecDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // No DB (or fallback-only cell): spec sections stay hidden quietly.
  if (!configured || !client || !cellId) return null
  if (specResult.status !== 'ready' || specResult.data === null) return null

  const spec = specResult.data
  const functionText = spec.function?.trim() ?? ''
  const formText = spec.form?.trim() ?? ''
  const valueProps = parseValueProps(spec.value_props)
  const hasAnySpec =
    functionText.length > 0 || formText.length > 0 || valueProps.length > 0

  if (!canWrite && !hasAnySpec) return null

  const beginEdit = () => {
    setNotice(null)
    setDraft({
      functionText,
      formText,
      valueProps: valueProps.length > 0 ? valueProps : [{ for: '', value: '' }],
    })
  }

  const handleSave = async () => {
    if (!draft || saving) return
    setSaving(true)
    setNotice(null)
    try {
      const outcome = await updateWithConcurrency(
        client,
        'cells',
        spec.id,
        {
          function: draft.functionText.trim() || null,
          form: draft.formText.trim() || null,
          value_props: serializeValueProps(draft.valueProps),
        },
        spec.updated_at,
      )
      if (outcome.conflict) {
        setNotice(
          outcome.current === null
            ? 'This cell was removed — the spec could not be saved.'
            : 'This cell changed elsewhere — reloading the latest spec.',
        )
        setReloadToken((token) => token + 1)
        setDraft(null)
        return
      }
      setDraft(null)
      setReloadToken((token) => token + 1)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  if (draft) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
        <label className="flex flex-col gap-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Function
          <textarea
            rows={2}
            value={draft.functionText}
            placeholder="What must this cell do?"
            className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:ring-1 focus:ring-ring"
            onChange={(event) =>
              setDraft({ ...draft, functionText: event.target.value })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Form
          <textarea
            rows={2}
            value={draft.formText}
            placeholder="What must it convey — look, feel, sound?"
            className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:ring-1 focus:ring-ring"
            onChange={(event) =>
              setDraft({ ...draft, formText: event.target.value })
            }
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Value
          </p>
          {draft.valueProps.map((entry, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <Input
                value={entry.for}
                placeholder="For…"
                aria-label="Value beneficiary"
                className="h-7 flex-1 text-xs"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    valueProps: draft.valueProps.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, for: event.target.value }
                        : row,
                    ),
                  })
                }
              />
              <Input
                value={entry.value}
                placeholder="Value…"
                aria-label="Value description"
                className="h-7 flex-[2] text-xs"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    valueProps: draft.valueProps.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, value: event.target.value }
                        : row,
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Remove value row"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setDraft({
                    ...draft,
                    valueProps: draft.valueProps.filter(
                      (_, rowIndex) => rowIndex !== index,
                    ),
                  })
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
            className="w-fit gap-1 text-xs text-muted-foreground"
            onClick={() =>
              setDraft({
                ...draft,
                valueProps: [...draft.valueProps, { for: '', value: '' }],
              })
            }
          >
            <Plus className="size-3" />
            Add value
          </Button>
        </div>
        {notice ? <InlineNotice variant="warning">{notice}</InlineNotice> : null}
        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDraft(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => {
              void handleSave()
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    )
  }

  if (!hasAnySpec) {
    return (
      <div className="flex flex-col gap-2">
        {notice ? <InlineNotice variant="warning">{notice}</InlineNotice> : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit gap-1.5 text-xs text-muted-foreground"
          onClick={beginEdit}
        >
          <Pencil className="size-3" />
          Specify function, form and value
        </Button>
      </div>
    )
  }

  return (
    <div className="group/spec relative flex flex-col gap-3">
      {notice ? <InlineNotice variant="warning">{notice}</InlineNotice> : null}
      {canWrite ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Edit spec"
          title="Edit spec"
          className="absolute top-0 right-0 text-muted-foreground opacity-0 transition-opacity group-hover/spec:opacity-100 focus-visible:opacity-100 hover:text-foreground"
          onClick={beginEdit}
        >
          <Pencil className="size-3" />
        </Button>
      ) : null}
      {functionText ? <SpecSection title="Function" text={functionText} /> : null}
      {formText ? <SpecSection title="Form" text={formText} /> : null}
      {valueProps.length > 0 ? (
        <section className="flex flex-col gap-1">
          <h3 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Value
          </h3>
          <ul className="flex flex-col gap-1">
            {valueProps.map((entry, index) => (
              <li key={index} className="text-sm leading-snug text-foreground/80">
                <span className="font-medium text-foreground">
                  {entry.for}
                </span>
                {entry.for && entry.value ? ' — ' : ''}
                {entry.value}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
