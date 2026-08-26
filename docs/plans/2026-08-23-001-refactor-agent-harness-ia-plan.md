---
status: completed
date: 2026-08-23
summary: Fix live skill drift and its no-op detector, then adopt the shared harness IA — guidelines/, connectors/, five root files.
distilled-into: GitHub issues #84, #87, #92, #93, #94 under #83
---

> Stage 1 is done differently than written: the vendored copy's sync script was
> deleted rather than hardened, and the drift was reconciled at the canonical
> home first. Stage 2 shipped as this branch. Read the file as the plan that
> was made, not as the record of what happened.

# Agent harness IA rebuild — uno-blueprint

Full audit and rationale: the harness-audit artifact (2026-08-23). Same grammar
as plus-uno and agentic-service-blueprinting; different content.

## Stage 1 — drift (do first, it is a correctness bug)

`node scripts/sync-agent-skill.mjs --check` currently reports 5 drifted files:
`skills/audit/SKILL.md`, `skills/slice/SKILL.md`, `slice-playbook.md`,
`check-kpi-alignment.md`, `check-value-ledger.md`. The in-app agent and IDE
humans are running different skill text.

- Resolve the drift at the canonical home (`agentic-service-blueprinting`), then sync.
- Repoint canonical from the local path (`/Users/billguo/Desktop/agentic-service-blueprinting`) to the git remote; keep `PLUGIN_REPO` as a dev override.
- Fail `--check` on a missing source instead of exiting clean.
- Wire it into CI beside `bot-contract-probe`. Gate: a deliberately drifted file turns the build red.

## Stage 2 — IA

```
CONTEXT.md   ← definitions extracted from product/03-reading-a-blueprint
README.md · SETUP.md · INDEX.md · AGENTS.md
docs/
  adr/
  connectors/            supabase · plus-uno (the bot-contract probe) · netlify
  guidelines/            overview · foundations/ · components/ · composition/
                         (from docs/design/*, same grammar as plus-uno)
  engineering/           codebase-guide · access-and-security · standards
                         operations · agent-system · agent-tools
  product-and-service/   overview · team-guide · assistant-and-audits
                         service-design-practice · product-design
```

- `docs/design/` → `docs/guidelines/`, restructured into foundations / components / composition.
- `03-reading-a-blueprint.md` splits: definitions to `CONTEXT.md`, the how-to-read narrative stays.
- `architecture.md` folds into `codebase-guide.md`; surprises become ADRs.
- `INDEX.md` moves to the root and keeps `generate-docs-index.mjs`.
- Plans and `todos/` (33 files) → GitHub Issues for anything open; finished ones stay as history.

## Notes

- This repo's agents are not only uno-bot — generic Claude Code sessions work here too. `AGENTS.md` should say that the domain skills (`/sb:map|audit|whatif|slice`) and the five agents come from the installed `sb` plugin, and that `src/lib/agent/skill/` is a vendored copy for the in-app agent, not the harness.
- The bot-contract probe stays. Name it an instance integration, not harness — the open-source package must not inherit it.
