/**
 * #278 — the shipped images move into the bucket.
 *
 * Three things must stay true: the series refuses a site-relative url or
 * frame; the repo ships no `public/blueprint-images`; and no source names a
 * path under it. The script's key derivation is pinned against the
 * migration's, since the two never exchange a mapping.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { replayMigrations } from '../migration-replay.mjs'
import { firstCellByPath, objectId, objectKey, SHELF_CELL } from '../move-images-to-bucket.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)

test('the series refuses a site-relative resource url or storyboard frame', () => {
  const schema = replayMigrations(resolve(ROOT, 'supabase/migrations'))
  assert.ok(schema.constraints.has('resources.resources_url_absolute'), 'resources may point inside the site again')
  assert.ok(schema.constraints.has('cells.cells_frame_absolute'), 'a frame may point inside the site again')
})

test('the repo ships no blueprint-images folder and no source names one', () => {
  assert.ok(!existsSync(resolve(ROOT, 'public/blueprint-images')), 'public/blueprint-images is back')
  const offenders = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        const source = readFileSync(path, 'utf8')
        if (/['"`]\/blueprint-images\//.test(source)) offenders.push(path.slice(ROOT.length + 1))
      }
    }
  }
  walk(resolve(ROOT, 'src'))
  assert.deepEqual(offenders, [])
})

test('the script derives the key the migration derives', () => {
  // md5('/blueprint-images/x.png')::uuid, as Postgres prints it.
  assert.equal(objectId('/blueprint-images/x.png'), 'dda92990-ec16-10dc-45c6-5d512d4cd5b1')
  assert.equal(
    objectKey('/blueprint-images/a/B.PNG', '11111111-1111-4111-8111-111111111111'),
    'cells/11111111-1111-4111-8111-111111111111/' + objectId('/blueprint-images/a/B.PNG') + '.png',
  )
  const first = firstCellByPath([
    { path: '/blueprint-images/shared.png', cellId: 'b0000000-0000-4000-8000-000000000000' },
    { path: '/blueprint-images/shared.png', cellId: 'a0000000-0000-4000-8000-000000000000' },
    { path: 'https://elsewhere/x.png', cellId: '00000000-0000-4000-8000-000000000009' },
  ])
  assert.equal(first.get('/blueprint-images/shared.png'), 'a0000000-0000-4000-8000-000000000000')
  assert.equal(first.size, 1)
  assert.equal(SHELF_CELL, '00000000-0000-4000-8000-000000000000')
})
