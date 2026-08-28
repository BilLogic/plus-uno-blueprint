/**
 * The parse gate, exercised on the three shapes it was built from.
 *
 * `check:migration-syntax` is green against `main` now that #148's three files
 * are fixed, so its headline assertion proves nothing on its own — a check that
 * never reports and a directory that is clean look identical from outside. What
 * is asserted here is that it would go red again: that a CTE opened without a
 * comma is caught, that `E'a' E'b'` is caught, that both are caught INSIDE a
 * plpgsql body where the statement grammar sees only a string, and that the
 * things this check deliberately does not do stay undone.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findings, lineOf, migrationFiles, syntaxErrors } from '../check-migration-syntax.mjs'

/** A throwaway migration directory. */
function dirWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'migration-syntax-'))
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql)
  return dir
}

/**
 * The #148 shape: a CTE chain whose last comma went missing under a comment.
 *
 * `separator` is what sits between the closing paren of one CTE and the name of
 * the next — `','`, or nothing, with or without a comment line.
 */
function cteChain(separator) {
  return `create or replace function public.f() returns int language plpgsql as $fn$
begin
  return (
    with everything as (
      select 1 as x
    )${separator}
    picked_rows as (
      select e.x from everything e
    )
    select p.x from picked_rows p
  );
end;
$fn$;`
}

test('a CTE that opens without a comma is a syntax error, comment or no comment', async () => {
  assert.deepEqual(await syntaxErrors(cteChain(',')), [])
  // The comma is the whole difference. A comment between the CTEs changes
  // nothing for Postgres and changes everything for a human reading the diff,
  // which is why both search migrations survived review.
  assert.deepEqual(await syntaxErrors(cteChain(',\n    -- what the caller asked for')), [])

  for (const separator of ['', '\n    -- what the caller asked for']) {
    const errors = await syntaxErrors(cteChain(separator))
    assert.equal(errors.length, 1)
    assert.equal(errors[0].pass, 'plpgsql body')
    assert.match(errors[0].message, /syntax error at or near "picked_rows"/)
  }
})

test('the statement grammar alone cannot see into a plpgsql body', async () => {
  // The reason there are two passes. `$fn$ … $fn$` is a string constant to the
  // grammar, so the pass that reads statements accepts a body that Postgres
  // would reject the moment `check_function_bodies` compiled it.
  const errors = await syntaxErrors(cteChain(''))
  assert.deepEqual(
    errors.map((one) => one.pass),
    ['plpgsql body'],
  )
})

test('an escape-string continuation may not carry its own E prefix', async () => {
  const block = (first, second) => `do $o$
declare
  guard constant text :=
    ${first}
    ${second};
begin
  raise notice '%', guard;
end
$o$;`

  // Adjacent constants separated by a newline concatenate — but only when the
  // continuation is a plain literal. This is the pair that ran in production
  // and the pair that was filed, in that order.
  assert.deepEqual(await syntaxErrors(block("E'a\\n' ||", "E'b\\n'")), [])
  assert.deepEqual(await syntaxErrors(block("'a'", "'b'")), [])

  const errors = await syntaxErrors(block("E'a\\n'", "E'b\\n'"))
  assert.equal(errors.length, 1)
  assert.equal(errors[0].pass, 'plpgsql body')
  assert.match(errors[0].message, /syntax error at or near "E'b/)
})

test('a body Postgres would accept but never resolve is not this check’s subject', async () => {
  // Syntax, and only syntax. A table that does not exist is an execution-time
  // error and no parser has an opinion about it. Said out loud here so that a
  // green run is never read as more than it is.
  assert.deepEqual(
    await syntaxErrors(`create or replace function public.f() returns int language plpgsql as $fn$
begin
  return (select nope from public.no_such_table);
end;
$fn$;`),
    [],
  )
  // A `language sql` body inside `$$ … $$` is a string to the grammar and is
  // not plpgsql, so neither pass reaches it. One of the two blind spots the
  // script's docstring names; asserted so it cannot close by accident and go
  // unnoticed.
  assert.deepEqual(
    await syntaxErrors("create function public.g() returns int language sql as $$ select 1 frm t $$;"),
    [],
  )
})

test('findings walk .sql files in filename order and carry a line', async () => {
  const dir = dirWith({
    '002_broken.sql': cteChain(''),
    '001_fine.sql': 'create table public.t (id uuid primary key);',
    'notes.md': 'not a migration',
  })
  assert.deepEqual(
    migrationFiles(dir).map((file) => file.split('/').pop()),
    ['001_fine.sql', '002_broken.sql'],
  )

  const problems = await findings(dir)
  assert.equal(problems.length, 1)
  assert.match(problems[0].file, /002_broken\.sql$/)
  assert.equal(problems[0].line, 7)
})

test('the line is recovered from the message, and admits when it cannot be', () => {
  const sql = 'line one\nline two\n  picked_rows as (\n'
  assert.equal(lineOf(sql, 'syntax error at or near "picked_rows"'), 3)
  // Nothing to quote, or a token the file does not contain: no line, and the
  // finding still stands without one.
  assert.equal(lineOf(sql, 'out of memory'), null)
  assert.equal(lineOf(sql, 'syntax error at or near "absent"'), null)
})
