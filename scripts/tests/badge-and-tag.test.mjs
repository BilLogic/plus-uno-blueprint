/**
 * #182 — the design system has two words for two ideas, and keeps them.
 *
 * A **badge** describes the thing it sits on: one per thing, not drawn from a
 * set, never interactive. A **tag** is one value out of a set, selectable or
 * removable. By that split the owner control is the only real tag in the
 * codebase and the divider label is a badge. "Chip" and "pill" were a third
 * and fourth name for those same two ideas, and they are not names any more.
 *
 * TWO GUARDS, and neither is a snapshot of today's tree — a check that
 * enumerates the files that exist right now passes for a codebase that has
 * quietly grown a thirty-first offender.
 *
 * 1. **No NAME says chip or pill.** The subject is every source file under
 *    `src`, comments removed, so a component, a prop, a constant, a variant
 *    string, a data attribute or a file name that reintroduces either word
 *    fails — including one written next week. `src` is the whole subject
 *    because `docs/plans`, `docs/adr`, `docs/brainstorms` and
 *    `supabase/migrations` are DATED RECORDS of what was decided and applied
 *    on a day, and rewriting a record is worse than the word it removes. The
 *    living docs — `docs/guidelines`, `docs/reference` — were swept by hand
 *    with this change and are held by review, not by this file.
 *
 * 2. **No COMMENT says chip or pill either.** The same walk, read on its other
 *    axis: `commentsOnly()` is the exact complement of `stripComments`, so one
 *    corpus feeds two assertions rather than two walks drifting apart. This
 *    half was excluded on the argument that a codebase is allowed to say why a
 *    word left, and that a guard reading comments could not be satisfied by
 *    any tree that explains its own history. That argument is right about the
 *    DOCUMENTS and wrong about the axis. What it protects is the rename map
 *    and this file, and both live under `scripts/`, outside a subject that was
 *    always `src`. Inside `src` a comment is not history — it is the sentence
 *    the next reader learns the name from, which is how six of them went on
 *    calling the badge a chip after #182 renamed everything around them.
 *
 *    NO EXEMPTION LIST, and that is a property of the subject rather than an
 *    omission. The four documents this repository exempts everywhere else —
 *    a guard's own file, `.changeset/`, `CHANGELOG.md` and
 *    `supabase/migrations/` — are outside `src` by construction, so nothing
 *    whose job is to write the retired word down is ever read. `lane_role`'s
 *    catalogue comment still says "pill cells" because no migration has
 *    changed it, and the scripts that quote that comment as a fixture quote it
 *    accurately; they move when the comment does.
 *
 * 3. **No badge changes colour or border on hover.** The subject is every
 *    `<Badge …>` element in the app plus the primitive's own variant table —
 *    an element-shaped subject rather than a list of badge files, because the
 *    next badge will be in a file this list has never heard of. A hover state
 *    reads as clickable and a badge is not; the tooltip, the focus ring and
 *    the help cursor are what say "there is something here".
 *
 * All three are proved to go red, in the shape
 * `scripts/tests/rls-posture.test.mjs` argues for: a check that is green
 * against this tree could equally be a check that examines nothing.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const SRC = resolve(ROOT, 'src')

/* --------------------------------------------------------------- the tree */

/** Comments removed, verbatim from `src/lib/tokenModel.ts`. */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** A block comment, or a line comment whose `//` is not part of a URL. */
const COMMENT = /\/\*[\s\S]*?\*\/|(^|[^:])(\/\/.*)$/gm

/**
 * The complement of `stripComments`: every comment kept, every other character
 * blanked to a space.
 *
 * Blanked rather than collected, so a line number still means what it says —
 * the report below is `file:line`, and a guard that names the wrong line is a
 * guard nobody trusts twice. It is written against the same two patterns
 * instead of subtracting one result from the other, because positions shift
 * the moment anything is removed.
 */
export function commentsOnly(source) {
  const out = source.replace(/[^\n]/g, ' ').split('')
  for (const match of source.matchAll(COMMENT)) {
    const text = match[2] ?? match[0]
    const start = match.index + (match[2] ? match[1].length : 0)
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] !== '\n') out[start + i] = text[i]
    }
  }
  return out.join('')
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    // A vanished entry is skipped — see `designSystemSources` for whose file
    // it is and why it vanishes mid-walk.
    let directory
    try {
      directory = statSync(path).isDirectory()
    } catch {
      return []
    }
    if (directory) return walk(path)
    if (!/\.(tsx?|css)$/.test(entry)) return []
    return [path]
  })
}

/**
 * Every TypeScript and stylesheet file under `src`, split into its two halves:
 * `code` is the file with comments stripped, `comments` is what the stripping
 * removed.
 *
 * ONE walk, because the name assertion and the comment assertion are one
 * corpus read on two axes; a second walk would be a second thing to keep in
 * step, and the sampling gap asserted below would then have to be asserted
 * twice.
 *
 * Test files are IN, unlike `sourceFiles()`'s roots: a test that asserts
 * against `techPillFace` is carrying the retired name just as surely as the
 * component would, and `coverCommandChip.test.tsx` was one of the offenders
 * this ticket found.
 */
export function designSystemSources() {
  return walk(SRC)
    .map((path) => {
      /*
        A file listed by the walk and gone by the time it is read is SKIPPED,
        not thrown on. `harness-claims.test.mjs` writes a probe component into
        `src/components/cover/` and deletes it again to prove the claim checker
        goes red, and vitest runs files in parallel — so this walk really does
        see a path that no longer exists, at a rate of roughly one run in four.
        The subject is every file that IS there.
      */
      try {
        const source = readFileSync(path, 'utf8')
        return {
          file: relative(ROOT, path).split('\\').join('/'),
          code: stripComments(source),
          comments: commentsOnly(source),
        }
      } catch {
        return null
      }
    })
    .filter((one) => one !== null)
    .sort((a, b) => a.file.localeCompare(b.file))
}

/* ------------------------------------------------- 1. chip and pill as names */

/** The two words that stopped being names. */
export const RETIRED_DESIGN_WORDS = ['chip', 'pill']

const SAYS_RETIRED = new RegExp(`(${RETIRED_DESIGN_WORDS.join('|')})`, 'i')

/** Every name in the tree that still says chip or pill, with where it is. */
export function namesThatSayChipOrPill(sources) {
  const out = []
  for (const { file, code } of sources) {
    if (SAYS_RETIRED.test(file)) out.push(`${file} — the file name`)
    code.split('\n').forEach((line, index) => {
      if (SAYS_RETIRED.test(line)) out.push(`${file}:${index + 1} ${line.trim()}`)
    })
  }
  return out
}

test('no name in the app says chip or pill', () => {
  const found = namesThatSayChipOrPill(designSystemSources())
  assert.deepEqual(
    found,
    [],
    'A name says "chip" or "pill". The design system has two words: a BADGE ' +
      'describes the thing it sits on, a TAG is one value out of a set. Both of ' +
      'these were a third and fourth name for those two ideas, and a touchpoint ' +
      "pill is a cell with a shape variant rather than a shape of its own:\n" +
      found.join('\n'),
  )
})

test('the name check goes red on a component that reintroduces either word', () => {
  const planted = [
    { file: 'src/components/blueprint/LaneChip.tsx', code: 'export function LaneChip() {}' },
    { file: 'src/lib/quiet.ts', code: "export const PILL_HEIGHT = 52\nconst x = 'pills'" },
  ]
  assert.deepEqual(namesThatSayChipOrPill(planted), [
    'src/components/blueprint/LaneChip.tsx — the file name',
    'src/components/blueprint/LaneChip.tsx:1 export function LaneChip() {}',
    'src/lib/quiet.ts:1 export const PILL_HEIGHT = 52',
    "src/lib/quiet.ts:2 const x = 'pills'",
  ])
})

test('the tree the name check reads is the tree, not a handful of files', () => {
  // The failure this whole file exists to prevent, one level up: a walker that
  // found nothing would pass exactly as loudly as a codebase that is clean.
  const sources = designSystemSources()
  assert.ok(sources.length > 200, `only ${sources.length} source files found under src`)
  for (const root of ['components/', 'lib/', 'contexts/', 'hooks/', 'styles/', 'types/']) {
    assert.ok(
      sources.some((one) => one.file.startsWith(`src/${root}`)),
      `src/${root} is not in the subject — the sampling gap that let a guard read only components/`,
    )
  }
})

/* ------------------------------------------- 2. chip and pill, in a comment */

/** Every comment in the tree that still says chip or pill, with where it is. */
export function commentsThatSayChipOrPill(sources) {
  const out = []
  for (const { file, comments } of sources) {
    comments.split('\n').forEach((line, index) => {
      if (SAYS_RETIRED.test(line)) out.push(`${file}:${index + 1} ${line.trim()}`)
    })
  }
  return out
}

test('no comment in the app says chip or pill', () => {
  const found = commentsThatSayChipOrPill(designSystemSources())
  assert.deepEqual(
    found,
    [],
    'A comment says "chip" or "pill". A comment inside `src` is where the next ' +
      'reader learns what to call the thing, so it teaches the retired name as ' +
      'surely as a component would: a BADGE describes the thing it sits on, a ' +
      'TAG is one value out of a set. Where neither word is what the sentence ' +
      'means, say what it means — the default size, a filled square, a ' +
      `button — rather than reaching for a third:\n${found.join('\n')}`,
  )
})

test('the comment check goes red on the sentences the name check ignores', () => {
  // The two axes on one corpus, stated as the pair they are: these lines are
  // invisible to the name check by construction, and the whole of what the
  // comment check is for.
  const planted = [
    {
      file: 'src/components/blueprint/Quiet.tsx',
      code: [
        '/* The touchpoint face used to be a pill with its own component. */',
        'export function TouchpointBadge() {} // was a chip',
      ].join('\n'),
    },
    {
      file: 'src/styles/quiet.css',
      code: '/* a touchpoint, once a chip, sits a step paler */\n.cell { color: red; }',
    },
  ].map(({ file, code }) => ({ file, code: stripComments(code), comments: commentsOnly(code) }))

  assert.deepEqual(namesThatSayChipOrPill(planted), [])
  assert.deepEqual(commentsThatSayChipOrPill(planted), [
    'src/components/blueprint/Quiet.tsx:1 ' +
      '/* The touchpoint face used to be a pill with its own component. */',
    'src/components/blueprint/Quiet.tsx:2 // was a chip',
    'src/styles/quiet.css:1 /* a touchpoint, once a chip, sits a step paler */',
  ])
})

test('the comment reader keeps the line numbers and drops the code', () => {
  // The extraction, on the shapes the corpus actually holds: a bare code line,
  // a block spanning two lines, a `//` inside a URL (which is the reason
  // `stripComments` carries `(^|[^:])` at all), and a trailing comment.
  const source = [
    'const a = 1',
    '/* block',
    '   spanning */',
    "const url = 'https://example.com' // after a URL",
    'const b = 2 // trailing',
  ].join('\n')
  const lines = commentsOnly(source).split('\n')
  assert.equal(lines.length, 5, 'a blanked line went missing')
  assert.deepEqual(
    lines.map((line) => line.trim()),
    ['', '/* block', 'spanning */', '// after a URL', '// trailing'],
  )
  // Blanked, not deleted: the comment sits where it sat.
  assert.equal(lines[4].indexOf('//'), source.split('\n')[4].indexOf('//'))
})

test('the walk reads the comments it claims to', () => {
  // The same fact the name walk asserts, one axis over. A reader that returned
  // nothing would satisfy the assertion above in silence.
  const sources = designSystemSources()
  const written = sources.flatMap(({ comments }) =>
    comments.split('\n').filter((line) => line.trim() !== ''),
  )
  assert.ok(written.length > 1000, `only ${written.length} comment lines were read`)
  assert.ok(sources.some(({ comments }) => comments.includes('badge')))
})

/* --------------------------------------------------- 3. a badge has no hover */

/**
 * Every `<Badge …>` opening tag in the app, and the primitive's variant table.
 *
 * An element-shaped subject rather than a file list: the rule is about what a
 * badge may do, so it has to find the next badge too, wherever it is written.
 */
export function badgeClassStrings(sources) {
  const out = []
  for (const { file, code } of sources) {
    for (const match of code.matchAll(/<Badge\b([^>]*)>/g)) {
      out.push({ file, where: '<Badge>', text: match[1] })
    }
    if (file.endsWith('ui/badge.tsx')) {
      const cva = /const badgeVariants = cva\(([\s\S]*?)\n\)/.exec(code)
      if (cva) out.push({ file, where: 'badgeVariants', text: cva[1] })
    }
  }
  return out
}

/** A hover utility that repaints — the thing that reads as clickable. */
const REPAINTS_ON_HOVER = /hover:(?:\[?[a-z-]*)?(?:bg|text|border|ring|shadow|underline)/

/** Badges that change colour or border on hover, or claim to be clickable. */
export function badgesThatReactToHover(strings) {
  return strings.flatMap((entry) => {
    const hover = REPAINTS_ON_HOVER.test(entry.text)
    const pointer = /cursor-pointer/.test(entry.text)
    if (!hover && !pointer) return []
    return [`${entry.file} (${entry.where}) — ${hover ? 'repaints on hover' : 'cursor-pointer'}`]
  })
}

test('no badge changes colour or border on hover', () => {
  const strings = badgeClassStrings(designSystemSources())
  // The extraction, asserted before its result is trusted.
  assert.ok(
    strings.filter((one) => one.where === '<Badge>').length > 5,
    'the <Badge> extraction found almost nothing — it is reading the wrong shape',
  )
  assert.ok(
    strings.some((one) => one.where === 'badgeVariants'),
    'the badge primitive’s variant table was not found',
  )
  const found = badgesThatReactToHover(strings)
  assert.deepEqual(
    found,
    [],
    'A badge reacts to the pointer. A hover state reads as clickable and a badge ' +
      'never is — it describes the thing it sits on. What a badge keeps is the help ' +
      `cursor, the focus ring and the tooltip:\n${found.join('\n')}`,
  )
})

test('the hover check goes red on a badge that grows one', () => {
  const planted = [
    {
      file: 'src/components/blueprint/Planted.tsx',
      code: [
        '<Badge className="hover:bg-muted">{name}</Badge>',
        '<Badge variant="outline" className="cursor-pointer">{name}</Badge>',
        '<Badge className="border-transparent">{name}</Badge>',
      ].join('\n'),
    },
    {
      file: 'src/components/ui/badge.tsx',
      code: 'const badgeVariants = cva(\n  "rounded-4xl hover:border-ring",\n)',
    },
  ]
  const found = badgesThatReactToHover(badgeClassStrings(planted))
  assert.deepEqual(found, [
    'src/components/blueprint/Planted.tsx (<Badge>) — repaints on hover',
    'src/components/blueprint/Planted.tsx (<Badge>) — cursor-pointer',
    'src/components/ui/badge.tsx (badgeVariants) — repaints on hover',
  ])
})

test('the hover check leaves an interactive control inside a badge alone', () => {
  // The distinction: a badge may CONTAIN something clickable — the scenario
  // badge's parallel-scenario tooltip is one — and that control is allowed to
  // react. What is forbidden is the badge itself repainting under the pointer.
  const quiet = [
    {
      file: 'src/components/blueprint/Quiet.tsx',
      code: [
        '<Badge className="cursor-help border-transparent">',
        '  <button className="hover:opacity-100 hover:bg-muted">i</button>',
        '  {name}',
        '</Badge>',
      ].join('\n'),
    },
  ]
  assert.deepEqual(badgesThatReactToHover(badgeClassStrings(quiet)), [])
})
