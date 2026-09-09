import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  CELL_FIELDS,
  COLUMN_DEFAULTS,
  LANE_FIELDS,
  PHASE_FIELDS,
  isEmpty,
} from '../authored_fields.mjs'
import {
  buildInventorySql,
  evaluate,
  expandSeedEntries,
  groupFailures,
  isDownstream,
  parseCounts,
  parsePsqlErrors,
  reachableFromConfig,
  seedSectionFromConfig,
  seededTables,
} from '../check-seed-loads.mjs'
import { NOT_LOADED, SEED_FILES, resolveSeedFiles } from '../load-seed.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)

/**
 * This reader no longer says what the seed IS — `scripts/load-seed.mjs` does,
 * since #547 — but it still says what `[db.seed]` would load, and empty is the
 * only passing answer. Every shape below is one this reader has to get right
 * for that alarm to mean anything.
 */
describe('reading the seed out of config.toml', () => {
  it('reads the ordered list, and keeps the order', () => {
    const section = seedSectionFromConfig(
      ['[db]', 'port = 54322', '', '[db.seed]', 'enabled = true',
        'sql_paths = ["./seed.sql", "./seeds/b.sql", "./seeds/a.sql"]', '', '[storage]',
      ].join('\n'),
    )
    expect(section).toEqual({
      enabled: true,
      sqlPaths: ['./seed.sql', './seeds/b.sql', './seeds/a.sql'],
    })
  })

  it('reads a list that wraps across lines, because the real one does', () => {
    const section = seedSectionFromConfig(
      ['[db.seed]', 'sql_paths = [', '  "./seed.sql",', '  "./seeds/one.sql"', ']', '[auth]'].join('\n'),
    )
    expect(section.sqlPaths).toEqual(['./seed.sql', './seeds/one.sql'])
  })

  it('stops at the next section, so a later array is not mistaken for the seed', () => {
    const section = seedSectionFromConfig(
      ['[db.seed]', 'sql_paths = ["./seed.sql"]', '', '[db.migrations]',
        'schema_paths = ["./schemas/everything.sql"]'].join('\n'),
    )
    expect(section.sqlPaths).toEqual(['./seed.sql'])
  })

  it('treats a missing section as no seed rather than an empty one', () => {
    expect(seedSectionFromConfig('[db]\nport = 54322\n')).toBeNull()
  })

  it('reports enabled = false, which means the deployment loads nothing', () => {
    expect(
      seedSectionFromConfig('[db.seed]\nenabled = false\nsql_paths = ["./seed.sql"]').enabled,
    ).toBe(false)
  })

  it('ignores a commented-out path, because a comment is not a seed file', () => {
    const section = seedSectionFromConfig(
      '[db.seed]\n# sql_paths = ["./old.sql"]\nsql_paths = ["./seed.sql"]',
    )
    expect(section.sqlPaths).toEqual(['./seed.sql'])
  })
})

describe('expanding a glob the config format allows', () => {
  const list = (dir) => (dir === 'seeds' ? ['b.sql', 'a.sql', 'notes.md'] : ['seed.sql'])

  it('expands `*` in sorted order, so a run is reproducible', () => {
    expect(expandSeedEntries(['./seed.sql', './seeds/*.sql'], list)).toEqual([
      'seed.sql', 'seeds/a.sql', 'seeds/b.sql',
    ])
  })

  it('leaves a literal path alone, dots and all', () => {
    expect(expandSeedEntries(['./seeds/a.b.sql'], list)).toEqual(['seeds/a.b.sql'])
  })
})

/**
 * The committed files, not fixtures. A path renamed in `load-seed.mjs` and
 * not on disk is a file the seed silently stops loading, and this is the only
 * place that notices.
 */
describe('this repository’s own seed', () => {
  const files = resolveSeedFiles()

  it('resolves every entry SEED_FILES names to a file on disk', () => {
    expect(files).toHaveLength(SEED_FILES.length)
  })

  it('loads supabase/seed.sql first — the scenarios hang off what it creates', () => {
    expect(files[0].endsWith('/supabase/seed.sql')).toBe(true)
    expect(files.length).toBeGreaterThan(1)
  })

  /**
   * The fence (#547). `[db.seed].sql_paths` is what `supabase db push
   * --include-seed` reads, and that command's `--linked` is the default and
   * its name says nothing about resetting anything. Emptying the table is the
   * whole of the reachability half of #547; a later edit that puts one path
   * back restores the reach, and nothing else in the repository reads that
   * table any more.
   */
  it('leaves [db.seed] naming nothing, so no CLI subcommand can load the seed', () => {
    expect(reachableFromConfig()).toEqual([])
  })

  it('disables [db.seed] as well, because an empty array may read as unset', () => {
    // The Supabase CLI's own default for an unset `sql_paths` is `./seed.sql`.
    // The boolean is what makes that unreachable rather than merely unlikely.
    const section = seedSectionFromConfig(
      readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8'),
    )
    expect(section.enabled).toBe(false)
  })

  /**
   * `supabase/seeds/` held 25 files while `[db.seed].sql_paths` named 22, so
   * three had never been loaded by anything and nothing said so. This does not
   * adopt them — it makes the omission a stated one, and fails when a fourth
   * file appears untethered to either list.
   */
  it('accounts for every file in supabase/seeds/, loaded or explicitly not', () => {
    const onDisk = readdirSync(resolve(ROOT, 'supabase/seeds'))
      .filter((name) => name.endsWith('.sql'))
      .map((name) => `seeds/${name}`)
      .sort()
    const accounted = [
      ...SEED_FILES.filter((rel) => rel.startsWith('seeds/')),
      ...NOT_LOADED.map((entry) => entry.file),
    ].sort()
    expect(accounted).toEqual(onDisk)
  })

  it('gives every unloaded file a reason, so the list cannot become a dumping ground', () => {
    for (const entry of NOT_LOADED) expect(entry.reason.length).toBeGreaterThan(20)
  })
})

/**
 * The safety (#547). `supabase/seed.sql` opens with a guard that refuses when
 * any row under its service holds a column `scripts/authored_fields.mjs`
 * enumerates — the columns a person typed, which the seed overwrites without
 * error because every insert in it is an upsert keyed by a hand-minted id.
 *
 * The guard restates those three lists in PL/pgSQL, because SQL cannot import
 * a JavaScript constant. A restatement is a second copy and a second copy goes
 * stale — `authored_fields.mjs` itself spent a fortnight selecting
 * `cells.maturity`, renamed to `status` in `20260821240000`, which made
 * `authored_fields.mjs export` fail outright rather than export less. So the
 * two are held to each other by set equality here, in the suite CI runs, and
 * `npm run check:seed-load` catches the other axis: a column named in the
 * guard that the schema does not have fails the load loudly.
 */
describe('the guard in supabase/seed.sql', () => {
  const seed = readFileSync(resolve(ROOT, 'supabase/seed.sql'), 'utf8')

  /** One `<name> constant text[] := array[…]` declaration, as its strings. */
  const declared = (name) => {
    const match = new RegExp(`${name}\\s+constant\\s+text\\[\\]\\s*:=\\s*array\\[([^\\]]*)\\]`, 'i')
      .exec(seed)
    if (!match) return null
    return [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1])
  }

  it('counts exactly the cell columns authored_fields.mjs enumerates', () => {
    expect(declared('cell_columns')?.sort()).toEqual([...CELL_FIELDS].sort())
  })

  it('counts exactly the lane columns authored_fields.mjs enumerates', () => {
    expect(declared('lane_columns')?.sort()).toEqual([...LANE_FIELDS].sort())
  })

  it('counts exactly the phase columns authored_fields.mjs enumerates', () => {
    expect(declared('phase_columns')?.sort()).toEqual([...PHASE_FIELDS].sort())
  })

  it('names the export command, which is what makes a refusal survivable', () => {
    expect(seed).toContain('scripts/authored_fields.mjs export')
  })

  it('scopes itself to the service it rebuilds, not to every row in the database', () => {
    // Another service's authored work is not this file's business. A guard
    // that counted it would refuse on a database this seed could not harm.
    expect(seed).toContain("target constant uuid := 'a0000000-0000-4000-8000-000000000001'")
    expect(seed).toContain('where ph.service_id = $1')
    expect(seed).toContain('where t.service_id = $1')
  })

  it('stands before the first write, or it is not a guard', () => {
    expect(seed.indexOf('do $guard$')).toBeLessThan(seed.indexOf('insert into public.services'))
    expect(seed.indexOf('do $guard$')).toBeLessThan(seed.indexOf('delete from'))
  })
})

/**
 * `cells.status` is `not null default 'live'`, so every row in the database
 * carries one whether or not a person chose it. Counted as content it would
 * export a whole board for nothing and make the seed's guard refuse on every
 * database that has any cells at all — including one this seed had just
 * loaded onto an empty database a minute earlier.
 */
describe('a defaulted column is not authored content', () => {
  it('treats a status still on its default as empty', () => {
    expect(isEmpty({ status: 'live' }, ['status'])).toBe(true)
  })

  it('treats a status that moved off the default as authored', () => {
    expect(isEmpty({ status: 'deprecated' }, ['status'])).toBe(false)
  })

  it('still treats null, blank and the empty array as empty', () => {
    expect(isEmpty({ owner: null, form: '  ', kpis: [] }, ['owner', 'form', 'kpis'])).toBe(true)
  })

  it('and the guard mirrors it — the same columns, the same defaults', () => {
    const seed = readFileSync(resolve(ROOT, 'supabase/seed.sql'), 'utf8')
    const literal = /column_defaults\s+constant\s+jsonb\s*:=\s*'([^']*)'/.exec(seed)?.[1]
    expect(JSON.parse(literal ?? 'null')).toEqual(COLUMN_DEFAULTS)
  })
})

/**
 * A seed loads in dependency order, so one broken statement takes a whole
 * subtree with it. Printing forty knock-on failures beside the one column
 * that started it is how a report buries its own finding.
 */
describe('grouping what psql said', () => {
  // Real output from the 2026-09-05 run, before the seed was regenerated.
  const STDERR = [
    'psql:supabase/seeds/warm_up_happy_path.sql:568: ERROR:  column "description" of relation "cells" does not exist',
    'psql:supabase/seeds/warm_up_happy_path.sql:584: ERROR:  column "links" of relation "cells" does not exist',
    'psql:supabase/seeds/warm_up_happy_path.sql:592: ERROR:  column "links" of relation "cells" does not exist',
    'LINE 2: set links = jsonb_build_array(',
    'psql:supabase/seeds/warm_up_happy_path.sql:120: ERROR:  insert or update on table "path_steps" violates foreign key constraint "path_steps_path_id_fkey"',
    'psql:supabase/seeds/warm_up_happy_path.sql:145: ERROR:  cells: lane_id does not exist',
  ].join('\n')

  it('reads only psql’s error lines, never its LINE echo', () => {
    const failures = parsePsqlErrors(STDERR)
    expect(failures).toHaveLength(5)
    expect(failures[0]).toEqual({
      file: 'supabase/seeds/warm_up_happy_path.sql',
      line: 568,
      message: 'column "description" of relation "cells" does not exist',
    })
  })

  it('puts root causes first and the commonest cause at the top', () => {
    const groups = groupFailures(parsePsqlErrors(STDERR))
    expect(groups.map((g) => [g.message, g.count, g.downstream])).toEqual([
      ['column "links" of relation "cells" does not exist', 2, false],
      ['column "description" of relation "cells" does not exist', 1, false],
      ['insert or update on table "path_steps" violates foreign key constraint "path_steps_path_id_fkey"', 1, true],
      ['cells: lane_id does not exist', 1, true],
    ])
  })

  it('keeps at most three examples, so one cause cannot fill the screen', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      `psql:supabase/seed.sql:${i}: ERROR:  column "picture" of relation "cells" does not exist`).join('\n')
    const [group] = groupFailures(parsePsqlErrors(many))
    expect(group.count).toBe(40)
    expect(group.examples).toHaveLength(3)
  })

  it('calls the trigger’s raise downstream — it is not a missing column', () => {
    // `cells_validate_path_match` raises `cells: lane_id does not exist`,
    // which ends in the same four words as a genuinely absent column. Read
    // as a root cause it turns one missing lane into twenty schema defects.
    expect(isDownstream('cells: lane_id does not exist')).toBe(true)
    expect(isDownstream('cells.path_id must match lanes.path_id')).toBe(true)
    expect(isDownstream('current transaction is aborted, commands ignored until end of transaction block')).toBe(true)
    expect(isDownstream('column "picture" of relation "cells" does not exist')).toBe(false)
  })
})

describe('the tables a seed writes', () => {
  it('names each one once, in first-mention order', () => {
    expect(
      seededTables(
        'insert into public.services (name) values (1);\n' +
        'INSERT INTO public.phases (id) values (1);\n' +
        'insert into public.services (name) values (2);',
      ),
    ).toEqual(['services', 'phases'])
  })

  it('does not mistake a delete or an update for an insert', () => {
    expect(seededTables('delete from public.cells;\nupdate public.cells set frame = null;')).toEqual([])
  })
})

/**
 * Loading is not rendering. A table the seed writes and the anon key cannot
 * read is a blank screen in the browser, and psql reports nothing at all.
 */
describe('the anon read', () => {
  it('asks as anon, and asks about the render joins beside the tables', () => {
    const sql = buildInventorySql(['cells'])
    expect(sql.startsWith('set role anon;')).toBe(true)
    expect(sql).toContain("select 'cells'::text as t, count(*)::bigint as n from public.cells")
    expect(sql).toContain("select '@grid', n from (")
    expect(sql).toContain("select '@placement', n from (")
  })

  it('reads psql’s pipe-separated pairs', () => {
    expect([...parseCounts('cells|749\n@grid|749\n')]).toEqual([['cells', 749], ['@grid', 749]])
  })

  it('fails an empty table the seed wrote, and says why it is not a psql error', () => {
    const counts = parseCounts('cells|0\n@grid|1\n@hierarchy|1\n@placement|1\n@resource|1')
    expect(evaluate(counts, ['cells'])).toEqual([
      'public.cells is empty as anon — the seed writes it, but the deployed key cannot see a row of it',
    ])
  })

  it('fails a render read that returns nothing even when every table has rows', () => {
    const counts = parseCounts('cells|749\n@grid|0\n@hierarchy|1\n@placement|1\n@resource|1')
    expect(evaluate(counts, ['cells'])).toEqual([
      'the blueprint grid (@grid) returned no rows — the seed\'s content loaded but does not render',
    ])
  })

  it('fails a table the read never reached, distinctly from an empty one', () => {
    expect(evaluate(parseCounts('@grid|1\n@hierarchy|1\n@placement|1\n@resource|1'), ['cells'])[0])
      .toBe('public.cells returned no row — the anon read never reached it')
  })

  it('passes when every table has rows and every join returns some', () => {
    const counts = parseCounts('cells|749\n@grid|749\n@hierarchy|22\n@placement|86\n@resource|98')
    expect(evaluate(counts, ['cells'])).toEqual([])
  })
})
