import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { normalizeBlueprint, type RawPath } from '@/lib/normalizeBlueprint'
import { PATH_BLUEPRINT_SELECT } from '@/lib/workflowQueries'
import canvasAdapter from '@/lib/agent/skill/references/canvas-adapter.md?raw'
import dataModel from '@/lib/agent/skill/references/data-model.md?raw'
import elicitationProtocol from '@/lib/agent/skill/references/elicitation-protocol.md?raw'
import laneVocabulary from '@/lib/agent/skill/references/lane-vocabulary.md?raw'
import layerRoles from '@/lib/agent/skill/references/layer-roles.md?raw'
import auditPlaybook from '@/lib/agent/skill/references/audit-playbook.md?raw'
import whatifPlaybook from '@/lib/agent/skill/references/whatif-playbook.md?raw'
import checkGapSweep from '@/lib/agent/skill/references/check-gap-sweep.md?raw'
import checkJargonLint from '@/lib/agent/skill/references/check-jargon-lint.md?raw'
import checkChannelConflict from '@/lib/agent/skill/references/check-channel-conflict.md?raw'
import checkKpiAlignment from '@/lib/agent/skill/references/check-kpi-alignment.md?raw'
import checkPerceivedOwner from '@/lib/agent/skill/references/check-perceived-owner.md?raw'
import checkValueLedger from '@/lib/agent/skill/references/check-value-ledger.md?raw'
import checkFeeVisibility from '@/lib/agent/skill/references/check-fee-visibility.md?raw'
import slicePlaybook from '@/lib/agent/skill/references/slice-playbook.md?raw'
import sliceTemplates from '@/lib/agent/skill/references/slice-templates.md?raw'

type Client = SupabaseClient<Database>

/**
 * Read tools return COMPACT TEXT, not JSON dumps — the model reads them the
 * way a person skims a grid, and ids ride along in parentheses so every
 * later write can name its target precisely.
 */

/**
 * The same reference files the IDE skills read from disk, served as a tool.
 * One progressive-disclosure mechanism, two consumers: editing a file in
 * the plugin repo upgrades both (vendored here by scripts/sync-agent-skill).
 */
const REFERENCES: Record<string, string> = {
  'canvas-adapter': canvasAdapter,
  'layer-roles': layerRoles,
  'lane-vocabulary': laneVocabulary,
  'elicitation-protocol': elicitationProtocol,
  'data-model': dataModel,
  'audit-playbook': auditPlaybook,
  'whatif-playbook': whatifPlaybook,
  'check-gap-sweep': checkGapSweep,
  'check-jargon-lint': checkJargonLint,
  'check-channel-conflict': checkChannelConflict,
  'check-kpi-alignment': checkKpiAlignment,
  'check-perceived-owner': checkPerceivedOwner,
  'check-value-ledger': checkValueLedger,
  'check-fee-visibility': checkFeeVisibility,
  'slice-playbook': slicePlaybook,
  'slice-templates': sliceTemplates,
}

export function readReference(name: string): string {
  const doc = REFERENCES[name]
  if (doc) return doc
  return `Unknown reference "${name}". Available: ${Object.keys(REFERENCES).join(', ')}`
}

export const REFERENCE_NAMES = Object.keys(REFERENCES)

export async function listScenarios(client: Client): Promise<string> {
  const { data, error } = await client
    .from('phases')
    .select(
      'id, name, order_position, service_scenarios (id, name, description, order_position)',
    )
    .order('order_position')
  if (error) throw new Error(error.message)

  const lines: string[] = []
  for (const phase of data ?? []) {
    lines.push(`Phase "${phase.name}" (${phase.id})`)
    const scenarios = [...(phase.service_scenarios ?? [])].sort(
      (a, b) => (a.order_position ?? 0) - (b.order_position ?? 0),
    )
    for (const scenario of scenarios) {
      lines.push(
        `  Scenario "${scenario.name}" (${scenario.id})${scenario.description ? ` — ${scenario.description}` : ''}`,
      )
    }
  }
  return lines.join('\n') || 'No phases found.'
}

export async function getBlueprint(
  client: Client,
  scenarioId: string,
): Promise<string> {
  const { data, error } = await client
    .from('paths')
    .select(PATH_BLUEPRINT_SELECT)
    .eq('service_scenario_id', scenarioId)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as RawPath[]
  if (rows.length === 0) return 'No paths in this scenario.'

  const sections: string[] = []
  for (const raw of rows) {
    const blueprint = normalizeBlueprint(raw)
    const { path, steps, layers, cells } = blueprint
    const lines: string[] = [
      `Path "${path.name}" (${path.id}, type ${path.path_type})`,
      `Steps: ${steps
        .map((step) => `${step.column_position}. "${step.name}" (${step.id})`)
        .join(' | ')}`,
    ]
    for (const layer of layers) {
      lines.push(
        `Lane "${layer.name}" (${layer.id}${layer.role ? `, role ${layer.role}` : ''}):`,
      )
      const byStep = new Map<string, typeof cells>()
      for (const cell of cells) {
        if (cell.layer_id !== layer.id) continue
        const list = byStep.get(cell.step_id) ?? []
        list.push(cell)
        byStep.set(cell.step_id, list)
      }
      for (const step of steps) {
        for (const cell of byStep.get(step.id) ?? []) {
          lines.push(
            `  [step ${step.column_position}] "${cell.content}" (${cell.id})`,
          )
        }
      }
    }
    sections.push(lines.join('\n'))
  }
  return sections.join('\n\n')
}

export async function getCell(client: Client, cellId: string): Promise<string> {
  const { data, error } = await client
    .from('cells')
    .select(
      'id, content, description, owner, perceived_owner, function, form, value_props, layer_id, step_id, slot_position',
    )
    .eq('id', cellId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return `No cell with id ${cellId}.`
  const fields: Array<[string, unknown]> = [
    ['content', data.content],
    ['summary', data.description],
    ['owner', data.owner],
    ['perceived_owner', data.perceived_owner],
    ['function', data.function],
    ['form', data.form],
    ['value_props', data.value_props ? JSON.stringify(data.value_props) : null],
    ['layer_id', data.layer_id],
    ['step_id', data.step_id],
    ['slot_position', data.slot_position],
  ]
  return fields
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n')
}

export async function listSlices(client: Client): Promise<string> {
  const { data, error } = await client
    .from('slices')
    .select('id, title, slice_type')
    .order('slice_type')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return 'No slices yet.'
  return data
    .map((slice) => `"${slice.title}" (${slice.id}, type ${slice.slice_type})`)
    .join('\n')
}

/** The tag vocabulary — read this before writing any owner value. */
export async function listOwnerTags(client: Client): Promise<string> {
  const { data, error } = await client
    .from('cells')
    .select('owner, perceived_owner')
    .or('owner.not.is.null,perceived_owner.not.is.null')
  if (error) throw new Error(error.message)
  const tags = new Set<string>()
  for (const row of data ?? []) {
    if (row.owner) tags.add(row.owner)
    if (row.perceived_owner) tags.add(row.perceived_owner)
  }
  if (tags.size === 0) return 'No owner tags in use yet.'
  return [...tags].sort().join(', ')
}
