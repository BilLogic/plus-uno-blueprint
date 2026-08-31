---
audience: designers, developers
summary: Which mechanism explains what — popover, kind badge, hint, alert — why a definition is never a tooltip, where an entity kind's definition hangs, what ⓘ means, the two-word badge/tag vocabulary and what a badge may never do, the badge-or-text rule that turns on whether a value's set is governed, and where a touchpoint's prominence is shown.
sources: src/components/blueprint/panelShell.tsx, src/components/blueprint/EntityDefinitionPopover.tsx, src/components/blueprint/PanelTermLabel.tsx, src/lib/panelTerms.ts, src/components/blueprint/LanePanel.tsx, src/components/ui/alert.tsx, src/components/ui/badge.tsx, src/lib/touchpointProminence.ts, src/components/blueprint/ProminenceSelect.tsx
last-reviewed: 2026-08-31
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
| **Yes, it's a definition** | **`Popover openOnHover` on the word itself** | Someone who already knows what "backstage actions" means should not have to step over an explanation of it. Hover for the pointer, press for everyone else. |
| **It's guidance while typing** | inline **`hint`** under the field label | A field being filled in deserves its guidance without a gesture. |

That is the whole protocol. Everything below is consequence.

### ⓘ means "opens the panel", and only that

*Was "There is no ⓘ", 2026-08-21. Settled again 2026-08-31 with #140 Q11 —
the glyph came back on the canvas in the meantime and had picked up a second
meaning, which is the failure the original section was written against.*

`PanelHint` — a clickable ⓘ that revealed an aside — is still deleted, and for
the reason it always was:

| Where | Verdict |
| --- | --- |
| Lane panel — *"saving writes all 6 lanes"* | **Real, and behind the wrong mechanism.** The entire point was that the reader must not be surprised by it. A click-to-open marker is missed by not clicking. Now an inline `Alert variant="warning"`. |
| Scenario panel — *"the layout control is on the canvas"* | **Answered a question nobody arrives with.** Deleted. |

What changed is that the glyph itself is now in use — on the canvas, marking
the controls that open an entity's properties panel — and it had drifted into
meaning two things. Six components drew it: four for *opens the panel*
(`EntityTitleAffordance`, `LaneHeaderAffordance`, `StepHeaderAffordance`,
`EntityPropertiesButton`) and two for *an aside* (`ScenarioTitleBadge`'s
parallel-scenario note, and `ScenarioParallelInfoTooltip` parked before a slide
title).

> **ⓘ means "opens the panel". Nothing else may wear it, and it is always
> visible.**

Both asides moved onto the word they were about, into the same popover that
carries what a scenario is — one mechanism, two facts, which is allowed. And
three of the six were drawn only on hover, so on touch the one signal that a
header opened anything was never drawn at all. **A signifier a reader cannot
see is not a signifier.** `CANVAS_HEADER_HINT` no longer starts at `opacity-0`
and `EntityPropertiesButton` no longer takes `revealOnHover`.

An `Alert`'s leading icon is not this ⓘ: it is the alert's own severity mark,
it is never a target, and it is covered by the variant table above.

### The question cursor came back, and why

*Removed 2026-08-21, restored 2026-08-31 with #182. The reversal is the
interesting part, so it is recorded rather than quietly re-applied.*

It was removed on the argument that swapping the pointer is a second signal for
something the tooltip already announces. That argument depended on a fact that
is no longer true: at the time, an explained badge also lightened under the
pointer, so the reader already had a hover signal and the cursor was the
second one.

**#182 took the hover state away** — a badge that repaints under the pointer
reads as clickable, and a badge never is. That leaves nothing at all to say
"there is something here" before the tooltip opens. So the cursor is the
signal now rather than a duplicate of one, and an explained label or badge
wears three things and only three: **`cursor-help`, a focus ring, and the
tooltip itself.**

The scope is exact. `cursor-help` belongs on an element that has a definition
to give — `PanelTermLabel`, `StatusBadge`, `PanelKindBadge` when it was passed
a `description`, a path badge where its description tooltip is shown. A badge
with nothing behind it keeps `cursor-default`: a help cursor over a word that
explains nothing is a promise it cannot keep.

### A definition is never a tooltip

*Decided 2026-08-31 with #140, and it is a bug report rather than a
preference.*

Base UI's `Tooltip` opens on hover and on focus and on nothing else — its hover
interaction is `mouseOnly` and there is no press behind it. This app has a real
phone posture (`useMobileShell`, a full-width bottom sheet). So every
definition it owned was **invisible on a phone**: all six `PanelTermLabel`
sites, every `PanelKindBadge description=` (a lane's role, a stakeholder's
one-liner), the owner hint, and every path, phase and scenario description on
the board. Nothing said so, and nothing failed.

> **A definition uses `Popover` with `openOnHover` on the trigger.** Hover for
> the pointer, the popover's own press for everyone else. No new component:
> `openOnHover` is a real prop on `PopoverTrigger`, default false.

`IconTooltip`'s tooltips stay tooltips. They label icon-only buttons, which is
the one case the table above keeps a tooltip for — the tooltip **is** the
label, the button's `aria-label` says the same words, and a button whose press
is already spoken for cannot have that press mean "explain" as well. The same
exemption covers a tab. It is narrow on purpose: a bare `<span>` has no such
excuse, and that is where every dead definition was hiding.

[`scripts/tests/entity-definitions.test.mjs`](../../scripts/tests/entity-definitions.test.mjs)
fails a build that puts a definition back behind a tooltip. The subject is
every `<Tooltip>` element in `src`, not a list of files, so it finds the next
one wherever it is written.

### What a phase, a scenario, a path, a step, a lane and a service ARE

*Decided 2026-08-31 with #140.*

The entity kinds were the one vocabulary the app never defined. `PanelTermLabel`
explains the words *inside* a panel on the assumption that a reader who opened
it knows what kind of thing they opened it on; #140 is that assumption failing.

> **A definition hangs off the entity's own label ON THE BOARD, in that label's
> hover slot, alongside the label's existing description where it has one. Six
> placements, no exemptions.**

Not the panel badge. A reader who does not know what a lane is has the question
*while looking at the board*, before anything is opened, and an explanation
that arrives only after the click is an explanation for somebody who no longer
needs it. `PanelKindBadge label="Phase"` is unchanged: the panel already
answers "what is in this one".

| Kind | Label on the board | Carried by |
| --- | --- | --- |
| service | the navbar title | `EntityTitleAffordance` |
| phase | the phase frame's label, and the menubar title | `ScenarioTitleBadge` (`tone="phase"`), `EntityTitleAffordance` |
| scenario | the compare panel's label, the menubar title, a slide header's title | `ScenarioTitleBadge`, `EntityTitleAffordance`, `ScenarioTitleDefinition` |
| path | the band, column and cell label | `PathLabelBadge` |
| step | the column header | `StepHeaderAffordance` |
| lane | the row header | `LaneHeaderAffordance` |

All six route through **`EntityDefinitionPopover`**, and the words live in
`ENTITY_KIND_DEFINITIONS` (`src/lib/panelTerms.ts`) — static constants, one per
kind, next to the panel terms they are the missing half of. The component was
`PathDescriptionTooltip`; the name was already wrong, since two badges funnelled
through it, and it is wrong twice over now that it is not a tooltip.

**One shape, always the same.** The kind in small caps, its definition, a rule,
and then this instance's own description below it. The kind line goes on all
six including the three that already had a description — a reader learns the
shape once and it never varies, and "the ones with a description are different"
is a rule nobody can see.

One mechanism carrying two facts is fine. The standing prohibition is two
mechanisms for **one** fact, which is why the instance half is drawn only where
the description is not already on screen: a menubar title and a slide header
print it as prose beside the name, so their popovers carry the kind alone.

### The cue is a dotted underline

`cursor-help` is a pointer cue and touch has no pointer, so the help cursor
cannot be the only mark on an explained word. The mark is the `<abbr>` idiom —
a dotted underline in the label's own ink at 40%, `DEFINED_LABEL_CUE` in
`src/lib/panelText.ts`. Not an ⓘ: that glyph means "opens the panel".

**This does not undo `### The question cursor came back, and why` above, and it
is the revisit that section invited.** Its argument was that with #182 taking
the hover state away, nothing at all announced an explained badge before the
tooltip opened, so the cursor stopped being a duplicate signal. The dotted
underline is now the always-drawn signal that argument was missing — but it is
a *different* signal from the cursor rather than the same one twice: the
underline says "this word is defined" to everyone, and the cursor says "and a
pointer will get it without a click" to the reader who has one. An explained
label wears four things and only four: **the dotted underline, `cursor-help`, a
focus ring, and the popover.** A label with nothing behind it wears none of
them — a help cursor and a dotted rule over a word that explains nothing are
promises neither can keep.

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
This is why definitions are popovers rather than tooltips (above), and why a
canvas header that both explains a word and opens a panel gives them **two
targets**: the name carries the definition, and an opener filling the rest of
the block carries the panel.

**Keyboard.** A tooltip on a bare `<span>` cannot be reached at all. A section
label carrying a definition must be focusable and must announce itself.

**Screen readers.** An icon-only control's tooltip and its `aria-label` say the
same words from one source. Two strings for one label is how they drift.

Practical consequence: **prefer a component over a raw `<Tooltip>`.**
`IconTooltip`, `PanelTermLabel`, `PanelKindBadge` and `EntityDefinitionPopover`
already handle focus and labelling. A raw tooltip dropped on a `<span>` almost
never does — and if what it carries is a definition, it is also unreachable on
touch.

---

## The cases, decided

| What | Mechanism |
| --- | --- |
| Icon-only button | `IconTooltip` — the tooltip **is** its label, and the one place a tooltip is still right |
| **What a phase, scenario, path, step, lane or service IS** | `EntityDefinitionPopover` on that entity's own label **on the board** — six placements, no exemptions |
| Lane role, path type, cell status | `PanelKindBadge description=` on the badge, which is a popover |
| Who a lane's owner IS — the definition on `stakeholders.summary` | `StakeholderBadge`, which is `PanelKindBadge description=` with the registry's own one-liner. Where the field is editable there is no badge to hover, so the same sentence is printed under the picker; the two never appear together. |
| Section label naming a concept — `Dependencies`, `Evidence`, `Resources`, `Summary` | `PanelTermLabel` — a popover on the label; the label must be focusable |
| Form field guidance | `hint` prop, always visible |
| A consequence of saving | `Alert variant="warning"`, inline |
| A load or write failure | `Alert variant="destructive"`, inline |
| Why a control is elsewhere | **nothing** — if it matters, the control is in the wrong place |
| Opening an entity's properties | the ⓘ, always visible, and it means nothing else |

Standing prohibition: **nothing carries two mechanisms for one fact.** Removed
from the lane badge in Aug 2026; do not bring it back.

---

## Badge and tag, and there is no third word

*Decided 2026-08-31 with #182. The vocabulary had four words for two ideas.*

> **A badge describes the thing it sits on.** One per thing, not drawn from a
> set the reader picks from, **never interactive**.
>
> **A tag is one value out of a set**, selectable or removable.

By that split the divider label is a badge, a cell's `status` is a badge, a
lane's stakeholder is a badge, a path's name is a badge — and `OwnerTagSelect`
is the only tag in the app. A touchpoint on the canvas is neither: it is a
**cell** whose corner radius is a variant, which is why it takes
`BlueprintCellButton`'s `touchpoint` variant rather than a component of its
own. "Chip" and "pill" were a third and fourth name for these two, and
[`scripts/tests/badge-and-tag.test.mjs`](../../scripts/tests/badge-and-tag.test.mjs)
now fails a build that reintroduces either as a name.

**A badge never changes colour or border on hover**, and the same test enforces
it over every `<Badge>` in the app. This is the rule the question cursor above
depends on: a surface that repaints under the pointer promises a click, so a
badge that did it was promising one it never delivered. What a badge offers
instead is the help cursor, the focus ring and the tooltip. **Something that
needs a hover state is a button** — use one, and give it something to do.

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
nowhere else. It is not on the grid.**

### Why not the grid

The objection to a panel-only answer is real and worth stating first: a
distinction visible only after a click is one most readers never meet. Three
things answer it.

**It is not a scanning fact.** "Is this core here?" cannot be asked without
already looking at *here*. The reader who clicked the touchpoint is exactly the
reader the answer is for — and everything else the placement carries, its
summary, its screenshot, its design link, is behind the same click. Promoting
one of the four to the board would say prominence is the important one.

**The touchpoint has no visual variable left.** A touchpoint cell already encodes
three vocabularies — tone by touchpoint name, a dashed edge and drained fill
for an unbuilt `status`, the slice-sequence badge — over three interaction
rings (active, connected, picked). A fourth mark either collides with `status`,
which owns fill and opacity, or arrives as a legend nobody was taught.

**It would be learned by nobody.** By the rule above, a badge promises a
vocabulary the reader learns by seeing it repeat. Zero placements are marked
today and most never will be; a mark appearing on a handful of touchpoints out of
three hundred reads as an anomaly, not as a scale.

### What was rejected

| Considered | Why not |
|---|---|
| A mark on **every** touchpoint, all three states rendered on the board | The failure #189 names outright. Three hundred touchpoints each wearing an importance mark averages into "this tool matters", which is a claim about the catalog — and the unmarked majority would have to wear *unmarked* as a visible state, putting a judgement nobody made on screen. |
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
