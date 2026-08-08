# 021 · P2 · Agent harness review — remaining findings

Source: dedicated harness + sb:-skills review 2026-08-08 (two agents),
fixed across two same-day passes. The full fixed ledger lives in the
commit messages of 3b6bb5e (P1s: abort poisoning, upsert clobber; prompt
contradictions; canvas-adapter/data-model refresh; derived-layer port;
dual-home convergence) and 1d33428 (round exhaustion, prompt caching,
harness one-sourcing + parity + new cases C8/D5/D6, wave-2 IR fields).

Remaining, ranked:

## P2
1. **Template slice rendering**: the plugin template app has no slice
   rendering/`?slice=` route, so the slice skill's render-checker Present
   gate is unreachable on scaffolded workspaces (the SKILL routes around
   it; a real port would close the loop).

## P3
2. Tool-result transcript growth uncapped in `run.messages` for the life
   of a session (UI rows capped at DETAIL_LIMIT; provider-side copies are
   not) — a few get_blueprints of a 5-path scenario dominate later rounds.
3. Attachment payloads (annotation structure) lost on transcript
   rehydration — the chip label survives, the model-facing payload does
   not (`persistence.ts` / `hydrateAgentTranscript`).
4. `persistence.ts` two-tab clobber: seq = local event index with
   `upsert onConflict(session_id, seq)` — two tabs on one session silently
   overwrite each other's transcript rows.
