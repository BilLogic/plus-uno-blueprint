import type { PathOption } from '@/components/blueprint/PathMultiSelect'
import type { PathListItem } from '@/lib/pathSelection'
import { getPathColorKey } from '@/lib/pathColorTheme'

export function getOverviewPathKey(path: Pick<PathListItem, 'path_type' | 'name'>): string {
  return getPathColorKey(path)
}

/** One entry per unique path name/type across all overview scenarios. */
export function collectOverviewPathOptions(
  pathsByScenario: Map<string, PathListItem[]>,
): PathOption[] {
  const byKey = new Map<string, PathOption>()

  for (const paths of pathsByScenario.values()) {
    for (const path of paths) {
      const key = getOverviewPathKey(path)
      if (!byKey.has(key)) {
        byKey.set(key, { ...path, id: key })
      }
    }
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Path options limited to the given scenario ids (focused phase or scenario). */
export function collectOverviewPathOptionsForScenarios(
  pathsByScenario: Map<string, PathListItem[]>,
  scenarioIds: readonly string[],
): PathOption[] {
  const scoped = new Map<string, PathListItem[]>()
  for (const scenarioId of scenarioIds) {
    const paths = pathsByScenario.get(scenarioId)
    if (paths?.length) scoped.set(scenarioId, paths)
  }
  return collectOverviewPathOptions(scoped)
}

export function isOverviewPathFilterChecked(
  pathKey: string,
  _pathsByScenario: Map<string, PathListItem[]>,
  activePathKeys: readonly string[],
): boolean {
  return activePathKeys.includes(pathKey)
}

export function toggleOverviewPathFilter(
  pathKey: string,
  _pathsByScenario: Map<string, PathListItem[]>,
  _getSelectedPathIds: (scenarioId: string) => string[],
  togglePathKey: (pathKey: string) => void,
): void {
  togglePathKey(pathKey)
}