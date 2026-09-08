import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The host half of the reference-doc seam, and its TIMING.
 *
 * Nothing in this repository registers a document — the seam belongs to a host
 * that MOUNTS the package, and this repository is still the app rather than a
 * host of it. It is under test anyway because `referenceNames.ts` is byte-held
 * to the template's copy and already splices registered names into the shared
 * vocabulary: the registry is wired here whether or not anyone uses it, and a
 * wiring nobody exercises is a wiring nobody notices breaking.
 *
 * Every case reloads the module graph and imports dynamically, because what is
 * under test is what `referenceDocs.ts` and `referenceNames.ts` record while
 * they evaluate. A static import would settle the registry once for the file.
 */

beforeEach(() => {
  vi.resetModules()
})

describe('the reference registry', () => {
  it('is empty until something registers, and the two halves agree', async () => {
    const { REFERENCE_NAMES } = await import('@/lib/agent/tools/referenceNames')
    const { REFERENCE_DOCS } = await import('@/lib/agent/tools/referenceDocs')
    // `canvas-adapter` is this deployment's override and `blueprint` is its own
    // account of itself, spliced in by `referenceNamesExtra.ts` — both arrive
    // by module edit, which is the seam an app that COPIES the kit uses.
    expect(REFERENCE_NAMES.slice(0, 2)).toEqual(['canvas-adapter', 'blueprint'])
    expect(REFERENCE_NAMES).not.toContain('runbook')
    // The agreement `read.ts` asserts at module init, asserted here too.
    expect(Object.keys(REFERENCE_DOCS).sort()).toEqual(
      [...REFERENCE_NAMES].sort(),
    )
  })

  it("a host's own document is served, and named after this deployment's", async () => {
    const { registerReferenceDocs } = await import(
      '@/lib/agent/tools/referenceRegistry'
    )
    registerReferenceDocs({ runbook: '# On call\n' })

    const { REFERENCE_NAMES } = await import('@/lib/agent/tools/referenceNames')
    const { readReference } = await import('@/lib/agent/tools/read')

    expect(REFERENCE_NAMES.slice(0, 3)).toEqual([
      'canvas-adapter',
      'blueprint',
      'runbook',
    ])
    expect(readReference('runbook')).toBe('# On call\n')
  })

  /**
   * The tool description a model reads is interpolated at module scope in
   * `specs.ts`, which is exactly why registration has to precede the import.
   * An agent told about a document it cannot be told about is the failure this
   * ordering exists to prevent.
   */
  it("the agent's tool description names the registered document", async () => {
    const { registerReferenceDocs } = await import(
      '@/lib/agent/tools/referenceRegistry'
    )
    registerReferenceDocs({ runbook: '# On call\n' })

    const { TOOL_SPECS } = await import('@/lib/agent/tools/specs')
    const getReference = TOOL_SPECS.find((spec) => spec.name === 'get_reference')
    expect(getReference?.description).toContain('runbook')
  })

  it('overriding a document already served replaces it and adds no name', async () => {
    const { registerReferenceDocs } = await import(
      '@/lib/agent/tools/referenceRegistry'
    )
    registerReferenceDocs({ 'canvas-adapter': '# Their own adapter\n' })

    const { REFERENCE_NAMES } = await import('@/lib/agent/tools/referenceNames')
    const { REFERENCE_DOCS } = await import('@/lib/agent/tools/referenceDocs')
    const { readReference } = await import('@/lib/agent/tools/read')

    expect(readReference('canvas-adapter')).toBe('# Their own adapter\n')
    expect(
      REFERENCE_NAMES.filter((name) => name === 'canvas-adapter'),
    ).toHaveLength(1)
    // `read.ts` asserts these agree at module init; say so here too, because
    // the de-duplication in `referenceNames.ts` is the only reason it holds.
    expect(Object.keys(REFERENCE_DOCS).sort()).toEqual(
      [...REFERENCE_NAMES].sort(),
    )
  })

  it('registering after the documents are served throws', async () => {
    const { registerReferenceDocs } = await import(
      '@/lib/agent/tools/referenceRegistry'
    )
    // Whatever imported the app has already built the served record.
    await import('@/lib/agent/tools/referenceDocs')

    expect(() => registerReferenceDocs({ runbook: '# Too late\n' })).toThrow(
      /already being served/,
    )
  })

  it('accumulates across calls made before the first read', async () => {
    const { registerReferenceDocs, registeredReferenceNames } = await import(
      '@/lib/agent/tools/referenceRegistry'
    )
    registerReferenceDocs({ runbook: '# One\n' })
    registerReferenceDocs({ escalations: '# Two\n' })
    expect(registeredReferenceNames()).toEqual(['runbook', 'escalations'])
  })
})
