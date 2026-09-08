#!/usr/bin/env node
/**
 * The shared-file citation rule's contract.
 *
 * A file on the reconciled allowlist is held byte-identical with the
 * template's copy, so a citation in it is read from two repositories at once.
 * These tests pin what counts as a repo-local identity and, just as
 * importantly, what does not — the rule is only worth having if it stays quiet
 * on a colour literal and on prose that merely mentions a plan.
 *
 * Exercised against literal strings rather than real files, so the outcomes
 * are pinned to the rule and not to whatever the tree happens to contain.
 */
import { describe, expect, it } from 'vitest'
import { describeCitation, repoLocalCitations } from '../repo-local-citations.mjs'

const kinds = (path, text) => repoLocalCitations(path, text).map((f) => f.kind)
const texts = (path, text) => repoLocalCitations(path, text).map((f) => f.text)

describe('what the rule catches', () => {
  it('catches an issue number, which names a different ticket on each side', () => {
    expect(texts('src/a.ts', '// A popover since #243, not a tooltip.')).toEqual(['#243'])
  })

  it('catches an ADR by number, in either spelling', () => {
    expect(texts('src/a.ts', '// This does not soften ADR 0004.')).toEqual(['ADR 0004'])
    expect(texts('src/a.ts', '// See ADR-12 and adr 3.')).toEqual(['ADR-12'])
    // Also a docs path, and reported as both: the two say different things
    // about why it cannot stay, and a reader fixing it wants the ADR reason.
    expect(kinds('src/a.ts', '// docs/adr/0003-a-service-owns-its-journey.md')).toEqual([
      'adr',
      'docs-path',
    ])
  })

  it('catches a migration, by filename or by its bare timestamp', () => {
    expect(texts('src/a.ts', '// `20260729120000_derived_layer.sql` narrowed it')).toEqual([
      '20260729120000_derived_layer',
    ])
    // The bare form is the one that got away first: a citation in backticks
    // with no `_name` after it walked past a pattern that required the suffix.
    expect(texts('src/a.ts', '// outside the grant (`21000113000000`)')).toEqual([
      '21000113000000',
    ])
  })

  it('catches any other docs path', () => {
    expect(texts('src/a.ts', '// See docs/plans/2026-08-17-003-plan.md.')).toContain(
      'docs/plans/2026-08-17-003-plan.md.',
    )
  })

  it('catches a plan or todo by number, date slug or section letter', () => {
    expect(texts('src/a.ts', '// plan 003 declined it')).toEqual(['plan 003'])
    expect(texts('src/a.ts', '// (plan 2026-08-17-001): the mark')).toEqual([
      'plan 2026-08-17-001',
    ])
    expect(texts('src/a.ts', '// three row states (nav plan D8)')).toEqual(['plan D8'])
    expect(texts('src/a.ts', '// a rotation is not a drag (todo 027)')).toEqual(['todo 027'])
    expect(texts('src/a.ts', "// Plan §3's gap-first order")).toEqual(['§3'])
  })

  it('reports a line once per kind, so one comment is one thing to fix', () => {
    expect(kinds('src/a.ts', '// #243 and #305 and #112 all moved')).toEqual(['issue'])
    expect(kinds('src/a.ts', '// #243, and ADR 0004 with it')).toEqual(['issue', 'adr'])
  })
})

describe('what the rule leaves alone', () => {
  it('leaves a hex colour alone in a stylesheet or an SVG', () => {
    expect(repoLocalCitations('src/a.svg', '<path fill="#000"/>')).toEqual([])
    expect(repoLocalCitations('src/a.css', '  --ring: #304;')).toEqual([])
    expect(repoLocalCitations('src/a.css', '  --ring: #8900ff;')).toEqual([])
  })

  it('leaves a fully-qualified cross-repository reference alone', () => {
    // The owner and repository are written down, so the address does not
    // change with the reader — it is the bare form that means two things.
    expect(
      repoLocalCitations('src/a.ts', '// BilLogic/agentic-service-blueprinting#139 settled it'),
    ).toEqual([])
    expect(texts('src/a.ts', '// qualified owner/repo#139, then bare #243')).toEqual(['#243'])
  })

  it('still catches an ADR in a stylesheet — only the colour form is masked', () => {
    expect(texts('src/a.css', '/* into the build (ADR 0001) */')).toEqual(['ADR 0001'])
  })

  it('leaves a plan named rather than numbered alone', () => {
    // A name resolves to nothing findable, which misleads nobody; a number
    // resolves to a different document on each side. No pattern can separate
    // "the trigger-line plan" from "a slot plan can be built from", so the
    // check takes the addressed forms and leaves these to a reader.
    expect(repoLocalCitations('src/a.ts', '// the trigger-line plan says so')).toEqual([])
    expect(repoLocalCitations('src/a.ts', '// A shape a slot plan can be built from')).toEqual(
      [],
    )
    expect(repoLocalCitations('src/a.ts', '// Plan the anchor slots for one band.')).toEqual([])
  })

  it('leaves an OKLCH literal alone — a decimal tail is not a timestamp', () => {
    // Four confident findings on a stylesheet that cites nothing is how the
    // unanchored version announced itself. Both series begin `20` or `21`, and
    // neither a digit nor a decimal point may sit on either side.
    expect(repoLocalCitations('src/a.css', '  --x: oklch(0.47058823529411 0 0);')).toEqual([])
    expect(repoLocalCitations('src/a.ts', 'const n = 120260729120000')).toEqual([])
  })

  it('leaves a two-digit number alone — neither repository is back at #99', () => {
    expect(repoLocalCitations('src/a.ts', '// grid-cols-#12 is not a citation')).toEqual([])
  })

  it('reads nothing out of a binary file', () => {
    expect(repoLocalCitations('public/logo.png', '#243 ADR 0004')).toEqual([])
    expect(repoLocalCitations('src/f.woff2', 'docs/adr/0001.md')).toEqual([])
  })
})

describe('what a failure tells the reader', () => {
  it('names the file, the line, the citation and why it cannot stay', () => {
    const [finding] = repoLocalCitations('src/a.ts', '\n// since #243\n')
    expect(finding).toEqual({ line: 2, kind: 'issue', text: '#243' })
    expect(describeCitation('src/a.ts', finding)).toBe(
      'src/a.ts:2 cites `#243` — an issue number means a different ticket in each repository',
    )
  })

  it('tells an ADR citation what to do instead, rather than only that it is wrong', () => {
    const [finding] = repoLocalCitations('src/a.ts', '// ADR 0005 says')
    expect(describeCitation('src/a.ts', finding)).toContain('name the decision instead')
  })
})
