#!/usr/bin/env node
/**
 * The reconciled set: shared files this deployment has DECLARED byte-identical
 * to the template it is imported from — agentic-service-blueprinting, the
 * dependency pinned in package.json and the lockfile.
 *
 * `scripts/check-reconciled-files.mjs` reads this list and fails CI if any path
 * on it has drifted from the template's copy.
 *
 * ── WHAT THIS LIST IS FOR NOW ─────────────────────────────────────────────
 *
 * It used to be the road to the import flip and the larger half of this file.
 * At its peak it held 522 paths, 507 of them under `src/`, each one a file
 * somebody had proved identical so that it could one day be deleted and
 * imported instead. That day came: this deployment reads the application out
 * of the package, `src/` is gone, and for every one of those 507 files drift
 * is no longer prevented — it is impossible. There is one copy.
 *
 * So the 507 are not unenrolled. Their subject left the repository, which is
 * the outcome the enrolments were working toward rather than a retreat from
 * them. What remains is the set the flip could not dissolve: files this
 * repository still HOLDS and still shares, where two copies genuinely exist
 * and can still disagree.
 *
 * There are fifteen, and they fall into three groups.
 *
 *   - **The build's own configuration.** `vite.config.ts`, `tsconfig.json`,
 *     `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`,
 *     `components.json`. These matter MORE after the flip than before it, not
 *     less: the first three now carry the seam itself — where `@/…` resolves,
 *     where `~/…` resolves, what `tsc` compiles and what vitest collects — and
 *     the same bytes serve a repository with a deployment root and one without
 *     by what is on disk rather than by what either file says. A local edit
 *     here is how the seam would quietly stop being a seam, and the gate is
 *     what forces that conversation upstream instead.
 *   - **Shared scripts and their tests.** `erd-value-sets.mjs`,
 *     `always-loaded.mjs`, `authoring-archivers.mjs`, `check-pointers.mjs`,
 *     `check-router-budget.mjs`, and two suites. `scripts/` is the one tree
 *     the flip did not touch: it is not the application, so it did not move
 *     into the package, and where both repositories run the same check they
 *     still run two copies of it.
 *   - **Two data files.** `public/step-visual-placeholder.svg`, whose NAME is
 *     written into fourteen applied migrations so only the copy inside it is
 *     shareable, and `docs/agents/triage-labels.md`, which maps the five
 *     canonical triage roles to the label strings a tracker uses — a role the
 *     template respells is a label this deployment's agents would go on
 *     applying under the old one.
 *
 * ── WHAT A FILE ON THIS LIST MAY NOT SAY ──────────────────────────────────
 *
 * A file here is read from two repositories at once, so it CITES NO
 * REPO-LOCAL IDENTITY: no issue or pull-request number, no ADR number, no
 * migration filename, no `docs/` path, no plan or todo number. Each of those
 * is an address in one repository and resolves to something else, or to
 * nothing, in the other.
 *
 * This is measured, not feared. `#243` was "One definition card, and no icon
 * anywhere" here and "Printing from dark mode renders the filled control at
 * dark-theme lightness" upstream, and it appeared in eight enrolled files.
 * `#305` does not exist upstream at all. Where a shared comment has to point
 * at a decision, it NAMES the decision — "the decision that a service owns its
 * journey and shares the catalog", never "ADR 3". ADR 0014 carries the rule
 * under "How a shared file cites this".
 *
 * `check:reconciled` enforces this over everything on this list, whatever the
 * extension.
 *
 * ── TWO ENTRIES ARE ENROLLED AND CURRENTLY FAILING, ON PURPOSE ────────────
 *
 * `scripts/tests/one-badge-one-size.test.mjs` and
 * `scripts/tests/authoring-log.test.mjs` both reach for `src/`: the first
 * walks it and reads `src/components/ui/badge.tsx`, the second imports
 * `../../src/lib/authoringLog.ts`. Both subjects are the application's and are
 * now inside the package, so both suites fail here with ENOENT.
 *
 * They stay on this list. Unenrolling a file to make a suite green is the one
 * move this gate exists to prevent, and neither file has drifted — both are
 * still byte-identical to the template's copy, which is the only thing this
 * list asserts. What has happened is that the template has not yet been taught
 * that a repository running these checks might not hold the application, and
 * that is an upstream change: the two paths want resolving the way
 * `vite.config.ts` already resolves the application's root — `./src` if it
 * exists, else the package's — or, for the second, importing through `@/…`,
 * which the vitest aliases already answer in both repositories. Same bytes,
 * different behaviour by what is on disk, which is the pattern the build files
 * above already follow.
 *
 * Until that lands upstream and arrives with a pin, these two are a known red
 * with a named cause, which is a better state than a gate with two holes in it.
 *
 * ── HOW THIS LIST GROWS NOW ───────────────────────────────────────────────
 *
 * Slowly, and in one direction only. The application can no longer be enrolled
 * because it is no longer here. A new entry is a file this repository gains
 * that the template also has and that both agree should not drift — which in
 * practice means another shared script, or another piece of the build. Adding
 * one is still a one-line append under its own reasoning.
 */

export const RECONCILED_FILES = [
  // ── The build's own configuration, and the seam it now carries ──
  //
  // `tsconfig.json` carries the `@/*` mapping every import in the package
  // resolves through, and `~/*` beside it so an editor resolves what the build
  // resolves; remap either on one side alone and identical text quietly stops
  // naming the same modules — the one failure a byte-identity gate cannot see
  // for itself. `tsconfig.app.json` is the language the shared code is authored
  // in — `strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, ES2023 — plus
  // the include that compiles `deployment` beside `src`. `components.json` is
  // the shadcn registry config that GENERATES the `components/ui/` primitives:
  // a changed `style` or `baseColor` moves no file by itself, it makes the next
  // `shadcn add` emit a differently-shaped primitive.
  'tsconfig.json',
  'tsconfig.app.json',
  'components.json',

  // `vite.config.ts` is the one that reads as a deployment file and is not.
  // Enrolling it is the point: this deployment may not edit the template's
  // code, so a build difference has to arrive as a seam the template offers,
  // and the gate is what forces that conversation instead of letting a quiet
  // local edit stand in for it. Since the flip it holds the two aliases, the
  // deployment test glob and the application source root — the whole mechanism
  // by which this repository runs code it does not contain.
  //
  // `tsconfig.node.json` is the compiler config for exactly that one file.
  // `eslint.config.js` is a register of lint exceptions; it was declined once,
  // on the ground that two repos disagreeing about `no-unused-vars` cannot make
  // identical source mean different things, and enrolled later when the two
  // converged anyway.
  'eslint.config.js',
  'tsconfig.node.json',
  'vite.config.ts',

  // ── Shared scripts ──
  //
  // `erd-value-sets.mjs` was the first path enrolled outside `src/`: a pure ERD
  // parser over a catalog either repo supplies. Nothing in the gate was ever
  // restricted to `src/`, which is why this group survived the flip intact
  // while everything under `src/` did not.
  'scripts/erd-value-sets.mjs',
  'scripts/always-loaded.mjs',
  'scripts/authoring-archivers.mjs',

  // A board reaches the address bar upstream too — the phase, the scenario, and
  // the mechanism that reads it. The one prose change the adoption asked for
  // was a rename rather than a rewrite: the router's inline rules sat under a
  // heading of this repository's own wording, and the exempt section is one
  // category wherever it sits.
  'scripts/check-pointers.mjs',
  'scripts/check-router-budget.mjs',

  // The badge-size guard. This deployment wrote it and the template did not
  // have it, so seven call sites there were still choosing a badge's geometry
  // themselves — three shapes, two of them below every size `ui/badge.tsx`
  // offers. The guard went upstream citation-free and the seven overrides went
  // with it, which is why the file can be held here at all: the version this
  // deployment wrote named two issue numbers, and a rule about call sites does
  // not need an address to be true.
  //
  // KNOWN RED since the flip — it walks `src`. See the module header.
  'scripts/tests/one-badge-one-size.test.mjs',

  // The authoring log's own suite, adopted with the log itself when the change
  // log went upstream.
  //
  // KNOWN RED since the flip — it imports `../../src/lib/authoringLog.ts`. See
  // the module header.
  'scripts/tests/authoring-log.test.mjs',

  // ── Two data files ──
  //
  // The placeholder a `cells.frame` carries when a step has no artwork yet. Its
  // NAME is a data value — `/step-visual-placeholder.svg` is written into
  // fourteen applied migrations, so renaming the asset would turn every
  // placeholder into a real frame — so only the copy inside it is shared.
  'public/step-visual-placeholder.svg',

  // The harness standard, and the first path enrolled under `docs/`. It maps
  // the five canonical triage roles to the label strings a tracker actually
  // uses, and both repos drive the same engineering skills off it, so a role
  // the template respells is a label this deployment's agents would go on
  // applying under the old one. Its two neighbours in `docs/agents/` are the
  // control: `issue-tracker.md` and `domain.md` are the same standard and both
  // differ, each by the single sentence naming a per-repo fact.
  'docs/agents/triage-labels.md',
]
