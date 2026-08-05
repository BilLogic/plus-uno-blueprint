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
const PLUGIN_REFS = resolve(PLUGIN, 'references')
const VENDORED = resolve('src/lib/agent/skill/references')
const VENDORED_SKILLS = resolve('src/lib/agent/skill/skills')

const FILES = [
  'canvas-adapter.md',
  'layer-roles.md',
  'lane-vocabulary.md',
  'elicitation-protocol.md',
  'data-model.md',
]

// The four-skill architecture: these SKILL.md files are the same ones IDE
// humans get from the plugin; the app vendors them for the /slash triggers.
// audit and whatif join this list when the plugin ships them (plan
// 2026-07-29-004 phases 2–3).
const SKILLS = [
  ['blueprint/SKILL.md', 'blueprint.md'],
  ['slice/SKILL.md', 'slice.md'],
]

const check = process.argv.includes('--check')

if (!existsSync(PLUGIN_REFS)) {
  console.error(`plugin references not found at ${PLUGIN_REFS} (set PLUGIN_REPO)`)
  process.exit(check ? 0 : 1) // absent plugin checkout must not fail CI
}

let drift = 0
const pairs = [
  ...FILES.map((file) => [resolve(PLUGIN_REFS, file), resolve(VENDORED, file), file]),
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
