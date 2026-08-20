import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import { parseValueProps } from '@/lib/valueProps'
import type { Json } from '@/types/database'

/**
 * The vocabulary the Value editor suggests from: the STAKEHOLDER REGISTRY
 * first, then any audience already written that the registry does not know.
 *
 * It used to be only the second half — every distinct string in
 * `value_props[].for` — which suggested the drift back at you: "tutor" and
 * "Regular Tutor" were offered as two audiences because they had been typed as
 * two. The registry is the answer to who exists; the leftovers stay in the
 * list so an author can see (and correct) what does not match it yet, rather
 * than losing a value that already exists.
 */
export function useValueAudiences(): QueryResult<string[]> {
  const fallback = useCallback(() => [], [])

  return useSupabaseQuery<string[]>(
    'value-audiences',
    async (client) => {
      const [registry, cells] = await Promise.all([
        client.from('stakeholders').select('name, aliases').order('name'),
        client.from('cells').select('value_props').not('value_props', 'is', null),
      ])
      if (registry.error) throw new Error(registry.error.message)
      if (cells.error) throw new Error(cells.error.message)

      const known = new Set<string>()
      const suggestions: string[] = []
      for (const row of registry.data ?? []) {
        suggestions.push(row.name)
        known.add(row.name.toLowerCase())
        for (const alias of row.aliases ?? []) known.add(alias.toLowerCase())
      }

      const leftovers = new Set<string>()
      for (const row of cells.data ?? []) {
        for (const entry of parseValueProps(row.value_props as Json)) {
          const name = entry.for.trim()
          if (name && !known.has(name.toLowerCase())) leftovers.add(name)
        }
      }

      return [
        ...suggestions,
        ...[...leftovers].sort((a, b) => a.localeCompare(b)),
      ]
    },
    fallback,
  )
}
