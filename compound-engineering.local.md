---
review_agents:
  - compound-engineering:review:kieran-typescript-reviewer
  - compound-engineering:review:architecture-strategist
  - compound-engineering:review:data-integrity-guardian
  - compound-engineering:review:security-sentinel
  - compound-engineering:review:data-migration-expert
---

Repo: uno-blueprint — React + TypeScript + Tailwind + shadcn service-blueprint canvas on Supabase.
Review context: branch refactor/agent-tool-surface carries ~109 commits: path type/status rework (entity_status domain shared by cells+paths), 17 SQL migrations (renames: maturity→status, service_lifecycles→services, propositions→business_model), panel shell refactor (cell/lane/phase/scenario/service panels share one shell), skeleton-loading contract tests, path colour token system (pathColorTheme), agent tool surface (src/lib/agent). Tests: vitest (npm test), typecheck, lint.
Known conventions: PostgREST select strings need reserved words quoted; hand-written mappers (normalizeBlueprint.ts) must carry every selected column; ring-inset inside overflow-hidden; paths named by condition not activity (docs/reference/path-names-draft.md); teams vocabulary in docs/reference/lane-vocabulary.md.
