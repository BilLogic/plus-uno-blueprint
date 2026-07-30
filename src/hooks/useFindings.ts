import { DEV_FALLBACK_FINDINGS } from '@/data/devFindings'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import type { Finding } from '@/types/database'

/** Severity display order: critical first, unknown values last. */
const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  warn: 1,
  info: 2,
}

/** Panel order: severity (critical > warn > info), then newest first. */
export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const bySeverity =
      (SEVERITY_RANK[a.severity] ?? SEVERITY_RANK.info + 1) -
      (SEVERITY_RANK[b.severity] ?? SEVERITY_RANK.info + 1)
    if (bySeverity !== 0) return bySeverity
    return b.created_at.localeCompare(a.created_at)
  })
}

// TODO(dev-only): remove after DB findings exist — no-DB dev mode only.
const findingsFallback = (): Finding[] | null =>
  import.meta.env.DEV ? sortFindings(DEV_FALLBACK_FINDINGS) : null

/**
 * All findings for one service lifecycle (public SELECT), ordered by
 * severity (critical > warn > info) then `created_at` desc. With no explicit
 * `lifecycleId`, the first lifecycle by `created_at` is used — the same
 * resolution as `useSlices`. Bump `reloadToken` after a status flip.
 */
export function useFindings(
  lifecycleId?: string,
  reloadToken = 0,
): QueryResult<Finding[]> {
  return useSupabaseQuery<Finding[]>(
    `findings:${lifecycleId ?? 'first'}:${reloadToken}`,
    async (client) => {
      let resolvedLifecycleId = lifecycleId
      if (!resolvedLifecycleId) {
        const { data, error } = await client
          .from('service_lifecycles')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)
        if (error) throw new Error(error.message)
        resolvedLifecycleId = data?.[0]?.id
        if (!resolvedLifecycleId) return []
      }

      const { data, error } = await client
        .from('findings')
        .select('*')
        .eq('service_lifecycle_id', resolvedLifecycleId)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return sortFindings(data ?? [])
    },
    findingsFallback,
  )
}
