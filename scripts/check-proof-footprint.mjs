#!/usr/bin/env node
/**
 * A migration's proof block may not leave the database changed.
 *
 * `20260830160000` proved that a placement reorder no longer raises 23505.
 * It proved it correctly. It also deleted a production row while doing so,
 * because `sync_cell_touchpoints` is a SYNC: handed two probe names, it
 * removes every placement the cell already had. The cleanup then removed the
 * probes and the cell was left holding nothing.
 *
 * Nothing reported it. The migration applied cleanly, its own assertion
 * passed — it asserted the swap took, which was true — and every check in
 * this repository stayed green. It surfaced because a placement count run for
 * an unrelated reason came back one lower than a note from an hour earlier.
 *
 * That is the gap this file closes. Proving a destructive function behaves is
 * a legitimate and valuable thing for a migration to do — the unit test could
 * not, because the PLAN was right and only its application failed. What is
 * not legitimate is proving it against rows somebody authored. So the rule is
 * not "do not call it" but "borrow and return": a block that runs a syncing
 * function against a row it did not create must snapshot what it found and
 * put it back.
 *
 * ── Two ways to give it back ──────────────────────────────────────────────
 *
 * The first is to snapshot the rows and reinsert them, which is what the
 * amended proof in `20260830160000` does.
 *
 * The second was found by #187's proof and is better where it applies: build
 * the wanted list out of the cell's OWN content and append the probes to it.
 * Then nothing is displaced in the first place — the real names are in the
 * list, so the sync keeps them — and the block puts the text back at the end.
 * A rule that only knew the snapshot shape flagged that block, which is a
 * false positive on the safer of the two designs.
 *
 * Deliberately not a general-purpose SQL analyser. It knows one function by
 * name, because that is the one that syncs, and a second such function should
 * arrive here as a second entry rather than as a regex that guesses.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Functions that delete whatever they were not told to keep. */
export const SYNCING_FUNCTIONS = ['sync_cell_touchpoints']

/** Every `do $tag$ ... $tag$` body in a migration, tag spelling and all. */
export function proofBlocks(sql) {
  const blocks = []
  const opener = /\bdo\s+\$([A-Za-z_]*)\$/gi
  let match
  while ((match = opener.exec(sql)) !== null) {
    const terminator = `$${match[1]}$`
    const start = match.index + match[0].length
    const end = sql.indexOf(terminator, start)
    // An unterminated block is a syntax error, and check:migration-syntax is
    // what reports that. Here it is simply not a block, so it is skipped
    // rather than reported twice under a name that would confuse the reader.
    if (end === -1) continue
    blocks.push(sql.slice(start, end))
    opener.lastIndex = end + terminator.length
  }
  return blocks
}

/**
 * What a block does to rows it did not create.
 *
 * `borrows` is the load-bearing distinction: a block that selects a cell out
 * of the table is working on somebody's data, and one that only inserts its
 * own scaffolding is not. Without it the rule would ban the honest version of
 * this proof along with the destructive one.
 */
export function blockFootprint(block) {
  const body = block.toLowerCase()
  return {
    syncs: SYNCING_FUNCTIONS.some((fn) => body.includes(`${fn}(`)),
    borrows: /\bfrom\s+public\.cells\b/.test(body),
    // A block asserting the call was REFUSED is proving the opposite thing,
    // and there is nothing to give back because nothing was taken. The
    // companion proof in `20260830160000` is exactly this: it picks a cell
    // holding no placements, calls the function, and asserts it skipped. If
    // the gate ever broke, that assertion is what would say so.
    provesRefusal: /'skipped'/.test(body),
    snapshots: body.includes('jsonb_agg'),
    restores: /\binsert\s+into\s+public\.cell_touchpoints\b/.test(body),
    // The other safe shape: the wanted list is built from the cell's own
    // content, so the sync has nothing to displace, and the text it borrowed
    // to build that list is put back.
    derivesFromContent: /regexp_split_to_array\s*\(\s*[a-z_]*\.?content/.test(body),
    // A restore assigns the SAVED value and nothing else. The append that
    // sets up this shape is also an `update public.cells set content`, so a
    // looser test would let the block satisfy itself with the statement that
    // did the borrowing.
    restoresContent:
      /\bupdate\s+public\.cells\s+set\s+content\s*=\s*[a-z_][a-z0-9_]*\s+where\b/.test(
        body,
      ),
  }
}

/** Whether a block that borrowed rows returns them, by either route. */
export function returnsWhatItBorrowed(footprint) {
  const { snapshots, restores, derivesFromContent, restoresContent } = footprint
  return (snapshots && restores) || (derivesFromContent && restoresContent)
}

/** One finding per block that syncs against borrowed rows without returning them. */
export function findings(files) {
  const found = []
  for (const { name, sql } of files) {
    proofBlocks(sql).forEach((block, index) => {
      const footprint = blockFootprint(block)
      const { syncs, borrows, snapshots, derivesFromContent, provesRefusal } = footprint
      if (provesRefusal) return
      if (!syncs || !borrows) return
      if (returnsWhatItBorrowed(footprint)) return
      found.push({
        file: name,
        block: index + 1,
        reason: snapshots
          ? 'snapshots the rows it displaces but never puts them back'
          : derivesFromContent
            ? 'builds its wanted list from the cell\'s content but never puts the content back'
            : 'runs a syncing function against rows it did not create, and keeps no copy',
      })
    })
  }
  return found
}

export function migrationFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = join(process.cwd(), 'supabase', 'migrations')
  const files = migrationFiles(dir)
  const bad = findings(files)
  if (bad.length > 0) {
    for (const { file, block, reason } of bad) {
      console.error(`${file}: do-block ${block} ${reason}`)
    }
    console.error(
      '\nA proof block may borrow a row, but it has to give it back. See ' +
        'supabase/migrations/20260830230000_the_proof_deleted_a_placement_and_the_count_was_the_only_witness.sql.',
    )
    process.exit(1)
  }
  console.log(
    `ok — ${files.length} migration files; every proof block that syncs borrowed rows restores them`,
  )
}
