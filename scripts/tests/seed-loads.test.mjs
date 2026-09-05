import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  buildInventorySql,
  evaluate,
  expandSeedEntries,
  groupFailures,
  isDownstream,
  parseCounts,
  parsePsqlErrors,
  resolveSeedFiles,
  seedSectionFromConfig,
  seededTables,
} from '../check-seed-loads.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)

/**
 * The list `[db.seed].sql_paths` states IS the seed. `supabase/seed.sql` is
 * its first entry and 22 scenario files follow — so a reader that got this
 * wrong would check a fifteenth of the content and report the rest green.
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
 * The committed config, not a fixture. A path renamed in `config.toml` and
 * not on disk is a file the deployment silently stops loading, and this is
 * the only place that notices.
 */
describe('this repository’s own seed', () => {
  const files = resolveSeedFiles()

  it('resolves every entry the config names to a file on disk', () => {
    const declared = seedSectionFromConfig(
      readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8'),
    )
    expect(files).toHaveLength(declared.sqlPaths.length)
  })

  it('loads supabase/seed.sql first — the scenarios hang off what it creates', () => {
    expect(files[0].endsWith('/supabase/seed.sql')).toBe(true)
    expect(files.length).toBeGreaterThan(1)
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
