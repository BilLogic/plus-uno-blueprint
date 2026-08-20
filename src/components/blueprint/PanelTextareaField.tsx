import { Field } from '@/components/blueprint/panelShell'

/**
 * A multi-line spec field.
 *
 * A bare `<textarea>` with the cell panel's exact treatment, NOT
 * `input-group.tsx`: the inventory reserves that for the composer, where the
 * group owns the border and the single focus ring.
 */
export function PanelTextareaField({
  label,
  hint,
  value,
  rows = 3,
  disabled,
  placeholder,
  onChange,
}: {
  label: string
  hint: string
  value: string
  rows?: number
  disabled: boolean
  placeholder?: string
  onChange: (next: string) => void
}) {
  return (
    <Field label={label} hint={hint}>
      {disabled ? (
        // Read-only takes the cell panel's value treatment — `text-sm
        // text-foreground/80`, the same step CellContentSection and
        // CellOverviewSpec render every authored value at. A disabled
        // textarea reads as a broken input; prose reads as prose.
        <p className="text-sm whitespace-pre-wrap text-foreground/80">
          {value || <span className="text-muted-foreground">Not specified.</span>}
        </p>
      ) : (
        <textarea
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          // Copied verbatim from CellPanelEditor's multi-line treatment. NOT
          // `input-group.tsx` — the inventory reserves that for the composer,
          // where the group owns the border and the single focus ring.
          className="w-full resize-y rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      )}
    </Field>
  )
}
