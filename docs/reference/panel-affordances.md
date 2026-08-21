# Explaining things in a panel

Three mechanisms had drifted into being picked by habit: `IconTooltip` in 34
files, `PanelHint` in two, a raw `Tooltip` in eleven more, and a dozen section
labels naming a concept with nothing to say what it means. The same fact ended
up hoverable in one panel, behind an ⓘ in another, and unexplained in a third.

> *Rewritten twice on 2026-08-21. The first version asked "is the thing on
> screen?", which sounds decisive and is not. The second kept a clickable ⓘ
> that turned out to have one defensible use in the whole app — so this version
> deletes the mechanism and routes that one use somewhere better.*

---

## The rule

**One question: can the reader afford to miss it?**

| | Mechanism | Because |
| --- | --- | --- |
| **No — they must read it** | inline **`Alert`**, always visible | A consequence they would be surprised by. Missable is the same as absent. |
| **Yes, it's a definition** | **hover / focus / tap the word itself** | Someone who already knows what "backstage actions" means should not have to step over an explanation of it. |
| **It's guidance while typing** | inline **`hint`** under the field label | A field being filled in deserves its guidance without a gesture. |

That is the whole protocol. Everything below is consequence.

### There is no ⓘ

`PanelHint` is deleted. It had exactly two uses in the app:

| Where | Verdict |
| --- | --- |
| Lane panel — *"saving writes all 6 lanes"* | **Real, and behind the wrong mechanism.** The entire point was that the reader must not be surprised by it. A click-to-open marker is missed by not clicking. Now an inline `Alert variant="warning"`. |
| Scenario panel — *"the layout control is on the canvas"* | **Answered a question nobody arrives with.** Deleted. |

A mechanism with one good use is not a mechanism; it is a special case wearing
a costume. If a future case genuinely needs *"click to reveal an aside"*, that
is the moment to reconsider — not before.

### No question cursor

`cursor-help` is removed everywhere. Swapping the pointer is a second signal
for something the tooltip already announces, and it reads as *broken* more
readily than *explained*.

---

## Alerts: which variant

`Alert` ships five variants and they are already load-bearing elsewhere in the
app. Pick by what the reader is being told, not by how loud you want to be.

| Variant | Use for | Example |
| --- | --- | --- |
| `warning` | A consequence of an action they are about to take | *"Saving writes all 6 'Front Stage Actions' lanes in Warm-Up."* |
| `destructive` | Something has failed, or is about to be destroyed | *"Evidence could not be loaded."* |
| `info` | Context that changes how to read what is on screen | *"This path is an unmaintained overview — see the five named paths."* |
| `success` | A write landed, where the result is not otherwise visible | |
| `default` | Neutral note with no status | Rare in panels; prefer prose. |

**Warning is about consequence, not volume.** A panel that opens on a tinted
banner every time has taught the reader to skip tinted banners. If a message
would appear on every open regardless of state, it is not an alert — it is
either prose or nothing.

---

## Hover is never the only way in

This is half the rule, not an accessibility footnote.

**Touch.** There is no hover on a phone, and this app has a phone posture —
`useMobileShell`, a bottom sheet the full width of the screen. Any definition
reachable only by pointer is invisible there. Every hover explanation must open
on tap; a tap that opens a definition must not also activate what it sits on.

**Keyboard.** A tooltip on a bare `<span>` cannot be reached at all. A section
label carrying a definition must be focusable and must announce itself.

**Screen readers.** An icon-only control's tooltip and its `aria-label` say the
same words from one source. Two strings for one label is how they drift.

Practical consequence: **prefer a component over a raw `<Tooltip>`.**
`IconTooltip` and `PanelKindBadge` already handle focus and labelling. A raw
tooltip dropped on a `<span>` almost never does.

---

## The cases, decided

| What | Mechanism |
| --- | --- |
| Icon-only button | `IconTooltip` — the tooltip **is** its label |
| Lane role, path type, cell maturity, entity kind | `PanelKindBadge description=` on the badge |
| Section label naming a concept — `Dependencies`, `Evidence`, `Resources`, `Applies when` | tooltip on the label; the label must be focusable |
| Form field guidance | `hint` prop, always visible |
| A consequence of saving | `Alert variant="warning"`, inline |
| A load or write failure | `Alert variant="destructive"`, inline |
| Why a control is elsewhere | **nothing** — if it matters, the control is in the wrong place |

Standing prohibition: **nothing carries two mechanisms for one fact.** Removed
from the lane chip in Aug 2026; do not bring it back.

---

## Badge or text

*Revised 2026-08-21 — the first test was wrong, and `owner_team` proved it.*

The old test was "is the value from a set the **schema** enforces?" That is a
fact about the database, which the reader cannot see. It put `owner_team` in
the text column because the list was editorial — while a reader looking at 306
lanes sees the same handful of words over and over, which is what a badge is
for.

The right test is about the reader:

> **Does the value come from a vocabulary the reader learns by seeing it
> repeat?**

| | Badge | Text |
| --- | --- | --- |
| **How many distinct values?** | few, and they recur | many, mostly unique |
| **What does the reader do?** | scans for it, recognises it | reads it |
| **Two entities sharing a value** | means something — same kind | coincidence |
| **Does it carry a colour?** | yes, part of the vocabulary | no |

**Badges:** entity kind (Scenario, Lane, Step) · lane role · path type · cell
maturity · touchpoint tone · **`owner_team`**.

**Text:** KPIs · tools · summaries · notes · `owner` and `perceived_owner`
free-text overrides.

**The trap, restated properly.** A value that happens to be one of three things
*today* is not a vocabulary. The question is whether the set is **governed** —
someone owns the list and adding to it is a decision — not whether it is short.
`owner_team` is governed by [lane-vocabulary.md](./lane-vocabulary.md) and
backed by the `stakeholders` table. An ungoverned free-text column with four
values is still text, and badging it promises a vocabulary that does not exist.
