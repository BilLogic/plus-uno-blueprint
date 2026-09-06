import type { ToolSpec } from '@/lib/agent/providers/provider'
import { REFERENCE_NAMES } from '@/lib/agent/tools/referenceNames'

/** Re-exported so the eval harness, which bundles this module, resolves
 * the same reference vocabulary the app serves. */
export { REFERENCE_NAMES }

/**
 * The static allow-list — the agent's entire reach. Each write dispatches
 * onto the SAME wrapper the UI calls, so RLS, validation, session logging
 * and revert capture come free; there is no dynamic dispatch, no table
 * name as an argument, no free SQL. A request for anything else is a
 * refusal, not an attempt. Deliberately absent: every delete.
 */

/**
 * ARGUMENT NAMES ARE NOT COLUMN NAMES, and after 20260830190000 four of them
 * visibly are not.
 *
 * `create_cell_dependency(label)` writes `cell_dependencies.name`;
 * `create_finding(check_name, note)` writes `audit_findings.check_key` and
 * `.summary`; `create_slice(slice_type, description)` writes `slices.kind` and
 * `.summary`. The mapping happens in `registry.ts` and the columns are the
 * ones #177 renamed.
 *
 * They stay because this surface is a PINNED CROSS-REPO CONTRACT, not app
 * internals. `agentic-service-blueprinting` is a git-URL dependency fixed to a
 * tag, and its skills name these arguments in prose the model reads —
 * `skills/audit/SKILL.md` and `references/audit-playbook.md` both say
 * `check_name`. Renaming here without a matching release upstream means a
 * skill telling the model to send an argument this app rejects, which is a
 * worse failure than a name that reads a little behind the schema. AGENTS.md
 * states the direction: a fix goes upstream and arrives here as a version
 * bump.
 */

/**
 * NAMING — the rule every tool here follows.
 *
 * A tool name is `<verb>_<noun>`. The verb states the CONTRACT (what the
 * caller may assume about the result); the noun states the entity family,
 * or the corpus when the rows can come from several rungs of one walk.
 *
 *   search_  ranked matches for a query — truncated at k, snippets only
 *   list_    the COMPLETE set at a level — no query, always projected
 *   get_     named ids — full bodies, bounded BY the ids being required
 *   compare_ / measure_   derived, not stored
 *   create_ / update_ / upsert_ / duplicate_   data writes (CRUD)
 *   set_     UI STATE ONLY — never a data write
 *   open_ / focus_   move the user's canvas
 *
 * `list_` and `search_` stay apart because their success criteria are
 * opposite: enumeration must be COMPLETE, ranking must be RELEVANT. A
 * model that reaches for the ranked door on an enumeration question gets
 * a silent top-k truncation and reports a partial set as the whole one.
 *
 * `list_` and `get_` stay apart because `get_` REQUIRES ids, and that
 * requirement is the payload guardrail — it makes "every cell at full
 * body" impossible by construction rather than by a conditional check.
 *
 * NAME vs PARAMETER. Scope rides in a parameter when it is a zoom level on
 * one parent-child walk (`phase > scenario > path > step/lane > cell` —
 * that is `granularity`), and in the NAME when it is a different record
 * type. Test: can you reach it by walking parent to child through the
 * grid? Evidence hangs off a cell but is not a coarser cell, so it earns a
 * name. Attachments on rows you already asked for ride in `include`.
 *
 * A tool name is NOT a table name and NOT an RPC name. The agent tool
 * `create_step` dispatches to the Postgres RPC `add_step`; renaming one
 * must never rename the other.
 */

const str = (description: string) => ({ type: 'string', description })

/**
 * The service-scope filter shared by the reads that take one. It is a FILTER,
 * not a navigation mode: omit it to stay within the active service (the one on
 * screen), name a service to narrow to it, or pass "all" to reach across every
 * service in the deployment. Inert on a single-service deployment, where every
 * value names the same one service.
 */
const SERVICE_SCOPE_PARAM = str(
  'Optional. Which service to search: a service name, or "all" for every service in the deployment. Omit to use the active service (the one on screen). Ignored when the deployment has only one service.',
)

/**
 * The lane-role filter shared by the two reads that take one.
 *
 * ONE constant rather than the same sentence written twice. It used to be
 * twice, and both copies went on offering the two `*_tech` role spellings
 * long after 20260830150000 renamed them to `frontstage_touchpoints` and
 * `backstage_touchpoints` (#395). A spec is the only description of the value
 * set the model ever sees, so a stale one is not a cosmetic defect: the
 * filter it produces matches no lane, and the read comes back empty while
 * reporting success.
 *
 * The list is the whole vocabulary the `lanes_lane_role_check` constraint
 * admits, and `scripts/check-lane-role-values.mjs` fails the build if a
 * retired spelling comes back to it.
 */
const LANE_ROLE_FILTER_PARAM = str(
  'customer_actions | frontstage_actions | frontstage_touchpoints | backstage_actions | backstage_touchpoints | partner_actions | support_actions | storyboard',
)

/**
 * The mobile reading roster — the ONLY tools offered while the mobile shell
 * is up, for every tier including service accounts. Mobile is view-only by
 * decision (2026-08-08 plan): navigation, reading, and Q&A; no writes, no
 * canvas-mode switch, no annotation marks, no desktop-surface ui_commands.
 * A whitelist rather than a write-filter so a future tool defaults to
 * ABSENT on mobile until someone deliberately adds it here.
 *
 * This is a UX gate, not the security boundary — the server-side RPC tier
 * enforcement stays the real wall.
 */
export const MOBILE_READ_TOOL_NAMES = new Set([
  'get_reference',
  'list_references',
  'list_lanes',
  'list_cell_dependencies',
  'list_evidence',
  'get_evidence',
  'get_business_model',
  'list_sessions',
  'get_session',
  'list_blueprint',
  'get_blueprint',
  'compare_blueprint',
  'get_cell',
  'list_slices',
  'get_slice',
  'list_owner_tags',
  'list_stakeholders',
  'get_ui_state',
  'get_change_history',
  'open_phase',
  'open_scenario',
  'focus_cell',
  'open_cell_panel',
  'measure_deletion_impact',
  'list_findings',
])

/**
 * The reading surface — the row `canvas-adapter.md` calls "the FULL read
 * surface; nothing else reads".
 *
 * CLASSIFIED BY THE ADAPTER'S OWN TEST, not by subtraction: a read tool
 * NEITHER MOVES THE USER'S CANVAS NOR CHANGES A ROW. The complement of
 * `WRITE_TOOL_NAMES` is NOT this set — it sweeps in `focus_cell`,
 * `set_sidebar` and the rest of `INTERFACE_TOOL_NAMES`, which write nothing
 * and are still not reads: they change what the human is looking at, and the
 * adapter's read row promises the opposite in the same sentence.
 *
 * Two calls worth naming, because both go the way a subtraction would not:
 *
 *   `list_ui_commands` IS a read — it reports which controls exist right
 *   now and touches neither the canvas nor a row. `ui_command`, which fires
 *   them, is not.
 *
 *   `measure_deletion_impact` IS a read — `measure_` is derived-not-stored
 *   per the naming rule above, and the deletion it measures is one it
 *   cannot perform.
 *
 * `MOBILE_READ_TOOL_NAMES` is a different question and cannot stand in for
 * this: it is a UX roster that deliberately CONTAINS canvas movers (a phone
 * still navigates) and deliberately OMITS reads (`search_blueprint`,
 * `list_ui_commands`).
 */
export const READ_TOOL_NAMES = new Set([
  'get_reference',
  'list_references',
  'list_blueprint',
  'search_blueprint',
  'get_blueprint',
  'compare_blueprint',
  'get_cell',
  'list_lanes',
  'list_cell_dependencies',
  'list_slices',
  'get_slice',
  'list_owner_tags',
  'list_stakeholders',
  'list_evidence',
  'get_evidence',
  'get_business_model',
  'list_sessions',
  'get_session',
  'get_ui_state',
  'get_change_history',
  'list_ui_commands',
  'measure_deletion_impact',
  'list_findings',
])

/**
 * The tools that drive the interface — the adapter's "same gestures the human
 * has" row. They change what the human SEES, never what the database HOLDS.
 *
 * `ui_command` is here rather than in either surface because it is genuinely
 * neither: most of its commands are interface, and the ones its own listing
 * marks "[changes data]" count against the write batch. Putting it in
 * `WRITE_TOOL_NAMES` would make the loop bill every zoom as a write; putting
 * it in `READ_TOOL_NAMES` would tell the agent `undo_last_change` is a read.
 */
export const INTERFACE_TOOL_NAMES = new Set([
  'open_phase',
  'open_scenario',
  'focus_cell',
  'open_cell_panel',
  'set_canvas_mode',
  'set_sidebar',
  'annotate_cells',
  'ui_command',
])

/** The tools that mutate data — the loop enforces batch etiquette on these. */
export const WRITE_TOOL_NAMES = new Set([
  'create_step',
  'create_lane',
  'upsert_cell',
  'update_cell',
  'create_cell_dependency',
  'update_path',
  'create_phase',
  'create_scenario',
  'create_path',
  'duplicate_path',
  'duplicate_scenario',
  'create_slice',
  'update_slice',
  'replace_slides',
  'create_evidence',
  'update_evidence',
  'create_finding',
  'update_finding',
  'create_stakeholder',
  'update_stakeholder',
])

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'get_reference',
    description: `Read a rulebook reference before acting on its topic. Available: ${REFERENCE_NAMES.filter((n) => n !== 'canvas-adapter').join(', ')}. Read blueprint first for what this blueprint is, what a status licenses you to say and what absence means; lane-roles and lane-vocabulary before any lane/role work; cocreate-playbook and elicitation-protocol before co-creating a scenario from conversation or notes.`,
    parameters: {
      type: 'object',
      properties: { name: str('Reference name, e.g. "lane-roles"') },
      required: ['name'],
    },
  },
  {
    name: 'list_blueprint',
    description:
      'The COMPLETE set of things at one or more levels of the journey, with ids. granularity picks the level: phase, scenario, path, step, lane, cell. Optional filters narrow the scope. This is your table of contents and your "what exists" answer — every row is returned (up to limit) with the true total, so it is the only honest way to say "all N scenarios" or "every exception path". Start here: granularity ["phase","scenario"] is the orientation read. Use get_blueprint instead when you already know the scenario and want its grid laid out.',
    parameters: {
      type: 'object',
      properties: {
        granularity: {
          type: 'array',
          description:
            'One or more of: phase, scenario, path, step, lane, cell. Ask for the level you actually need — "cell" across the whole blueprint is 955 rows.',
          items: { type: 'string' },
        },
        phase: str('Restrict to a phase by name, e.g. "In-session"'),
        scenario: str('Restrict to a scenario by name, e.g. "Warm-Up"'),
        kind: str('happy | variant | exception'),
        lane_role: LANE_ROLE_FILTER_PARAM,
        service: SERVICE_SCOPE_PARAM,
        limit: {
          type: 'number',
          description: 'Max rows (default 200, max 500). The true total is reported either way.',
        },
      },
      required: ['granularity'],
    },
  },
  {
    name: 'search_blueprint',
    description:
      'Find things by WHAT THEY SAY, when you do not already know which scenario holds them — "where do we handle a late call-off", "which cells mention Workday". Results are RANKED and cut off at limit; the header reports how many matched in total, so say that number when you show a subset. Every row reports matched_by. ' +
      'IMPORTANT: this matches WORDS, not meaning. A question phrased differently from the blueprint\'s own wording can return nothing even though the moment IS mapped — zero rows means "no row uses these words", NEVER "the blueprint does not cover this". Re-search with the board\'s vocabulary, or use list_blueprint to see what exists, before reporting an absence. ' +
      'Use list_blueprint when you want the COMPLETE set at a level, and get_blueprint when you already know the scenario. ' +
      'AFTER you find cells, POINT AT THEM: open_scenario, then focus_cell on the one you are talking about. Finding a cell is not the same as showing it — the user is looking at a canvas, and an answer they cannot see on screen is half an answer.',
    parameters: {
      type: 'object',
      properties: {
        query: str('The words to match, in the blueprint\'s own vocabulary where you know it'),
        granularity: {
          type: 'array',
          description:
            'Levels to search: phase, scenario, path, step, lane, cell. Defaults to ["cell"]. Add "path" or "scenario" when hunting for a named branch.',
          items: { type: 'string' },
        },
        phase: str('Restrict to a phase by name'),
        scenario: str('Restrict to a scenario by name'),
        kind: str('happy | variant | exception'),
        lane_role: LANE_ROLE_FILTER_PARAM,
        service: SERVICE_SCOPE_PARAM,
        limit: {
          type: 'number',
          description: 'Max rows (default 15, max 100). The true total is reported either way.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_blueprint',
    description:
      'One scenario laid out as a GRID: every path with its steps, lanes, cells (ids included) and the dependency arrows between them. This is the reading view — use it before writing into a scenario. For "what exists at level X", use list_blueprint instead.',
    parameters: {
      type: 'object',
      properties: { scenario_id: str('Scenario id from list_blueprint') },
      required: ['scenario_id'],
    },
  },
  {
    name: 'compare_blueprint',
    description:
      "Structured comparison of a scenario's paths: canonical columns with verdicts, one group per divergent STEP (the same \"Step N\" the ledger groups by and jump_divergence takes) tagged with its logical divergence zone, every differing slot with per-path quotes and cell ids, and the detail-only (description/links) group. Read before driving the compare UI or answering \"what differs\". Dependency edges are not compared.",
    parameters: {
      type: 'object',
      properties: {
        scenario_id: str('Scenario id from list_blueprint'),
        path_ids: {
          type: 'array',
          description:
            'Optional subset (2+) of the scenario\'s path ids, in comparison order; omit to compare every path',
          items: { type: 'string' },
        },
      },
      required: ['scenario_id'],
    },
  },
  {
    name: 'get_cell',
    description: 'One cell in full: content, summary, owners, function/form/value, position.',
    parameters: {
      type: 'object',
      properties: { cell_id: str('Cell id') },
      required: ['cell_id'],
    },
  },
  {
    name: 'list_slices',
    description: 'List existing slices (stakeholder views) with ids and types.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_slice',
    description:
      'One slice in full: fields plus every slide with its cells, title, narrative. Read before update_slice or replace_slides.',
    parameters: {
      type: 'object',
      properties: { slice_id: str('Slice id from list_slices') },
      required: ['slice_id'],
    },
  },
  {
    name: 'list_owner_tags',
    description:
      'The owner tag vocabulary in use. ALWAYS read before writing owner or perceived_owner — reuse an existing tag unless creating one deliberately.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'list_stakeholders',
    description:
      "The cast: who the blueprint is for, who staffs it, who partners on it, and the provider itself — with the other spellings each name has been written as. ALWAYS read before writing a value_props audience or linking a lane: `tutor` and `Regular Tutor` are one person, and the aliases are where that is recorded. The cast is a shared deployment-level catalog; by default this shows the actors the active service's lanes actually pick, service:\"all\" the whole roster.",
    parameters: {
      type: 'object',
      properties: { service: SERVICE_SCOPE_PARAM },
    },
  },
  {
    name: 'create_stakeholder',
    description:
      'Add someone to the cast. Rare and deliberate — a new row means a new ACTOR in the service, not a new spelling of one who exists. A different spelling belongs in the existing row\'s aliases via update_stakeholder.',
    parameters: {
      type: 'object',
      properties: {
        name: str('How this actor is written on the canvas, e.g. "Lead Tutor"'),
        kind: str('recipient | staff | partner | provider'),
        summary: str('Who they are, in one line; omit for none'),
        aliases: {
          type: 'array',
          items: { type: 'string' },
          description: 'Other spellings already present in this blueprint',
        },
      },
      required: ['name', 'kind'],
    },
  },
  {
    name: 'update_stakeholder',
    description:
      "Edit one member of the cast. Renaming also rewrites `slices.actor` on every slice linked to them — the registry owns that text. Read list_stakeholders first; the id is in its output.",
    parameters: {
      type: 'object',
      properties: {
        stakeholder_id: str('Stakeholder id'),
        name: str('New name; omit to keep'),
        kind: str('recipient | staff | partner | provider; omit to keep'),
        summary: str('One line; omit to keep'),
        aliases: {
          type: 'array',
          items: { type: 'string' },
          description: 'Replaces the alias list; omit to keep',
        },
      },
      required: ['stakeholder_id'],
    },
  },
  {
    name: 'list_lanes',
    description:
      'The lane vocabulary actually in use, with how many lanes carry each label and role. Read before create_lane — reuse a label unless the new lane is genuinely a different kind of thing. Distinct from get_reference("lane-roles"), which says what the roles MEAN rather than which ones this blueprint uses.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'list_references',
    description:
      'The rulebook references available to get_reference, live. Use when unsure what guidance exists.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'list_cell_dependencies',
    description:
      'The dependencies: which cell sets off, or depends on, which other cell. `leads_to` means this cell makes the other one happen (drawn as an arrow); `enables` means the other must already be true (recorded, never drawn). Pass cell_id to get just the edges touching one cell — the whole graph is large. These are the same arrows the user sees on the canvas, and the read half of create_cell_dependency.',
    parameters: {
      type: 'object',
      properties: {
        cell_id: str('Restrict to edges into or out of this cell; omit for the whole graph (capped at 200)'),
      },
    },
  },
  {
    name: 'list_evidence',
    description:
      'Sources the blueprint\'s claims rest on — interviews, analytics, docs, decisions. Pass cell_id for one cell\'s evidence. Read before asserting that a mapped moment is GROUNDED: a cell with no evidence is a claim, not a finding.',
    parameters: {
      type: 'object',
      properties: {
        cell_id: str('Restrict to evidence attached to this cell; omit for the newest 100 across the blueprint'),
      },
    },
  },
  {
    name: 'get_evidence',
    description:
      'Named evidence rows in full, excerpt included. Use after list_evidence to read the sources you intend to cite.',
    parameters: {
      type: 'object',
      properties: {
        evidence_ids: {
          type: 'array',
          description: 'Evidence ids from list_evidence',
          items: { type: 'string' },
        },
      },
      required: ['evidence_ids'],
    },
  },
  {
    name: 'get_business_model',
    description:
      'The service\'s business model: pricing, revenue model, funding, partners, delivery cost. One row per service — no id to pass. Read before answering anything about how the service sustains itself.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'list_sessions',
    description:
      'Past chat sessions on this blueprint — titles, dates, edit counts, ids. Use when the user refers to something discussed earlier ("like we said last time"). Shows exactly the sessions the session switcher shows.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_session',
    description:
      'One past session\'s transcript, oldest turn first. Read after list_sessions when you need what was actually said, not just that a session exists.',
    parameters: {
      type: 'object',
      properties: { session_id: str('Session id from list_sessions') },
      required: ['session_id'],
    },
  },
  {
    name: 'get_ui_state',
    description:
      'What the user is looking at RIGHT NOW: view level, selected phase/scenario, active tab, open cell panel, Design-mode selection. Call after navigating, or whenever "this/here/what I selected" needs grounding. When the user asks what they are looking at, relay EVERY line — view level included, not just the selection.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_change_history',
    description:
      "This session's edit history — every change made in this browser session (human and agent), newest first. When reporting it, distinguish user edits from agent edits and remind the user rows are revertible from the change sheet.",
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max entries (default 30)' },
      },
    },
  },
  {
    name: 'open_phase',
    description:
      'Navigate the user\'s canvas to a phase. Use when asked to go to / show / open something, or to show your work after writing into it.',
    parameters: {
      type: 'object',
      properties: { phase_id: str('Phase id from list_blueprint') },
      required: ['phase_id'],
    },
  },
  {
    name: 'open_scenario',
    description:
      'Navigate the user\'s canvas to a scenario. Open the scenario before focus_cell.',
    parameters: {
      type: 'object',
      properties: { scenario_id: str('Scenario id from list_blueprint') },
      required: ['scenario_id'],
    },
  },
  {
    name: 'focus_cell',
    description:
      'Focus the active canvas camera on a specific cell and wait for the move to complete — use to point at evidence when answering questions. The cell\'s scenario must be open first (open_scenario).',
    parameters: {
      type: 'object',
      properties: { cell_id: str('Cell id') },
      required: ['cell_id'],
    },
  },
  {
    name: 'list_ui_commands',
    description:
      'The LIVE list of UI controls you can drive right now (panel tabs, zoom, compare toggle, presentation, undo, …). Commands appear/disappear with the surfaces that own them — list before ui_command when unsure what exists.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'ui_command',
    description:
      'Fire a UI control by name (from list_ui_commands), with an optional arg. Interface only, EXCEPT the ones the list marks "[changes data]" — those count against your write batch. Notable [changes data] commands: undo_last_change (reverts whatever is newest, INCLUDING the human\'s own edit if theirs came last — say whose change you are undoing before firing it), revert_my_changes (only your own edits from this session; prefer it whenever the user says "undo what you did"), and keep_all_changes (clears the change sheet and with it every revert in the session — nothing can be taken back afterwards). Reverting the whole session is human-only; revert_all_changes exists to say so.',
    parameters: {
      type: 'object',
      properties: {
        command: str('Command name from list_ui_commands'),
        arg: str('Argument where the command takes one; omit otherwise'),
      },
      required: ['command'],
    },
  },
  {
    name: 'open_cell_panel',
    description:
      "Open the cell detail side panel on the user's screen — the same panel a click opens. The cell's scenario must be open first (open_scenario).",
    parameters: {
      type: 'object',
      properties: { cell_id: str('Cell id') },
      required: ['cell_id'],
    },
  },
  {
    name: 'set_canvas_mode',
    description:
      "Switch the user's canvas between 'view' (reading) and 'design' (authoring) mode — same switch as the toolbar's.",
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['view', 'design'], description: 'Target mode' },
      },
      required: ['mode'],
    },
  },
  {
    name: 'set_sidebar',
    description: 'Collapse or expand the sidebar (more canvas vs more navigation).',
    parameters: {
      type: 'object',
      properties: {
        collapsed: { type: 'boolean', description: 'true = collapse' },
      },
      required: ['collapsed'],
    },
  },
  {
    name: 'annotate_cells',
    description:
      'Draw ephemeral annotation boxes around cells on the open canvas (optional short text note above them) — use to point at things visually, like a human with a marker. Marks are scratch-lane only: never saved, cleared on reload.',
    parameters: {
      type: 'object',
      properties: {
        cell_ids: {
          type: 'array',
          description: 'Cells to box (must be on the open scenario)',
          items: { type: 'string' },
        },
        note: str('Optional short label drawn above the boxes; omit for none'),
      },
      required: ['cell_ids'],
    },
  },
  {
    name: 'create_phase',
    description:
      'Create a new phase in the service. Propose the structure as text and get a nod first.',
    parameters: {
      type: 'object',
      properties: {
        name: str('Phase name'),
        summary: str('One line on what this stage is; omit for none'),
      },
      required: ['name'],
    },
  },
  {
    name: 'create_scenario',
    description:
      'Create a new scenario in a phase, with its first path and empty steps. lane_source_path_id copies an existing path\'s lane stack (STRONGLY preferred — lane labels must match across scenarios). Propose as text and get a nod first.',
    parameters: {
      type: 'object',
      properties: {
        phase_id: str('Phase id from list_blueprint'),
        name: str('Scenario name'),
        path_name: str('First path name; say what the route is, not its type. Defaults to "Main path"'),
        step_count: { type: 'number', description: 'Initial step columns (default 5)' },
        lane_source_path_id: str('Path id whose lanes to copy; omit for none'),
      },
      required: ['phase_id', 'name'],
    },
  },
  {
    name: 'create_path',
    description:
      'Add a path to a scenario — variant or exception. lane_source_path_id copies the sibling\'s lane stack (preferred).',
    parameters: {
      type: 'object',
      properties: {
        scenario_id: str('Scenario id'),
        name: str('Path name'),
        kind: {
          type: 'string',
          enum: ['happy', 'variant', 'exception'],
          description: 'Default variant',
        },
        lane_source_path_id: str('Sibling path id whose lanes to copy; omit for none'),
      },
      required: ['scenario_id', 'name'],
    },
  },
  {
    name: 'duplicate_path',
    description:
      'Copy a path — lanes, steps, optionally cells and arrows — as a new variant of the same scenario.',
    parameters: {
      type: 'object',
      properties: {
        source_path_id: str('Path to copy'),
        name: str('New path name'),
        kind: { type: 'string', enum: ['happy', 'variant', 'exception'], description: "Defaults to 'variant'" },
        copy_cells: { type: 'boolean', description: 'Default true' },
      },
      required: ['source_path_id', 'name'],
    },
  },
  {
    name: 'duplicate_scenario',
    description:
      'Copy a WHOLE scenario into the same phase — its columns, every path, every lane, every cell, and every arrow with both ends inside it. One call, two arguments, but it writes far more rows than that suggests: duplicating a 5-path scenario is hundreds of inserts. Say roughly how big the source is and get a nod first. Fully revertible (its inverse deletes the copy). The UI names copies "X (copy)" — use the same form unless the human asks for a different name, so the sidebar reads consistently however the copy was made. Copied cells get no cell_key, so they cannot be bound into a slice until one is authored.',
    parameters: {
      type: 'object',
      properties: {
        source_scenario_id: str('Scenario id from list_blueprint'),
        name: str('Name for the copy; the UI convention is "<source name> (copy)"'),
      },
      required: ['source_scenario_id', 'name'],
    },
  },
  {
    name: 'measure_deletion_impact',
    description:
      'What deleting something would destroy — cell and arrow counts, which slices lose slides, which of those undo cannot put back, and what survives. A pure read: it deletes nothing, and no delete tool exists for you. Use it to answer "what happens if I remove this?" BEFORE the human opens the confirm dialog. Relay the warning and reassurance sentences VERBATIM; they are worded to not overstate what comes back.',
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['scenario', 'path', 'step', 'lane', 'slice'],
          description: 'What is being deleted.',
        },
        target_id: str('Id of the scenario, path, step, lane or slice'),
        scope_id: str(
          'REQUIRED when kind is "step": the path id. Deleting a step removes only the cells on ONE path, so without the path there is no true number to quote. Ignored for other kinds.',
        ),
      },
      required: ['kind', 'target_id'],
    },
  },
  {
    name: 'create_slice',
    description:
      'Create a slice (stakeholder view) that REFERENCES existing cells — never copies. cell_ids in journey order, one slide per cell by default. Propose members by name and get a nod first.',
    parameters: {
      type: 'object',
      properties: {
        title: str('Slice title'),
        description: str('One-line description; omit for none'),
        slice_type: {
          type: 'string',
          enum: ['journey', 'lane', 'step', 'custom'],
          description: 'Kind of cut',
        },
        actor: str('Whose view this is; omit for none'),
        cell_ids: {
          type: 'array',
          description: 'Existing cell ids, in journey order',
          items: { type: 'string' },
        },
      },
      required: ['title', 'slice_type', 'cell_ids'],
    },
  },
  {
    name: 'update_slice',
    description: "Edit a slice's own fields: title, description, actor, type.",
    parameters: {
      type: 'object',
      properties: {
        slice_id: str('Slice id from list_slices'),
        title: str('omit to keep'),
        description: str('omit to keep'),
        actor: str('omit to keep'),
        slice_type: { type: 'string', enum: ['journey', 'lane', 'step', 'custom'], description: 'omit to keep' },
      },
      required: ['slice_id'],
    },
  },
  {
    name: 'replace_slides',
    description:
      "Replace a slice's slides wholesale — THE tool for reordering, resequencing, merging cells into one slide, or splitting them apart. Read the slice first; pass the complete new slide list (each slide: cells in order + optional title/narrative). When a reorder instruction is positionally ambiguous (e.g. \"move the last one up, then merge 2 and 3\" — original numbering or after the move?), confirm which you mean before writing. Re-read the slice afterwards to confirm the slide count matches what you intended.",
    parameters: {
      type: 'object',
      properties: {
        slice_id: str('Slice id'),
        slides: {
          type: 'array',
          description: 'Full replacement, in order',
          items: {
            type: 'object',
            properties: {
              cells: { type: 'array', description: 'Cell ids on this slide', items: { type: 'string' } },
              title: str('Slide title; omit for none'),
              narrative: str('Slide narrative; omit for none'),
            },
            required: ['cells'],
          },
        },
      },
      required: ['slice_id', 'slides'],
    },
  },
  {
    name: 'create_step',
    description:
      'Add a step (column) to a path. Read sibling paths first — step names align across paths BY NAME, so reuse the exact name when the step exists elsewhere.',
    parameters: {
      type: 'object',
      properties: {
        path_id: str('Path id'),
        name: str('Step name'),
        at_position: {
          type: 'number',
          description: 'Insert position (1-based); omit to append',
        },
      },
      required: ['path_id', 'name'],
    },
  },
  {
    name: 'create_lane',
    description:
      'Add a lane to EVERY path of a scenario. Read lane-roles and lane-vocabulary first; lane labels are byte-identical for the same actor group across scenarios.',
    parameters: {
      type: 'object',
      properties: {
        scenario_id: str('Scenario id'),
        name: str('Lane label'),
        lane_role: str(
          'Semantic role (e.g. frontstage_actions, backstage_touchpoints); omit if none fits',
        ),
        at_position: { type: 'number', description: 'Insert row (1-based); omit to append' },
      },
      required: ['scenario_id', 'name'],
    },
  },
  {
    name: 'upsert_cell',
    description:
      'Create the cell at (path, lane, step). Creation ONLY — the call refuses if a cell already exists there (edit with update_cell instead). content is REQUIRED and must be real journey text — an empty or placeholder cell is invisible in the grid.',
    parameters: {
      type: 'object',
      properties: {
        path_id: str('Path id'),
        lane_id: str('Lane id from get_blueprint (parameter named lane_id for historical reasons)'),
        step_id: str('Step id (from get_blueprint)'),
        content: str('The complete cell text — a journey moment, not a system capability. Aim for 80 characters; above 100 returns a non-blocking review warning because the canvas preview clamps to four lines. Put supporting detail in summary. Good: "Tutor greets the student and confirms today\'s goal". Bad: "Session management module".'),
      },
      required: ['path_id', 'lane_id', 'step_id', 'content'],
    },
  },
  {
    name: 'update_cell',
    description:
      'Edit a cell. Text side: content, summary (the tl;dr — never a copy of the text), owner and perceived_owner (existing tags — see list_owner_tags). Spec side: function (what it does), form (how it appears), value_props (audience/value pairs). Reads the current values first, so pass only the fields you mean to change. Fields cannot be CLEARED here — an empty string means keep; ask the human to clear one in the panel.',
    parameters: {
      type: 'object',
      properties: {
        cell_id: str('Cell id'),
        content: str('New complete cell text; aim for 80 characters (above 100 returns a non-blocking review warning; detail belongs in summary); omit to keep'),
        summary: str('New summary; omit to keep'),
        owner: str('Owner tag; omit to keep'),
        perceived_owner: str('Perceived-owner tag; omit to keep'),
        function: str('Function text — what the cell does; omit to keep'),
        form: str('Form text — how it appears; omit to keep'),
        value_props: {
          type: 'array',
          description: 'Full replacement list of {for, value}; omit to keep',
          items: {
            type: 'object',
            properties: { for: str('Audience'), value: str('The value delivered') },
            required: ['for', 'value'],
          },
        },
      },
      required: ['cell_id'],
    },
  },
  {
    name: 'create_cell_dependency',
    description:
      'Connect two cells on the SAME path. BOTH kinds read source-first. kind "leads_to" = the source makes the target happen (drawn as an arrow); "enables" = the source makes the target possible without causing it (panel-only, never drawn) — "B only makes sense once A is true" is A enables B, so the PRECONDITION is the source. They are NOT inverses: a precondition causes nothing, so do not record one as leads_to. State which kind you chose and why in your reply. Arrows only where they add information.',
    parameters: {
      type: 'object',
      properties: {
        source_cell_id: str('Source cell id'),
        target_cell_id: str('Target cell id'),
        kind: { type: 'string', enum: ['leads_to', 'enables'], description: 'Default leads_to' },
        label: str('Short arrow label; omit for none'),
      },
      required: ['source_cell_id', 'target_cell_id'],
    },
  },
  {
    name: 'update_path',
    description: 'Rename a path.',
    parameters: {
      type: 'object',
      properties: { path_id: str('Path id'), name: str('New name') },
      required: ['path_id', 'name'],
    },
  },
  {
    name: 'list_findings',
    description:
      'The findings ledger: audit/whatif findings with status. Read before recording (see what is already open) and when the human asks to triage.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'resolved', 'dismissed', 'all'],
          description: 'Filter; default open',
        },
        cell_id: str(
          'Only findings that name this cell. Use when the human asks "is there anything flagged here?" about a specific moment.',
        ),
      },
    },
  },
  {
    name: 'create_evidence',
    description:
      'Attach a source to a cell — the record of WHY a mapped moment is believed. kind is one of interview, survey, analytics, doc, meeting, decision, observation, other. Write evidence when the user tells you where something came from; never invent a source, and never attach one to a cell you have not read.',
    parameters: {
      type: 'object',
      properties: {
        cell_id: str('Cell the source supports'),
        kind: str('interview | survey | analytics | doc | meeting | decision | observation | other'),
        title: str('What the source IS, e.g. "Tutor onboarding interview #4" — required'),
        ref: str('Link or locator, e.g. a URL or doc name; omit if none'),
        excerpt: str('The quoted passage that carries the claim; omit if none'),
      },
      required: ['cell_id', 'kind', 'title'],
    },
  },
  {
    name: 'update_evidence',
    description:
      'Edit an evidence row: kind, title, ref, excerpt. Pass only the fields you mean to change — the rest are kept. To move a source to a DIFFERENT cell, add it there and remove it here; this tool does not re-point it.',
    parameters: {
      type: 'object',
      properties: {
        evidence_id: str('Evidence id from list_evidence'),
        kind: str('interview | survey | analytics | doc | meeting | decision | observation | other; omit to keep'),
        title: str('New title; omit to keep'),
        ref: str('New link or locator; omit to keep'),
        excerpt: str('New quoted passage; omit to keep'),
      },
      required: ['evidence_id'],
    },
  },
  {
    name: 'create_finding',
    description:
      'Record one sb:audit / sb:whatif finding as a triageable row. Dedupe is built in: an open finding with the same fingerprint (check_name + cited cells) is updated in place, a dismissed one stays dismissed (the call reports it and writes nothing), a resolved one reopens as a new row. Omit run_id on the first finding of a run and reuse the returned run_id for the rest of that run. Cite cells by id; for a zero-cell finding pass scope instead (e.g. "scenario:Warm-Up").',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', enum: ['audit', 'whatif'], description: 'Which skill produced it' },
        check_name: str('Roster check name, e.g. "gap-sweep"'),
        severity: { type: 'string', enum: ['info', 'warn', 'critical'], description: 'Per the check doc default unless evidence says otherwise' },
        note: str('The finding itself — what is wrong, where, and why it matters. No raw ids in this text.'),
        cell_ids: {
          type: 'array',
          description: 'Cells the finding is about; omit only for zero-cell findings',
          items: { type: 'string' },
        },
        scope: str('Zero-cell fingerprint scope, required when cell_ids is empty. Include a short reason slug so two zero-cell findings from one check cannot collide, e.g. "scenario:Warm-Up:orphan-step-cooldown"'),
        run_id: str('The run identity returned by the first create_finding of this run'),
      },
      required: ['source', 'check_name', 'severity', 'note'],
    },
  },
  {
    name: 'update_finding',
    description:
      'Triage a finding: resolved (fixed / no longer true) or dismissed (accepted as-is; dismissed findings never reopen), or open to reopen. This is the only edit humans or agents make to an existing finding.',
    parameters: {
      type: 'object',
      properties: {
        finding_id: str('Finding id from list_findings'),
        status: { type: 'string', enum: ['open', 'resolved', 'dismissed'], description: 'New status' },
      },
      required: ['finding_id', 'status'],
    },
  },
]

/**
 * Every declared tool belongs to exactly one surface.
 *
 * Init-time, following `read.ts`'s REFERENCES/REFERENCE_NAMES check: the
 * fastest failure for a tool added to `TOOL_SPECS` and classified nowhere.
 * Without it a new tool DEFAULTS TO UNCLASSIFIED, and unclassified reads as
 * "not in the read row and not in the write row" — which is exactly the
 * shape of plus-uno-blueprint#115, where the rulebook's two "FULL surface"
 * rows omitted thirty-three tools the app had.
 *
 * `scripts/check-write-surface.mjs` then holds the two rosters to the
 * adapter's prose; this holds them to the declarations.
 */
{
  const declared = TOOL_SPECS.map((spec) => spec.name)
  const surfaces = { read: READ_TOOL_NAMES, interface: INTERFACE_TOOL_NAMES, write: WRITE_TOOL_NAMES }
  const homes = (name: string) =>
    Object.entries(surfaces).filter(([, set]) => set.has(name)).map(([surface]) => surface)

  const orphans = declared.filter((name) => homes(name).length === 0)
  const shared = declared.filter((name) => homes(name).length > 1)
  const ghosts = Object.entries(surfaces).flatMap(([surface, set]) =>
    [...set].filter((name) => !declared.includes(name)).map((name) => `${surface}:${name}`),
  )

  if (orphans.length || shared.length || ghosts.length)
    throw new Error(
      'TOOL_SPECS and the surface rosters disagree — every tool belongs to exactly one of ' +
        `READ_TOOL_NAMES / INTERFACE_TOOL_NAMES / WRITE_TOOL_NAMES.${
          orphans.length ? ` Classified nowhere: ${orphans.join(', ')}.` : ''
        }${shared.length ? ` In more than one: ${shared.join(', ')}.` : ''}${
          ghosts.length ? ` Rostered but not declared: ${ghosts.join(', ')}.` : ''
        }`,
    )
}
