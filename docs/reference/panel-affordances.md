# Explaining things in a panel

Three mechanisms for explaining things had drifted into being picked by habit:
`IconTooltip` in 34 files, `PanelHint` in two, a raw `Tooltip` in eleven more,
and a dozen section labels naming a concept with nothing to say what it means.
The same fact ended up hoverable in one panel, behind an ⓘ in another, and
unexplained in a third.

This is the rule.

> *Rewritten 2026-08-21. The first version asked one question — "is the thing
> you are explaining on screen?" — which sounds decisive and is not. Almost
> everything is on screen in some sense. It also decided hover-versus-click by
> presence, when presence has nothing to do with it, and it was silent on touch
> and keyboard, where a hover-only rule simply fails.*

---

## Two decisions, not one

Explaining something in a panel is two independent choices, and the old rule
collapsed them into one. Keep them apart:

> **The anchor follows the subject.**
> **The gesture follows the length.**

**Anchor** — what the explanation hangs off.

| The subject is | Anchor |
| --- | --- |
| a word on screen that *is* the subject (`Dependencies`, `Front Stage Tech`, `Applies when`) | **that word** |
| a control with no words (an icon-only button) | **that control** — the explanation is its label |
| not on screen at all (an absent control, a rule about how saving works, why a field is missing) | **an ⓘ marker**, placed where the reader will look for it |

**Gesture** — how it opens.

| The explanation is | Gesture |
| --- | --- |
| a phrase or a sentence — glanced at, then done | **hover, focus and tap** |
| a paragraph, or it contains a link, or the reader needs it open while looking at something else | **click** |

The two are independent. A term whose definition runs long gets a click. A
short aside still gets an ⓘ, because the ⓘ is about *anchoring*, not length.
The one combination to avoid is a click-to-open marker whose content is four
words — that is a control promising more than it delivers.

**Why gesture is about length, not presence.** A hover panel cannot be kept
open, cannot be scrolled, and closes the moment the pointer leaves. Those are
the real constraints, and they are set by how much there is to read — not by
whether the subject happens to be visible.

---

## Hover is never the only way in

The old rule was built entirely on hover, which excludes two populations
outright. This section is not an accessibility footnote; it is half the rule.

**Touch.** There is no hover on a phone, and this app has a phone posture —
`useMobileShell`, a bottom sheet the full width of the screen. Any definition
reachable only by pointer is invisible there. Every hover explanation must open
on tap as well; a tap that opens a definition must not also activate whatever it
sits on.

**Keyboard.** A tooltip on a bare `<span>` cannot be reached at all. If a
section label carries a definition, that label must be focusable and must
announce itself — otherwise the definition is mouse-only, which is the same
failure as touch with a different cause.

**Screen readers.** An icon-only control's tooltip and its `aria-label` say the
same words, from one source. Two strings for one label is how they drift.

The practical consequence: **prefer one component per job over a raw
`<Tooltip>`.** `IconTooltip` and `PanelKindBadge` already handle focus and
labelling. A raw tooltip dropped onto a `<span>` almost never does.

---

## The cases, decided

| What | Anchor | Gesture | Component |
| --- | --- | --- | --- |
| Icon-only button | the button | hover / focus / tap | `IconTooltip` |
| Lane role, path type, cell maturity, entity kind | the badge | hover / focus / tap | `PanelKindBadge description=` |
| Section label naming a concept — `Dependencies`, `Evidence`, `Resources`, `Applies when` | the label | hover / focus / tap | label tooltip; label must be focusable |
| Form field guidance | none — inline under the label | always visible | `hint` prop |
| Why a control is not in this panel | ⓘ beside the section it concerns | click | `PanelHint` |
| What a save actually touches | ⓘ beside the identity line | click | `PanelHint` |
| A definition that runs to a paragraph | the term | **click** | `PanelHint` on the term |

Two standing prohibitions:

- **Nothing carries both an ⓘ and a hover with the same words.** Two controls
  for one fact. Removed from the lane chip in Aug 2026; do not bring it back.
- **An ⓘ next to a word that could carry the definition itself** is the same
  mistake. If the word is the subject, hover the word.

---

## Badge or text

*Revised 2026-08-21 — the first version's test was wrong, and `owner_team` was
the case that proved it.*

The old test was "is the value from a set the **schema** enforces?" That is a
fact about the database, and the reader cannot see the database. It put
`owner_team` in the text column because the team list was editorial rather than
constrained — while a reader looking at 306 lanes sees the same seven words over
and over, which is exactly what a badge is for.

The right test is about the reader:

> **Does the value come from a vocabulary the reader learns by seeing it
> repeat?**

Learning happens through repetition, so the question is really: *does the same
value appear across many entities?*

| | Badge | Text |
| --- | --- | --- |
| **How many distinct values?** | few, and they recur | many, mostly unique |
| **What does the reader do?** | scans for it, recognises it | reads it |
| **Two entities with the same value** | means something — they are the same kind | is coincidence |
| **Does it carry a colour?** | yes, and the colour is part of the vocabulary | no |

**Badges:** entity kind (Scenario, Lane, Step) · lane role · path type · cell
maturity · touchpoint tone · **`owner_team`**.

**Text:** KPIs · tools · summaries · notes · `owner` and `perceived_owner`
free-text overrides.

`owner_team` moved. Seven teams across 306 lanes is a vocabulary a reader learns
in one sitting, and "which lanes does Research own?" is a scanning question. The
[lane vocabulary](./lane-vocabulary.md) is the closed list behind it, and the
stakeholder registry (plan `2026-08-20-009`) is what will enforce it — the
badge treatment is correct now and will be schema-backed shortly.

**The trap the old rule was reaching for, restated properly.** A value that
happens to be one of three things *today* is not a vocabulary. The question is
whether the set is **governed** — someone owns the list and adding to it is a
decision — not whether it is currently short. `owner_team` is governed by
`lane-vocabulary.md`. An ungoverned free-text column with four values in it is
still text, and badging it promises a vocabulary that does not exist.

---

## Applying it

- `PanelKindBadge` takes a `description` — anything from a governed vocabulary
  should pass it, and then it explains itself for free.
- `IconTooltip` for icon-only controls. `PanelHint` for absences, for rules, and
  for anything that runs long.
- A raw `<Tooltip>` is a smell: it usually means focus and touch were not
  considered. If you reach for one twice for the same job, that job wants a
  component.
