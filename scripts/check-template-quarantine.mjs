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
 * later) parent carries template content — descended from the template's
 * root commit AND NOT from this instance's own. No network or remote is
 * required; ancestry alone identifies a template merge, so this runs the
 * same in CI as locally.
 *
 * BOTH roots are load-bearing, and the first version of this guard used
 * only one. Since the graft, every commit in this repo descends from the
 * template root, so "descends from templateRoot" is true of our own
 * branches too. CI checks a pull request out as a synthetic merge commit
 * (parent 1 = base, parent 2 = the branch), so that test classified every
 * PR as an incoming template merge and reported the PR's own work as
 * upstream overwriting us. It failed each of the two runs on #149 while
 * `npm run check:template-quarantine` passed locally, where HEAD is not a
 * merge commit — falsifying the "runs the same in CI as locally" claim
 * this docstring makes two paragraphs up. The instance root is what makes
 * that claim true: our branches descend from it, upstream commits do not.
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
 * True when `commit` descends from `root`. False also when either is unknown.
 *
 * stderr is captured rather than inherited: "not a valid commit name" is an
 * ANSWER here, not a fault, and letting git print it turns a passing run into
 * one that reads like a broken one.
 */
function descendsFrom(root, commit) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', root, commit], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return true
  } catch {
    return false
  }
}

/**
 * True when a merged-in parent carries content from the template rather than
 * from this instance.
 *
 * Exported because this is the half that broke, and the half no unit test
 * covered — the file's own test said "the git walk itself is exercised in CI,
 * where there are merges", and CI is exactly where the walk misclassified
 * every pull request.
 */
export function carriesTemplateContent(parent, { templateRoot, instanceRoot }) {
  return descendsFrom(templateRoot, parent) && !descendsFrom(instanceRoot, parent)
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
function templateMerges(range, roots) {
  const lines = git('rev-list', '--merges', '--first-parent', '--reverse', range)
    .split('\n')
    .filter(Boolean)
  return lines.filter((sha) => {
    const parents = git('rev-list', '--parents', '-n', '1', sha).split(' ').slice(1)
    // The first parent is this repo's own line of history; only the merged-in
    // side can carry upstream content.
    return parents.slice(1).some((p) => carriesTemplateContent(p, roots))
  })
}

function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const range = process.argv[2] ?? 'origin/main..HEAD'

  const roots = {
    templateRoot: manifest.templateRootCommit,
    instanceRoot: manifest.instanceRootCommit,
  }
  if (!roots.templateRoot || !roots.instanceRoot) {
    // Missing either root turns the classifier into a coin toss in one
    // direction or the other, and the wrong direction is silent.
    console.error(
      'scripts/template-quarantine.json must pin both templateRootCommit and instanceRootCommit',
    )
    process.exit(1)
  }

  let merges
  try {
    merges = templateMerges(range, roots)
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
