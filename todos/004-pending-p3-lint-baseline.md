---
status: pending
priority: p3
issue_id: 004
tags: [code-review, quality]
---
# Lint baseline can't gate CI (78 pre-existing problems)

## Problem Statement
The repo carries 78 pre-existing lint problems (react-refresh/only-export-components,
set-state-in-effect, conditional hooks in legacy files), so lint can't be a CI gate;
this branch holds the line at baseline+0 by convention (one new react-refresh entry
from the hover-context hook matches existing noise). Burn down the baseline in a
dedicated pass, then gate.

## Correction (2026-08-23)

**The premise of this todo is stale.** `npx eslint .` over 469 files now returns
**0 errors, 0 warnings**. The 78 pre-existing problems are gone, so "lint can't
be a CI gate" is no longer true and the burn-down this todo asks for has already
happened by other means.

What survives is the second half: gating. Lint is clean, so it *can* be a CI gate
now, and making it one is the remaining work. Rescope or close.

## Cross-references (triaged 2026-08-23)

Partially absorbed. The `set-state-in-effect` half is now evidenced: **17** sites
carry the suppression, and the render-performance audit
behind #57 identifies which of them matter — chiefly `EditorContext.tsx:206`
and `:235`, where the `isSubslide` branch sets both ids with no equality guard
and terminates only because the next pass hits an early return. That provider
feeds the whole canvas. #57 scopes only those; the rest of the baseline stays
here.

Note the suppressions are not lint *failures* — each carries a justification
comment and eslint is clean with them in place. They are a knowingly-carried
escape hatch, which is a different thing from a baseline of unfixed problems.

Gating on lint no longer needs to wait for anything. The separate style-debt
ratchet (arbitrary values, alpha modifiers, raw values in `src/lib/`) should wait
for the token model in #56 — that is the mechanism that will count it correctly.
