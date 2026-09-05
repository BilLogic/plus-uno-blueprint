---
audience: designers, developers
summary: Every word a panel puts in front of a reader and the name behind it — the alignment rule, the five labels that diverge and why each does, what the catalog says about each name, and why the subject is panel labels rather than words on screen.
sources: scripts/interface-schema-map.mjs, scripts/tests/labels-name-their-columns.test.mjs, supabase/migrations/
last-reviewed: 2026-09-05
---

# The interface→schema map

Every word a panel puts in front of a reader, and the name behind it.
`scripts/retired-vocabulary.mjs` records the words that **changed**; this
records what every current word is **bound to**, the agreements included. A
table of divergences alone cannot say that the rest are fine — "not listed"
would mean both "aligned" and "nobody looked", and that ambiguity is the state
[#171](https://github.com/BilLogic/plus-uno-blueprint/issues/171) was raised
about: *"how come we have inconsistent naming from front and backend again
(i.e., resources vs. links)?"* The complaint was never that the words differ.
It was that no document said which of the differences were on purpose.

The interface word is a **panel label** — the `label`, `term` and `title` props
of the five components that put a field's name in front of a reader. The schema
word is a `table.column`, or a bare table where the label heads a whole
relation rather than one field of it. The two **agree** when they are the same
word once case, spaces and a foreign key's `_id` are set aside; singular and
plural agree too, because the label over a relation names the thing and the
table names the collection. Anything further apart than that owes the third
column a reason.

## The binding

<!-- generated:binding — npm run interface-map -->

| The interface says | The schema says | Why they differ |
|---|---|---|
| **Content** | `cells.content` | — |
| **Summary** | `cells.summary`, `cell_touchpoints.summary`, `paths.summary`, `phases.summary`, `scenarios.summary`, `services.summary`, `steps.summary` | — |
| **Status** | `cells.status`, `paths.status` | — |
| **Owner** | `cells.owner` | — |
| **Perceived owner** | `cells.perceived_owner` | — |
| **Function** | `cells.function` | — |
| **Form** | `cells.form` | — |
| **Value proposition** | `cells.value_props` | `props` abbreviates this exact phrase and no other. A label is read once and a name is typed daily, so the panel spells out what the schema shortens. Singular on purpose: a cell has one value proposition, stated once per audience — each row is a `for` and a `value` — and the plural on the column counts those statements, not separate propositions. |
| **Touchpoint** | `touchpoints` | — |
| **Role** | `cell_touchpoints.role` | — |
| **Registry** | `cell_touchpoints.touchpoint_id` | The column is a foreign key into `touchpoints`, and the field is where a name-only placement is linked to the registry entry it was about (#277). A reader is choosing from the registry; the panel says so rather than naming the key. |
| **Stakeholder** | `lanes.stakeholder_id` | — |
| **Owner team** | `lanes.owner_team` | — |
| **KPIs** | `lanes.kpis` | — |
| **Tools** | `lanes.tools` | — |
| **Business impact** | `phases.business_impact` | — |
| **Operational requirements** | `phases.operational_requirements` | — |
| **Paths** | `paths` | — |
| **Author note** | `paths.note` | `note` is this vocabulary's word for an author's aside, and the label says whose aside it is because it sits directly under Summary, which is the path's own sentence. That distinction is worth a word on screen and not worth a second column. |
| **Funding** | `business_models.funding` | — |
| **Pricing** | `business_models.pricing` | — |
| **Delivery cost** | `business_models.delivery_cost` | — |
| **Revenue model** | `business_models.revenue_model` | — |
| **Partners** | `business_models.partners` | — |
| **Examples** | `services.entity_examples` | The section heads a jsonb map, not a field, and the column carries an `entity_` qualifier the label drops: on the service panel the only examples in question are the board’s six entity kinds, so the qualifier is understood and the heading says the plain word. The six inputs beneath it name the kinds, not columns, so they carry no row of their own; this one row binds the whole map. |
| **Position** | `path_steps.position` | — |
| **Storyboard** | `lanes.lane_role` | The one row whose right-hand side is a VALUE rather than the name of a place to put one: `storyboard` is one of the eight `lane_role` admits, and this label heads the frames of the lane carrying it. The word is in the schema; it is simply not a column name. |

<!-- /generated:binding -->

Five rows out of twenty-seven, and each one a decision rather than an accident.
That is the claim the table exists to make checkable, and
[`scripts/tests/labels-name-their-columns.test.mjs`](../../scripts/tests/labels-name-their-columns.test.mjs)
checks it four ways: every panel label has a row, every row is a label some
panel still says, every row names something the replayed schema has, and a
divergent row carries a reason while an aligned row does not. The last pair is
the one worth stating out loud. A reason recorded about a label that never
diverged reads as a decision and settles nothing, and a reason column with
decoration in it is a column readers learn to skip — taking the four real ones
with it.

One of the three is the shape worth recognising when the next arrives. `note`
is an ordinary word several tables carry, naming what a value IS; **Author
note** names what this particular one is FOR. A column shared across tables
cannot say which of them a reader is standing in, and renaming it to the label
would make it wrong on the next table that needs it. (**Link** was the same
shape until #276: `cell_touchpoints.url` became a featured `resources.url` row,
and the button it makes is named by its host.) The other two are one-offs: `value_props` abbreviates its label,
and `lane_role` holds its label as a value.

**The subject is panel labels, and that is narrower than "words on screen" on
purpose.** *Spec* never reaches the interface at all — the entry for it in
[`CONTEXT.md`](../../CONTEXT.md) says so and why. *Line of visibility* and
*strip* reach it as drawings rather than as the name of a field, and are
derived at render time from `lane_role` and from the frames of a step, so there
is nothing to bind them to. A word that heads no field has no name to be bound
to, and a rule pretending otherwise would be a rule nobody could satisfy.

## What the catalog says

The binding above says which column a label names. This says what the catalog
says that column IS — the comment the migration series wrote on it, which is
also the sentence `docs/agents/blueprint.md` puts in front of every agent. Both
tables are generated by `scripts/generate-interface-schema-map.mjs`, so a label
and the sentence behind it are read from one place and cannot drift into two.

<!-- generated:catalog — npm run interface-map -->

24 of 34 names carry a comment in the catalog.

| The schema says | What the catalog says |
|---|---|
| `cells.content` | THE ONE DELIBERATE EXCEPTION to the name/title/summary vocabulary (#177): a cell's text is a sentence somebody wrote about a moment, not a name for the cell and not a one-line summary of something longer. |
| `cells.summary` | Optional longer cell description (detail panel, not grid label) |
| `cell_touchpoints.summary` | — |
| `paths.summary` | Optional summary of what this path variant represents |
| `phases.summary` | — |
| `scenarios.summary` | — |
| `services.summary` | What this service is, in the words a newcomer needs. The one field above the business model in the service panel. |
| `steps.summary` | What this moment is, across every lane — the one sentence that makes the column legible without reading five cells. Shown as the caption under the step's strip, which is the frames of its cells read across the lanes. |
| `cells.status` | How far along the thing this cell describes is. Defaults to live — a current-state blueprint documents what is in use. |
| `paths.status` | How far along this route is. Defaults to live. Replaces the "Prototype: " / "Planned: " name prefixes, which said the same thing where nothing could query it. |
| `cells.owner` | Actual owning team/party for this cell. |
| `cells.perceived_owner` | Who the customer believes owns this moment (mismatch = deception risk). |
| `cells.function` | Spec: role/responsibility/requirements of this cell (what it must do). |
| `cells.form` | Spec: communication/look/feel/sound (what it must convey). |
| `cells.value_props` | Array of {for, value} — value generated per beneficiary (user, business, actor). |
| `touchpoints` | Deployment-level catalog of the tools, documents, channels and artifacts the |
| `cell_touchpoints.role` | What this touchpoint is to this moment: core (the step happens through |
| `cell_touchpoints.touchpoint_id` | — |
| `lanes.stakeholder_id` | — |
| `lanes.owner_team` | Team that staffs/owns this lane (feeds KPI-alignment audit). |
| `lanes.kpis` | String array: metrics this lane's team is measured on. |
| `lanes.tools` | String array: systems/tools this lane's actors use. |
| `phases.business_impact` | Commercial impact notes: opex, NPS, brand, retention, growth. |
| `phases.operational_requirements` | Process / system / people / legal requirements for this phase. |
| `paths` | One route through a scenario: happy, variant or exception (kind), and how far along it is (status). Nothing connects across paths; a path is a detour, not a stage. |
| `paths.note` | Optional path note shown alongside path metadata (e.g. parallel scenario context) |
| `business_models.funding` | — |
| `business_models.pricing` | — |
| `business_models.delivery_cost` | — |
| `business_models.revenue_model` | — |
| `business_models.partners` | — |
| `services.entity_examples` | Per-service authored examples, one free-text value per core kind (service, phase, scenario, path, step, lane), shown under each kind's definition to ground it in this deployment. Blueprint data, not app config: it rides the service block so a re-map round-trips it. A jsonb object with no CHECK — the six-key shape is the app's, and an unwritten key simply does not render. |
| `path_steps.position` | Blueprint column index for this step on this path |
| `lanes.lane_role` | Semantic role key that drives rendering (pill cells, storyboard rows, divider anchoring), deliberately separate from the free-form display name. Canonical values: customer_actions, |

<!-- /generated:catalog -->

## Where the halves live

**The map a person reads is generated, and that is a change from how this
document used to work.** It sat inside `CONTEXT.md` until
[#365](https://github.com/BilLogic/plus-uno-blueprint/issues/365), as a
hand-kept table held against `LABEL_COLUMNS` by a parity test — two lists on
purpose, because a prose document should not be load-bearing for a build, and a
documented map that has drifted from the enforced one is a lie in the file
people trust to learn the vocabulary. Generating the table settles the same
argument a better way: there is one list, `scripts/interface-schema-map.mjs`,
this document is rendered from it, and `npm run check:interface-map` fails when
the rendering and the document disagree. The prose around the tables stays
hand-written, because why two words differ is a decision and no catalog holds
decisions.
