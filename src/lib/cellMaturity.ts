/**
 * How far along the thing a cell describes is — one ordered axis.
 *
 * It began as two values, `planned` and `prototype`, and the boundary between
 * them did not order: both meant "not built", neither said how close. Worse,
 * the one case labelled `planned` was a card already merged on the dev branch
 * and sitting in QA, which is the most built a thing can be without being
 * live.
 *
 * So the ladder runs by the only question a reader actually asks — can I rely
 * on this today — and answers it in both directions: three rungs below
 * shipped, and two qualifications of shipped, because a working surface that
 * is failing or being withdrawn is not the same as one you can build on.
 */
export const CELL_MATURITY = [
  'explored',
  'planned',
  'in_progress',
  'at_risk',
  'deprecated',
] as const

export type CellMaturity = (typeof CELL_MATURITY)[number]

/** Is this describing something that does not exist yet? */
export function isUnbuilt(maturity: CellMaturity | null | undefined): boolean {
  return (
    maturity === 'explored' ||
    maturity === 'planned' ||
    maturity === 'in_progress'
  )
}

/** The state in the words a reader uses, for the panel. */
export const CELL_MATURITY_LABEL: Record<CellMaturity, string> = {
  explored: 'Explored — design only',
  planned: 'Planned — committed, not started',
  in_progress: 'In progress — built, not deployed',
  at_risk: 'At risk — shipped, failing',
  deprecated: 'Deprecated — on the way out',
}

/** What each rung means, for the panel's hover. */
export const CELL_MATURITY_MEANING: Record<CellMaturity, string> = {
  explored:
    'Designed and discussed, with no build card behind it. It may never happen.',
  planned:
    'Committed and carded, but no code exists yet.',
  in_progress:
    'Code exists and is in build or QA. Not deployed, so nobody is using it.',
  at_risk:
    'Shipped and in use, and failing in a way somebody has measured.',
  deprecated:
    'Still there and still working, and being taken away. Do not build on it.',
}
