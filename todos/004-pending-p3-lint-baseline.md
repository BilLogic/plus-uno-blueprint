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
