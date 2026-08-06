---
title: "feat: Anonymous sandbox mode — full app, session-local writes"
type: feat
status: active
date: 2026-08-05
---

# Anonymous sandbox mode — full app, session-local writes

Visitors to the deployed site currently get read-only. Decision (Bill,
2026-08-05): let anonymous visitors READ, WRITE, and DELETE against a
**session-local overlay** — the full app experience, including the agent
— with a disclaimer that nothing persists. The hosted database never
sees an anonymous write; RLS already guarantees that and nothing here
relaxes it. This is tier zero of the access ladder (sandbox → viewer
account → service account), and it ports to the published template as
the zero-setup demo path.

## The mechanism: overlay store, one seam per write family

- `src/lib/sandbox/store.ts` — an in-memory patch store (created rows,
  updated fields, tombstones) keyed the same way the query cache is,
  persisted to `sessionStorage` (survives reload, dies with the tab —
  matching the disclaimer's promise).
- **Reads**: `useSupabaseQuery` applies the overlay to fetched rows
  post-fetch (one merge function per query family: phases/blueprints,
  slices, findings). Real data stays the base; patches layer on top.
- **Writes**: every mutation module already funnels through a handful of
  seams — `authoringRpc.call()`, `cellContentMutations`,
  `cellSpecMutations`, `sliceMutations`, and the agent registry's
  dispatch. Each seam gets a sandbox branch: no session → write the
  overlay instead of PostgREST. The revert ledger works unchanged (it
  records closures, not SQL).
- **Structural RPCs** (add_lane, create_scenario, delete_path…): emulate
  the minimal set client-side (create/add/rename/delete with local ids);
  anything not worth emulating returns an honest "not available in the
  sandbox" instead of a broken imitation.
- **Agent**: anonymous sessions get `allowWrites: true` against the
  sandbox seams — the full four-skill experience, findings included
  (overlay findings table). Chat persists to localStorage (existing
  anonymous path).

## The disclaimer

First mutation (or first mode switch to Edit) per tab triggers a toast:
"Sandbox — your edits live in this tab only and disappear when it
closes. Sign in to edit the real blueprint." One-line badge stays in the
change sheet while sandbox patches exist. Never repeat the toast within
a session; annoyance teaches people to ignore warnings.

## Scope boundaries

- No anonymous DB writes, ever — RLS stays untouched; the overlay is the
  only write target.
- Viewer/service tiers unchanged; signing in mid-sandbox offers "keep
  playing in sandbox or discard patches and use your account" (no
  automatic promotion of sandbox edits into real writes — that is a
  data-integrity trap).
- Template port inherits this as the no-DB demo mode's write half.

## Acceptance criteria

- [ ] Anonymous visitor can edit cells, create/delete structure, make
      slices, run /sb:audit with findings recorded — all overlay-only.
- [ ] Reload keeps the sandbox; closing the tab clears it.
- [ ] Toast on first mutation; badge while patches exist.
- [ ] Signed-in behavior byte-identical to today.
- [ ] A network log during a full sandbox session shows zero write
      requests to Supabase.

## Units (rough)

1. Overlay store + read-merge for the blueprint query family.
2. Seam branches: cell content/spec + direct-table mutations.
3. Structural emulation set + honest refusals for the rest.
4. Slices + findings families; agent seam audit.
5. Toast/badge + sign-in transition + template port notes.
