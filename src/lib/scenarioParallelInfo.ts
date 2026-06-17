import { GOAL_SETTING_SCENARIO_ID } from '@/data/goalSettingHappyPathFallback'
import { HELP_REQUEST_SCENARIO_ID } from '@/data/helpRequestHappyPathFallback'
import { WARM_UP_SCENARIO_ID } from '@/data/blueprintFallbacks'
import type { Slide } from '@/types/slides'

export { GOAL_SETTING_SCENARIO_ID }

const PARALLEL_TOOLTIPS_BY_ID: Record<string, string> = {
  [WARM_UP_SCENARIO_ID]:
    'This scenario can run in parallel with the Goal-Setting and Help Request scenarios.',
  [GOAL_SETTING_SCENARIO_ID]:
    'This scenario can run in parallel with the Warm-Up and Help Request scenarios.',
  [HELP_REQUEST_SCENARIO_ID]:
    'This scenario can run in parallel with the Warm-Up and Goal-Setting scenarios.',
}

const PARALLEL_TOOLTIPS_BY_LABEL: Record<string, string> = {
  'warm-up': PARALLEL_TOOLTIPS_BY_ID[WARM_UP_SCENARIO_ID]!,
  'goal-setting phase': PARALLEL_TOOLTIPS_BY_ID[GOAL_SETTING_SCENARIO_ID]!,
  'help request': PARALLEL_TOOLTIPS_BY_ID[HELP_REQUEST_SCENARIO_ID]!,
}

export function getScenarioParallelTooltip(
  slide: Pick<Slide, 'id' | 'label'>,
): string | null {
  return (
    PARALLEL_TOOLTIPS_BY_ID[slide.id] ??
    PARALLEL_TOOLTIPS_BY_LABEL[slide.label.trim().toLowerCase()] ??
    null
  )
}
