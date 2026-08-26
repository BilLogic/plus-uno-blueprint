---
audience: developers
summary: The three systems this instance is coupled to, and the rule that keeps that coupling out of the open-source package.
---

# Connectors

Everything this repo is coupled to across a boundary it does not control: the
database, the Slack bot that reads it, and the host that serves it.

`docs/connectors/` is **instance-only, on purpose.** This app is one deployment
of a template that is also the `agentic-service-blueprinting` package, and the
package must inherit nothing PLUS-specific. Anything in this folder describes
*this* instance's integrations; a fork replaces the contents and keeps the
folder, the filenames, and the shape.

| Connector | What crosses the boundary |
|---|---|
| [supabase](supabase.md) | The database, the auth session, the retrieval index. Everything the app reads and writes. |
| [plus-uno](plus-uno.md) | uno-bot, the Slack bot that reads this app's database and deep-links back into it. The one live cross-repo invariant. |
| [netlify](netlify.md) | The host. Push to main is production. |

## What belongs here, and what does not

**Here:** the shape of the contract, who owns which side, what breaks when it
drifts, and what guards it.

**Not here:** operational procedure. How to deploy, roll back, invite a person or
read a dashboard is [engineering/operations.md](../engineering/operations.md).
The access model, the RLS posture, the write path and the runbook step for a
full re-embed are [engineering/access-and-security.md](../engineering/access-and-security.md).
A connector doc points at those rather than restating them — an operator looks
where they always look.

## The failure mode all three share

A mechanism ships and its guard does not, or ships pointing at something that
cannot fail. Two coordination bugs shipped silently before the blueprint
contract file existed — a renamed slices column and a re-shaped findings column
each made a bot read return empty **for weeks** — and the skill-sync check that
was supposed to catch a related drift exited clean whenever it could not see its
own source.

So each doc below says what its guard is and, where the guard is weak, says that
too.
