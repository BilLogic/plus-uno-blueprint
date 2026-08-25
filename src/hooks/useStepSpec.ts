import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import { VISUAL_LAYER_ROLES } from '@/lib/blueprintLayout'
import { getLayerRole } from '@/lib/laneRoles'

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
  /**
   * The storyboard frames for this moment, with the lane each came from.
   *
   * The panel that opens from a storyboard cell has to SHOW the storyboard —
   * it is the face the reader clicked. The lane name rides along as quiet
   * provenance, not as the frame's meaning: the meaning is the summary below
   * it, which is what the caption on the canvas says too.
   */
  frames: { laneName: string; picture: string }[]
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
    async (client, signal) => {
      if (!stepId) return null

      const { data: step, error } = await client
        .from('steps')
        .select(
          'id, name, summary, scenario_id, scenarios!inner(name, phases!inner(name))',
        )
        .eq('id', stepId)
        .abortSignal(signal)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!step) return null

      const { data: memberships, error: membershipError } = await client
        .from('path_steps')
        .select('position, paths!inner(name, created_at)')
        .eq('step_id', stepId)
        .abortSignal(signal)
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
        .abortSignal(signal)
      if (countError) throw new Error(countError.message)

      const { data: pictured, error: pictureError } = await client
        .from('cells')
        .select('picture, lanes!inner(name, position, lane_role)')
        .eq('step_id', stepId)
        .not('picture', 'is', null)
        .abortSignal(signal)
      if (pictureError) throw new Error(pictureError.message)

      /*
        STORYBOARD lanes only, deduplicated.

        Every pictured cell used to qualify, so a tech cell's product logo
        turned up in the panel as if it were a frame of the story — a Zoom
        mark stacked under two drawings of people. A frame is what the
        storyboard row draws; a logo is a pill's decoration.

        The dedupe is because the same step is drawn once per path and the
        paths share their imagery.
      */
      const seen = new Set<string>()
      const frames: { laneName: string; picture: string }[] = []
      for (const row of (pictured ?? []) as unknown as Array<{
        picture: string | null
        lanes: { name: string; position: number; lane_role: string | null }
      }>) {
        const picture = row.picture?.trim()
        if (!picture || seen.has(picture)) continue
        const role = getLayerRole({
          name: row.lanes.name,
          role: row.lanes.lane_role,
        })
        if (!role || !(VISUAL_LAYER_ROLES as readonly string[]).includes(role)) {
          continue
        }
        seen.add(picture)
        frames.push({ laneName: row.lanes.name, picture })
      }

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
        frames,
      }
    },
    fallback,
  )
}
