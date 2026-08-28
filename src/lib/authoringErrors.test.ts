/**
 * The translation table, and the class of bug that emptied one row of it.
 *
 * `layers_path_row_unique` sat in `TRANSLATIONS` for months explaining a lane
 * collision no constraint could raise: nothing has ever carried that name, the
 * object on those columns was a plain index, and the branch was dead the day
 * it was written (#117 removed it, #118 made the rule real and restored it).
 * A matcher on a name that does not exist fails silently — the user gets the
 * fallback and nobody learns that a translation was missing.
 *
 * So two halves. The first drives the real database text through
 * `toAuthoringError`, captured from production rather than paraphrased, since
 * a test that invents the error text can agree with a matcher that is wrong
 * about it. The second reads the module as source and asserts that every
 * identifier-shaped matcher names something a migration actually creates —
 * which is precisely the check the dead entry would have failed.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { PostgrestError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { toAuthoringError } from '@/lib/authoringErrors'

const postgrest = (
  message: string,
  details: string,
  code: string,
): PostgrestError =>
  ({ name: 'PostgrestError', message, details, hint: '', code }) as PostgrestError

/**
 * Verbatim from the hosted project on 2026-08-28: two lanes forced into one
 * slot inside a transaction, then `set constraints … immediate` to run the
 * deferred check. Deferral is why this is the only shape that reaches a user —
 * a reorder that merely passes through a collision never raises at all.
 */
const LANE_COLLISION = postgrest(
  'duplicate key value violates unique constraint "lanes_path_position_unique"',
  'Key (path_id, "position")=(17d54a45-65ab-4670-8035-fb7bc0a0b256, 0) already exists.',
  '23505',
)

describe('a lane collision, in the words the database uses', () => {
  it('is named as lanes rather than as a generic duplicate', () => {
    const error = toAuthoringError(LANE_COLLISION)
    expect(error.message).toBe(
      'Two lanes ended up in the same position. Reload and try the move again.',
    )
  })

  it('beats the generic `duplicate key value` entry, which also matches it', () => {
    // Both entries match this text; only the order of the table decides. If
    // the specific one is ever moved below the generic one the user is told
    // "something with that name or position already exists here", which is
    // true, unhelpful, and indistinguishable from a name clash.
    const generic = toAuthoringError(
      postgrest(
        'duplicate key value violates unique constraint "cells_cell_key_unique"',
        'Key (cell_key)=(warm-up/happy/regular-tutor/step-5) already exists.',
        '23505',
      ),
    )
    expect(generic.message).toBe(
      'Something with that name or position already exists here.',
    )
  })

  it('keeps the database text on `.raw`, and off the screen', () => {
    const error = toAuthoringError(LANE_COLLISION)
    expect(error.raw).toContain('lanes_path_position_unique')
    expect(error.message).not.toContain('lanes_path_position_unique')
  })
})

/** Every `match:` literal in the module, in table order. */
function matchers(source: string): string[] {
  return [...source.matchAll(/match:\s*'([^']+)'/g)].map((m) => m[1])
}

/** Every constraint and index name any migration creates. */
function createdNames(): string[] {
  const dir = join(process.cwd(), 'supabase', 'migrations')
  const names: string[] = []
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, file), 'utf8')
    for (const m of sql.matchAll(/\bconstraint\s+([a-z_][a-z0-9_]*)/gi)) {
      names.push(m[1].toLowerCase())
    }
    for (const m of sql.matchAll(
      /\bcreate\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi,
    )) {
      names.push(m[1].toLowerCase())
    }
  }
  return names
}

describe('the translations that name a database object', () => {
  const source = readFileSync(
    join(process.cwd(), 'src', 'lib', 'authoringErrors.ts'),
    'utf8',
  )
  // Identifier-shaped only. The sentences ("A blueprint needs a name") and the
  // Postgres phrases ("duplicate key value") name nothing and are not subject.
  const identifiers = matchers(source).filter((m) => /^[a-z][a-z0-9_]*_[a-z0-9_]+$/.test(m))

  it('is not an empty subject', () => {
    // Two today. If this reaches zero the check below has stopped checking.
    expect(identifiers.length).toBeGreaterThanOrEqual(2)
  })

  for (const identifier of identifiers) {
    it(`${identifier} is a name some migration creates`, () => {
      // Substring, not equality: `findings_open_fingerprint` matches the error
      // text raised by `findings_open_fingerprint_idx`, and matching by
      // substring is what the module itself does.
      //
      // WHAT THIS CANNOT SEE: an object created and later dropped or renamed.
      // The migrations are append-only, so the create survives its own
      // deletion here. `npm run check:identifiers:live` is the half that reads
      // the schema as it stands.
      const created = createdNames()
      expect(
        created.some((name) => name.includes(identifier)),
        `no migration creates anything named like \`${identifier}\` — the matcher is dead text`,
      ).toBe(true)
    })
  }
})
