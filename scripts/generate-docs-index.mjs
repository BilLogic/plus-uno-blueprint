#!/usr/bin/env node
/**
 * Generates the root INDEX.md — the one map both humans and agents read first.
 *
 * At the root, not in docs/, because it routes past docs/ as well as through
 * it: SETUP, CONTEXT and AGENTS are root files and an index that could not
 * name them was a map of one folder.
 *
 * Doc rows come from each reference doc's frontmatter (`audience`, `summary`),
 * never hand-typed here: hand-maintained duplication is how the rev-1 plan
 * drifted its own numbering before a single doc existed. The task-routing
 * table below IS hand-authored — routing is editorial judgment — but it lives
 * in exactly one place (this script) and ships into the generated file.
 *
 * A doc with no `summary:` in its frontmatter is a FAILURE, not a blank cell.
 * The index's whole job is telling a reader whether to open a file; a row that
 * cannot do that is worse than no row, because it looks like an answer.
 *
 * Run: node scripts/generate-docs-index.mjs   (also: npm run docs:index)
 * CI-check: node scripts/generate-docs-index.mjs --check
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const DOCS = join(ROOT, 'docs')
const REFERENCE_DIRS = ['product', 'guidelines', 'engineering', 'reference', 'adr', 'connectors']

/** Task-shaped routing — a row per task someone arrives holding, phrased
 * the way they'd ask it. Update alongside any doc move. */
const ROUTING = [
  ['What do these words mean — scenario, path, lane, cell, slice, finding?', 'CONTEXT.md'],
  ['What does this panel label actually name in the schema?', 'docs/reference/interface-schema-map.md'],
  ['Clone it and get it running', 'SETUP.md'],
  ['What is this product / can I edit things / how do I get access?', 'docs/product/01-overview.md'],
  ['Find a scenario, read it on desktop or phone, share it, present to leadership', 'docs/product/02-team-guide.md'],
  ['What is a lane / line of visibility / slice / finding?', 'docs/product/03-reading-a-blueprint.md'],
  ['Someone mentioned an audit finding — what is it, can I trust it, how do I challenge it?', 'docs/product/04-the-assistant-and-audits.md'],
  ['Run a mapping / audit / what-if / slicing session; where is the methodology specified?', 'docs/product/05-service-design-practice.md'],
  ['Ground product or UX decisions on blueprint evidence', 'docs/product/06-product-design-on-blueprints.md'],
  ['Why does the app look and feel this way?', 'docs/guidelines/overview.md'],
  ['Match an existing surface’s visual style', 'docs/guidelines/overview.md (surface anatomy) → docs/guidelines/composition/'],
  ['Which token do I use — and how do I add one?', 'docs/guidelines/foundations/tokens.md → the topic’s own foundation file'],
  ['Chart, band, severity or zoom-tier encodings', 'docs/guidelines/foundations/data-viz.md'],
  ['Which component or primitive do I reach for; empty/error-state anatomy', 'docs/guidelines/components/overview.md'],
  ['What does a click / ⌘-click / tap / pinch DO, and why?', 'docs/guidelines/composition/canvas.md'],
  ['What happens on a phone or tablet (as a spec)?', 'docs/guidelines/foundations/layout.md (the gate) → docs/guidelines/composition/mobile-shell.md'],
  ['Working on a panel, the sidebar, compare, slices, the agent, a dialog', 'docs/guidelines/composition/overview.md'],
  ['Write UI copy, error text, or agent-voice wording', 'docs/guidelines/foundations/content-voice.md'],
  ['Accessibility bar: contrast, forced-colors, reduced motion, touch targets', 'docs/guidelines/foundations/accessibility.md'],
  ['Where does X live, how does it connect, which pattern do I copy?', 'docs/engineering/codebase-guide.md'],
  ['Add a field to cells end-to-end (schema → RPC → panel UI)', 'docs/engineering/access-and-security.md → docs/engineering/codebase-guide.md → docs/guidelines/composition/entity-panels.md'],
  ['Which user is my session / my agent; what writes are legitimate; how is access enforced?', 'AGENTS.md invariants → docs/engineering/access-and-security.md'],
  ['Canvas gesture or camera misbehaving — intended vs implemented behavior', 'docs/guidelines/composition/canvas.md + docs/engineering/codebase-guide.md'],
  ['How do the in-app agent and its rosters work?', 'docs/engineering/agent-system.md'],
  ['Add or change an agent tool; run the eval harness', 'docs/engineering/agent-tools.md'],
  ['Coding standards, the Supabase benchmark, tooling traps, how to run and write tests', 'docs/engineering/standards.md'],
  ['Deploy, rollback, environments, monitoring, troubleshooting', 'docs/engineering/operations.md'],
  ['Anything crossing a repo boundary — the database, uno-bot, the deploy', 'docs/connectors/overview.md'],
  ['Merge from the template, or find out what is still PLUS-specific here', 'docs/engineering/template-relationship.md'],
  ['Is this plan file still true?', 'its frontmatter `status` + `distilled-into`'],
]

function frontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---/.exec(text)
  if (!match) return {}
  const out = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return out
}

const missingSummary = []

function docRows() {
  const rows = []
  for (const dir of REFERENCE_DIRS) {
    const walk = (abs) => {
      for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        const full = join(abs, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name.endsWith('.md')) {
          const fm = frontmatter(readFileSync(full, 'utf8'))
          const path = relative(ROOT, full)
          if (!fm.summary) missingSummary.push(path)
          rows.push({
            path,
            audience: fm.audience ?? '—',
            summary: fm.summary ?? '',
          })
        }
      }
    }
    try {
      walk(join(DOCS, dir))
    } catch {
      // Folder not populated yet — fine during phased rollout.
    }
  }
  return rows
}

const rows = docRows()

if (missingSummary.length > 0) {
  for (const path of missingSummary) {
    console.error(`::error::${path} has no \`summary:\` in its frontmatter — the index cannot say whether to open it`)
  }
  console.error(`\n${missingSummary.length} doc(s) without a frontmatter summary.`)
  process.exit(1)
}

const generated = `<!-- GENERATED by scripts/generate-docs-index.mjs — edit frontmatter or the script, never this file. -->

# uno-blueprint documentation map

Five files at the root, each answering one question:
[README](README.md) *what is this*, [SETUP](SETUP.md) *how do I run it*,
[CONTEXT](CONTEXT.md) *what do these words mean*, this file *where do I go*,
and [AGENTS](AGENTS.md) *what must I not do*.

Under \`docs/\`, three lanes, never mixed: **reference** (below — living,
always true), **history** (\`docs/plans/\`, \`docs/ideation/\`,
\`docs/brainstorms/\` — decision-era snapshots, content never edited; check a
plan's frontmatter \`status\`/\`distilled-into\` before treating it as truth),
and the **queue** ([GitHub Issues](https://github.com/BilLogic/plus-uno-blueprint/issues) —
assignment, closing and cross-repo links are things a folder of markdown
cannot do).

## Route by task

| I need to… | Go to |
|---|---|
${ROUTING.map(([q, d]) => `| ${q} | ${d} |`).join('\n')}

## Reading paths by role

Read in order and stop where it says to; each path is short on purpose.

- **New team member (non-design/dev):** \`CONTEXT.md\` → \`docs/product/01\` →
  \`02\` → \`03\`. Stop there.
- **New designer:** \`CONTEXT.md\` → \`docs/product/01\` → \`03\` → \`06\`, then
  \`docs/guidelines/overview.md\` → the foundation your task needs → the one
  composition doc for the surface you are touching.
- **New developer:** \`SETUP.md\` → \`CONTEXT.md\` →
  \`docs/engineering/codebase-guide.md\` → \`access-and-security.md\` →
  \`docs/adr/\`, with \`AGENTS.md\` in force throughout.
- **Coding agent:** \`AGENTS.md\` (auto-loaded) → \`CONTEXT.md\` for the
  vocabulary → this file's routing rows for your task. **Any task that writes
  data reads \`docs/engineering/access-and-security.md\` before it writes.**
- **Anyone crossing a repo boundary** (the database, uno-bot, the deploy):
  \`docs/connectors/overview.md\`.

## Every reference doc

Every living doc under \`docs/\`, with the one-line summary from its own
frontmatter. History is deliberately absent, and the queue does not live here.

| Doc | Audience | What it answers |
|---|---|---|
${rows.map((r) => `| ${r.path} | ${r.audience} | ${r.summary} |`).join('\n')}
`

const target = join(ROOT, 'INDEX.md')
if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(target, 'utf8')
  } catch {
    /* missing counts as stale */
  }
  if (current !== generated) {
    console.error('INDEX.md is stale — run: node scripts/generate-docs-index.mjs')
    process.exit(1)
  }
  console.log('INDEX.md is current')
} else {
  writeFileSync(target, generated)
  console.log(`wrote INDEX.md (${rows.length} reference docs indexed)`)
}
