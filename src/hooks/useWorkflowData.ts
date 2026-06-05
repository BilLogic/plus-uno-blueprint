import { useEffect, useState } from 'react'
import { useSupabase } from '@/contexts/SupabaseProvider'
import {
  LIFECYCLE_LIST_SELECT,
  PATH_DETAIL_SELECT,
  PATH_LIST_SELECT,
  PHASE_LIST_SELECT,
} from '@/lib/workflowQueries'
import type { PathType } from '@/types/database'

export type PathListItem = {
  id: string
  name: string
  path_type: PathType
  service_scenario_id: string
  created_at: string
  updated_at: string
}

export function usePaths() {
  const { client, configured } = useSupabase()
  const [paths, setPaths] = useState<PathListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!configured || !client) {
      setLoading(false)
      setPaths([])
      return
    }

    let cancelled = false
    setLoading(true)

    void client
      .from('paths')
      .select(PATH_LIST_SELECT)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          setPaths([])
        } else {
          setError(null)
          setPaths((data ?? []) as PathListItem[])
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [client, configured])

  return { paths, loading, error, configured }
}

export function usePathDetail(pathId: string | undefined) {
  const { client, configured } = useSupabase()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pathId || !configured || !client) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void client
      .from('paths')
      .select(PATH_DETAIL_SELECT)
      .eq('id', pathId)
      .single()
      .then(({ data: row, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          setData(null)
        } else {
          setError(null)
          setData(row as Record<string, unknown>)
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [client, configured, pathId])

  return { data, loading, error }
}

export function usePhases() {
  const { client, configured } = useSupabase()
  const [phases, setPhases] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!configured || !client) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void client
      .from('phases')
      .select(PHASE_LIST_SELECT)
      .order('order_position')
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          setPhases([])
        } else {
          setError(null)
          setPhases((data ?? []) as Record<string, unknown>[])
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [client, configured])

  return { phases, loading, error, configured }
}

export function useServiceLifecycles() {
  const { client, configured } = useSupabase()
  const [lifecycles, setLifecycles] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!configured || !client) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void client
      .from('service_lifecycles')
      .select(LIFECYCLE_LIST_SELECT)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          setLifecycles([])
        } else {
          setError(null)
          setLifecycles((data ?? []) as Record<string, unknown>[])
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [client, configured])

  return { lifecycles, loading, error, configured }
}

/** @deprecated Use usePhases — kept for pages not yet renamed */
export function useServiceRequests() {
  return usePhases()
}
