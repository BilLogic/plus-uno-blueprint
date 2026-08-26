import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BLUEPRINT_THEME } from '@/lib/blueprintTheme'
import { getBlueprintFillStyle } from '@/lib/pathColorTheme'
import { cn } from '@/lib/utils'
import type { CSSProperties } from 'react'

type BlueprintDividerTagProps = {
  label: string
  compact?: boolean
  /** Flat right edge so the rule can meet the pill flush (Figma-style). */
  connected?: boolean
}

/**
 * What each divider line means, in the words a service designer would use.
 *
 * These three lines are the whole grammar of a service blueprint and the
 * canvas states them as three unexplained captions. A reader who does not
 * already know the convention has nowhere to find out, which is exactly the
 * kind of thing a tooltip is for — the label names it, the tooltip says what
 * it separates.
 */
const DIVIDER_MEANINGS: Record<string, string> = {
  'line of interaction':
    'Above it, what the customer does. Below it, the staff and systems they interact with directly.',
  'line of visibility':
    'Everything below this line happens out of the customer\'s sight.',
  'line of internal interaction':
    'Below it, the support work that never touches the customer — the teams and systems the backstage relies on.',
}

/** Light label-rail divider caption — reference blueprint interaction/visibility rows. */
export function BlueprintDividerRailLabel({
  label,
  compact,
}: {
  label: string
  compact?: boolean
}) {
  const meaning = DIVIDER_MEANINGS[label.trim().toLowerCase()]
  const caption = (
    <span
      data-blueprint-row-header=""
      className={cn(
        'relative shrink-0 font-medium uppercase leading-none tracking-[0.08em]',
        compact ? 'text-3xs' : 'text-2xs',
      )}
      style={{ color: BLUEPRINT_THEME.dividerLabel }}
    >
      {label}
    </span>
  )
  if (!meaning) return caption
  return (
    <Tooltip>
      <TooltipTrigger render={caption} />
      <TooltipContent side="top" className="max-w-xs">
        {meaning}
      </TooltipContent>
    </Tooltip>
  )
}

/** Figma-style dark pill label for interaction / visibility divider rows. */
export function BlueprintDividerTag({
  label,
  compact,
  connected,
}: BlueprintDividerTagProps) {
  return (
    <span
      data-blueprint-fill
      className={cn(
        'inline-flex shrink-0 items-center px-3 py-1.5 font-semibold uppercase leading-none tracking-[0.06em]',
        compact ? 'text-3xs' : 'text-2xs',
        connected ? 'rounded-l-sm rounded-r-none' : 'rounded-sm',
      )}
      style={getBlueprintFillStyle(BLUEPRINT_THEME.dividerTagBg)}
    >
      {label}
    </span>
  )
}

export type BlueprintDividerLineStyle = 'dashed' | 'dotted' | 'solid'

type BlueprintDividerRuleProps = {
  lineStyle: BlueprintDividerLineStyle
  className?: string
  style?: CSSProperties
}

const DIVIDER_LINE_COLOR = BLUEPRINT_THEME.divider

/** Horizontal rule extending from a divider tag — background-based so dashes start flush. */
export function BlueprintDividerRule({
  lineStyle,
  className,
  style,
}: BlueprintDividerRuleProps) {
  const lineStyleProps: CSSProperties =
    lineStyle === 'dashed'
      ? {
          backgroundImage: `linear-gradient(to right, ${DIVIDER_LINE_COLOR} 0, ${DIVIDER_LINE_COLOR} 6px, transparent 6px, transparent 12px)`,
          backgroundSize: '12px 1px',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'left center',
        }
      : lineStyle === 'dotted'
        ? {
            backgroundImage: `linear-gradient(to right, ${DIVIDER_LINE_COLOR} 0, ${DIVIDER_LINE_COLOR} 2px, transparent 2px, transparent 6px)`,
            backgroundSize: '6px 1px',
            backgroundRepeat: 'repeat-x',
            backgroundPosition: 'left center',
          }
        : { backgroundColor: DIVIDER_LINE_COLOR }

  return (
    <div
      aria-hidden
      className={cn('h-px shrink-0 self-center', className)}
      style={{ ...lineStyleProps, ...style }}
    />
  )
}
