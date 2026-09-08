#!/usr/bin/env node
/**
 * Repo-local identities in a file that two repositories share.
 *
 * A file on the reconciled allowlist is held byte-identical with the
 * template's copy, so every comment in it is read by people in two different
 * repositories. An issue number, an ADR number, a migration filename or a
 * `docs/` path is an address in ONE of them. The same string then resolves to
 * two different things, and the reader who follows it concludes the comment is
 * lying rather than that the citation is.
 *
 * This is not hypothetical. `#243` is "One definition card, and no icon
 * anywhere" here and "Printing from dark mode renders the filled control at
 * dark-theme lightness" upstream, and it appears in eight shared files.
 * `#305` does not exist upstream at all. Of the three ADR citations the
 * allowlist used to carry, two named the wrong decision on one side or the
 * other, and the third matched by luck.
 *
 * The rule: a shared file names a decision and never numbers it. There is a
 * worked example in `src/hooks/useStakeholders.ts`, and ADR 0014 carries the
 * rule itself under "How a shared file cites this" — put where a reader
 * chasing a citation lands, rather than in a convention document they would
 * have to know to look for.
 *
 * Pure: it takes a path and the file's text and returns findings. The caller
 * decides which files to read and what to do about what comes back.
 */

/** Files that carry no prose, so there is nothing here to find. */
const BINARY = /\.(png|jpe?g|gif|webp|avif|woff2?|ttf|otf|ico|pdf)$/i

/**
 * Where a bare `#abc` is a colour rather than a citation.
 *
 * `#\d{3,4}` cannot tell `#304` (an issue) from `#304` (a short hex). In a
 * stylesheet or an SVG a `#` followed by three or six hex digits is a colour
 * literal and never an issue number — `src/assets/vite.svg` carries `#000` —
 * so those two forms are masked before the scan. No enrolled stylesheet cites
 * an issue number, and the alternative is a gate that cries wolf on every
 * colour it meets.
 */
const COLOUR_HOSTS = /\.(css|svg)$/i
const HEX_COLOUR = /#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b/g

const PATTERNS = [
  // An issue or pull-request number. Three or four digits: both repositories
  // are well past #99 and nowhere near #10000.
  ['issue', /#\d{3,4}\b/g],
  // An ADR by number, in either spelling, plus the path its file sits at.
  ['adr', /\bADRs?[\s-]*\d+\b|docs\/adr\//g],
  // A migration filename. The two repositories do not share a migration
  // series, so one that resolves here resolves to nothing — or to something
  // else — there.
  ['migration', /\b\d{14}_[a-z0-9_]+/g],
  // Any other `docs/` path. Both repositories have a `docs/` tree and they
  // agree on almost nothing inside it.
  ['docs-path', /\bdocs\/[a-z0-9_\-.]+(?:\/[a-z0-9_\-.]+)*/g],
  // A plan or todo by its number, date slug or section letter — `plan 003`,
  // `plan 2026-08-17-001 U1`, `nav plan D8`, `todo 027 §4`, `Plan §3`. These
  // are addresses in `docs/plans/` even when the path is left off, and that
  // tree is one repository's.
  //
  // A plan named rather than numbered — "the trigger-line plan", "the access
  // model plan" — is NOT caught, and that is the line: a name resolves to
  // nothing findable, which misleads nobody, while a number resolves to a
  // different document on each side. No regular expression can tell "the
  // trigger-line plan" from "a slot plan can be built from" anyway, so the
  // check takes the addressed forms and leaves the descriptive ones to a
  // reader.
  ['plan', /\bplans?\s+(?:\d{3}\b|20\d\d-\d\d-\d\d[-\w]*|[A-Z]\d\b)|\btodos?\s+\d{3}\b|§\s*\d/gi],
]

/**
 * Every repo-local identity in one shared file, as
 * `{ line, kind, text }` — `line` is 1-based, `text` is the matched string.
 *
 * A line is reported once per kind, not once per match, so a comment naming
 * three issues in one breath is one finding to fix rather than three.
 *
 * @param {string} path repo-relative path, used only to decide the dialect
 * @param {string} text the file's contents
 */
export function repoLocalCitations(path, text) {
  if (BINARY.test(path)) return []

  const masksColours = COLOUR_HOSTS.test(path)
  const findings = []

  text.split('\n').forEach((raw, index) => {
    const line = masksColours ? raw.replace(HEX_COLOUR, '') : raw
    for (const [kind, pattern] of PATTERNS) {
      pattern.lastIndex = 0
      const match = pattern.exec(line)
      if (match) findings.push({ line: index + 1, kind, text: match[0] })
    }
  })

  return findings
}

/** How to say a finding to someone who has to fix it. */
export function describeCitation(path, finding) {
  const advice = {
    issue: 'an issue number means a different ticket in each repository',
    adr: 'name the decision instead — each repository numbers its own ADRs',
    migration: 'the two repositories do not share a migration series',
    'docs-path': "the two repositories' docs trees do not agree",
    plan: 'a plan or todo number is an address in one repository\'s docs tree',
  }[finding.kind]
  return `${path}:${finding.line} cites \`${finding.text}\` — ${advice}`
}
