# Tooltips, hints and badges — when to use which

Three mechanisms for explaining things had drifted into being picked by habit:
`IconTooltip` in 34 files, `PanelHint` in two, a raw `Tooltip` in eleven more,
and a dozen section labels naming a concept with nothing to say what it means.
The same fact ended up hoverable in one panel, behind an ⓘ in another, and
unexplained in a third.

This is the rule. It is short on purpose.

---

## The three jobs

There are only three reasons to explain something in a panel, and each has one
mechanism.

### 1. Name a control that has no words — **hover tooltip, on the control**

An icon-only button is unlabelled. The tooltip *is* its label.

```tsx
<IconTooltip label="Add a dependency">
  <button …><Plus /></button>
</IconTooltip>
```

Hover, never click. **A label you have to click for is not a label.** Screen
readers get the same words through `aria-label`, so the two never disagree.

### 2. Define a term the reader may not know — **hover tooltip, on the term itself**

Lane roles, path types, maturity, and the words this app uses for its own
furniture: *dependency*, *evidence*, *resource*, *slice*, *route*. A reader who
does not already know what "backstage actions" means needs to be told, once,
where they are looking.

```tsx
<PanelKindBadge label="Front Stage Tech" description={describeLaneRole(role)} />
```

**No ⓘ beside it.** The word in question is already on screen, and hovering the
word you do not recognise is where anyone looks for its meaning. An icon next
to a word that could carry the tooltip itself is two controls for one fact —
that pattern was removed from the lane chip in Aug 2026 and should not come
back.

### 3. Explain something ABSENT, or a decision — **clickable ⓘ, popover**

Why the layout control is not in this panel. What a save actually touches. Why
a field a reader expects is missing.

```tsx
<PanelHint label="Where the layout is set">
  How the paths are laid out is a view preference, set by the compare control
  on the canvas…
</PanelHint>
```

These are asides. They are longer than a tooltip should hold, they are read at
most once, and they must be dismissible — a hover cannot do any of the three.
`PanelHint` uses a popover, so it dismisses the way everything else does: click
away, Escape.

---

## The test

> **Is the thing you are explaining on screen?**
>
> **Yes** → hover the thing itself. No icon.
> **No — it is absent, or it is a decision about the design** → ⓘ popover.

That is the whole rule. Everything below is consequence.

- A section label naming a concept (`Dependencies`, `Evidence`, `Resources`,
  `Applies when`) is **on screen**, so it takes a hover tooltip on the label —
  not an ⓘ, not nothing.
- A form field's `hint` is the same job as a definition, delivered inline
  because a field being filled in deserves its guidance without a gesture.
- Nothing gets both an ⓘ *and* a hover carrying the same words.

---

## Badge or text

Two questions, one answer each.

| | Badge | Text |
| --- | --- | --- |
| **What is the value?** | one of a closed set | authored prose, or an open string |
| **What does the reader do with it?** | scans for it | reads it |
| **Does its colour mean something?** | yes — the set has a palette | no; colour would be decoration |

A badge answers *which kind of thing is this*. Text answers *what does it say*.

**Badges:** entity kind (Scenario, Lane, Step), lane role, path type, cell
maturity, touchpoint tone. Every one is a closed set with a defined palette,
and every one is something a reader scans a panel for rather than reads.

**Text:** owner team, KPIs, tools, summaries, notes, owner and perceived owner.
These are open strings. A badge around an open string promises a vocabulary
that does not exist, and the moment two of them differ only in wording the
promise is visibly broken.

**The trap:** a value that is *currently* one of three things is not a closed
set. `owner_team` comes from a closed list of eight teams and still takes text,
because the list is editorial and will grow. A closed set is one the *schema*
enforces — a check constraint, a TypeScript union — not one that happens to be
short today.

---

## Applying it

- `PanelKindBadge` takes a `description` — anything from a closed set should
  pass it, and then it explains itself on hover for free.
- `IconTooltip` for icon-only controls. `PanelHint` for absences and decisions.
- A raw `<Tooltip>` is fine where neither fits, but if you reach for one twice
  for the same job, that job wants a component.
