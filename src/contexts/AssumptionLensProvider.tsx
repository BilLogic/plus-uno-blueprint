import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AssumptionLensContext } from '@/contexts/assumptionLensContext'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useViewState } from '@/contexts/viewStateStore'

type AssumptionLensProviderProps = {
  children: ReactNode
}

/**
 * Owns the assumption-lens evidence counts: one fetch of the public
 * `evidence_counts` view per activation, held as a stable set and
 * invalidated only by Evidence-tab mutations (`refresh`).
 */
export function AssumptionLensProvider({
  children,
}: AssumptionLensProviderProps) {
  const { client, configured } = useSupabase()
  const { lens } = useViewState()
  const active = lens === 'assumption'
  const [version, setVersion] = useState(0)
  const [evidencedCellIds, setEvidencedCellIds] =
    useState<ReadonlySet<string> | null>(null)

  useEffect(() => {
    if (!active || !configured || !client) {
      return
    }

    let cancelled = false
    void client
      .from('evidence_counts')
      .select('cell_id, n')
      .then(({ data, error }) => {
        if (cancelled || error) return
        setEvidencedCellIds(
          new Set(
            (data ?? []).flatMap((row) =>
              row.cell_id && (row.n ?? 0) > 0 ? [row.cell_id] : [],
            ),
          ),
        )
      })

    return () => {
      cancelled = true
    }
  }, [active, client, configured, version])

  const refresh = useCallback(() => {
    setVersion((current) => current + 1)
  }, [])

  const value = useMemo(
    () => ({
      evidencedCellIds: active ? evidencedCellIds : null,
      refresh,
    }),
    [active, evidencedCellIds, refresh],
  )

  return (
    <AssumptionLensContext.Provider value={value}>
      {children}
    </AssumptionLensContext.Provider>
  )
}
