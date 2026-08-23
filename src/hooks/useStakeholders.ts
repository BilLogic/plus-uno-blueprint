import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import type { Stakeholder } from '@/types/database'

/**
 * What sort of party a registry row is.
 *
 * The first four are ACTORS — they appear in the blueprint as somebody in the
 * room, and can be a lane's `stakeholder_id`. `team` is an accountable group:
 * it reaches a lane through `owner_team` and is never its stakeholder, because
 * Design does not stand in a room.
 */
export type StakeholderKind =
  | 'recipient'
  | 'staff'
  | 'partner'
  | 'provider'
  | 'team'

export const STAKEHOLDER_KIND_LABELS: Record<StakeholderKind, string> = {
  recipient: 'Recipient',
  staff: 'Staff',
  partner: 'Partner',
  provider: 'Provider',
  team: 'Team',
}

/**
 * The service's cast list.
 *
 * One registry replaces four free-text fields that named the same people and
 * agreed with none of them — `lanes.name`, `cells.value_props[].for`,
 * `slices.actor` and the business model's partners. Every surface that used to
 * suggest from whatever strings happened to be in the data reads this instead,
 * so "tutor" and "Regular Tutor" stop being two people.
 */
export function useStakeholders(): QueryResult<Stakeholder[]> {
  const fallback = useCallback(() => [], [])

  return useSupabaseQuery<Stakeholder[]>(
    'stakeholders',
    async (client) => {
      const { data, error } = await client
        .from('stakeholders')
        .select('*')
        .order('kind')
        .order('name')
      if (error) throw new Error(error.message)
      return data ?? []
    },
    fallback,
  )
}
