import { cn } from '@/lib/utils'
import type { BlueprintLayerStyle } from '@/lib/blueprintTheme'
import type { CSSProperties } from 'react'

export const BLUEPRINT_CELL_TEXT_COLOR = '#000000'
export const BLUEPRINT_CELL_BORDER_COLOR = '#000000'

function normalizeHex(hex: string): string {
  return hex.trim().toUpperCase()
}

function hexToHsl(hex: string): [h: number, s: number, l: number] {
  const normalized = normalizeHex(hex)
  const r = parseInt(normalized.slice(1, 3), 16) / 255
  const g = parseInt(normalized.slice(3, 5), 16) / 255
  const b = parseInt(normalized.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      default:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return [h * 360, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2
  let r = 0
  let g = 0
  let b = 0

  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** WCAG 2.x relative luminance of a 6-digit sRGB hex. */
function relativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex)
  const channel = (offset: number) => {
    const c = parseInt(normalized.slice(offset, offset + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

export function getContrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Minimum contrast a focus ring owes its own cell — WCAG 2.2 SC 1.4.11. */
export const CELL_RING_MIN_CONTRAST = 3

/**
 * Pick the lightness closest to `preferred` whose colour still clears
 * `CELL_RING_MIN_CONTRAST` against `fill`.
 *
 * The ring drawn on a blueprint cell is the focus affordance on the app's
 * most-used control, so it owes SC 1.4.11 against the fill it outlines. The
 * previous fixed floor (`max(l * 0.54, 36)`) measured 1.86:1 on chartreuse and
 * failed on five of the eight lane fills. Searching keeps the ring as close to
 * the fill's own tone as the requirement allows, rather than forcing every lane
 * to one pessimistic dark value.
 *
 * Darkens by default; lightens instead when the fill is dark enough that no
 * darker tone can reach the target.
 */
function solveRingLightness(
  hue: number,
  saturation: number,
  preferred: number,
  fill: string,
  target = CELL_RING_MIN_CONTRAST + 0.05,
): string {
  const at = (lightness: number) => hslToHex(hue, saturation, lightness)

  if (getContrastRatio(at(preferred), fill) >= target) return at(preferred)

  // `bound` is the extreme that definitely passes if anything does.
  const darkenable = getContrastRatio(at(0), fill) >= target
  const bound = darkenable ? 0 : 100
  if (!darkenable && getContrastRatio(at(100), fill) < target) {
    // Mid-luminance fill: neither extreme clears 3:1 at this saturation.
    // Fall back to the higher-contrast extreme rather than returning a value
    // that silently fails.
    return getContrastRatio(at(0), fill) >= getContrastRatio(at(100), fill)
      ? at(0)
      : at(100)
  }

  let pass = bound
  let fail = preferred
  for (let i = 0; i < 20; i += 1) {
    const mid = (pass + fail) / 2
    if (getContrastRatio(at(mid), fill) >= target) pass = mid
    else fail = mid
  }
  return at(pass)
}

/**
 * Rescale an HSL saturation so the *absolute* channel spread survives a
 * lightness change.
 *
 * HSL saturation is lightness-relative: the RGB spread it produces is
 * `s * (1 - |2L - 1|)`. Carrying a near-grey's saturation down to a darker ring
 * therefore amplifies it — 8% at L=95 is a 2/255 spread, but 8% at L=58 is
 * 19/255. Since a near-grey's hue is itself a rounding artefact, that turned
 * `#F2F2F4` into a blue-grey ring and `#F4F2F2` into a red-grey one, 240° apart.
 */
function saturationPreservingChroma(
  saturation: number,
  fromLightness: number,
  toLightness: number,
): number {
  const reach = (l: number) => 1 - Math.abs((2 * l) / 100 - 1)
  const to = reach(toLightness)
  if (to <= 0) return saturation
  return Math.min(saturation, (saturation * reach(fromLightness)) / to)
}

/** Per-cell interaction tones — same hue as fill, tuned for hover/pressed/focus. */
export function getBlueprintCellInteractionColors(fill: string): {
  bg: string
  bgHover: string
  bgPressed: string
  ring: string
  ringSoft: string
} {
  const [h, s, l] = hexToHsl(fill)

  // Neutral visual cells — keep grey family.
  //
  // Saturation is clamped to the source rather than raised to a fixed 14/10.
  // For a near-grey, `max - min` is a rounding artefact, so `h` is decided by
  // ±1 in the last hex digit; raising chroma amplified that into a visible hue
  // (#F2F2F4 produced a blue-grey ring, #F4F2F2 a red-grey one, 240° apart).
  if (s < 10) {
    return {
      bg: fill,
      bgHover: hslToHex(h, s, l * 0.94),
      bgPressed: hslToHex(h, Math.min(s + 6, 18), l * 0.86),
      ring: hslToHex(h, saturationPreservingChroma(s, l, 42), 42),
      ringSoft: solveRingLightness(
        h,
        saturationPreservingChroma(s, l, 58),
        58,
        fill,
      ),
    }
  }

  const isVivid = s > 45 && l < 82
  const hoverLightness = isVivid ? l * 0.88 : l > 88 ? l * 0.91 : l * 0.93
  const pressedLightness = isVivid ? l * 0.78 : l > 88 ? l * 0.84 : l * 0.86
  const hoverSat = isVivid
    ? Math.min(s * 1.04, 90)
    : Math.min(s * 1.1, 92)
  const pressedSat = isVivid
    ? Math.min(s * 1.08, 92)
    : Math.min(s * 1.16, 94)
  const ringSat = Math.min(s * 1.3, 88)
  const ringSoftSat = Math.min(s * 1.18, 82)

  return {
    bg: fill,
    bgHover: hslToHex(h, hoverSat, hoverLightness),
    bgPressed: hslToHex(h, pressedSat, pressedLightness),
    ring: hslToHex(h, ringSat, Math.max(l * 0.42, 26)),
    ringSoft: solveRingLightness(h, ringSoftSat, Math.max(l * 0.54, 36), fill),
  }
}

export function getBlueprintCellInteractionStyle(
  fill: string,
): Record<string, string> {
  const colors = getBlueprintCellInteractionColors(fill)
  return {
    '--blueprint-cell-bg-origin': colors.bg,
    '--blueprint-cell-bg': colors.bg,
    '--blueprint-cell-bg-hover': colors.bgHover,
    '--blueprint-cell-bg-pressed': colors.bgPressed,
    '--blueprint-cell-ring': colors.ring,
    '--blueprint-cell-ring-soft': colors.ringSoft,
  }
}

/** @deprecated Use getBlueprintCellInteractionColors().ring */
export function getBlueprintCellRingColor(fill: string): string {
  return getBlueprintCellInteractionColors(fill).ring
}

export function getBlueprintCellSurfaceStyle(
  fill: string,
  extra?: CSSProperties,
): CSSProperties {
  return {
    backgroundColor: fill,
    color: BLUEPRINT_CELL_TEXT_COLOR,
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
