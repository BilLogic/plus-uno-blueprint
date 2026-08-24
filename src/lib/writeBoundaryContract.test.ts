import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

/**
 * No component, context or hook writes to a table directly.
 *
 * `AGENTS.md` has stated this since the ledger was built, and on 2026-08-23 a
 * docs audit found it was false: `SliceStoryboardField.tsx` set and cleared
 * `slice_items.illustration` with a bare `.from('slice_items').update()`. Two
 * things followed, and neither was visible at the call site.
 *
 * The write never reached the session ledger, which is the app's only undo, so
 * replacing a storyboard destroyed the previous picture with no record that it
 * had existed and no revert control. And `.update().eq()` without `.select()`
 * returns `error: null` when zero rows match, so clearing the image on a frame
 * that had been merged away reported success and cleared nothing.
 *
 * The rule was prose, so nothing caught it for as long as it was wrong. This
 * test is the mechanism: every table write goes through a `src/lib/*Mutations`
 * module or `authoringRpc.ts`, where the inverse is captured before the write
 * and `recordChange` runs after it.
 *
 * Reads are untouched — the hooks are full of `.from(...).select(...)` and that
 * is the correct place for them. Storage is untouched too: `client.storage
 * .from(BUCKET)` takes an identifier, not a quoted table name, so an upload
 * cannot trip this.
 */
const ROOTS = ['../components', '../contexts', '../hooks'] as const

/** `.from('table')` followed by a write verb, across at most a few lines. */
const TABLE_WRITE =
  /\.from\(\s*'[a-z_]+'\s*\)[\s\S]{0,200}?\.(update|insert|upsert|delete)\s*\(/g

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = resolve(dir, name)
    if (statSync(path).isDirectory()) {
      out.push(...walk(path))
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

test('components, contexts and hooks never write to a table directly', () => {
  const offenders: string[] = []

  for (const root of ROOTS) {
    for (const file of walk(resolve(__dirname, root))) {
      const source = readFileSync(file, 'utf-8')
      for (const match of source.matchAll(TABLE_WRITE)) {
        const line = source.slice(0, match.index).split('\n').length
        const table = match[0].match(/'([a-z_]+)'/)?.[1] ?? '?'
        const verb = match[1]
        offenders.push(
          `${file.split('/src/')[1]}:${line} — ${verb} on '${table}'`,
        )
      }
    }
  }

  expect(
    offenders,
    offenders.length === 0
      ? ''
      : `Direct table writes outside the mutation layer:\n  ${offenders.join('\n  ')}\n\n` +
        `Move the write into src/lib/<area>Mutations.ts: capture the previous ` +
        `value as the inverse, write with .select() so a zero-row update is a ` +
        `failure, then recordChange(). See setSliceFrameIllustration.`,
  ).toEqual([])
})
