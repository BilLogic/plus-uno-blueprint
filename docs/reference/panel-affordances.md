---
audience: designers, developers
summary: Which mechanism explains what in a panel — tooltip, kind badge, hint, alert — the badge-or-text rule that turns on whether a value's set is governed, and where a touchpoint's prominence is shown.
sources: src/components/blueprint/panelShell.tsx, src/components/blueprint/LanePanel.tsx, src/components/ui/alert.tsx, src/lib/touchpointProminence.ts, src/components/blueprint/ProminenceSelect.tsx
last-reviewed: 2026-08-30
---

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
| Lane role, path type, cell status, entity kind | `PanelKindBadge description=` on the badge |
| Who a lane's owner IS — the definition on `stakeholders.summary` | `StakeholderBadge`, which is `PanelKindBadge description=` with the registry's own one-liner. Where the field is editable there is no badge to hover, so the same sentence is printed under the picker; the two never appear together. |
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
`status` (renamed from `maturity` in `20260821240000`, and grown from two
values to the six of the `entity_status` domain — see `src/lib/entityStatus.ts`)
· touchpoint tone · a lane's **stakeholder** (`StakeholderBadge`; eighteen
names, every one of them recurring, and the registry is the governed list the
test below asks for) · **`owner_team`**.
⚠️ `owner_team` is the one entry the code does not honor: `LanePanel.tsx`
renders it as an input or as prose, never as a badge, and nothing checks the
rule. See [lane-vocabulary.md](./lane-vocabulary.md).

**Text:** KPIs · tools · summaries · notes · `owner` and `perceived_owner`
free-text overrides.

---

## Where prominence is shown

*Decided 2026-08-30 with #189, which asked for the answer rather than the
implementation.*

`cell_touchpoints.prominence` marks a touchpoint as **core** or **peripheral at
one moment**. It sits on the placement and not on the catalog on purpose: a
poster is core at recruitment and incidental three phases later, so the same
artifact is both depending on where the reader is standing.

**It renders in the cell detail panel, beside the touchpoint's own name, and
nowhere else. It is not on the grid pill.**

### Why not the grid

The objection to a panel-only answer is real and worth stating first: a
distinction visible only after a click is one most readers never meet. Three
things answer it.

**It is not a scanning fact.** "Is this core here?" cannot be asked without
already looking at *here*. The reader who clicked the pill is exactly the
reader the answer is for — and everything else the placement carries, its
summary, its screenshot, its design link, is behind the same click. Promoting
one of the four to the board would say prominence is the important one.

**The pill has no visual variable left.** A touchpoint pill already encodes
three vocabularies — tone by touchpoint name, a dashed edge and drained fill
for an unbuilt `status`, the slice-sequence badge — over three interaction
rings (active, connected, picked). A fourth mark either collides with `status`,
which owns fill and opacity, or arrives as a legend nobody was taught.

**It would be learned by nobody.** By the rule above, a badge promises a
vocabulary the reader learns by seeing it repeat. Zero placements are marked
today and most never will be; a mark appearing on a handful of pills out of
three hundred reads as an anomaly, not as a scale.

### What was rejected

| Considered | Why not |
|---|---|
| A mark on **every** pill, all three states rendered on the board | The failure #189 names outright. Three hundred pills each wearing an importance mark averages into "this tool matters", which is a claim about the catalog — and the unmarked majority would have to wear *unmarked* as a visible state, putting a judgement nobody made on screen. |
| **`core` only** on the board, nothing for the other two | Tempting, and worse than nothing. It makes a considered `peripheral` and an untouched placement identical on the grid, so the board silently answers "no" to two different questions. Half a vocabulary teaches a reader a distinction that is not there. |
| A **count or a filter** — "show me the core touchpoints" | A query, not a rendering, and it belongs with "where else is this used" (#172 story 6) rather than in the panel that has one placement in front of it. |

### The unmarked case renders nothing

Three states, two of them values: `core`, `peripheral`, and null. **Null gets no
badge, no dash and no "Unmarked" label.** Most placements will never be judged,
and any rendering of the unmarked state is a judgement nobody made, shown as
though somebody had. Absence is what tells it apart from a deliberate
`peripheral` — a reader who sees no badge learns nothing about the placement,
which is exactly correct.

Only the **editor** names the state, because a control has to offer it: the
`ProminenceSelect` option reads *"Unmarked — nobody has judged this"* and is
first in the list, so an author who marked a placement by mistake can get back.
While the editor is open the badge is not rendered — a badge beside a select
for one value is two mechanisms for one fact, which the standing prohibition
above forbids.

The vocabulary and its labels live in `src/lib/touchpointProminence.ts`. The
badge says "Core at this step" rather than "Core": the bare word is the
misreading this column exists to avoid.


**The trap, restated properly.** A value that happens to be one of three things
*today* is not a vocabulary. The question is whether the set is **governed** —
someone owns the list and adding to it is a decision — not whether it is short.
`owner_team` is governed by [lane-vocabulary.md](./lane-vocabulary.md) and
backed by the `stakeholders` table. An ungoverned free-text column with four
values is still text, and badging it promises a vocabulary that does not exist.
