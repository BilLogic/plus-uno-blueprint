import type { PathType } from '@/types/database'

export type PathListItem = {
  id: string
  name: string
  path_type: PathType
}

export function defaultSelectedPathIds(paths: PathListItem[]): string[] {
  const preferred = paths.find((p) => p.path_type === 'happy') ?? paths[0]
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
