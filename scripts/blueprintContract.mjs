/**
 * `BLUEPRINT_CONTRACT`, as a value, for the checks that hold it to reality.
 *
 * The contract lives in `src/lib/blueprintContract.ts` and must stay
 * dependency-free — uno-bot compiles that module inside a Worker. So the
 * checkers cannot import it as TypeScript and had been re-deriving it with
 * one bespoke regexp each. That is its own hazard: a regexp that stops
 * matching returns an empty list, and a loop over an empty list passes.
 *
 * This reads the object literal and evaluates it, so a checker gets the real
 * values or a hard error — never a plausible-looking empty set. Any shape the
 * reader cannot find throws here, at import, where the run dies loudly.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const CONTRACT_PATH = 'src/lib/blueprintContract.ts'

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)
const OPENING = 'export const BLUEPRINT_CONTRACT = '
const CLOSING = '} as const'

export function readContract(root = REPO_ROOT) {
  const source = readFileSync(resolve(root, CONTRACT_PATH), 'utf8')

  const start = source.indexOf(OPENING)
  if (start === -1) {
    throw new Error(
      `${CONTRACT_PATH} no longer declares "${OPENING.trim()}". The contract ` +
        `readers cannot see it, so nothing downstream is being checked. Fix the ` +
        `reader in scripts/blueprintContract.mjs rather than the declaration.`,
    )
  }

  const body = source.slice(start + OPENING.length)
  const end = body.lastIndexOf(CLOSING)
  if (end === -1) {
    throw new Error(
      `${CONTRACT_PATH} no longer ends its literal with "${CLOSING}". See ` +
        `scripts/blueprintContract.mjs.`,
    )
  }

  // The literal is plain JS once `as const` is dropped: comments, trailing
  // commas and single quotes are all legal. JSON.parse cannot read it.
  const literal = body.slice(0, end + 1)
  const value = new Function(`return (${literal})`)()

  for (const key of [
    'urlParams',
    'appUrl',
    'breadcrumb',
    'publicReadTables',
    'botReadTables',
    'fkConstraints',
    'rpcs',
    'searchBlueprintParams',
    'searchBlueprintColumns',
    'searchBlueprintInclude',
  ]) {
    if (!(key in value)) {
      throw new Error(
        `${CONTRACT_PATH} no longer declares "${key}". If that removal is ` +
          `deliberate, drop it from the required list here and from the ` +
          `coverage table in scripts/tests/blueprintContract.test.mjs.`,
      )
    }
  }

  return value
}

export const BLUEPRINT_CONTRACT = readContract()
