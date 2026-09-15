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
 * There are twenty-five, and they fall into three groups.
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
 *     `check-router-budget.mjs`, `check-glossary-only.mjs`,
 *     `check-negation-ratchet.mjs`, `check-target-schema.mjs`,
 *     `check-harness-claims.mjs`, `agent-account.mjs`,
 *     `generate-agent-account.mjs`, `sweep.mjs`, `seed-list.mjs`, and three
 *     suites.
 *     `scripts/` is the one tree the flip did not touch: it is not the
 *     application, so it did not move into the package, and where both
 *     repositories run the same check they still run two copies of it. This is
 *     also the group that grows, and it is the group with a failure this list
 *     cannot see for itself: a release that publishes a shared script this tree
 *     does not hold moves no byte here and turns no gate below red.
 *     `npm run check:shared-scripts` is the other direction — it reads the
 *     template's own published list out of the installed package and fails on a
 *     path we do not hold, do not hold identically, or hold and never enrolled.
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
 * ── THE TWO SUITES THAT REACHED FOR `src/`, AND WHY BOTH STAYED ──────────
 *
 * Both of the shared suites here were written where the repository running
 * them also HELD the application, and a deployment does not. Neither was
 * unenrolled to get past that; in both cases the cause went upstream and the
 * entry stayed, at the same bytes.
 *
 * `authoring-log.test.mjs` reached up two directories for its client half and
 * now imports it through `@/…`, which resolves the application wherever the
 * build resolves it.
 *
 * `one-badge-one-size.test.mjs` builds a throwaway tree, mounts the package
 * into it as `node_modules/agentic-service-blueprinting`, and asserts the walk
 * finds the same files through the mounted copy as through the direct one. It
 * used to mount the root the suite was run FROM — the same directory in a
 * repository that keeps its own `src`, and in a deployment a root with no
 * application in it at all, which the resolver refused on a tree the test had
 * just built. It now mounts the directory the application's `src` actually
 * sits in, so what gets staged is an application either way, and it asserts
 * that premise rather than assuming it.
 *
 * That is the shape the header above argues for: where a shared file is wrong
 * about a deployment, the fix is the template's to make and the enrolment is
 * what carries the question there.
 *
 * ── HOW THIS LIST GROWS NOW ───────────────────────────────────────────────
 *
 * Slowly, and in one direction only. The application can no longer be enrolled
 * because it is no longer here. A new entry is a file this repository gains
 * that the template also has and that both agree should not drift — which in
 * practice means another shared script, or another piece of the build. Adding
 * one is still a one-line append under its own reasoning — and the append is
 * the last step, not the first. The section below is what comes before it.
 *
 * ── THE BYTE-IDENTICAL FILE THAT IS STILL NOT ON THIS LIST ────────────────
 *
 * One path this repository holds is byte-identical to the pinned template's
 * copy today and is not enrolled. Identical-and-unenrolled reads like a list
 * one line short, and the cost of that reading is that it gets proposed again
 * every time somebody measures. So the reasoning is written down here rather
 * than rediscovered.
 *
 * There were seven. Six of them cited a `docs/` path, and every one of those
 * six is now enrolled — which is the whole argument for the citation rule
 * playing out rather than an exception to it. Byte-identity is only the FIRST
 * of the two promises an entry makes; the second is the citation rule above,
 * and a file that is byte-identical AND carries an address resolving in at
 * most one of the two repositories had to have the citation taken out of BOTH
 * copies before enrolment was available at all. The template made that change:
 * a `docs/` path is a defect where it dangles, so the three that pointed a
 * deployment's maintainer at a document only the template has now name the
 * thing instead of its address, the two that WROTE to a repo-local path read
 * it from `repo-config.mjs` — the file that exists for exactly that and is
 * never shared — and the suite whose throwaway fixtures merely looked like an
 * address spells them somewhere no tree claims. Six enrolments, none of them
 * forced.
 *
 * The remaining one, `public/favicon.svg`, cites nothing and would pass. It
 * stays off for the other reason, the one asked of every candidate: whether
 * this deployment has cause to diverge later. It does. The favicon is identity
 * rather than behaviour, and `index.html` beside it already diverges on
 * exactly that — `<title>PLUS</title>` against the template's — so the icon in
 * the browser tab is the next thing to become this deployment's own. Enrolling
 * it would route a branding change through the template, which is the one
 * place it does not belong.
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
  // Its staged self-test mounts the directory the application sits in rather
  // than the root the suite ran from, so it stages an application in a
  // deployment too. See the module header.
  'scripts/tests/one-badge-one-size.test.mjs',

  // `scripts/tests/authoring-log.test.mjs` is the sweep-side half of
  // `authoring-archivers.mjs` above, and the two move together again.
  //
  // It was off this list for one release. The change that moved
  // `archivingFunctionsIn` onto the sweep rewrote the suite, and the new text
  // spelled its fixture series `21000101000000_one.sql` /
  // `21000102000000_two.sql` — a made-up pair that reads like a migration
  // address, and `check:reconciled`'s citation rule is line-based over bytes
  // and cannot tell a fixture from an address. The bytes were the release's
  // and the promise this list makes about them was not, which was the honest
  // state to be in rather than a weakened rule.
  //
  // v1.44.10 fixed it at the source, the way the router suite's `docs/a.md`
  // was fixed: the members are spelled under `notes/`, which no tree claims,
  // and the file joins the template's published shared list. So the entry
  // comes back, and `check:shared-scripts` now holds the pair from the other
  // direction as well.
  'scripts/tests/authoring-log.test.mjs',

  // The composition-claims check, and its suite. The claim for a file is
  // written where the file lives, so the documents that claim the assembled
  // surfaces moved into the package and the check that reads them became one
  // file run in both trees. Here the package's documents are the only layer —
  // this repository keeps no composition folder — and what the check sweeps
  // besides them is the trees `composition.claimed` names; in the template it
  // is the same walk over the one layer that tree has. Both halves of that
  // behaviour are ours to keep honest, so both are enrolled: this repository
  // ran a fork of the check for as long as it held composition documents of
  // its own, and a fork is exactly what the enrolment now forbids.
  'scripts/check-harness-claims.mjs',
  'scripts/tests/harness-claims.test.mjs',

  // ── The six that used to name a `docs/` path ──
  //
  // Each of these ran here already and each was byte-identical already; what
  // held them off the list was an address. Three of them SENT A READER
  // somewhere — a connector document, the decision-record tree — and a
  // sentence naming a tree only one repository has is a dead pointer in the
  // other, so those sentences now name the thing rather than the path. Two of
  // them WROTE to a repo-local path, which no rewording reaches: the document
  // the agent account renders, the baseline beside it, and the trees a sweep
  // must not rewrite are values now, read from `repo-config.mjs` — the file
  // that exists to hold this repository's own paths and is never shared. And
  // the router suite's `docs/a.md` was never an address at all, only a
  // fixture spelled like one; it builds them under `notes/` now, which costs
  // nothing and saves a line-based gate from a finding it cannot judge.
  'scripts/check-glossary-only.mjs',
  'scripts/check-negation-ratchet.mjs',
  'scripts/check-target-schema.mjs',
  'scripts/generate-agent-account.mjs',
  'scripts/tests/the-router-is-a-router.test.mjs',

  // The account generator's whole LOGIC, and the failures it words for a reader
  // in either tree. The template's fence is closed under relative import for
  // exactly this file: `generate-agent-account.mjs` was enrolled and every line
  // it runs lives here, so a message naming a document only one repository has
  // sat behind a green guard for a release.
  'scripts/agent-account.mjs',

  // The sweep, and the module it asks where a deployment's seed is.
  //
  // These two are why the nine entries above them changed at all. `sweep.mjs`
  // answers "give me the files for this subject" for eight subjects — the
  // application, the prose, the scripts, the migrations, the reference surface,
  // the package's reference documents, a deployment's seed and the commit — so
  // a check names one and contains only its judgement. No shared script
  // resolves a root from its own location any more; they read the working
  // directory, which is what lets one file serve two repositories without
  // either of them being the one it was written in.
  //
  // `swept-docs.mjs` and `unverified.mjs` were on this list and are not any
  // more, and neither was unenrolled: the template DELETED both. The swept set
  // is the sweep's `docs` subject now and the skip-said-out-loud register is
  // its last section, so there is no copy on the other side for a byte-identity
  // gate to compare against. This repository still holds its own
  // `swept-docs.mjs`, because four of its own checks still read it; what it no
  // longer is, is shared.
  'scripts/sweep.mjs',
  'scripts/seed-list.mjs',

  // The other half of the sweep. `sweep.mjs` answers what a check examines;
  // `verdict.mjs` answers what it concludes — the four outcomes rendered one
  // way and the exit code set one way, so a check carries only its findings.
  // It arrives with the six shared checks that now import it, and it is held
  // byte-identical for the same reason they are: the rendering is the green
  // line both repositories publish.
  'scripts/verdict.mjs',

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
