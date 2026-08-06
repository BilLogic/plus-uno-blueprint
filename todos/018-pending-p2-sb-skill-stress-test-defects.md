---
status: pending
priority: p2
issue_id: 018
tags: [sb-skills, plugin, quality]
dependencies: []
---

# sb skill-suite stress test (2026-08-06) — defects to fix in the plugin repo

Suite verdict: healthy. 37/37 referenced files present across map/audit/
slice/whatif; roster ↔ check-docs 1:1, no drift; validators pass on the live
Ecoeled IR and fail LOUDLY (exit 1, path-precise messages) on all seven
injected faults; fingerprints deterministic under cell-key reordering; no
hardcoded paths or project IDs; hooks all resolve.

Defects — all live in the plugin source repo
`/Users/billguo/Desktop/agentic-service-blueprinting` (sb-marketplace →
cache 0.2.2), NOT in uno-blueprint:

1. **P2 — Ecoeled workspace stale vs plugin 0.2.2.**
   `~/Documents/Claude/Projects/Ecoeled/blueprint-workspace` predates the
   derived-layer skills: missing all check-*.md, audit/slice/whatif
   playbooks + tools, auditor/impact-tracer agents; ir-schema.json,
   adapter-contract.md, layer-roles.md, blueprint-reviewer.md differ.
   Run the customization.md upgrade recipe. Its fault-repair-closed-loop
   sign-off hash is self-documented stale (friction #19).
2. **P3 — slice SKILL.md lacks the plugin-root fallback caveat** that
   audit and whatif carry (line ~18: claims scaffolded workspaces carry
   the same files — false for pre-slice workspaces).
3. **P3 — Release 0.2.2 ships scratch files** at package root:
   `.tmp_fp_pure.py`, `.tmp_fp_compute.py`, `.tmp_fp_compute.ipynb`,
   `.tmp_fp_out.json`, `.tmp_run_sha256.py`. `.tmp_fp_compute.py`
   duplicates the fingerprint algorithm audit_tools.py's docstring warns
   against. Delete + add to packaging ignore.
4. **P4 — `audit_tools.py dedupe`** raw-tracebacks on malformed JSON
   (loud, exit 1, but unformatted vs every other tool).

Not executed: `scripts/tests/run_tests.sh` (its --register round-trip
writes src/data/blueprintFallbacks.ts — excluded by the read-only rule).
Run it when working in the plugin repo directly.

## Work Log

- 2026-08-06: Stress test by subagent; read-only, no DB/workspace writes.
