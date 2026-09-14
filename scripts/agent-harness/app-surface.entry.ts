/**
 * The harness's one-sourcing seam: rolldown bundles this entry at startup, so
 * the tool declarations the harness offers a provider are the EXACT objects the
 * app hands its providers. No copies, so no drift.
 *
 * WHY AN ENTRY FILE AT ALL. The harness used to bundle the application's
 * `lib/agent/tools/specs.ts` directly and destructure four exports from it,
 * because that module declared all four: the spec array, the write roster, the
 * mobile roster and the reference list. It declares none of them now. A tool is
 * one definition under `lib/agent/tools/definitions/` — its name, its surface,
 * its zod arguments, where it may run and its `run` — and `specs.ts` is one
 * line projecting that list. The three rosters are therefore DERIVED from the
 * definitions, which is a bundler's job and not a text reader's, and a bundle
 * has one entry. This file is that entry: it re-exports what the application
 * states and derives what the application derives, in the application's own
 * terms, so there is still exactly one statement of each fact.
 *
 * It is a `.ts` file in a repository of `.mjs` scripts for the same reason:
 * it imports the application through the `@/…` alias, which is TypeScript's
 * and Vite's, and rolldown resolves it here the way the browser build does.
 */
export { TOOL_SPECS } from '@/lib/agent/tools/specs'
import { TOOL_DEFINITIONS } from '@/lib/agent/tools/definitions'
export { TOOL_DEFINITIONS }
/**
 * The two rosters the harness gates on, derived here the way the app's own
 * `roster.ts` derives them: a write is a tool on the write surface, and the
 * mobile roster is every tool whose availability says it may run in the
 * view-only shell. Derived rather than listed, so a tool that changes surface
 * changes both sides at once.
 */
export const WRITE_TOOL_NAMES = new Set(
  TOOL_DEFINITIONS.filter((tool) => tool.surface === 'write').map((tool) => tool.name),
)
export const MOBILE_READ_TOOL_NAMES = new Set(
  TOOL_DEFINITIONS.filter((tool) => tool.availability.mobile).map((tool) => tool.name),
)
/**
 * The reference vocabulary, so `list_references` answers from the app's own
 * list rather than a second copy the harness would have to keep in step.
 */
export { REFERENCE_NAMES } from '@/lib/agent/tools/referenceNames'
