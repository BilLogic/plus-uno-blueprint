#!/usr/bin/env node
/**
 * A migration that creates a table in `public` must revoke anon's writes on it.
 *
 * `20260828121000` swept twelve tables and a view clean of anon write grants,
 * and wrote its post-condition against the schema so it could not pass while
 * any remained. It held. Two days later `20260830140000` created two tables
 * and the count went from zero back to eight — without granting anything to
 * anon, because it did not have to. The platform grants the API roles on
 * relations created in `public`; the grants arrive with the table.
 *
 * So the sweep was never a fix, it was a repair, and the repair is owed once
 * per new table forever. This is the rule that collects the debt at the point
 * it is incurred.
 *
 * ── Why static, when a live check already exists ──────────────────────────
 *
 * `check:rls-posture:live` asks the catalog and would have caught this the
 * moment it happened. It needs a service-role connection, so it is not in
 * `gates.yml`, so it did not run, so it was red on production for as long as
 * those two tables existed and nobody was looking. A check that only runs
 * when someone remembers is a check that reports on attention rather than on
 * the schema.
 *
 * This one reads the series. No database, no credentials, runs on every PR.
 * It is strictly weaker — it cannot see what the platform actually granted —
 * and that is the trade: it catches the migration, not the database, and the
 * migration is where a human can still act.
 *
 * ── The cutoff, and why it is a date rather than an allowlist ─────────────
 *
 * Tables created before `20260828121000` were swept by that file, in bulk,
 * once. Demanding a per-file revoke from migrations written before the rule
 * existed would fail thirty files for not obeying something not yet decided.
 * So the rule begins where the sweep did. A dated cutoff says "from here on"
 * and needs no maintenance; an allowlist of exempt tables would need a line
 * added every time somebody looked at it and grew until it meant nothing.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** The sweep that established the rule. Files at or after it must obey it. */
export const RULE_BEGINS_AT = '20260828121000'

/** The privileges a table hands `anon` on creation, none of which it may keep. */
export const ANON_WRITE_PRIVILEGES = ['insert', 'update', 'delete', 'truncate']

/**
 * The SQL with its prose removed.
 *
 * Not decoration. The header of `20260830140000` explains that "a failed
 * CREATE TABLE rolls back", and the sentence made this check report a table
 * called `rolls` that no migration has ever created. A rule that reads
 * comments is a rule that fires on how carefully someone explained
 * themselves, and the answer is to stop reading comments rather than to
 * write worse ones.
 *
 * Line comments and block comments only. A `--` inside a string literal would
 * be mistaken for a comment, which is a known and accepted imprecision here:
 * the statements this file looks for — `create table`, `revoke` — do not
 * carry string literals, and the alternative is a tokeniser.
 */
export function withoutComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
}

/** `create table [if not exists] public.foo` — the name, however it was spelled. */
export function tablesCreated(sql) {
  const created = []
  sql = withoutComments(sql)
  const pattern =
    /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?/gi
  let match
  while ((match = pattern.exec(sql)) !== null) created.push(match[1].toLowerCase())
  return created
}

/**
 * Tables the file revokes anon's writes on.
 *
 * A revoke naming a subset — `revoke insert on … from anon` — does not count.
 * Three of the four privileges left behind is the shape that reads as done and
 * is not, and TRUNCATE is the one a partial revoke tends to drop: it is the
 * privilege that bypasses RLS entirely, so it is the only one where the grant
 * is the sole gate.
 */
export function tablesRevoked(sql) {
  const revoked = new Set()
  sql = withoutComments(sql)
  const pattern =
    /\brevoke\s+([^;]*?)\s+on\s+(?:table\s+)?(?:"?public"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?\s+from\s+([^;]*);/gi
  let match
  while ((match = pattern.exec(sql)) !== null) {
    const [, privileges, table, grantees] = match
    if (!/\banon\b/i.test(grantees)) continue
    const listed = privileges.toLowerCase()
    const complete =
      /\ball\b/.test(listed) ||
      ANON_WRITE_PRIVILEGES.every((privilege) => listed.includes(privilege))
    if (complete) revoked.add(table.toLowerCase())
  }
  return revoked
}

/**
 * One finding per table created at or after the cutoff that the series never
 * revokes anon's writes on.
 *
 * Series-wide, not file-local, and the difference is the whole design. The
 * invariant worth holding is that no table REACHES THE END of the series
 * still granted — not that each migration apologises inside its own text.
 * `20260830140000` created the two touchpoint tables and did not revoke;
 * `20260830240000` revokes them. Demanding the revoke sit in the creating file
 * would mean editing an applied migration to satisfy a linter, which is the
 * precedent `20260830160000` was careful to spend only on a statement that
 * deleted rows.
 *
 * The revoke must come at or after the creation. An earlier one does not
 * count: it would be revoking a table that does not exist yet, which Postgres
 * refuses anyway, and accepting it would let a file "cover" a table added
 * years later.
 */
export function findings(files) {
  const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name))
  const revokedAt = new Map()
  for (const { name, sql } of ordered) {
    for (const table of tablesRevoked(sql)) {
      if (!revokedAt.has(table)) revokedAt.set(table, [])
      revokedAt.get(table).push(name)
    }
  }

  const found = []
  for (const { name, sql } of ordered) {
    if (name.slice(0, RULE_BEGINS_AT.length) < RULE_BEGINS_AT) continue
    for (const table of tablesCreated(sql)) {
      const covered = (revokedAt.get(table) ?? []).some((at) => at >= name)
      if (!covered) found.push({ file: name, table })
    }
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
    for (const { file, table } of bad) {
      console.error(
        `${file}: creates public.${table} and never revokes anon's writes on it`,
      )
    }
    console.error(
      `\nAdd: revoke ${ANON_WRITE_PRIVILEGES.join(', ')} on public.<table> from anon;\n` +
        'The grants arrive with the table — see 20260830240000_anon_picked_up_two_more_tables.sql.',
    )
    process.exit(1)
  }
  const governed = files.filter((f) => f.name.slice(0, RULE_BEGINS_AT.length) >= RULE_BEGINS_AT)
  console.log(
    `ok — ${governed.length} migrations since ${RULE_BEGINS_AT}; every table they create revokes anon's writes`,
  )
}
