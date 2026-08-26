import { describe, expect, it } from 'vitest'
import { declarationsIn, rulesDeclaring, stylesheet } from '@/lib/tokenModel'

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
