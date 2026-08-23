---
status: accepted
---

# One token model is the single seam for style enforcement

Style rules here were enforced by five independent test files — `tokenDiscipline`,
`palette`, `motion`, `canvasStackingContract`, `railRhythmContract` — each reading
its own hand-picked subset of files with its own regex. Each therefore sampled the
region where its property already held: the palette guard asserted that path colours
stay off the lane families while sampling only the one path type that cannot collide,
and the raw-value guard skipped `src/lib/`, where the values it forbids already lived.
We are replacing all five with assertions against one token model that reads the
authored token layer, the source tree and the compiled output, because a sixth and
seventh ad-hoc guard would reproduce the same blind spot twice more.

## Considered Options

Widening each existing guard in place was cheaper, preserved five passing tests, and
was rejected: five guards that each choose their own sample cannot be trusted to
tell us whether a rename touching hundreds of sites broke something, no matter how
wide each one gets. The sampling gap is a property of having five seams, not of any
one guard's scope.

## Consequences

The compiled artifact is an input to the model, produced by a fixture step that
excludes `docs/` from Tailwind's content scan. This is load-bearing rather than
hygiene: Tailwind v4 scans non-gitignored markdown, so a class name written in a
planning document generates that class in the compiled output. A risk note in
`docs/plans/2026-08-22-001-refactor-one-visual-vocabulary-plan.md` warning that
`--field` was live via `bg-field` generated the only occurrence of `bg-field` in the
repo, and thereby the evidence for its own warning.

Liveness must also be read from the JavaScript bundle, not the stylesheet alone —
`--colors-white` has zero occurrences in compiled CSS and one in the bundle, via an
inline style in `CanvasPenCursor.tsx`.
