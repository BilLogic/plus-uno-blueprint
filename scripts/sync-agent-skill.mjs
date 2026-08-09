#!/usr/bin/env node
/**
 * One-way sync of the agent's rulebook from the plugin repo into the app's
 * vendored copy, with a drift check for CI: `--check` exits 1 when the
 * vendored bytes differ from the source instead of copying.
 *
 * The plugin repo is the canonical home (humans manage the same files as
 * IDE skills); the app bundles the vendored copy via ?raw imports and
 * serves it through the read_reference tool.
 */
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PLUGIN = resolve(process.env.PLUGIN_REPO ?? '../agentic-service-blueprinting')
const VENDORED = resolve('src/lib/agent/skill/references')
const VENDORED_SKILLS = resolve('src/lib/agent/skill/skills')

// Plugin-relative source path per vendored reference. The plugin keeps its
// shared core at references/ and each skill's own materials under
// skills/<name>/references/; the app's vendored dir stays flat because
// read_reference serves files by bare name.
const FILES = [
  'references/canvas-adapter.md',
  'references/layer-roles.md',
  'references/lane-vocabulary.md',
  'skills/map/references/elicitation-protocol.md',
  'skills/map/references/cocreate-playbook.md',
  'references/data-model.md',
  'references/audit-playbook.md',
  'skills/whatif/references/whatif-playbook.md',
  'skills/audit/references/check-gap-sweep.md',
  'skills/audit/references/check-jargon-lint.md',
  'skills/audit/references/check-channel-conflict.md',
  'skills/audit/references/check-kpi-alignment.md',
  'skills/audit/references/check-perceived-owner.md',
  'skills/audit/references/check-value-ledger.md',
  'skills/audit/references/check-fee-visibility.md',
  'skills/slice/references/slice-playbook.md',
  'skills/slice/references/slice-templates.md',
]

// The four-skill architecture: these SKILL.md files are the same ones IDE
// humans get from the plugin; the app vendors them for the /slash triggers.
const SKILLS = [
  ['map/SKILL.md', 'map.md'],
  ['slice/SKILL.md', 'slice.md'],
  ['audit/SKILL.md', 'audit.md'],
  ['whatif/SKILL.md', 'whatif.md'],
]

const check = process.argv.includes('--check')

if (!existsSync(resolve(PLUGIN, 'references'))) {
  console.error(`plugin references not found at ${resolve(PLUGIN, 'references')} (set PLUGIN_REPO)`)
  process.exit(check ? 0 : 1) // absent plugin checkout must not fail CI
}

let drift = 0
const pairs = [
  ...FILES.map((file) => [
    resolve(PLUGIN, file),
    resolve(VENDORED, file.split('/').pop()),
    file,
  ]),
  ...SKILLS.map(([from, to]) => [
    resolve(PLUGIN, 'skills', from),
    resolve(VENDORED_SKILLS, to),
    `skills/${from}`,
  ]),
]
for (const [source, target, label] of pairs) {
  if (!existsSync(source)) {
    console.error(`missing in plugin: ${label}`)
    drift += 1
    continue
  }
  const same =
    existsSync(target) &&
    readFileSync(source, 'utf8') === readFileSync(target, 'utf8')
  if (same) continue
  if (check) {
    console.error(`drift: ${label}`)
    drift += 1
  } else {
    copyFileSync(source, target)
    console.log(`synced: ${label}`)
  }
}

if (check && drift > 0) process.exit(1)
console.log(check ? 'vendored copy matches the plugin' : 'done')
