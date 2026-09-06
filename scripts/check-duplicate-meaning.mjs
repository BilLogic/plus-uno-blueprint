#!/usr/bin/env node
/**
 * Does this deployment state, in its own harness prose, something the template
 * already states? (#364, story 8.)
 *
 * This repository is the only one of the three that holds two harnesses at
 * once. The template arrives as the lockfile-pinned git dependency
 * `agentic-service-blueprinting`, installed by `npm ci` to
 * `node_modules/agentic-service-blueprinting`, so a sweep across the repository
 * boundary needs no sibling checkout, no credential and no network — which is
 * why the spec's fifth check moved here from `plus-uno`, whose own gate
 * forbids a member that cannot run on a clean checkout.
 *
 *   node scripts/check-duplicate-meaning.mjs  (also: npm run check:duplicate-meaning)
 *
 * ── WHY THIS IS NOT `check:reconciled` WEARING A COSTUME ────────────────────
 *
 * `scripts/check-reconciled-files.mjs` compares WHOLE FILES, BYTE FOR BYTE,
 * over an allowlist of paths this deployment has declared identical to the
 * template's. That check is silent about every file not on the list, and no
 * file that differs anywhere can ever join it. `CONTEXT.md` is the standing
 * example: this glossary defines forty-one terms and the template's defines
 * twenty-six, so the two files must differ as files, permanently, and byte
 * identity has nothing whatever to say about the paragraphs inside them.
 *
 * This check compares BLOCKS — a paragraph, a list, a table, a term row — and
 * compares them after a normalisation that removes exactly the four things
 * that let one statement read as two different byte strings:
 *
 *   1. LINE WRAPPING. The two repositories wrap prose at different columns, so
 *      a paragraph copied across and reflowed is byte-different and
 *      meaning-identical.
 *   2. LETTER CASE. The template writes its glossary terms capitalised
 *      (`**Sprawl**`) and this one writes them lower case (`**sprawl**`). That
 *      one character is enough to make a verbatim copy invisible to `cmp`.
 *   3. MARKDOWN EMPHASIS AND LINK SYNTAX. A copied sentence that later gained a
 *      link, a bold span or a pair of backticks is still the copied sentence.
 *   4. EACH REPOSITORY'S OWN NAME. This is the one that matters most, and the
 *      live example is `docs/agents/issue-tracker.md`: the two copies differ in
 *      exactly one place, the repository named in the frontmatter, and behind
 *      that single word sit seventeen blocks of identical prose that no
 *      byte-level comparison of the two files can reach. A sentence about
 *      `plus-uno-blueprint` and the same sentence about
 *      `agentic-service-blueprinting` are one statement, and folding the two
 *      names to one token is what lets the sweep see that.
 *
 * So the finding is not "these bytes agree". It is "this deployment and the
 * template say the same thing, in files that no check holds together, and one
 * of the two will move without the other".
 *
 * ── THE SUBJECT, AND THE THREE PLACES IT DELIBERATELY STOPS ─────────────────
 *
 * SUBJECT is the swept prose documents — `scripts/swept-docs.mjs`, the list
 * this repository already keeps of the documents it holds to a standard — for
 * those paths the pinned template also carries. Today that is `CONTEXT.md`,
 * `README.md` and `AGENTS.md`; it is a walk rather than a list so that a doc
 * that becomes shared later is swept without anyone remembering to add it.
 * `swept-docs.mjs` already excludes `docs/adr/`, `docs/plans/`,
 * `docs/ideation/` and `docs/brainstorms/`, for the reason its own header
 * gives: a decision record states the decision of its day in the words of its
 * day, and rewriting one falsifies it. That exclusion is inherited here rather
 * than restated, which is the whole point of there being one list.
 *
 * Anything `check:reconciled` already holds is dropped too. A file on that
 * allowlist is identical to the template's on purpose and by promise; reporting
 * its paragraphs as duplicates would be this check second-guessing the one
 * beside it.
 *
 * Three kinds of shared text were measured while this was being written and
 * are deliberately NOT gated. Each is named here with its reason, because a
 * boundary nobody can evaluate is indistinguishable from a boundary drawn to
 * make a check pass.
 *
 *   `docs/agents/`. Its three files carry twenty-one duplicated blocks, and
 *   they are the largest single source of agreement between the two trees.
 *   They are also not this repository's prose: they are the configuration
 *   surface of the third-party `mattpocock-skills` package, which `AGENTS.md`
 *   § Agent skills names as exactly that — "Config the `mattpocock-skills`
 *   engineering skills read". The prose in them is that package's, and two
 *   adopters answering the same upstream questionnaire the same way is not one
 *   repository restating the other. `docs/agents/triage-labels.md` is in fact
 *   byte-identical to the template's copy, which makes it a candidate for the
 *   reconciled allowlist rather than a finding for this sweep.
 *
 *   SHARED SCRIPT HEADERS. Sixteen `scripts/*.mjs` files exist in both repos,
 *   and their comment prose repeats sixty-one blocks — the richest seam of all.
 *   Fifteen of the sixteen differ as files and always will, so
 *   `check:reconciled` can never take them. They are still out, because a
 *   comment's job is to explain the code it sits beside, and those are two
 *   forked implementations: the duplication is bounded by, and self-correcting
 *   with, the divergence of the code under it. Replacing an explanation with a
 *   pointer into `node_modules` would make the deployment's own source worse in
 *   order to make a count smaller.
 *
 *   THE RENAME MAP, which story 8 names directly. Both repositories carry a
 *   `scripts/retired-vocabulary.mjs`, and eleven of this one's thirty-two rows
 *   state the same rename as one of the template's twenty-three. It is out, and
 *   the reason is that those are not two statements of one meaning: they are
 *   two ENFORCEMENT LISTS, each swept over its own tree by its own checks, and
 *   they already disagree in three places on purpose. This repository retires
 *   the identifier fragment `proposition` where the template retires
 *   `propositions`, and the singular's absence there is argued at length in
 *   that file, because forbidding it on screen would forbid the very word the
 *   rename was performed to protect. A check that fused the two lists would be
 *   standing pressure to abandon a correct decision, which is worse than the
 *   duplication it would remove.
 *
 * ── THE FLOOR ───────────────────────────────────────────────────────────────
 *
 * A block counts only once its normalised form reaches `PROSE_FLOOR`
 * characters. Below that, agreement is coincidence rather than copying: two
 * harnesses of the same shape both write `## Boot protocol`, both draw a table
 * separator, and both open a section the same way. Eighty characters is about a
 * full line of prose — long enough that two authors do not arrive at it
 * independently, short enough to catch a single copied sentence.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { RECONCILED_FILES } from './reconciled-files.mjs'
import { sweptDocs } from './swept-docs.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Where `npm ci` puts the pinned template. The same copy check:reconciled reads. */
export const PACKAGE = 'node_modules/agentic-service-blueprinting'

/** Shortest normalised block that counts as copied rather than coincident. */
export const PROSE_FLOOR = 80

/**
 * Prose that is shared but is not this repository's to say once. Vendored
 * configuration for a third-party skill package: the header above argues it.
 */
export const NOT_OUR_PROSE = ['docs/agents/']

/** The two repository names that are one token as far as meaning is concerned. */
const REPOSITORY_NAMES = /plus-uno-blueprint|agentic-service-blueprinting/gi

/**
 * One statement, stripped of the four things that let a copy read as different
 * bytes: link and emphasis syntax, either repository's own name, line wrapping,
 * and letter case. Pure and exported so the test can drive it directly.
 */
export function normalise(text) {
  return text
    .replace(/\[([^\]\n]*)\]\([^)\n]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(REPOSITORY_NAMES, '<this repository>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * The blocks of a markdown document: runs of consecutive non-blank lines,
 * each with the line it starts on. Fenced regions are dropped whole — a fence
 * holds code, and whether two repositories share code is `check:reconciled`'s
 * question and not this one's.
 */
export function blocksIn(text) {
  const blocks = []
  const lines = text.split('\n')
  let open = null
  let fenced = false

  const close = () => {
    if (open) blocks.push({ line: open.line, text: open.lines.join('\n') })
    open = null
  }

  lines.forEach((line, index) => {
    if (/^\s*(?:```|~~~)/.test(line)) {
      close()
      fenced = !fenced
      return
    }
    if (fenced) return
    if (line.trim() === '') {
      close()
      return
    }
    if (open) open.lines.push(line)
    else open = { line: index + 1, lines: [line] }
  })
  close()

  return blocks
}

/**
 * The blocks of one document that the template's copy of it also states.
 *
 * Pure over two texts, so the unit test can prove both branches on fixtures
 * rather than by editing the documents the check protects.
 *
 * @param {object} io
 * @param {string} io.ours     this repository's text
 * @param {string} io.theirs   the template's text at the same path
 * @param {string} io.subject  the repo-relative path, for the message
 */
export function findings({ ours, theirs, subject }) {
  const template = new Map()
  for (const block of blocksIn(theirs)) {
    const key = normalise(block.text)
    if (key.length < PROSE_FLOOR) continue
    if (!template.has(key)) template.set(key, block.line)
  }

  const out = []
  for (const block of blocksIn(ours)) {
    const key = normalise(block.text)
    if (key.length < PROSE_FLOOR) continue
    if (!template.has(key)) continue
    const opening = block.text.replace(/\s+/g, ' ').trim().slice(0, 96)
    out.push(
      `${subject}:${block.line} is stated in the template too, at ${PACKAGE}/${subject}:` +
        `${template.get(key)} — "${opening}…". Say it once: the template owns the harness ` +
        'vocabulary the two repositories share, so this copy either anchors itself to ' +
        'something only this deployment can say, or gives way to a pointer at the ' +
        "template's.",
    )
  }
  return out
}

/**
 * The documents this sweep compares: swept prose the template also carries,
 * less the vendored config and less whatever `check:reconciled` already holds.
 */
export function subjectDocuments(root = REPO_ROOT, packageRoot = join(root, PACKAGE)) {
  const reconciled = new Set(RECONCILED_FILES)
  return sweptDocs(root)
    .filter((rel) => !NOT_OUR_PROSE.some((prefix) => rel.startsWith(prefix)))
    .filter((rel) => !reconciled.has(rel))
    .filter((rel) => existsSync(join(packageRoot, rel)))
}

/** Every document's findings, with the census of what was actually compared. */
export function sweep(root = REPO_ROOT, packageRoot = join(root, PACKAGE)) {
  const documents = subjectDocuments(root, packageRoot)
  const failures = []
  let compared = 0

  for (const subject of documents) {
    const ours = readFileSync(join(root, subject), 'utf8')
    const theirs = readFileSync(join(packageRoot, subject), 'utf8')
    compared += blocksIn(ours).filter((block) => normalise(block.text).length >= PROSE_FLOOR).length
    failures.push(...findings({ ours, theirs, subject }))
  }

  return { documents, failures, compared }
}

function main() {
  const packageRoot = join(REPO_ROOT, PACKAGE)
  if (!existsSync(packageRoot)) {
    console.error(
      `[duplicate-meaning] ${PACKAGE} is not installed, so this deployment's harness prose ` +
        'cannot be compared against the template it was generalised from.\n' +
        '  -> run `npm ci` and re-run this check. There is always a subject here, so a ' +
        'missing template is a failure and never a quiet pass.',
    )
    process.exit(1)
  }

  const { documents, failures, compared } = sweep(REPO_ROOT, packageRoot)

  if (documents.length === 0) {
    console.error(
      '[duplicate-meaning] no swept document is shared with the template, so this check ' +
        'compared nothing.\n  -> a sweep with an empty subject reports green on any input. ' +
        'Either the subject rules in this file have drifted from the tree, or the pinned ' +
        'package is not the template.',
    )
    process.exit(1)
  }

  if (failures.length > 0) {
    console.error(
      `[duplicate-meaning] ${failures.length} block(s) of this deployment's harness prose ` +
        `are stated in the template as well:\n` +
        failures.map((one) => `  ${one}`).join('\n') +
        '\n  -> the same meaning is stated here and in the template both, in files nothing ' +
        'holds together, so one copy will move without the other.',
    )
    process.exit(1)
  }

  console.log(
    `[duplicate-meaning] ${compared} block(s) across ${documents.length} document(s) shared ` +
      `with the pinned template (${documents.join(', ')}); none of them is stated in both.`,
  )
}

// Same guard shape as check-reconciled-files: a hand-built `file://` comparison
// silently no-ops whenever the path needs escaping.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) main()
