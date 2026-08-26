---
audience: everyone
summary: What the in-app AI assistant is, what audits and findings are, why results can be trusted, and how to challenge them.
sources: agentic-service-blueprinting references/audit-playbook.md, agentic-service-blueprinting skills/audit/references/check-gap-sweep.md, src/components/editor/AgentDock.tsx, src/components/editor/SessionChangesSheet.tsx
last-reviewed: 2026-08-08
---

# The assistant and audits

This is the trust document: what the AI in this app actually is, what it
can and cannot do, and how to check its work.

## What the assistant is

The ✦ panel is an AI assistant that reads the **same board you see** — not
a chatbot with general opinions about tutoring. Ask it a question and it
answers from the blueprint's actual content; ask it to show you something
and it navigates the view, opens the right cell, and points at what it
means. For visitors and viewers it is strictly a reader and guide.

For service team members on a desktop, it can also **edit** — add or
rewrite cells, restructure a scenario — but only what that team member
could edit themselves. Every edit it makes lands in a **review sheet**: a
running list of this session's changes, each with an undo button. A human
can reverse any single change, or all of them. The assistant never has more
power than the person it's working for, and its work is never irreversible.

## What audits are

An audit is a systematic sweep of the blueprint by a set of **named
checks** — each one a specific question asked of every relevant cell:

- **Gap sweep** — which moments people clearly experience have no cell?
- **Jargon lint** — which customer-facing text uses words no customer says?
- **Channel conflict** — where is the same person or channel needed in two
  places at once?
- **KPI alignment** — do a lane's success metrics reward what its cells
  actually do?
- **Perceived owner** — where does who-customers-think-is-acting differ
  from who really is?
- **Value ledger** — which cells deliver value to nobody?
- **Fee visibility** — where does money change hands invisibly?

Each check follows a **written specification** — a document stating exactly
what question it asks, what counts as a hit, and how severe hits are. Not
vibes, and not the assistant freestyling: two runs of the same check on the
same board look for the same things. (Practitioners: the specifications
themselves are catalogued in [doc 05](05-service-design-practice.md).)

## Findings and their statuses

Everything an audit notices is recorded as a **finding**: the check that
raised it, a plain-language description, a severity, and — always — the
exact cells it's about. Findings are stored with the blueprint and carry
one of three statuses:

- **Open** — noticed, not yet judged by a human.
- **Resolved** — a human fixed the underlying issue.
- **Dismissed** — a human judged it a non-issue. **Dismissed stays
  dismissed**: the system remembers the judgment, and re-running the audit
  will not resurface the same finding about the same cells.

Audits only ever point. They never change the blueprint, and only humans
change a finding's status.

## Why to trust the results

- **Every finding cites its cells.** You never have to take a finding on
  faith — open the cited cells and look. If the cells don't show what the
  finding claims, the finding is wrong, and you can dismiss it.
- **Checks that can't run say so.** Some checks need information the
  blueprint may not carry yet (success metrics, ownership labels, value
  notes). A check missing its inputs reports "skipped — nothing to check"
  rather than guessing.
- **The team tests the assistant.** Its abilities are run against test
  cases with known right answers before changes ship, so "it can navigate,
  it can cite, it doesn't invent cells" is verified behavior, not hope.

## How to challenge a finding

Disagree with one? You have three honest moves: **dismiss** it (your
judgment wins and is remembered), **resolve** it (fix the blueprint so
it's no longer true), or **ask the assistant to re-check** — after edits, a
fresh run of the same written specification either re-detects the issue or
retires it. What you shouldn't do is leave a finding you know is wrong
sitting open; the statuses exist so the list stays meaningful.

## Honest limits

The assistant can be wrong. It can misread a cell, over-flag a harmless
inconsistency, or miss a real one. That's exactly why every claim carries
citations, every edit carries an undo, and every finding waits for a human
verdict. Treat it as a sharp, fast junior colleague with perfect recall of
the board: check its reasoning the way you'd check anyone's — by looking at
what it points at.
