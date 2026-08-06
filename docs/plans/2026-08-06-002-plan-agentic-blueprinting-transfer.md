---
title: Transfer uno-blueprint's proven patterns into the agentic-service-blueprinting repo
type: plan
status: active
date: 2026-08-06
---

# 🚚 The transfer plan — uno-blueprint → agentic-service-blueprinting

## Overview

`~/Desktop/agentic-service-blueprinting` is the sb plugin's source **and** the
blueprint template app, versioned together (CHANGELOG: "workspace plugin
version = template version", currently 0.2.2 @ `695cd12`). uno-blueprint has
spent two days becoming the proving ground: Supabase-aligned design system,
matcha brand, motion tokens, TanStack Query with an explicit invalidation
contract, the access model, a zero lint baseline, TS7 tooling, and a pile of
review-hardened fixes. The template still runs the OLD frontend — a monolithic
`src/index.css`, pre-token, pre-everything.

This plan sequences the transfer so the template ships what uno-blueprint
proved, the plugin sheds its stress-test defects, and the transferable ideas
land as *rules*, not copied files.

## What transfers (and what deliberately doesn't)

### A. Plugin fixes — todos/018, smallest first

1. **Scratch files in the 0.2.2 package** (`.tmp_fp_pure.py`,
   `.tmp_fp_compute.py`/`.ipynb`, `.tmp_fp_out.json`, `.tmp_run_sha256.py`):
   delete; add a packaging ignore. Note commit `9b3adc2` already did this
   dance once — the ignore is the actual fix, not the deletion.
2. **slice SKILL.md fallback caveat**: copy the exact "workspaces scaffolded
   before this skill shipped may lack these files — fall back to plugin root"
   clause audit/whatif carry.
3. **`audit_tools.py dedupe`** raw traceback on malformed JSON → formatted
   error like its sibling subcommands.
4. **Ecoeled workspace upgrade** (`~/Documents/Claude/Projects/Ecoeled/
   blueprint-workspace`): run the customization.md upgrade recipe to 0.2.2;
   refresh the stale `fault-repair-closed-loop` sign-off hash (its friction
   #19). This is a *workspace* action, not a repo commit — do it after the
   plugin fixes so it upgrades onto fixed files.

### B. Template frontend — port the proven architecture

The template's app mirrors what uno-blueprint WAS. Port in the same order the
proving ground did, because the order encoded the dependencies:

1. **CSS architecture**: kill `src/index.css`; adopt the `src/styles/` split
   (imports-only entry, dials in `themes/`, derivations in `semantic.css`,
   `@theme inline` map in `theme.css`). Carry the hard-won rules as comments,
   they are the transfer: fallback chains OUTSIDE var() slots; seam variables
   distinctly named (`--app-font-sans`, never self-referential — `@theme
   inline` emits the property); `--surface-hue` default-plus-override is the
   one sanctioned dual declaration.
2. **Token discipline**: `text-2xs/3xs`, `--motion-*` + `--ease-structural`,
   `--shadow-floating`, `--primary-border`. Bring the two drift tests
   (`palette.test.ts` pattern, `motion.test.ts` incl. its reduced-motion
   coverage assertion) — the tests are what makes the tokens stick.
3. **Brand seam, not brand copy**: the template is a template — it gets the
   OKLCH machinery (hue dial, gamut-checked primary, derived border) with its
   own neutral default, NOT uno's matcha. Document the oklch-skill method in
   the template's styling README: contrast moves by L, chroma checked against
   the ceiling per-space, C% consistency judged not assumed.
4. **Query layer**: TanStack `useSupabaseQuery` wrapper + `queryClient` +
   the invalidation contract, with the lesson written at the top: *staleTime
   Infinity means every mutation MUST invalidate every read-prefix it
   touches; the reviews caught five forgotten prefixes in the proving
   ground* (scenario-paths, lane-sources, evidence, value-audiences, and the
   revert path). Port `evidenceMutations`-style ledger wrappers if the
   template has the ledger.
5. **Component patterns**: SegmentedControl-over-toggle-group,
   command-driven slash menu, shape-true skeletons discipline
   (EditorLoadingSkeletons' import-the-real-constants trick), CanvasEmptyState
   variants, the arrow-geometry horizontal-entry anchor convention.
6. **Tooling**: zero lint baseline + the eslint config shape (scoped
   react-refresh off for contexts, `^_` ignore patterns); vitest single
   harness; TS7 side-by-side (`@typescript/native` for typecheck, TS6 for
   typescript-eslint) with the collapse note; the `--font-source-code-pro`
   injection in base.css.

### C. Backend / access model — rules, not schema

Port the three rules verbatim into the repo's AGENTS.md (it has one):

1. Anon reads the published presentation surface only.
2. Authenticated writes go through one ledgered funnel (SECURITY DEFINER +
   revoked table grants + `SET search_path` + in-body auth check).
3. Service role never leaves the operator's machine.

Plus the two operational lessons as a migration-authoring note:
- A per-role `REVOKE` is a no-op while the PUBLIC default grant stands —
  revoke from PUBLIC.
- Every hosted `apply_migration` gets a same-day committed migration file, or
  a rebuild silently regresses it (the security review's P2).
- The evidence-undo coupling pattern: verbatim-row restores depend on lax
  insert policies; tightening and restore-RPC-ification travel together.

### D. What does NOT transfer

- The matcha brand values (template keeps a neutral default; hue is a dial).
- uno's Supabase project specifics (IDs, seeds, Ecoeled data).
- The agent-panel provider/key UX — template may want it, but it's feature
  work, not pattern transfer; decide separately.
- `compat.css` and other flagged-for-deletion residue (todos/016) — don't
  export debt.

## Sequencing

| Phase | Work | Gate |
| --- | --- | --- |
| 1 | A1–A3 plugin fixes | plugin's own `scripts/tests/run_tests.sh` green (it writes a fixture — run in the plugin repo, not read-only) |
| 2 | Version bump 0.2.3 + CHANGELOG; reinstall marketplace cache | `/plugin` reinstall picks up 0.2.3; sb skills still register |
| 3 | A4 Ecoeled workspace upgrade | its bundled validator exit 0; sign-off hashes recomputed |
| 4 | B1–B2 CSS + tokens + drift tests | build green, drift tests pass, template renders unchanged-by-default |
| 5 | B3–B6 seam/query/components/tooling | template lint 0, tests green |
| 6 | C rules into AGENTS.md + migration notes | reads correctly against the template's actual supabase/ dir |
| 7 | Template visual eval (both themes) + one scaffolded-workspace smoke test | render-checker walk clean |

Phases 1–3 are an afternoon; 4–5 are the real port (uno's history is the
recipe — the commits from `65a94b6` through today are effectively a replay
script); 6–7 close it.

## Risks

| Risk | Mitigation |
| --- | --- |
| Template app has diverged structurally from uno's pre-migration state | Diff `src/` trees first; port by concern, not by patch |
| Plugin version bump breaks the installed Ecoeled workspace mid-upgrade | Phase order: fix plugin → bump → THEN upgrade workspace onto the fixed version |
| Copying files instead of rules re-imports uno-specific debt | Section D is the guard; review each ported file for uno-isms (project IDs, matcha values, Ecoeled references) |
| Two repos drift again after transfer | The drift tests travel with the tokens; AGENTS.md rules travel with the model — both self-enforce |

## Sources

- Proving-ground history: uno-blueprint `65a94b6..82cc969` (the replay script)
- todos/018 (sb defects), todos/016 (residue not to export)
- docs/plans/2026-08-06-001 (access model, decisions + couplings)
- Stress-test report (sb suite health, 2026-08-06)
- Target repo: `~/Desktop/agentic-service-blueprinting` @ `695cd12` (0.2.2)
