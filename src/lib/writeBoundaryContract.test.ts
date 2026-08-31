import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

/**
 * Nothing writes to a table except the modules that own the write path.
 *
 * `AGENTS.md` has stated this since the ledger was built, and on 2026-08-23 a
 * docs audit found it was false: `SliceStoryboardField.tsx` set and cleared
 * `slides.illustration` with a bare `.from('slides').update()`. Two
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
 * **The guard itself was the next thing to be wrong.** It scanned three named
 * roots — `components/`, `contexts/`, `hooks/` — so `src/lib` was invisible to
 * it, and `agent/tools/registry.ts` wrote `findings` straight from the tool
 * dispatcher for as long as that hole existed: no ledger entry, no captured
 * inverse, ⌘Z stepping over the write to undo somebody else's edit instead. A
 * named-roots list can only ever cover the directories that existed the day it
 * was written. So the walk now starts at `src/` and the exemptions are named
 * one by one: a new directory is covered the moment it appears, and a new
 * writer has to argue for itself here.
 *
 * Reads are untouched — the hooks are full of `.from(...).select(...)` and that
 * is the correct place for them. Storage is untouched too: `client.storage
 * .from(BUCKET)` takes an identifier, not a quoted table name, so an upload
 * cannot trip this.
 */
const SRC = resolve(__dirname, '..')

/**
 * A `src`-relative path that owns part of the write path, and why.
 *
 * The `*Mutations.ts` family is matched by shape rather than listed, because
 * adding one is the *sanctioned* way to add a write and should not need an
 * edit here. The pattern is anchored at `lib/` on purpose: a
 * `components/FooMutations.ts` is not a mutation module, it is this test being
 * routed around.
 */
const MUTATION_MODULE = /^lib\/[A-Za-z]+Mutations\.ts$/

/**
 * The writers that are deliberately outside the `*Mutations` family. Each is
 * asserted to exist below, so a rename fails loudly instead of quietly
 * widening the exemption to nothing.
 */
const EXEMPT: ReadonlyArray<{ path: string; because: string }> = [
  {
    path: 'lib/revertChange.ts',
    because:
      'the ledger’s own inverse-applier — it cannot record a change, recording one is what it undoes',
  },
  {
    path: 'lib/agent/persistence.ts',
    because:
      'the agent transcript (agent_sessions / agent_messages), which is not blueprint data and has nothing to revert',
  },
]

function isExempt(relative: string): boolean {
  return (
    MUTATION_MODULE.test(relative) ||
    EXEMPT.some((entry) => entry.path === relative)
  )
}

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

test('every exempted writer still exists', () => {
  const missing = EXEMPT.filter(
    (entry) => !existsSync(resolve(SRC, entry.path)),
  ).map((entry) => entry.path)
  expect(
    missing,
    `Exempted from the write boundary but no longer present: ${missing.join(', ')}. ` +
      'If it moved, move the exemption with it; if it is gone, delete the exemption.',
  ).toEqual([])
})

test('nothing outside the mutation layer writes to a table directly', () => {
  const offenders: string[] = []

  for (const file of walk(SRC)) {
    const relative = file.slice(SRC.length + 1)
    if (isExempt(relative)) continue
    const source = readFileSync(file, 'utf-8')
    for (const match of source.matchAll(TABLE_WRITE)) {
      const line = source.slice(0, match.index).split('\n').length
      const table = match[0].match(/'([a-z_]+)'/)?.[1] ?? '?'
      const verb = match[1]
      offenders.push(`${relative}:${line} — ${verb} on '${table}'`)
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

/**
 * …and every write that fails translates the failure before raising it.
 *
 * The companion rule to the one above, and it was false for longer. The
 * boundary test made the `*Mutations` family the only place a table may be
 * written; it said nothing about what those modules do when the write is
 * refused, and eight of them did the worst available thing:
 * `throw new Error(error.message)`. Two consequences, neither visible at the
 * call site.
 *
 * The reader saw Postgres. `new row violates row-level security policy for
 * table "phases"` went to the panel as the error text, which is precisely what
 * `AuthoringError` exists to stop — `raw` is for the console, `message` is for
 * a person.
 *
 * And `toAuthoringError` is where a denial re-derives the tier (#136). A
 * module that raises around it is a module where a demoted session keeps being
 * offered the button, because the one signal that the local tier is stale
 * never reaches the reconciler. That made the reconcile look installed while
 * covering only five of the thirteen modules that write.
 *
 * So: the same modules the boundary test permits to write are the modules
 * required to translate. Nothing here inspects the reads — a hook raising
 * `error.message` from a `.select()` is a different problem with a different
 * answer.
 */
const RAW_THROW = /throw new Error\(\s*[A-Za-z_$][\w$]*\.message\s*\)/g

/** Written by hand for a person, not forwarded from the database. */
const HUMAN_SENTENCE_OWNERS: ReadonlySet<string> = new Set([
  // `agent/persistence.ts` writes the transcript, not the board: its failures
  // are not authoring failures and have no tier to reconcile.
  'lib/agent/persistence.ts',
])

test('a write that is refused is translated, never forwarded raw', () => {
  const offenders: string[] = []

  for (const file of walk(SRC)) {
    const relative = file.slice(SRC.length + 1)
    if (!isExempt(relative)) continue
    if (HUMAN_SENTENCE_OWNERS.has(relative)) continue
    const source = readFileSync(file, 'utf-8')
    for (const match of source.matchAll(RAW_THROW)) {
      const line = source.slice(0, match.index).split('\n').length
      offenders.push(`${relative}:${line} — ${match[0]}`)
    }
  }

  expect(
    offenders,
    offenders.length === 0
      ? ''
      : `Raw database text raised at the reader:\n  ${offenders.join('\n  ')}\n\n` +
        `Use \`throw toAuthoringError(error)\`. It phrases the failure for a ` +
        `person, keeps the database's own text on \`.raw\` for the console, ` +
        `and is where an authorization denial re-derives the session tier.`,
  ).toEqual([])
})

test('the translation rule can fail', () => {
  // The guard above is a regex over source text, which is the kind of check
  // that passes because it matched nothing. Prove it matches the shape it
  // claims to, and does not match the shape it permits.
  expect('if (error) throw new Error(error.message)'.match(RAW_THROW)).not.toBeNull()
  expect('throw new Error(readError.message)'.match(RAW_THROW)).not.toBeNull()
  expect('throw toAuthoringError(error)'.match(RAW_THROW)).toBeNull()
  expect('throw new Error(`That ${subject} no longer exists.`)'.match(RAW_THROW)).toBeNull()
})
