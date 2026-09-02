import { OptionSelect } from '@/components/blueprint/OptionSelect'
import {
  TOUCHPOINT_PROMINENCE_OPTIONS,
  type TouchpointProminenceValue,
} from '@/lib/touchpointProminence'

/** The sentinel the select uses for "no value" — `null` is not a string. */
const UNMARKED = ''

type Marked = Exclude<TouchpointProminenceValue, null>

const OPTIONS = TOUCHPOINT_PROMINENCE_OPTIONS.map((option) => ({
  value: option.value ?? UNMARKED,
  label: option.label,
}))

/**
 * Core, peripheral, or left alone.
 *
 * The same control as `StatusSelect` (#256) over a three-word vocabulary.
 *
 * The unmarked option is FIRST and is a real choice rather than a placeholder.
 * A select whose empty state is an unselectable prompt teaches that
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
    <OptionSelect
      value={value ?? UNMARKED}
      onChange={(next) => onChange(next === UNMARKED ? null : (next as Marked))}
      options={OPTIONS}
      disabled={disabled}
      className={className}
      id={id}
      aria-label={ariaLabel}
    />
  )
}
