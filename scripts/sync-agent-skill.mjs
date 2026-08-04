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

const PLUGIN_REFS = resolve(
  process.env.PLUGIN_REPO ?? '../agentic-service-blueprinting',
  'references',
)
const VENDORED = resolve('src/lib/agent/skill/references')

const FILES = [
  'canvas-adapter.md',
  'layer-roles.md',
  'lane-vocabulary.md',
  'elicitation-protocol.md',
  'data-model.md',
]

const check = process.argv.includes('--check')

if (!existsSync(PLUGIN_REFS)) {
  console.error(`plugin references not found at ${PLUGIN_REFS} (set PLUGIN_REPO)`)
  process.exit(check ? 0 : 1) // absent plugin checkout must not fail CI
}

let drift = 0
for (const file of FILES) {
  const source = resolve(PLUGIN_REFS, file)
  const target = resolve(VENDORED, file)
  if (!existsSync(source)) {
    console.error(`missing in plugin: ${file}`)
    drift += 1
    continue
  }
  const same =
    existsSync(target) &&
    readFileSync(source, 'utf8') === readFileSync(target, 'utf8')
  if (same) continue
  if (check) {
    console.error(`drift: ${file}`)
    drift += 1
  } else {
    copyFileSync(source, target)
    console.log(`synced: ${file}`)
  }
}

if (check && drift > 0) process.exit(1)
console.log(check ? 'vendored copy matches the plugin' : 'done')
