import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'

export type StepSpec = {
  id: string
  name: string
  /** What this moment is, across every lane — the storyboard's caption. */
  summary: string
  scenarioId: string
  scenarioName: string
  phaseName: string
  /** Path names that include this step, with its position on each. */
  positions: { pathName: string; position: number }[]
  cellCount: number
}

/**
 * One step: its summary, and where it sits.
 *
 * A step's position is NOT a column on `steps` — it lives on `path_steps`, per
 * path, and the same step legitimately sits at different positions on
 * different paths (11 of them do). So the panel reports the positions rather
 * than a position.
 */
export function useStepSpec(stepId: string | null): QueryResult<StepSpec | null> {
  const fallback = useCallback(() => null, [])

  return useSupabaseQuery<StepSpec | null>(
    `step-spec:${stepId ?? 'none'}`,
    async (client) => {
      if (!stepId) return null

      const { data: step, error } = await client
        .from('steps')
        .select(
          'id, name, summary, scenario_id, scenarios!inner(name, phases!inner(name))',
        )
        .eq('id', stepId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!step) return null

      const { data: memberships, error: membershipError } = await client
        .from('path_steps')
        .select('position, paths!inner(name, created_at)')
        .eq('step_id', stepId)
      if (membershipError) throw new Error(membershipError.message)

      const positions = ((memberships ?? []) as unknown as Array<{
        position: number
        paths: { name: string; created_at: string }
      }>)
        .sort((a, b) => a.paths.created_at.localeCompare(b.paths.created_at))
        .map((row) => ({ pathName: row.paths.name, position: row.position }))

      const { count, error: countError } = await client
        .from('cells')
        .select('id', { count: 'exact', head: true })
        .eq('step_id', stepId)
      if (countError) throw new Error(countError.message)

      const scenario = step.scenarios as unknown as {
        name: string
        phases: { name: string }
      }

      return {
        id: step.id,
        name: step.name,
        summary: step.summary ?? '',
        scenarioId: step.scenario_id,
        scenarioName: scenario.name,
        phaseName: scenario.phases.name,
        positions,
        cellCount: count ?? 0,
      }
    },
    fallback,
  )
}
