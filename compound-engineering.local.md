---
review_agents:
  - compound-engineering:review:kieran-typescript-reviewer
  - compound-engineering:review:architecture-strategist
  - compound-engineering:review:data-integrity-guardian
  - compound-engineering:review:security-sentinel
  - compound-engineering:review:data-migration-expert
---

Repo: plus-uno-blueprint — React + TypeScript + Tailwind + shadcn service-blueprint canvas on Supabase.
Review context: tests are vitest (`npm test`), `npm run typecheck`, `npm run lint`; conventions are in AGENTS.md and docs/engineering/standards.md.
Known conventions: PostgREST select strings need reserved words quoted; hand-written mappers (normalizeBlueprint.ts) must carry every selected column; ring-inset inside overflow-hidden; paths named by condition not activity (docs/reference/path-names.md); teams vocabulary in docs/reference/lane-vocabulary.md.
