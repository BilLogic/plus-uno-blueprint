import { cn } from '@/lib/utils'
import type { BlueprintLayerStyle } from '@/lib/blueprintTheme'
import type { CSSProperties } from 'react'

/**
 * A blueprint cell is a Radix family, and its states are steps of that family.
 *
 * This file used to derive hover / pressed / ring tones from a hex fill in
 * JavaScript — HSL conversion, a lightness search, and a binary contrast solver
 * to force the ring past 3:1. The scale already answers all of it: the step for
 * each role is a fixed choice, checked once in `palette.test.ts` against the
 * stylesheet rather than recomputed per cell per render. That check covers dark
 * mode too, which the solver never saw — it took a hex fill, and dark mode
 * never produced one.
 *
 * Values resolve through `var()`, so a cell is on the same tokens as the rest of
 * the app. Print stays light because colors.css scopes its `.dark` override to
 * `@media screen`.
 */
export type BlueprintCellFamily =
  | 'amber'
  | 'blue'
  | 'crimson'
  | 'gold'
  | 'gray'
  | 'green'
  | 'indigo'
  | 'lime'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'red'
  | 'slate'
  | 'violet'

/** Steps a cell uses, by role. */
export const CELL_STEP = {
  /** Resting surface. */
  surface: 500,
  hover: 600,
  pressed: 700,
  /**
   * Step 11, not the step-8 "border" step.
   *
   * Radix specifies step 8 as a border against the *app background* (steps 1–2).
   * On a step-5 surface — which is what a cell is — it measures 1.38:1 at worst
   * and fails SC 1.4.11 outright. Step 11 is the lowest step that clears 3:1
   * against step 5 across every family in both themes; worst case 3.60:1
   * (light/lime). `palette.test.ts` holds that line.
   */
  ring: 1100,
  /** High-contrast text. */
  text: 1200,
} as const

export function cellToken(
  family: BlueprintCellFamily,
  step: (typeof CELL_STEP)[keyof typeof CELL_STEP],
): string {
  return `var(--color-${family}-${step})`
}

/**
 * The grid's rules stay one neutral across every lane — a per-family border
 * would make a row of differently-tinted cells read as ragged rather than as
 * one table.
 */
export const BLUEPRINT_CELL_BORDER_COLOR = 'var(--color-gray-1200)'

/** Per-cell interaction tones — same family as the fill, stepped for each state. */
export function getBlueprintCellInteractionColors(
  family: BlueprintCellFamily,
): {
  bg: string
  bgHover: string
  bgPressed: string
  ring: string
  ringSoft: string
} {
  return {
    bg: cellToken(family, CELL_STEP.surface),
    bgHover: cellToken(family, CELL_STEP.hover),
    bgPressed: cellToken(family, CELL_STEP.pressed),
    ring: cellToken(family, CELL_STEP.ring),
    ringSoft: cellToken(family, CELL_STEP.ring),
  }
}

export function getBlueprintCellInteractionStyle(
  family: BlueprintCellFamily,
): Record<string, string> {
  const colors = getBlueprintCellInteractionColors(family)
  return {
    '--blueprint-cell-bg-origin': colors.bg,
    '--blueprint-cell-bg': colors.bg,
    '--blueprint-cell-bg-hover': colors.bgHover,
    '--blueprint-cell-bg-pressed': colors.bgPressed,
    '--blueprint-cell-ring': colors.ring,
    '--blueprint-cell-ring-soft': colors.ringSoft,
  }
}

export function getBlueprintCellSurfaceStyle(
  family: BlueprintCellFamily,
  extra?: CSSProperties,
): CSSProperties {
  return {
    backgroundColor: cellToken(family, CELL_STEP.surface),
    color: cellToken(family, CELL_STEP.text),
    borderColor: BLUEPRINT_CELL_BORDER_COLOR,
    ...extra,
  }
}

export function getBlueprintCellSurfaceStyleFromLane(
  laneStyle: BlueprintLayerStyle,
  extra?: CSSProperties,
): CSSProperties {
  return getBlueprintCellSurfaceStyle(laneStyle.lane, extra)
}

export function blueprintCellButtonClassName({
  compact = false,
  variant = 'cell',
  className,
}: {
  compact?: boolean
  variant?: 'cell' | 'pill' | 'visual'
  className?: string
} = {}) {
  const shared = cn(
    'h-auto w-full font-normal whitespace-normal shadow-none ring-offset-0',
    compact ? 'text-xs' : 'text-sm',
  )

  if (variant === 'pill') {
    return cn(
      shared,
      'rounded-full text-center leading-snug',
      compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
      className,
    )
  }

  if (variant === 'visual') {
    return cn(
      shared,
      'rounded-lg flex items-center justify-center',
      compact ? 'px-2 py-3' : 'px-3 py-4',
      className,
    )
  }

  return cn(
    shared,
    'rounded-lg flex-1 items-start justify-start text-left leading-relaxed',
    compact ? 'px-3 py-2.5' : 'px-4 py-3.5',
    className,
  )
}
