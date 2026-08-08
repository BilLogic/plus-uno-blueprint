# 021 · P2 · Agent harness review — remaining findings

Source: dedicated harness + sb:-skills review 2026-08-08 (two agents),
fixed across two same-day passes. The full fixed ledger lives in the
commit messages of 3b6bb5e (P1s: abort poisoning, upsert clobber; prompt
contradictions; canvas-adapter/data-model refresh; derived-layer port;
dual-home convergence) and 1d33428 (round exhaustion, prompt caching,
harness one-sourcing + parity + new cases C8/D5/D6, wave-2 IR fields).

Remaining, ranked:

Third pass (2026-08-08): transcript growth capped
(TOOL_RESULT_CONTEXT_LIMIT 12k with a re-read marker), attachment
payloads persisted + rehydrated into the model turn, two-tab clobber
fixed (per-boot epoch seq base; agent_messages.seq widened to bigint,
migration applied to hosted). Also closed from todos/019:
BlueprintTriggerArrows rAF coalescing + equality guards,
IntegratedTriggerArrows frame-shared cell index (kills the merged
grid's 2×paths full-DOM sweeps), text-smd token replaces the four
text-[13px] escapes, annotation fill shadow tokenized with a dark
variant, vendored-duration exemption + board-ladder primitive
exception documented in the design foundations.

## Remaining (dispositioned)
1. **Template slice rendering** — belongs to the plugin repo's own
   migration-v2 uno-parity plan (docs/plans/2026-08-08-001 there): the
   template src is an older fork, and a faithful port pulls the
   view-state/tab system + slice stack (~dozens of diverged files). Not
   a patch; the slice SKILL's schema gate + read-back verification route
   covers scaffolded workspaces until that migration runs.
2. **God-component splits** (019: CanvasAnnotationLayer 2157 lines,
   AgentPanel 19 useState, BlueprintCellDetailPanel 1479) — deliberate
   hold: large refactors queued behind a green end-to-end testing round,
   not before it.
