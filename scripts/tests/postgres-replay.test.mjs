import { describe, expect, it } from 'vitest'

import {
  classifyFailure,
  errorMessage,
  ratchetFailures,
  summariseReplay,
} from '../postgres-replay.mjs'

/**
 * The classifier is the whole report. Get it wrong and the replay says
 * "fifteen missing columns" about one trigger raising fifteen times, which
 * sends the reader to look for fifteen schema defects that are not there.
 *
 * Every string below is real psql output from the 2026-08-29 replay, not an
 * invention — the shapes that mattered are the ones the guessed patterns got
 * wrong.
 */
describe('classifying a replay failure', () => {
  it('calls a malformed literal syntax, because the file cannot have run anywhere', () => {
    // `20250625140000_before_students_join_regular_tutor_shift.sql:22` — a uuid
    // with 21 hex digits in its last group. Production would refuse it too, so
    // this is not "did not replay", it is "has never run".
    expect(
      classifyFailure(
        'psql:x.sql:22: ERROR:  invalid input syntax for type uuid: "a0000000-0000-4000-8000-000000000180503"',
      ),
    ).toBe('syntax')
    expect(classifyFailure('ERROR:  missing FROM-clause entry for table "c"')).toBe('syntax')
    expect(classifyFailure('ERROR:  syntax error at or near "picked_rows"')).toBe('syntax')
  })

  it('recognises a structural trigger raising, and does NOT read it as a missing column', () => {
    // THE ONE THAT WAS WRONG FIRST. `cells: layer_id does not exist` is a
    // `raise exception` from a trigger, and it ends in the same four words as a
    // genuinely absent column. Order the patterns the other way and fifteen
    // trigger raises are reported as fifteen schema defects.
    expect(classifyFailure('ERROR:  cells: layer_id does not exist')).toBe('assertion')
    expect(classifyFailure('ERROR:  cells: layer_id or step_id does not exist')).toBe('assertion')
  })

  it('recognises a migration asserting its own outcome', () => {
    expect(classifyFailure('ERROR:  expected 54 unbuilt cells, found 0')).toBe('assertion')
    expect(classifyFailure('ERROR:  expected 6 stakeholders, seeded 0')).toBe('assertion')
    expect(classifyFailure('ERROR:  38 mapped names match no path')).toBe('assertion')
    expect(classifyFailure('ERROR:  24 rows in the map match no path')).toBe('assertion')
  })

  it('separates a refused row from an absent object', () => {
    expect(
      classifyFailure(
        'ERROR:  insert or update on table "cell_triggers" violates foreign key constraint "cell_triggers_source_cell_id_fkey"',
      ),
    ).toBe('data')
    expect(classifyFailure('ERROR:  relation "public.stakeholders" does not exist')).toBe('structure')
    expect(classifyFailure('ERROR:  column "maturity" does not exist')).toBe('structure')
    expect(classifyFailure('ERROR:  permission denied for table agent_sessions')).toBe('structure')
  })

  it('strips psql’s file:line prefix', () => {
    expect(errorMessage('psql:20250603170000_x.sql:10: ERROR:  cells: layer_id does not exist')).toBe(
      'cells: layer_id does not exist',
    )
    expect(errorMessage(undefined)).toBe('')
  })
})

describe('summarising a replay', () => {
  const failures = [
    { file: 'a.sql', error: 'ERROR:  invalid input syntax for type uuid: "x"' },
    { file: 'b.sql', error: 'ERROR:  expected 6 stakeholders, seeded 0' },
    { file: 'c.sql', error: 'ERROR:  violates foreign key constraint "x"' },
    { file: 'd.sql', error: 'ERROR:  relation "public.stakeholders" does not exist' },
  ]

  it('reports the split, not just the count', () => {
    const summary = summariseReplay({ applied: 10, failures })
    expect(summary).toMatchObject({
      total: 14,
      applied: 10,
      failed: 4,
      byClass: { syntax: 1, assertion: 1, data: 1, structure: 1 },
    })
  })

  it('names the first failure, which is the only one nothing else explains', () => {
    expect(summariseReplay({ applied: 10, failures }).first.file).toBe('a.sql')
    expect(summariseReplay({ applied: 826, failures: [] }).first).toBeNull()
  })
})

describe('the ratchet', () => {
  const failures = [{ file: 'a.sql', error: 'x' }, { file: 'b.sql', error: 'y' }]

  it('passes when the failing set is unchanged', () => {
    expect(ratchetFailures(failures, { failing: ['a.sql', 'b.sql'] })).toEqual({
      newlyFailing: [],
      stale: [],
    })
  })

  it('catches a file that has newly stopped replaying', () => {
    expect(ratchetFailures(failures, { failing: ['a.sql'] }).newlyFailing).toEqual(['b.sql'])
  })

  it('reports an entry that is no longer true, so the baseline cannot become a backlog', () => {
    expect(ratchetFailures(failures, { failing: ['a.sql', 'b.sql', 'c.sql'] }).stale).toEqual(['c.sql'])
  })

  it('is inert until a baseline exists, rather than declaring everything new', () => {
    expect(ratchetFailures(failures, null).newlyFailing).toEqual([])
  })

  it('does not net out', () => {
    // A count would call this green: one repaired, one newly broken.
    const result = ratchetFailures(
      [{ file: 'a.sql', error: 'x' }, { file: 'z.sql', error: 'y' }],
      { failing: ['a.sql', 'b.sql'] },
    )
    expect(result.newlyFailing).toEqual(['z.sql'])
    expect(result.stale).toEqual(['b.sql'])
  })
})
