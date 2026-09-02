/**
 * The ERD parser behind `check:contract:live`'s `erd value sets` check. The
 * check needs the catalog; what the parser reads out of a Mermaid file is
 * decided here, on the shapes docs/reference/erd.mmd actually uses.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { erdFindings, erdValueSets } from '../erd-value-sets.mjs'
import { catalogValueSets } from '../value-set-claims.mjs'

test('the enum block, a wrapped set, a bare column with a table list, and attribute lines', () => {
  const mmd = [
    '%% Enums (CHECK constraints, live 2026-08-26):',
    '%%   scenarios.layout         ∈ (stacked | merged)  what the board opens as;',
    '%%                                                  written by the header toggle',
    '%%   evidence.kind            ∈ (interview | survey | analytics | doc | meeting |',
    '%%                               decision | observation | other)',
    '%%   origin (cells | lanes | paths) ∈ (import | app)',
    '%%',
    '%% cells.status and paths.status are the `entity_status` DOMAIN, not a CHECK.',
    'erDiagram',
    '  scenarios {',
    '    uuid id PK',
    '    text layout "stacked | merged"',
    '    text name "what it is called"',
    '  }',
  ].join('\n')
  assert.deepEqual(erdValueSets(mmd, 'erd.mmd'), [
    { site: 'erd.mmd:2', column: 'scenarios.layout', values: ['stacked', 'merged'] },
    { site: 'erd.mmd:4', column: 'evidence.kind', values: ['interview', 'survey', 'analytics', 'doc', 'meeting', 'decision', 'observation', 'other'] },
    { site: 'erd.mmd:6', column: 'origin', values: ['import', 'app'] },
    { site: 'erd.mmd:12', column: 'scenarios.layout', values: ['stacked', 'merged'] },
  ])
})

test('a claim is held to the set by equality, and a column nobody constrains is a finding', () => {
  const catalog = catalogValueSets([
    { source: 'check', relation: 'scenarios', column_name: 'layout', name: 'scenarios_layout_check', definition: "CHECK ((layout = ANY (ARRAY['stacked'::text, 'merged'::text])))" },
    { source: 'check', relation: 'cells', column_name: 'origin', name: 'cells_origin_check', definition: "CHECK ((origin = ANY (ARRAY['import'::text, 'app'::text])))" },
  ])
  const claims = [
    { site: 'erd.mmd:1', column: 'scenarios.layout', values: ['stacked', 'merged'] },
    { site: 'erd.mmd:2', column: 'scenarios.layout', values: ['single', 'stacked'] },
    { site: 'erd.mmd:3', column: 'origin', values: ['import', 'app'] },
    { site: 'erd.mmd:4', column: 'slices.origin', values: ['generated', 'customized', 'human'] },
  ]
  const findings = erdFindings(claims, catalog)
  assert.equal(findings.length, 2)
  assert.match(findings[0], /erd\.mmd:2 says `scenarios\.layout` is \{single, stacked\}; scenarios\.layout accepts \{stacked, merged\}/)
  assert.match(findings[1], /erd\.mmd:4 states values for `slices\.origin`, which no CHECK or domain constrains/)
})

test('the committed ERD parses to the sets it states', () => {
  const claims = erdValueSets(readFileSync(new URL('../../docs/reference/erd.mmd', import.meta.url), 'utf8'))
  assert.ok(claims.some((c) => c.column === 'paths.kind'), 'the enum block is read')
  // Once in the enum block, once on the entity's attribute line.
  assert.equal(claims.filter((c) => c.column === 'scenarios.layout').length, 2, 'attribute lines are read')
})
