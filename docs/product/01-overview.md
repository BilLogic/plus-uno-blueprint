---
audience: everyone
summary: What uno-blueprint is in plain words, who it is for, the surfaces at a glance, and who can look vs. edit.
sources: docs/plans/2026-08-06-001-plan-access-model-three-personas.md, docs/plans/2026-08-08-001-feat-mobile-responsive-blueprint-plan.md, src/components/editor/EditorShell.tsx
last-reviewed: 2026-08-08
---

# What uno-blueprint is

uno-blueprint is a living map of how the PLUS tutoring service works, moment
by moment. The map is a **service blueprint**: a chart that lays out, in time
order, everything that happens when someone uses the service — what students
and tutors see and do, and what happens behind the scenes to make each of
those moments work. Each place in the app where you look at or work with the
map (the main board, the comparison view, the presentation screen, and so on)
we call a **surface**.

Instead of the service living in people's heads, in slide decks that go stale,
or in a whiteboard photo from last spring, it lives here — browsable by
anyone on the team, kept current by the people who run the service, and
readable by an AI assistant that can answer questions about it.

## Who it's for

- **Anyone on or around the team** who wants to understand how the service
  actually runs — a session, start to finish, including the parts students
  never see.
- **The service team**, who keep the map true as the service changes.
- **Designers and program leads**, who use the map as evidence when deciding
  what to change ([more in doc 06](06-product-design-on-blueprints.md)).

## The surfaces at a glance

| Surface | What it shows |
| --- | --- |
| **Overview** | The whole service: its big stages and the situations mapped inside each. |
| **Scenario board** | One situation in full — a grid of moments you can pan, zoom, and click into. |
| **Compare** | Two or more versions of a journey side by side, to see where they differ. |
| **Slices** | Short, focused cuts of the map made for one audience — e.g. just the student's journey. |
| **Presentation** | A full-screen, frame-by-frame way to walk an audience through a slice. |
| **Phone view** | The same map, refolded into a top-to-bottom journey you scroll through. |
| **The assistant** | An AI panel that reads the same map and can navigate, point, and explain ([doc 04](04-the-assistant-and-audits.md)). |

## Who can do what

| You are… | You can… |
| --- | --- |
| A **visitor** (just opened the link, not signed in) | Browse everything — every surface above. Change nothing. |
| A **signed-in viewer** | Everything a visitor can, plus ask the assistant questions about the board. |
| A **service team member** | Everything above, plus edit the map — on a desktop or laptop. |
| Anyone **on a phone** | Read only. Everyone gets the same view-only experience on a phone, including team members. |

## How access is granted

You don't sign yourself up. The service team invites you: they create your
account and send you the sign-in details. If you think you should be able to
edit and can't, ask the team — it's a one-step change on their side.

That's the whole story from a reader's point of view. The technical
enforcement details live in the engineering docs:
[engineering/access-and-security](../engineering/access-and-security.md).

## Where to go next

- Want to actually use it? [02 — Team guide](02-team-guide.md).
- Words on the board confusing you? [03 — Reading a blueprint](03-reading-a-blueprint.md).
- Wondering about the AI? [04 — The assistant and audits](04-the-assistant-and-audits.md).
