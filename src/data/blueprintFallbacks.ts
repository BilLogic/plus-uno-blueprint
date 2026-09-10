/**
 * The offline blueprint registry, with nothing registered.
 *
 * The template ships this module so a deployment that keeps blueprint content
 * OUTSIDE its database can serve a board anyway: `getBlueprintFallback` hands
 * over a registered `BlueprintData` when there is no database read to be had,
 * and `resolveBlueprintForScenario` merges it under the rows, DB-wins per
 * field. `scripts/generate_fallbacks.py --register` is what fills it.
 *
 * This deployment keeps no content outside its database. It used to: fifty
 * TypeScript files here carried PLUS's board, and the merge's only live effect
 * was appending 88 cells the rows did not have — it filled no blank content,
 * no blank frame and no blank summary anywhere, because no such case existed.
 * Those cells are rows now (migration 20260910010000), so there is nothing
 * left for a fallback to add and no second copy of the board to keep in step
 * with the first.
 *
 * What remains is the shape the callers import. Every answer here is the empty
 * one, and it is the true answer: ask this registry for a path and there is no
 * path, because the database has them all.
 */
import type { BlueprintData } from '@/types/blueprint'

/** Whether any blueprint content is registered for this scenario. */
export function hasBlueprintFallback(_scenarioId: string | undefined): boolean {
  return false
}

/** The registered paths for a scenario, ahead of any display filtering. */
export function getFallbackPathsForScenario(_scenarioId: string | undefined): Array<{
  id: string
  name: string
  summary: string | null
  note: string | null
  kind: BlueprintData['path']['kind']
}> {
  return []
}

/** Registered content for a path, before display filters. */
export function getRawBlueprintFallback(
  _scenarioId: string | undefined,
  _pathId?: string | null,
  _pathKind?: BlueprintData['path']['kind'],
): BlueprintData | null {
  return null
}

/** Registered content for a path, with display filters applied. */
export function getBlueprintFallback(
  _scenarioId: string | undefined,
  _pathId?: string | null,
  _pathKind?: BlueprintData['path']['kind'],
): BlueprintData | null {
  return null
}

/**
 * Union the database's paths with registered paths it does not have. With
 * nothing registered there is nothing to union, so the database's list is the
 * whole list — including its order, which registration used to be able to
 * change.
 */
export function mergePathsWithFallback<
  T extends {
    id: string
    name: string
    summary: string | null
    note: string | null
    kind: BlueprintData['path']['kind']
  },
>(_scenarioId: string | undefined, paths: readonly T[]): T[] {
  return [...paths]
}
