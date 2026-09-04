#!/usr/bin/env node
/**
 * The reconciled set: shared files this deployment has DECLARED byte-identical
 * to the template it is imported from — agentic-service-blueprinting, the
 * dependency pinned in package.json and the lockfile.
 *
 * `scripts/check-reconciled-files.mjs` reads this list and fails CI if any
 * path on it has drifted from asb's copy. It is the failing counterpart to
 * `scripts/measure-template-divergence.mjs`, which only REPORTS divergence
 * over the whole tree and fails on nothing.
 *
 * This is a data file on purpose, and it starts EMPTY. Reconciliation happens
 * one file at a time, each under its own ticket, and enrolling a file is a
 * one-line append here — no edit to the checker, no edit to the workflow:
 *
 *     'src/lib/blueprintContract.ts',
 *
 * A path names the SAME repo-relative location in both repos; the checker
 * reads asb's copy from `node_modules/agentic-service-blueprinting/<path>`.
 * Only enrol a path once its ticket has actually made the two copies
 * identical — a path added ahead of that reddens every branch until it is
 * true.
 */
export const RECONCILED_FILES = [
  // The arrow-routing engine (#351): the same data-driven geometry in both
  // repos — anchor slots, confluence/fan-out, gap-first corridors, offset.
  // The renderers stay per-repo (uno's dependency vocab, asb's trigger vocab);
  // only these two pure files are held byte-identical.
  'src/lib/blueprintArrowGeometry.ts',
  'src/lib/arrowAnchorSlots.ts',
]
