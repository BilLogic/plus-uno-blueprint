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

## Cross-references (triaged 2026-08-23)

Partially absorbed. The `set-state-in-effect` half of this baseline is now
evidenced: 18 sites carry the suppression, and the render-performance audit
behind #57 identifies which of them matter — chiefly `EditorContext.tsx:206`
and `:235`, where the `isSubslide` branch sets both ids with no equality guard
and terminates only because the next pass hits an early return. That provider
feeds the whole canvas. #57 scopes only those; the rest of the baseline stays
here.

The burn-down-then-gate plan should also wait for the token model in #56 — it
is the mechanism that will count style debt correctly, and building a second
counter first means throwing one away.
