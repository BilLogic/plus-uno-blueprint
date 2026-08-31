import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BLUEPRINT_THEME } from '@/lib/blueprintTheme'
import { getBlueprintFillStyle } from '@/lib/pathColorTheme'
import { cn } from '@/lib/utils'
import type { CSSProperties } from 'react'

type BlueprintDividerBadgeProps = {
  label: string
  compact?: boolean
  /** Flat right edge so the rule can meet the badge flush (Figma-style). */
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
      // With a meaning behind it this is an explained label, and it wears the
      // three things this design system gives one: the help cursor, a focus
      // ring, and reachability by keyboard. A tooltip on a bare `<span>`
      // cannot be reached at all — the same gap `PanelTermLabel` closes, for
      // the reason docs/reference/panel-affordances.md § Hover is never the
      // only way in states. What it does NOT gain is a hover colour, because
      // that would read as clickable and it is not.
      {...(meaning ? { tabIndex: 0 } : {})}
      className={cn(
        'relative shrink-0 font-medium uppercase leading-none tracking-[0.08em]',
        compact ? 'text-3xs' : 'text-2xs',
        meaning &&
          'cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
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

/**
 * The filled divider label — a BADGE, and now one in code as well as in shape.
 *
 * It says what the line under it separates: one per divider, not drawn from a
 * set, never clickable. That is the definition of a badge, and it used to be
 * called a tag — a word this design system reserves for one value out of a
 * set, selectable or removable, which the owner control is and this is not.
 *
 * Built on `Badge` rather than a hand-rolled span so it inherits the one
 * geometry and, with it, the rule that a badge does not react to the pointer.
 * The overrides are the register (uppercase, letterspaced, tighter corners)
 * and the fill, which comes from the blueprint theme rather than a variant.
 */
export function BlueprintDividerBadge({
  label,
  compact,
  connected,
}: BlueprintDividerBadgeProps) {
  return (
    <Badge
      data-blueprint-fill
      className={cn(
        'h-auto border-transparent px-3 py-1.5 font-semibold uppercase leading-none tracking-[0.06em]',
        compact ? 'text-3xs' : 'text-2xs',
        connected ? 'rounded-l-sm rounded-r-none' : 'rounded-sm',
      )}
      style={getBlueprintFillStyle(BLUEPRINT_THEME.dividerBadgeBg)}
    >
      {label}
    </Badge>
  )
}

export type BlueprintDividerLineStyle = 'dashed' | 'dotted' | 'solid'

type BlueprintDividerRuleProps = {
  lineStyle: BlueprintDividerLineStyle
  className?: string
  style?: CSSProperties
}

const DIVIDER_LINE_COLOR = BLUEPRINT_THEME.divider

/** Horizontal rule extending from a divider badge — background-based so dashes start flush. */
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
