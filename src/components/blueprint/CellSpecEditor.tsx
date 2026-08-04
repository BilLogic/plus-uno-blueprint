import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { updateCellSpec } from '@/lib/cellSpecMutations'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import type { CellSpec } from '@/hooks/useCellSpec'
import { parseValueProps, type ValueProp } from '@/lib/valueProps'

/**
 * Inline editor for the cell's FUNCTION / FORM / VALUE spec.
 *
 * The pair is deliberate: *function* is what the cell has to accomplish
 * (role, responsibility, requirements); *form* is how it comes across
 * (communication, look, feel). Keeping them apart is what stops a spec from
 * collapsing into one paragraph of "what this does".
 */
export function CellSpecEditor({
  cellId,
  spec,
  onDone,
}: {
  cellId: string
  spec: CellSpec | null
  onDone: () => void
}) {
  const { client } = useSupabase()
  const [functionText, setFunctionText] = useState(spec?.function ?? '')
  const [formText, setFormText] = useState(spec?.form ?? '')
  const [valueProps, setValueProps] = useState<ValueProp[]>(() =>
    parseValueProps(spec?.value_props ?? null),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!client || busy) return
    setBusy(true)
    setError(null)
    try {
      await updateCellSpec(
        client,
        cellId,
        {
          function: functionText,
          form: formText,
          valueProps,
        },
        // Pre-edit values, captured as the revert state.
        {
          function: spec?.function ?? '',
          form: spec?.form ?? '',
          valueProps: parseValueProps(spec?.value_props ?? null),
        },
      )
      // The panel reads the spec through the shared query cache; drop this
      // cell's entry so the read view shows what was just written.
      invalidateQueries(`cell-spec:${cellId}`)
      onDone()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SpecField
        label="Function"
        hint="What this cell has to accomplish"
        value={functionText}
        onChange={setFunctionText}
      />
      <SpecField
        label="Form"
        hint="How it comes across"
        value={formText}
        onChange={setFormText}
      />

      <div className="flex flex-col gap-1.5">
        <FieldLabel label="Value" hint="Who gets what from it" />
        {valueProps.map((entry, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Input
              value={entry.for}
              placeholder="For…"
              className="h-7 w-28 shrink-0 text-xs"
              onChange={(event) =>
                setValueProps((props) =>
                  props.map((item, itemIndex) =>
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
                setValueProps((props) =>
                  props.map((item, itemIndex) =>
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
                setValueProps((props) =>
                  props.filter((_, itemIndex) => itemIndex !== index),
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
            setValueProps((props) => [...props, { for: '', value: '' }])
          }
        >
          <Plus className="size-3" />
          Add value
        </Button>
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-1.5">
        <Button type="button" size="sm" className="h-7 text-xs" disabled={busy} onClick={handleSave}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          disabled={busy}
          onClick={onDone}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

/** Label with its explanation folded into a hover tooltip, not inline text. */
function FieldLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="w-fit text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {label}
          </span>
        }
      />
      <TooltipContent side="left">{hint}</TooltipContent>
    </Tooltip>
  )
}

function SpecField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel label={label} hint={hint} />
      <textarea
        value={value}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </div>
  )
}
