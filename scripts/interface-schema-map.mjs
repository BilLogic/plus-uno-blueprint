/**
 * The interface→schema map: every panel label, and the name behind it.
 *
 * This is the ENFORCED half — the list CI acts on. The half a person reads is
 * `docs/reference/interface-schema-map.md`, and it is GENERATED from this one
 * by `scripts/generate-interface-schema-map.mjs`, which is the difference
 * between this map and the rename map next door. The rename map's two halves
 * were hand-kept and held together by a parity test; a generated document
 * cannot drift from its source, so the drift check is `--check` rather than an
 * assertion that two lists still agree.
 *
 * The document lived inside `CONTEXT.md` until #365. It was ninety lines of
 * reference in a glossary — read by every session that opened the file to look
 * up one word — and its table restated, row by row, what the catalog already
 * says. Now it is a disclosed reference: one pointer in `AGENTS.md`, whose
 * leading word is the surface a session is touching, and a body that is only
 * read when that pointer fires.
 *
 * WHAT IS GENERATED, AND FROM WHAT. The binding table restates the catalog —
 * a label, the `table.column` it names, and the sentence the catalog carries
 * about that column — so it is rendered rather than typed, from this list and
 * from the schema `scripts/migration-replay.mjs` replays out of
 * `supabase/migrations`. That replay is the catalog as the REPOSITORY
 * describes it, needs no credentials, and is the same static source
 * `check-retired-identifiers` sweeps; the same trade it states applies here.
 * The prose around the table is hand-written, because a decision about why two
 * words differ is not in any catalog.
 *
 * Read by:
 *   - `scripts/generate-interface-schema-map.mjs`         (the document)
 *   - `scripts/tests/labels-name-their-columns.test.mjs`  (#182 — the four rules)
 */

/**
 * Every panel label, the schema name behind it, and why they differ.
 *
 * `label` is matched against what a panel actually says, case-insensitively
 * and whole. `names` is one or more `table.column` names, or a bare table
 * where the label heads a whole relation rather than a field of one. `because`
 * is empty on every row whose label and name already agree, and required on
 * every row where they do not.
 *
 * ONE LABEL, SEVERAL NAMES is the ordinary case rather than an escape hatch:
 * six things on this board have a `summary`, and "Summary" is the right word
 * above all of them. A row is aligned only when it aligns with EVERY name it
 * lists, so a shared word cannot be smuggled past this by pairing a divergence
 * with an agreement.
 *
 * Ordered as a reader meets them: the cell and its placement, the lane, the
 * phase, the scenario's paths, the service, the step.
 */
export const LABEL_COLUMNS = Object.freeze(
  [
    { label: 'Content', names: ['cells.content'], because: '' },
    {
      label: 'Summary',
      names: [
        'cells.summary',
        'cell_touchpoints.summary',
        'paths.summary',
        'phases.summary',
        'scenarios.summary',
        'services.summary',
        'steps.summary',
      ],
      because: '',
    },
    { label: 'Status', names: ['cells.status', 'paths.status'], because: '' },
    { label: 'Owner', names: ['cells.owner'], because: '' },
    { label: 'Perceived owner', names: ['cells.perceived_owner'], because: '' },
    { label: 'Function', names: ['cells.function'], because: '' },
    { label: 'Form', names: ['cells.form'], because: '' },
    {
      label: 'Value proposition',
      names: ['cells.value_props'],
      because:
        '`props` abbreviates this exact phrase and no other. A label is read once and a name is typed daily, so the panel spells out what the schema shortens. Singular on purpose: a cell has one value proposition, stated once per audience — each row is a `for` and a `value` — and the plural on the column counts those statements, not separate propositions.',
    },
    { label: 'Touchpoint', names: ['touchpoints'], because: '' },
    { label: 'Role', names: ['cell_touchpoints.role'], because: '' },
    {
      label: 'Registry',
      names: ['cell_touchpoints.touchpoint_id'],
      because:
        'The column is a foreign key into `touchpoints`, and the field is where a name-only placement is linked to the registry entry it was about (#277). A reader is choosing from the registry; the panel says so rather than naming the key.',
    },
    { label: 'Stakeholder', names: ['lanes.stakeholder_id'], because: '' },
    { label: 'Owner team', names: ['lanes.owner_team'], because: '' },
    { label: 'KPIs', names: ['lanes.kpis'], because: '' },
    { label: 'Tools', names: ['lanes.tools'], because: '' },
    { label: 'Business impact', names: ['phases.business_impact'], because: '' },
    {
      label: 'Operational requirements',
      names: ['phases.operational_requirements'],
      because: '',
    },
    { label: 'Paths', names: ['paths'], because: '' },
    {
      label: 'Author note',
      names: ['paths.note'],
      because:
        "`note` is this vocabulary's word for an author's aside, and the label says whose aside it is because it sits directly under Summary, which is the path's own sentence. That distinction is worth a word on screen and not worth a second column.",
    },
    { label: 'Funding', names: ['business_models.funding'], because: '' },
    { label: 'Pricing', names: ['business_models.pricing'], because: '' },
    { label: 'Delivery cost', names: ['business_models.delivery_cost'], because: '' },
    { label: 'Revenue model', names: ['business_models.revenue_model'], because: '' },
    { label: 'Partners', names: ['business_models.partners'], because: '' },
    {
      label: 'Examples',
      names: ['services.entity_examples'],
      because:
        'The section heads a jsonb map, not a field, and the column carries an `entity_` qualifier the label drops: on the service panel the only examples in question are the board’s six entity kinds, so the qualifier is understood and the heading says the plain word. The six inputs beneath it name the kinds, not columns, so they carry no row of their own; this one row binds the whole map.',
    },
    { label: 'Position', names: ['path_steps.position'], because: '' },
    {
      label: 'Storyboard',
      names: ['lanes.lane_role'],
      because:
        'The one row whose right-hand side is a VALUE rather than the name of a place to put one: `storyboard` is one of the eight `lane_role` admits, and this label heads the frames of the lane carrying it. The word is in the schema; it is simply not a column name.',
    },
  ].map((row) => Object.freeze({ ...row, names: Object.freeze(row.names) })),
)

/* ------------------------------------------------------------- rendering */

/** A cell's text, flattened and with the column separator escaped. */
const cell = (text) => String(text ?? '').replace(/\s+/g, ' ').replaceAll('|', '\\|').trim()

/** How the replayed catalog addresses a name: a column, or a bare relation. */
const address = (name) => (name.includes('.') ? `column:${name}` : `table:${name}`)

/** Every name the map binds, in the order a reader meets them, deduplicated. */
export function boundNames(map = LABEL_COLUMNS) {
  return [...new Set(map.flatMap((row) => [...row.names]))]
}

/**
 * The binding table: one row per label, exactly the three columns the section
 * has always had. `—` for a row that agrees with the schema, because a reason
 * written about a label that never diverged reads as a decision and settles
 * nothing.
 */
export function renderBinding(map = LABEL_COLUMNS) {
  return [
    '| The interface says | The schema says | Why they differ |',
    '|---|---|---|',
    ...map.map(
      (row) =>
        `| **${cell(row.label)}** | ${row.names.map((name) => `\`${name}\``).join(', ')} | ` +
        `${cell(row.because) || '—'} |`,
    ),
  ].join('\n')
}

/**
 * What the catalog says about each bound name — the part of this document that
 * restates the schema rather than deciding anything, which is why it is
 * rendered from `pg_description` as the migration series writes it.
 *
 * A name with no comment says so rather than being left out: a column an agent
 * reads with nothing written about it is the gap `docs/agents/blueprint.md`
 * ratchets down, and hiding it here would make this document look complete.
 */
export function renderCatalog(schema, map = LABEL_COLUMNS) {
  const rows = boundNames(map).map((name) => {
    const entry = schema.comments.get(address(name))
    return `| \`${name}\` | ${entry ? cell(entry.text) : '—'} |`
  })
  const described = rows.filter((row) => !row.endsWith('| — |')).length
  return [
    `${described} of ${rows.length} names carry a comment in the catalog.`,
    '',
    '| The schema says | What the catalog says |',
    '|---|---|',
    ...rows,
  ].join('\n')
}

/** Names this map binds that the replayed catalog does not have. */
export function namesNotInCatalog(schema, map = LABEL_COLUMNS) {
  return boundNames(map).filter((name) => {
    if (!name.includes('.')) return !schema.tables.has(name)
    const [table, column] = name.split('.')
    return !schema.tables.get(table)?.columns?.has(column)
  })
}

/* --------------------------------------------------------------- splice */

const marker = (name) => ({
  open: new RegExp(`<!-- generated:${name}[^>]*-->`),
  close: `<!-- /generated:${name} -->`,
})

/**
 * The document with the named generated section replaced by `body`.
 *
 * Same shape as `scripts/agent-account.mjs`'s splice, deliberately: two
 * generators writing generated sections into a Markdown document should mark
 * them the same way, so a reader who has met one has met both.
 */
export function splice(doc, name, body, path = 'docs/reference/interface-schema-map.md') {
  const { open, close } = marker(name)
  const start = open.exec(doc)
  const end = doc.indexOf(close)
  if (!start || end === -1 || end < start.index) {
    throw new Error(`${path} has no <!-- generated:${name} --> … ${close} section`)
  }
  return `${doc.slice(0, start.index + start[0].length)}\n\n${body.trim()}\n\n${doc.slice(end)}`
}
