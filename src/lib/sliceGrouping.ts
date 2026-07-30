import type { DraftFrame } from '@/lib/sliceValidation'

/** Quick grouping — a starting point, not a mode. Everything stays editable. */
export function groupCells(
  cellIds: readonly string[],
  grouping: 'per-cell' | 'per-step' | 'single',
): DraftFrame[] {
  if (grouping === 'single') {
    return cellIds.length > 0
      ? [{ cells: [...cellIds], caption: '', narrative: '' }]
      : []
  }
  if (grouping === 'per-cell') {
    return cellIds.map((cell) => ({ cells: [cell], caption: '', narrative: '' }))
  }

  // Per step: cells sharing a step column become one screen, in the order the
  // steps were first encountered — which is the order the cells were picked.
  const byStep = new Map<string, string[]>()
  for (const cell of cellIds) {
    const element = document.querySelector(
      `[data-blueprint-cell="${CSS.escape(cell)}"]`,
    )
    const step = element?.getAttribute('data-step-index') ?? 'none'
    const bucket = byStep.get(step)
    if (bucket) bucket.push(cell)
    else byStep.set(step, [cell])
  }
  return [...byStep.values()].map((cells) => ({
    cells,
    caption: '',
    narrative: '',
  }))
}
