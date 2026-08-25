#!/usr/bin/env node
/**
 * Blocking guard: the template may never change this instance's own files.
 *
 * This repo and agentic-service-blueprinting were grafted (see the merge
 * base created in plus-uno-blueprint#105), so upstream changes now arrive
 * as ordinary `git merge template/main`. Most of src/ SHOULD arrive that
 * way. A handful of paths never should — this instance's migrations, its
 * blueprint data, its generated database types, its agent persona — and
 * a merge that quietly takes the package's version of those is a silent
 * data-shaped regression, not a code conflict someone would notice.
 *
 * Why a check and not .gitattributes: a `merge=ours` driver is named in
 * the committed .gitattributes but DEFINED in .git/config, which is not
 * committed. A fresh clone keeps the declaration and loses the driver, so
 * the protection silently stops existing. That is the same shape as the
 * deleted sync-agent-skill.mjs, whose --check exited 0 when it could not
 * see its source. A guard that passes when blind is not a guard.
 *
 * What it inspects: every merge commit in the range whose second (or
 * later) parent descends from the template's root commit. Those are the
 * merges that carry upstream content. Ordinary merges within this repo
 * are ignored, and no network or remote is required — ancestry alone
 * identifies a template merge, so this runs the same in CI as locally.
 *
 *   node scripts/check-template-quarantine.mjs              # origin/main..HEAD
 *   node scripts/check-template-quarantine.mjs <range>      # any rev range
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = resolve(ROOT, 'scripts/template-quarantine.json')

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()

/**
 * Deliberately tiny: exact paths, and a trailing `/**` for a whole subtree.
 * No `*` inside a segment, no brace expansion. The manifest is read by
 * humans deciding what upstream may touch; a pattern language they have to
 * reason about would defeat that.
 */
export function matches(file, pattern) {
  if (pattern.endsWith('/**')) return file.startsWith(pattern.slice(0, -2))
  return file === pattern
}

export function violations(files, quarantine) {
  const hits = []
  for (const file of files) {
    const entry = quarantine.find((q) => matches(file, q.path))
    if (entry) hits.push({ file, pattern: entry.path, reason: entry.reason })
  }
  return hits
}

/**
 * Merge commits in `range` that carry template content, oldest first.
 *
 * `--first-parent` is load-bearing. Once the graft exists, every commit in
 * the template's own history is reachable from ours, so a plain rev-list
 * would walk upstream's internal merges and judge them against a manifest
 * that describes OUR instance. Only merges on our own mainline are ours to
 * answer for.
 */
function templateMerges(range, templateRoot) {
  const lines = git('rev-list', '--merges', '--first-parent', '--reverse', range)
    .split('\n')
    .filter(Boolean)
  return lines.filter((sha) => {
    const parents = git('rev-list', '--parents', '-n', '1', sha).split(' ').slice(1)
    // The first parent is this repo's own line of history; only the merged-in
    // side can carry upstream content.
    return parents.slice(1).some((p) => {
      try {
        git('merge-base', '--is-ancestor', templateRoot, p)
        return true
      } catch {
        return false
      }
    })
  })
}

function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const range = process.argv[2] ?? 'origin/main..HEAD'

  let merges
  try {
    merges = templateMerges(range, manifest.templateRootCommit)
  } catch (error) {
    // An unresolvable range (a shallow CI clone, a missing origin/main) must
    // not read as "nothing to check" — that is the blind-guard failure this
    // script exists to avoid.
    console.error(`cannot resolve range "${range}": ${error.message.trim()}`)
    process.exit(1)
  }

  if (merges.length === 0) {
    console.log(`no template merges in ${range} — nothing to check`)
    return
  }

  let failed = false
  for (const sha of merges) {
    const files = git('diff', '--name-only', `${sha}^1`, sha).split('\n').filter(Boolean)
    const hits = violations(files, manifest.quarantine)
    const subject = git('log', '-1', '--format=%s', sha)
    if (hits.length === 0) {
      console.log(`ok   ${sha.slice(0, 7)} ${subject} (${files.length} files, none quarantined)`)
      continue
    }
    failed = true
    console.error(`FAIL ${sha.slice(0, 7)} ${subject}`)
    for (const hit of hits) {
      console.error(`       ${hit.file}`)
      console.error(`         matched ${hit.pattern} — ${hit.reason}`)
    }
  }

  if (failed) {
    console.error(
      '\nA template merge changed files this instance owns. Restore them from\n' +
        'the first parent (git checkout <merge>^1 -- <path>), amend the merge,\n' +
        'and re-run. Do not add the path to the manifest to make this pass.',
    )
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()
