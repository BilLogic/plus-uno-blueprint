import type { BlueprintCellFamily } from '@/lib/blueprintCellStyle'

/**
 * Stable Radix family per technology name — shared across every blueprint and
 * phase. Keys are canonical display labels (case-sensitive).
 *
 * Families rather than fills: a pill renders at step 400, one step paler than
 * the step-500 lane it sits in, so it reads as an object on the cell rather
 * than as another cell. Several tools share a family — the previous per-tool
 * hexes drew distinctions that carried no meaning.
 */
export const TECH_PILL_COLORS = {
  'Clearance obtainment guide': 'gold',
  'Dev Tools': 'blue',
  Email: 'violet',
  Figma: 'purple',
  'Google Docs/ Slides': 'pink',
  'Google Form Application': 'amber',
  'Google Quiz': 'red',
  'Google Quiz embedded in Notion': 'red',
  'Google Quizzes': 'green',
  Handshake: 'blue',
  'Handshake Employer Profile': 'indigo',
  'Marketing Website': 'blue',
  Notion: 'amber',
  'On-campus booth': 'lime',
  'PLUS App': 'lime',
  Posters: 'gold',
  Slack: 'orange',
  'Social Media': 'crimson',
  'Workday (Employee View)': 'indigo',
  'Workday (Employer View)': 'indigo',
  Workday: 'indigo',
  Bank: 'green',
  Zoom: 'blue',
  'Zoom Recording': 'purple',
  'Zoom/Pencil': 'blue',
} as const satisfies Record<string, BlueprintCellFamily>

export type TechPillName = keyof typeof TECH_PILL_COLORS

const TECH_LABEL_ALIASES: Record<string, TechPillName> = {
  'plus app': 'PLUS App',
  workday: 'Workday (Employee View)',
  'workday (employee view)': 'Workday (Employee View)',
  'workday (employer view)': 'Workday (Employer View)',
  'zoom/pencil': 'Zoom/Pencil',
  'zoom/ pencil': 'Zoom/Pencil',
}

function isZoomPencilLabel(label: string): boolean {
  return /^zoom\s*\/\s*pencil$/i.test(label.trim())
}

const LOWER_TO_CANONICAL = Object.fromEntries(
  (Object.keys(TECH_PILL_COLORS) as TechPillName[]).map((name) => [
    name.toLowerCase(),
    name,
  ]),
) as Record<string, TechPillName>

/** Unknown tech names fall back to a deterministic family from this set. */
const EXTENDED_FALLBACK_FAMILIES = [
  'violet',
  'green',
  'pink',
  'lime',
  'purple',
  'blue',
  'gold',
  'crimson',
  'indigo',
  'amber',
] as const satisfies readonly BlueprintCellFamily[]

function hashLabel(label: string): number {
  let hash = 0
  for (const char of label) {
    hash = (hash + char.charCodeAt(0)) | 0
  }
  return Math.abs(hash)
}

/** Resolve a raw pill label to its canonical registry key when possible. */
export function normalizeTechPillLabel(label: string): string {
  const trimmed = label.trim()
  if (isZoomPencilLabel(trimmed)) return 'Zoom/Pencil'

  const lower = trimmed.toLowerCase()
  return TECH_LABEL_ALIASES[lower] ?? LOWER_TO_CANONICAL[lower] ?? trimmed
}

/** The Radix family a tech pill draws from. */
export function getTechPillFamily(label: string): BlueprintCellFamily {
  const canonical = normalizeTechPillLabel(label)
  const known = TECH_PILL_COLORS[canonical as TechPillName]
  if (known) return known

  return EXTENDED_FALLBACK_FAMILIES[
    hashLabel(canonical) % EXTENDED_FALLBACK_FAMILIES.length
  ]
}
