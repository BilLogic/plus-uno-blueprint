import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  declarationsIn,
  rulesDeclaring,
  sourceFiles,
  sourceMatching,
  stripComments,
  stylesheet,
} from '@/lib/tokenModel'

/**
 * The seam's own guard.
 *
 * ADR 0001 makes `tokenModel` the one place that answers what the token layer
 * declares, so every rule built on it inherits whatever the reader cannot see.
 * It read line by line and required a declaration to close its own line, and
 * forty-one did not: `--background`, `--foreground`, `--card`, `--popover`,
 * `--secondary`, `--muted-foreground`, `--tertiary-foreground`, the contrast
 * ladder and every chart step are wrapped `oklch(…)` calls. The most-read names
 * in the system were invisible to the model that exists to see them, and no
 * rule failed — a rule only fails on what it can read.
 *
 * It surfaced sideways: `compat.css` aliases `--color-foreground-light` to
 * `--muted-foreground`, and the new "an alias points at a name semantic.css
 * declares" rule called it dangling against a name semantic.css declares at
 * line 166. So this file asserts the reader directly, rather than waiting for
 * the next blind spot to show up as a wrong answer somewhere else.
 */

describe('the declaration reader', () => {
  it('sees a declaration wrapped across lines', () => {
    const wrapped = rulesDeclaring('--muted-foreground')
    expect(wrapped).toHaveLength(1)
    expect(wrapped[0].file).toBe('semantic.css')
    expect(wrapped[0].selector).toBe(':root, .dark, .light')
    // Whitespace-collapsed, so how a value was wrapped is not part of what it is.
    expect(wrapped[0].value).toMatch(/^oklch\( from var\(--foreground\) /)
    expect(wrapped[0].value).not.toMatch(/\n/)
  })

  it('reports a wrapped declaration at the line its name sits on', () => {
    const [declaration] = rulesDeclaring('--muted-foreground')
    const line = stylesheet('semantic.css').text.split('\n')[declaration.line - 1]
    expect(line).toContain('--muted-foreground:')
  })

  it('misses none of the declarations in a sheet', () => {
    // The blunt cross-check: count `--name:` at the start of a line in the raw
    // text and compare. A reader that drops a shape drops the count with it.
    const text = stylesheet('semantic.css').text.replace(
      /\/\*[\s\S]*?\*\//g,
      (comment) => comment.replace(/[^\n]/g, ' '),
    )
    const written = [...text.matchAll(/^\s*--[a-zA-Z0-9-]+\s*:/gm)].length
    expect(declarationsIn('semantic.css')).toHaveLength(written)
  })
})

/**
 * The source reader's own guard, for the property the style rules cannot check
 * about themselves: that a reported `file:line` is the line the reader means.
 *
 * `stripComments` used to DELETE block comments rather than blank them, so
 * every newline inside a file's header vanished and every line number after it
 * shifted up by the header's height. Nothing failed, because a passing rule
 * reports no lines at all — the drift only shows once a rule starts failing,
 * which is the moment the number has to be right. Widening the sample to the
 * whole tree (#414) was that moment: `dev/ArrowSituationCatalogPage.tsx` opens
 * with a thirteen-line header, and its `#2563eb` on line 28 was being reported
 * at line 15, on an import statement.
 */
describe('the source reader', () => {
  const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')

  it('keeps every line, so a stripped file numbers the same as the raw one', () => {
    for (const source of sourceFiles()) {
      const raw = readFileSync(resolve(SRC, source.file), 'utf8')
      expect(source.code.split('\n')).toHaveLength(raw.split('\n').length)
    }
  })

  it('reports a match at the line it sits on in the file on disk', () => {
    // One end-to-end check through the same path a rule takes, rather than
    // trusting the line-count equality above to imply it.
    const matches = sourceMatching(/ARROW_COLOR = /g)
    expect(matches.length).toBeGreaterThan(0)
    for (const match of matches) {
      const [file, line] = match.split(':')
      const raw = readFileSync(resolve(SRC, file), 'utf8').split('\n')
      expect(raw[Number(line) - 1]).toContain('ARROW_COLOR = ')
    }
  })

  it('still blanks what a comment says, so a comment is not a use', () => {
    const stripped = stripComments('const a = 1 /* text-red-500 */\nconst b = 2\n')
    expect(stripped).not.toContain('text-red-500')
    expect(stripped.split('\n')).toHaveLength(3)
  })
})
