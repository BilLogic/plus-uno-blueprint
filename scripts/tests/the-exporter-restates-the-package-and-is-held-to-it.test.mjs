import { test } from 'vitest'
import assert from 'node:assert/strict'

import { appSource } from '../app-source.mjs'
import {
  CELL_COLUMNS,
  ENTITY_STATUS,
  RESOURCE_KINDS,
  TOUCHPOINT_ROLES,
} from '../export-sample-board.mjs'

/**
 * THE EXPORTER RESTATES FOUR OF THE PACKAGE'S VOCABULARIES. THIS IS WHAT STOPS
 * THE RESTATEMENT FROM DRIFTING.
 *
 * `scripts/export-sample-board.mjs` writes the offline board, and the offline
 * board has to be the shape the application reads. The application's rules are
 * TypeScript inside `node_modules`, which a plain `.mjs` script cannot import —
 * Playwright's transform hook declines any path with a `node_modules` segment
 * and Node's own type stripping refuses it outright — so the exporter restates
 * them: the six `entity_status` values, the two placement roles, the two
 * resource kinds, and the cell columns the board query asks for.
 *
 * A restatement with nothing holding it to its original is the defect
 * `scripts/check-lane-role-roster.mjs` exists for, one aggregate over: "none of
 * the three derives from the others, so their divergence is itself the
 * failure". The cost is specific and silent. A column added to the package's
 * `CELL_FIELDS` is a column the exporter never selects, so every offline board
 * regenerated afterwards quietly loses it — and nothing reds, because the
 * missing field is optional on the type and absent on a board nobody diffs.
 *
 * READ AS TEXT, not imported, for the same reason the exporter restates them.
 * The patterns are anchored on the package's own declarations; if one of them
 * moves or is renamed, this REFUSES rather than falling back to an empty set,
 * because an empty set agrees with every restatement.
 */

/** Every single-quoted string inside `text`. */
const quoted = (text) => [...text.matchAll(/'([^']*)'/g)].map((match) => match[1])

/** The body of a declaration, from `after` to the first `close`. */
function slice(source, subject, after, close) {
  const start = source.indexOf(after)
  assert.ok(
    start >= 0,
    `${subject}: the package no longer spells \`${after}\`. This check reads the application's ` +
      'own source as text, so a declaration that moved has to be followed here rather than ' +
      'guessed at — an unfound pattern agrees with everything.',
  )
  const end = source.indexOf(close, start + after.length)
  assert.ok(end > start, `${subject}: found \`${after}\` and no closing \`${close}\` after it`)
  return source.slice(start + after.length, end)
}

test('the six entity_status values are the package’s six', () => {
  const declared = quoted(
    slice(appSource('lib/entityStatus.ts'), 'entity status', 'ENTITY_STATUS = [', ']'),
  )
  assert.deepEqual(
    [...ENTITY_STATUS].sort(),
    declared.sort(),
    'scripts/export-sample-board.mjs narrows a cell’s and a path’s status to a vocabulary the ' +
      'application no longer has. A value the exporter drops renders as unsaid offline and as ' +
      'itself with a database, which is the same board disagreeing with itself.',
  )
})

test('the two placement roles are the package’s two', () => {
  const source = appSource('lib/touchpointRole.ts')
  const declared = quoted(slice(source, 'touchpoint role', 'export function normalizeRole', '}'))
  assert.deepEqual(
    [...TOUCHPOINT_ROLES].sort(),
    [...new Set(declared)].sort(),
    'the exporter accepts a different set of placement roles than the application does',
  )
})

test('the two resource kinds are the package’s two', () => {
  const source = appSource('lib/cellResources.ts')
  // The package writes the rule as one branch — `attachment` or a link — so the
  // set is that word plus the default the type names.
  assert.ok(
    source.includes("=== 'attachment' ? 'attachment' : 'link'"),
    'the package no longer spells the resource-kind rule the way this check reads it',
  )
  assert.deepEqual([...RESOURCE_KINDS].sort(), ['attachment', 'link'])
})

test('the cells the exporter selects are the columns the board reads, plus cell_key', () => {
  const fields = slice(appSource('lib/cellFields.ts'), 'cell fields', 'CELL_FIELDS = [', '] as const')
  const declared = [...fields.matchAll(/key: '([^']+)'/g)].map((match) => match[1])
  assert.ok(declared.length > 0, 'cell fields: found the list and no `key:` in it')

  // `cell_key` is the one column the exporter asks for and the live board does
  // not: a board with a database can ask which authored cell a row is, and a
  // board without one can only know if the export carried it.
  const selected = CELL_COLUMNS.split(',').map((column) => column.replace(/"/g, ''))
  assert.deepEqual(
    selected.slice().sort(),
    [...declared, 'cell_key'].sort(),
    'the exporter and the application disagree about a cell’s columns. A column the package ' +
      'added and this did not is a field every regenerated offline board silently loses; one ' +
      'this asks for and the package dropped is a 42703 on the next export.',
  )
})
