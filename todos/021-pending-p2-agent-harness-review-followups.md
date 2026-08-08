# 021 · P2 · Agent harness review — remaining findings

Source: dedicated harness + sb:-skills review 2026-08-08 (two agents). FIXED
same day: abort-mid-batch session poisoning, upsert_cell occupancy guard +
destructive-revert hazard, empty-assistant-parts guard, mobile/tier
injection contradiction, canvas-adapter refresh (write surface, session
tiers, reference availability, slot dialect), read_reference/system-prompt
duplication, data-model staleness (named path_type, slot dialect, derived
layer), auditor scope field, adapter-contract asset pointers, skill
trigger phrases, derived-layer migrations ported to the plugin template,
dual-home drift converged + synced. Remaining, ranked:

## P2
1. **Round-limit exhaustion UX** (`loop.ts`): on the last round the model is
   never told; append a synthetic "budget exhausted — answer now" user/tool
   note and allow one final no-tools reply (the eval harness already does
   this — the app should match IT, not vice versa).
2. **Eval harness spec fork** (`scripts/agent-harness/run.mjs:117-157`):
   hand-copied tool specs have drifted (read_reference guidance, compare
   vocabulary, get_ui_state). specs.ts is node-loadable now — import
   TOOL_SPECS/rosters via tsx/esbuild instead of the fork.
3. **Eval coverage gaps** (`cases.mjs`): nothing exercises the mobile
   roster/injection, view-only refusal path, revert_my_changes routing,
   get_compare_diff (stubbed "unavailable"), deletion-impact verbatim
   relay, duplicate_scenario nod gate, record_finding dedupe. Mocked
   list_ui_commands still advertises pre-v3 `side-by-side | integrated`.
4. **Anthropic prompt caching** (`providers/anthropic.ts`): static
   role+adapter+skill+tools (~6-8k tokens) repaid up to 12×/send; add
   cache_control breakpoints (prefix is already stable-first).
5. **IR schema vs wave-2 columns** (plugin `references/ir-schema.json`):
   spec columns (kpis/tools, owner pair, value_props) are forbidden by the
   IR schema though the DB now carries them — extend the schema + validator
   so IDE audits can run wave 2.
6. **Slice Present exit on template deployments**: the plugin template has
   no slice rendering/`?slice=` route; the render-checker gate is
   unreachable there. Either port minimal slice rendering or make the gate
   conditional on the deployment ("render-checker where the app renders
   slices; read-back verification otherwise").

## P3
7. update_cell_content/spec cannot CLEAR a field ('' = keep) — say so in
   the specs or accept '' as clear.
8. Batch-limit status row printed once per bounced call (spam) and failed
   writes consume batch budget (increment before dispatch).
9. Tool-result transcript growth uncapped in run.messages; attachments
   payload lost on transcript rehydration (chip label survives).
10. persistence.ts two-tab clobber (seq = local index, upsert onConflict).
11. cases.md prose drift vs cases.mjs; harness round cap 10 vs app 12;
    harness batch counter counts only successful writes.
12. role.md "all four skills FULLY live" overclaims (map ingest/translate
    routes are canvas-unavailable); whatif promotion wording vs adapter
    "nothing here relaxes one" preamble.
13. deletion-impact closing line mentions the confirm dialog, which mobile
    doesn't have.
