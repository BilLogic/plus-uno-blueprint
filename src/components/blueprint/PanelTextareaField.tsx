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
      {disabled && !value ? (
        <p className="text-xs text-muted-foreground">Not specified.</p>
      ) : (
        <textarea
          value={value}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="w-full resize-y rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:border-transparent disabled:px-0 disabled:opacity-100"
        />
      )}
    </Field>
  )
}
