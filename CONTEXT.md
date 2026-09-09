# Vocabulary

The words this codebase fixes, and what each one is bound to in the schema.

**This file is definitions and nothing else.** No architecture, no process, no
opinions about how to work. If a sentence here starts explaining *how the app
does* something rather than *what a word means*, it belongs somewhere else and
should be moved. That constraint is the file's whole value: an agent or a person
can read it end to end before touching anything, and it stays readable because
it never grows a second job. `scripts/check-glossary-only.mjs` holds it there,
so the constraint is a gate rather than a habit.

Two reference tables used to live here and now live where they are enforced.
The rename map is `scripts/retired-vocabulary.mjs`, the one list three checks
read, and the reasoning about which words are retired as identifiers rather
than as words is the header of
[`scripts/check-retired-identifiers.mjs`](scripts/check-retired-identifiers.mjs).
Every panel label and the column behind it is
[`docs/reference/interface-schema-map.md`](docs/reference/interface-schema-map.md).

How to *read* the artifact these words describe — what to look at first, what
the layout is telling you — is
[`docs/product/03-reading-a-blueprint.md`](docs/product/03-reading-a-blueprint.md).
Where the schema and access model are described in full is
[`docs/engineering/access-and-security.md`](docs/engineering/access-and-security.md).
What the blueprint tells an agent about itself — retrieval, absence, what a
status licenses, the schema as the catalog describes it — is
[`docs/agents/blueprint.md`](docs/agents/blueprint.md).

---

## The blueprint

The board's own words — *service*, *phase*, *scenario*, *path*, *step*, *lane*,
*cell*, *touchpoint*, *placement*, *storyboard*, *frame*, *strip*, *resource*,
*dependency*, *status*, *spec* — and the four records about the board —
*slice*, *slide*, *finding*, *evidence* — are the shared model, and this
deployment does not define them. They are defined once, under this same heading
in the template's own `CONTEXT.md`, with the retirements behind each one and the
columns each is bound to. Nearest copy on disk:
`node_modules/agentic-service-blueprinting/CONTEXT.md`, and the schema itself is
`node_modules/agentic-service-blueprinting/references/data-model.md`.

What follows is what this instance says that the template has no reason to say,
and nothing else. A sentence about a shared word that grows back here is drift —
one meaning in two files that nothing holds together, one of which will move
without the other — and `scripts/check-duplicate-meaning.mjs` is what notices.

**lane** — defined there. Named again here because a lane's **name says who, or
it says what**. The customer side and the partners are named after the actor —
*Regular Tutor*, *Lead Tutor*, *Teacher*, *CPO* — because on those rows the
reader is asking whose moment this is. The machinery is named after the job —
*Front Stage Actions*, *Back Stage Touchpoints*, *Support Actions* — because
there the reader is asking what kind of work it is, and the actor varies by
step. Both conventions appear on every board and that is correct; a lane named
for a person still carries the `lane_role` that places it.

**dependency** — defined there, both kinds read **source-first**, and the panel
names each end. Named again here for what is this deployment's alone: two of its
own surfaces once said the opposite, so `create_cell_dependency`,
`src/lib/agent/canvas-adapter.md` and this file are held to one direction by
[`scripts/tests/both-kinds-read-source-first.test.mjs`](scripts/tests/both-kinds-read-source-first.test.mjs).

**spec** — defined there, and banned from the interface there as well. How a
spec field is *written* is this deployment's own question:
[`docs/reference/spec-house-style.md`](docs/reference/spec-house-style.md).

**finding** — defined there. What one reads like here: "these two cells expect
the same tutor in two places at once", naming the exact cells it is about.

Who may CHANGE each of the four records is the ownership table in the template's
`CONTEXT.md`, and this deployment's write roster is held against that table —
not against a second copy of it — by
[`scripts/tests/who-writes-what.test.mjs`](scripts/tests/who-writes-what.test.mjs).

## Words this instance also uses

**canvas** — the pan/zoom surface the board is drawn on.
**compare** — the surface that puts two or more paths of one scenario against
each other.
**design mode** — the canvas mode in which cells become editable. Its opposite is
**view mode**. On the phone it does not exist at all — absent, never disabled.
**cover** — the shell's landing view, before any blueprint is open.

**change log** — the append-only record of every authoring write: what was
done, with which arguments, what would undo it, and who did it — a person, or
an agent and which of its sessions. It is **audit-only**. Nothing replays the
inverse it stores; the fast undo is the in-memory list the changes sheet reads,
and that list is emptied by a refresh while this is not.
Table `authoring_changes`.

**trash** — the deletions in the change log, which are the rows that carry a
`deleted_kind` and, with it, the payload of everything the delete destroyed.
**A view, not a table** (`trash`), so the recovery list cannot drift from the
record of what happened. It replaced `deleted_structure`, which recorded
deletions durably while every other write was remembered only until the tab
closed.

**`/sb:map`, `/sb:audit`, `/sb:whatif`, `/sb:slice`** — the four domain skills.
They are *skills*, not app surfaces, and they come from the installed `sb`
plugin (the `agentic-service-blueprinting` repo), not from this repo. Note that
**`slice` is overloaded**: `/sb:slice` is the skill that produces one, a *slice*
is the artefact it produces.

### Five words for arrival

Five words for *not there yet* — **entrance**, **boot**, **revealStage**,
**hold** and **status** — naming five different things. Two belong to the
shell, one to the canvas, one is a duration, and one is about the data rather
than the screen. The shell, the canvas and the skeleton hold are all shared
code, so the five are defined once, under this same heading in the template's
own `CONTEXT.md`, and not a second time here. Nearest copy on disk:
`node_modules/agentic-service-blueprinting/CONTEXT.md`.

**status** — what a query returned. Defined there like the rest, and named
again here for the one thing the template has no reason to say: it is **not the
board's *status***, the six-value word for how far along a cell or a path is.
That one is stored in a column; this one only ever describes a read.

### The writing vocabulary

Five words for how a document is written and reached, shared with the sibling
repositories so that one harness review uses one language.

**pointer** — a line held in always-loaded context that names material outside
it and the branch that should reach it: a row of `AGENTS.md` § Progressive
loading, a path beside a security line. Its wording, not its target, decides
whether a session gets there. A *reference* is what a pointer points at.

**ladder** — where a piece of writing sits by how immediately a session needs
it: an in-file step, then an in-file reference, then a **disclosed** reference
behind a pointer. **Not the canvas's reveal ladder** in § Five words for
arrival, which is about how much of a board is painted.

**disclosed** — a reference pushed out of the always-loaded tier and behind a
pointer, loaded only when that pointer fires. Everything under `docs/` is
disclosed; `AGENTS.md` is the tier itself.

**leading word** — the first word of a routing item, chosen so that it is the
word carrying the branch — *writes*, *migrations*, *skills* — and front-loaded
so a scanned pointer triggers on it. `scripts/check-pointers.mjs` is what holds
it there.

**sprawl** — a document too long even when every line of it is live: attention
thins across the whole of it. The cure is the ladder rather than a shorter
sentence. Distinct from *bloat*, which is dead weight — and this file was both
at once until #365, when the rename map and the interface-to-schema map it had
grown moved out to the check and the reference that own them. What measures the
always-loaded tier's share of it is `scripts/check-router-budget.mjs`.
