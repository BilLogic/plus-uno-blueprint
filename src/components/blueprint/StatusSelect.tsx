import {
  ENTITY_STATUS,
  ENTITY_STATUS_LABEL,
  type EntityStatus,
} from '@/lib/entityStatus'
import { cn } from '@/lib/utils'

/**
 * Status, as an editable field.
 *
 * It shipped read-only: a `StatusBadge` in both View and Edit mode, so the
 * one governed vocabulary on the board was the one thing an author could not
 * set from the panel. A native `<select>` rather than a styled listbox — six
 * fixed options, no search, no multi-select, and it gets keyboard and touch
 * for free.
 *
 * The option text is the full label ("Live — in use today"), because a
 * dropdown is where a reader learns what the six words mean; the badge only
 * has room for one of them.
 */
export function StatusSelect({
  value,
  onChange,
  disabled,
  className,
  id,
}: {
  value: EntityStatus
  onChange: (next: EntityStatus) => void
  disabled?: boolean
  className?: string
  id?: string
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as EntityStatus)}
      className={cn(
        'h-7 w-fit rounded-md border border-input bg-transparent px-2 text-xs',
        'outline-none transition-colors hover:border-control-hover',
        // Inset, so a panel that clips (the accordion animates its height
        // with overflow-hidden) cannot shear the ring.
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {ENTITY_STATUS.map((status) => (
        <option key={status} value={status}>
          {ENTITY_STATUS_LABEL[status]}
        </option>
      ))}
    </select>
  )
}
