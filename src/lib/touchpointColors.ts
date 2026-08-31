import type { TouchpointTone } from '@/lib/blueprintCellStyle'

/**
 * DEFAULT family per touchpoint, not a styling decision.
 *
 * A touchpoint's colour is meant to be chosen by whoever owns the blueprint —
 * "Zoom is blue" is a product fact, not a palette one. There is nowhere to
 * store that yet: a touchpoint is a parsed substring of `cells.content`, so
 * there is no row to attach a colour to. Until a `touchpoints` table exists,
 * this map is the seed, and `getTouchpointTone` already takes the override that
 * will carry the stored value.
 *
 * A touchpoint renders at step 400, one paler than the step-500 lane it sits in, so
 * it reads as an object on the cell rather than as another cell.
 */
export const TOUCHPOINT_COLORS = {
  'Clearance obtainment guide': 'gold',
  'Dev Tools': 'indigo',
  Email: 'purple',
  Figma: 'purple',
  'Google Docs/ Slides': 'crimson',
  'Google Form': 'gold',
  'Google Quiz': 'red',
  'Google Quiz embedded in Notion': 'red',
  'Google Quizzes': 'tomato',
  Handshake: 'indigo',
  'Marketing Website': 'indigo',
  Notion: 'gold',
  'On-campus booth': 'yellow',
  'PLUS App': 'yellow',
  Posters: 'gold',
  Slack: 'tomato',
  'Social Media': 'crimson',
  'Workday (Employee View)': 'indigo',
  'Workday (Employer View)': 'indigo',
  Workday: 'indigo',
  Bank: 'tomato',
  Zoom: 'indigo',
  'Zoom Recording': 'purple',
} as const satisfies Record<string, TouchpointTone>

export type TouchpointColorName = keyof typeof TOUCHPOINT_COLORS

const TECH_LABEL_ALIASES: Record<string, TouchpointColorName> = {
  'plus app': 'PLUS App',
  workday: 'Workday (Employee View)',
  'workday (employee view)': 'Workday (Employee View)',
  'workday (employer view)': 'Workday (Employer View)',
  // Kept as aliases, not as names: PLUS stopped using Pencil, and any row or
  // slice still spelling the old pair should resolve to the one tool that is
  // left rather than mint a second touchpoint.
  'zoom/pencil': 'Zoom',
  'zoom/ pencil': 'Zoom',
  // A touchpoint names the THING; which form, which profile, which tooling is the
  // summary's job. These are the labels that carried their own specification
  // until Aug 2026, kept so an older slice still resolves.
  'handshake employer profile': 'Handshake',
  'google form application': 'Google Form',
  'acceptance form (google form)': 'Google Form',
  'tutor sign-up form (google form)': 'Google Form',
}

function isLegacyZoomPencilLabel(label: string): boolean {
  return /^zoom\s*\/\s*pencil$/i.test(label.trim())
}

const LOWER_TO_CANONICAL = Object.fromEntries(
  (Object.keys(TOUCHPOINT_COLORS) as TouchpointColorName[]).map((name) => [
    name.toLowerCase(),
    name,
  ]),
) as Record<string, TouchpointColorName>

/** Unknown tech names fall back to a deterministic family from this set. */
const EXTENDED_FALLBACK_TONES = [
  'indigo',
  'gold',
  'crimson',
  'purple',
  'tomato',
  'yellow',
  'red',
] as const satisfies readonly TouchpointTone[]

function hashLabel(label: string): number {
  let hash = 0
  for (const char of label) {
    hash = (hash + char.charCodeAt(0)) | 0
  }
  return Math.abs(hash)
}

/** Resolve a raw touchpoint label to its canonical registry key when possible. */
export function normalizeTouchpointLabel(label: string): string {
  const trimmed = label.trim()
  if (isLegacyZoomPencilLabel(trimmed)) return 'Zoom'

  const lower = trimmed.toLowerCase()
  return TECH_LABEL_ALIASES[lower] ?? LOWER_TO_CANONICAL[lower] ?? trimmed
}

/**
 * The Radix family a touchpoint draws from.
 *
 * `chosen` wins when present — it is the seam the stored per-touchpoint colour
 * will arrive through, so adding the table later needs no restructuring here.
 */
export function getTouchpointTone(
  label: string,
  chosen?: TouchpointTone,
): TouchpointTone {
  if (chosen) return chosen
  const canonical = normalizeTouchpointLabel(label)
  const known = TOUCHPOINT_COLORS[canonical as TouchpointColorName]
  if (known) return known

  return EXTENDED_FALLBACK_TONES[
    hashLabel(canonical) % EXTENDED_FALLBACK_TONES.length
  ]
}
