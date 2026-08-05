import blueprintSkill from '@/lib/agent/skill/skills/blueprint.md?raw'
import sliceSkill from '@/lib/agent/skill/skills/slice.md?raw'

/**
 * The four-skill architecture, in the composer. These are the SAME SKILL.md
 * files IDE humans get from the agentic-service-blueprinting plugin —
 * vendored by scripts/sync-agent-skill.mjs, never authored here. A /command
 * loads its skill into the system prompt for that message only.
 *
 * audit and whatif are declared (the architecture is four skills) but not
 * yet published by the plugin (plan 2026-07-29-004 phases 2–3) — they show
 * in the menu as pending so the vocabulary is learnable before it is live.
 */
export type AgentSkillCommand = {
  /** The /command token, without the slash. */
  id: 'map' | 'slice' | 'audit' | 'whatif'
  label: string
  description: string
  /** SKILL.md content; null while the plugin has not shipped the skill. */
  content: string | null
}

export const AGENT_SKILL_COMMANDS: AgentSkillCommand[] = [
  {
    id: 'map',
    label: '/map',
    description: 'Create or evolve a blueprint from notes and conversation',
    content: blueprintSkill,
  },
  {
    id: 'slice',
    label: '/slice',
    description: 'Cut a stakeholder view out of the blueprint',
    content: sliceSkill,
  },
  {
    id: 'audit',
    label: '/audit',
    description: 'Run consistency checks over the blueprint — plugin skill pending',
    content: null,
  },
  {
    id: 'whatif',
    label: '/whatif',
    description: 'Trace the impact of a hypothetical change — plugin skill pending',
    content: null,
  },
]

/**
 * A draft that *starts* with a slash names a skill: "/audit the warm-up".
 * Returns the command and the remainder, or null when the token matches no
 * skill (the text then sends as-is — no surprise swallowing).
 */
export function parseSkillDraft(
  draft: string,
): { command: AgentSkillCommand; rest: string } | null {
  const match = /^\/(\w+)\s*([\s\S]*)$/.exec(draft.trim())
  if (!match) return null
  const command = AGENT_SKILL_COMMANDS.find((entry) => entry.id === match[1])
  return command ? { command, rest: match[2].trim() } : null
}
