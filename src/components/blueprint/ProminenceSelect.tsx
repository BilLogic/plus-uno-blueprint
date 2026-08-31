import {
  TOUCHPOINT_PROMINENCE_OPTIONS,
  type TouchpointProminenceValue,
} from '@/lib/touchpointProminence'
import { cn } from '@/lib/utils'

/** The sentinel the native select uses for "no value" — `null` is not a string. */
const UNMARKED = ''

/**
 * Core, peripheral, or left alone.
 *
 * A native `<select>` for the same reasons `StatusSelect` is one: three fixed
 * options, no search, and keyboard and touch behaviour for free.
 *
 * The unmarked option is FIRST and is a real choice rather than a placeholder.
 * A `<select>` whose empty state is an unselectable prompt teaches that
 * something is missing; here nothing is missing — most placements will never
 * be judged, and the author has to be able to go back to that state after
 * marking one by mistake. Its label says "nobody has judged this" so that
 * choosing it is not choosing a third degree of importance.
 */
export function ProminenceSelect({
  value,
  onChange,
  disabled,
  className,
  id,
  'aria-label': ariaLabel,
}: {
  value: TouchpointProminenceValue
  onChange: (next: TouchpointProminenceValue) => void
  disabled?: boolean
  className?: string
  id?: string
  'aria-label'?: string
}) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value ?? UNMARKED}
      disabled={disabled}
      onChange={(event) =>
        onChange(
          event.target.value === UNMARKED
            ? null
            : (event.target.value as Exclude<TouchpointProminenceValue, null>),
        )
      }
      className={cn(
        'h-7 w-fit rounded-md border border-input bg-transparent px-2 text-xs',
        'outline-none transition-colors hover:border-control-hover',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {TOUCHPOINT_PROMINENCE_OPTIONS.map((option) => (
        <option key={option.value ?? UNMARKED} value={option.value ?? UNMARKED}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
