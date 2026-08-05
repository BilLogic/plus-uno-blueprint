---
status: pending
priority: p3
issue_id: 016
tags: [code-review, quality, css, polish]
dependencies: []
---

# P3 polish batch — design-system merge review (2026-08-05)

Non-blocking findings from the three-agent /ce:review of the design-system
merge. None fixed yet; triage before working.

1. **`useSupabaseQuery.ts:86-94`** — error-branch result rebuilt and
   `fallback()` re-invoked every render while errored (docblock promises
   memoization). Wrap in `useMemo` keyed on `query.error` + `fallback`.
2. **`useSupabaseQuery.ts:58`** — all gated hooks (`key === null`) share the
   disabled cache entry `[null]` across types. Harmless today (nothing
   writes it; `invalidateQueries` never matches it); use a typed sentinel if
   it ever grows teeth.
3. **`scripts/tests/cell-content.test.mjs:14`** — stale header
   `Run: node --test …` survived the vitest migration.
4. **`src/styles/blueprint.css:219,349`** — comments say "ten properties",
   blocks define seven (line 230 even self-corrects).
5. **`src/styles/compat.css`** — all four Supabase-vocabulary aliases
   unconsumed; header says "goes away once empty". Delete file + its import
   in `tailwind.config.css:29`.
6. **`src/styles/unset-tw-colors.css:14-21`** — unsets families that were
   never Tailwind built-ins (crimson, gold, tomato, scale). Trim.
7. **`ThemeToggle.tsx:55-59`** — `absolute inset-0` on the resident icon is
   redundant under `mode="popLayout"`; drop one positioning layer.
8. **`--surface-hue` declared in both `semantic.css:34` and
   `themes/light.css:19`** — the one exception to "dials only in themes/";
   works by import order. Either move the default into each theme file or
   document it as the sanctioned exception next to the invariant.

## Work Log

- 2026-08-05: Collected from kieran-typescript / architecture / simplicity
  reviewers.
