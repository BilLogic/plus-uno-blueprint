/**
 * This deployment's own numbers and paths, read by the meta-checks.
 *
 * The router, glossary, sweep and docs-index scripts are one mechanism in
 * every repository that carries them — the template and each deployment of
 * it — but each repository has its own router, its own docs tree and its own
 * routing. Those values live here and nowhere else, so the scripts that read
 * them can be the same file everywhere. It is the seam the app draws with
 * `DeploymentConfig`: the mechanism is shared, the values are ours.
 *
 * NEVER SHARED. This file is this repository's and no sync, import or merge
 * carries it across. A value copied from the template describes the template's
 * files: a budget set against a different router passes while measuring
 * nothing.
 *
 * Every field is required. There are no defaults to fall back to, because a
 * check with no number of its own has nothing to hold this repository to.
 */

/** The generated interface-to-schema map. Named once, read twice below. */
const INTERFACE_MAP = 'docs/reference/interface-schema-map.md'

export const repoConfig = {
  router: {
    /**
     * The always-loaded tier's ceiling, in characters (`check-router-budget.mjs`).
     * Set against this router, whose boot protocol, inline rules and routing
     * table are the whole of it. Lower it whenever the tier lands well under.
     */
    budget: 6000,
    /** How far under `budget` the tier may sit before the budget is stale. */
    slack: 1200,
    /**
     * The prohibition-token baseline across the tier (`check-negation-ratchet.mjs`):
     * the files it was measured over, and the count it scored.
     */
    prohibitions: { files: 1, tokens: 4 },
  },

  /**
   * Folders whose markdown every prose sweep reads, beside the root docs
   * (`swept-docs.mjs`). One folder here: this deployment ships no plugin
   * surface, so it has no `references/`, `skills/` or `agents/` at the root.
   */
  sweptDirs: ['docs'],

  /**
   * Trees whose markdown keeps the words of the day it was written, so no
   * sweep rewrites it (`swept-docs.mjs`). Decision records are the whole of
   * it here: rewriting one is falsifying it. Prefixes, matched against the
   * repo-relative path.
   */
  datedRecords: ['docs/adr'],

  /**
   * The agent-account document and the ratchet baseline beside it
   * (`generate-agent-account.mjs`). The generator is one mechanism in every
   * repository that carries it; WHERE it writes is this deployment's own, and
   * the two docs trees do not agree — the baseline sits with the rest of the
   * generated reference material here.
   */
  agentAccount: {
    document: 'docs/agents/blueprint.md',
    baseline: 'docs/reference/agent-account-baseline.json',
  },

  /**
   * Where a glossary row that names a column belongs instead
   * (`check-glossary-only.mjs`), and a routing target below.
   */
  interfaceMap: INTERFACE_MAP,

  /** The authored half of the generated `INDEX.md` (`generate-docs-index.mjs`). */
  docsIndex: {
    /**
     * A row per task someone arrives holding, phrased the way they would ask
     * it. Targets are repo-relative paths. Update it alongside any doc move.
     */
    routing: [
      ['What do these words mean — scenario, path, lane, cell, slice, finding?', 'CONTEXT.md'],
      ['What does this panel label actually name in the schema?', INTERFACE_MAP],
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
      ['Bump the template pin, or find out which side owns a file', 'docs/engineering/template-relationship.md'],
    ],

    /**
     * The `## Reading paths` list, as the markdown it renders to: one bullet
     * per kind of reader, in the order that reader should go.
     */
    readingPaths: `Read in order and stop where it says to; each path is short on purpose.

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
  \`docs/connectors/overview.md\`.`,
  },
}
