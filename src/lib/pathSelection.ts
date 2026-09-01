import type { PathKind } from '@/types/database'
import type { EntityStatus } from '@/lib/entityStatus'

export type PathListItem = {
  id: string
  name: string
  summary: string | null
  note: string | null
  kind: PathKind
  /** How far along this route is. Drives the status badge on every path row. */
  status?: EntityStatus | null
}

/**
 * The path a scenario opens on: its happy one, or its first.
 *
 * There used to be a name check ahead of this — `/^happy\s*path$/i` — to break
 * ties when a scenario held several `happy` paths that could only be told
 * apart by which was literally called "Happy Path". No path is named after its
 * type any more (2026-08-21), so that branch could never match again, and
 * every scenario holds exactly one `happy` path for it to have disambiguated.
 */
export function pickPreferredPath<T extends { name: string; kind: PathKind }>(
  paths: readonly T[],
): T | undefined {
  if (paths.length === 0) return undefined
  return paths.find((path) => path.kind === 'happy') ?? paths[0]
}

export function defaultSelectedPathIds(paths: PathListItem[]): string[] {
  const preferred = pickPreferredPath(paths)
  return preferred ? [preferred.id] : []
}

export function pruneSelectedPathIds(
  selected: string[],
  paths: PathListItem[],
): string[] {
  return selected.filter((id) => paths.some((p) => p.id === id))
}

export function togglePathInSelection(
  selected: string[],
  pathId: string,
): string[] {
  if (selected.includes(pathId)) {
    return selected.filter((id) => id !== pathId)
  }
  return [...selected, pathId]
}

/** Preserve activation order when resolving selected paths to display items. */
export function itemsInSelectionOrder<T>(
  selectedPathIds: readonly string[],
  lookup: (pathId: string) => T | undefined,
): T[] {
  return selectedPathIds
    .map((id) => lookup(id))
    .filter((item): item is T => item !== undefined)
}
