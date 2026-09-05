/**
 * The always-loaded tier: what a session is handed before it decides anything.
 *
 * One list, shared by the three checks that hold the router's shape — the char
 * budget (`check-router-budget.mjs`), the negation ratchet
 * (`check-negation-ratchet.mjs`) and the pointer sweep (`check-pointers.mjs`).
 * Two lists would drift the way two vocabularies do: a file added to one and
 * not the others is a file half the guards read. Same reason `swept-docs.mjs`
 * holds the swept set once.
 *
 * WHAT COUNTS AS ALWAYS-LOADED. A file is in this tier when the harness hands
 * it to the session without the session choosing — for an IDE agent here, that
 * is `AGENTS.md` and nothing else. There is no `CLAUDE.md`, no `.claude/`
 * bundle and no prompt assembler in this repository; the router itself is the
 * whole of the guaranteed context, which is why it says so in its first
 * sentence.
 *
 * WHAT IS DELIBERATELY OUT, and why each is a Tier-2 read rather than an
 * omission:
 *
 *   - `CONTEXT.md` and `INDEX.md` are named by the boot protocol, which makes
 *     them the first two pointers to fire, not part of the tier. A session that
 *     touches no vocabulary and knows where it is going pays for neither. They
 *     are also large (43k and 21k chars today), so counting them would make a
 *     budget on the router meaningless — the number it is supposed to protect
 *     would be four percent of the total.
 *   - `README.md` and `SETUP.md` address a human arriving at the repository.
 *   - `compound-engineering.local.md` is read by the compound-engineering
 *     plugin's own skills when one of them runs, which is a branch, not a boot.
 *
 * The tier is a list rather than a walk because membership is a fact about the
 * harness — which file the tool loads unbidden — and no directory encodes it.
 * Adding a file here is a deliberate act that moves three checks at once, which
 * is the intended cost of growing a tier that every session pays for.
 */

/** Repo-relative paths, in load order. */
export const ALWAYS_LOADED = ['AGENTS.md']

/** What the reports say they counted, so a number is never printed bare. */
export const TIER_NOUN = 'always-loaded tier'
