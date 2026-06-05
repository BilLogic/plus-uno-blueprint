import { useCallback, useEffect, useState } from 'react'
import {
  pruneSelectedPathIds,
  togglePathInSelection,
  type PathListItem,
} from '@/lib/pathSelection'

export function usePathSelection(paths: PathListItem[]) {
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([])

  useEffect(() => {
    setSelectedPathIds((prev) =>
      pruneSelectedPathIds(prev.length > 0 ? prev : [], paths),
    )
  }, [paths])

  const togglePathSelection = useCallback((pathId: string) => {
    setSelectedPathIds((prev) => togglePathInSelection(prev, pathId))
  }, [])

  return { selectedPathIds, setSelectedPathIds, togglePathSelection }
}
