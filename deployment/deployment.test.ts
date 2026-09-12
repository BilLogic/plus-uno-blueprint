/**
 * This deployment's contract with the template it mounts.
 *
 * Everything asserted here is a value that, if it silently reverted to the
 * package's default, would leave a working application that was no longer THIS
 * deployment — the failure mode that has no error in it and no red anywhere.
 * The storage prefix is the sharpest of them: get it wrong and every reader's
 * saved state resets under a new namespace, with nothing reported.
 *
 * It asserts the RESOLVED config, not the literal. A literal that names
 * `cellBudget` proves someone typed it; the resolved value is what the
 * application reads, and the resolution is where an overlay can be dropped.
 */
import { describe, expect, it } from 'vitest'
import { resolveDeploymentConfig } from 'agentic-service-blueprinting'
import { currentStoragePrefix } from 'agentic-service-blueprinting/bootstrap'
import {
  configureCellBudget,
  getCellContentLengthGuidance,
} from '@/lib/cellContentLimits'
import { unoDeploymentConfig } from '~/deployment'
import { coverContent } from '~/content/coverContent'
import { SAMPLE_NAV } from '~/data/sampleNav'
// Imported for its side effects, which are the subject of the first test.
import '~/bootstrap'

const resolved = resolveDeploymentConfig(unoDeploymentConfig)

describe('this deployment', () => {
  it('namespaces storage under its own prefix, not the package default', () => {
    // `sb-` is what the package ships. Every key in a reader's browser was
    // written under `uno-`, and nothing raises if the bootstrap call is lost —
    // the state just quietly resets. Hence an assertion rather than a comment.
    expect(currentStoragePrefix()).toBe('uno-')
  })

  it('calls itself PLUS, not the template', () => {
    expect(resolved.brand.name).toBe('PLUS')
    expect(resolved.brand.accent).toBe('#85ECD5')
  })

  it('serves its own cover and its own pre-database board', () => {
    expect(resolved.cover).toBe(coverContent)
    expect(resolved.cover.title).toBe('Uno Blueprint')
    expect(resolved.sample.nav).toEqual(SAMPLE_NAV)
    expect(resolved.sample.nav.length).toBeGreaterThan(0)
  })

  it('pins the paths this board draws side by side', () => {
    // Distinct slots is the whole point — two paths sharing one would be the
    // hash collision the pins exist to prevent.
    const slots = Object.values(resolved.pathColorPins)
    expect(slots.length).toBeGreaterThan(0)
    expect(new Set(slots).size).toBe(slots.length)
  })

  it('warns on long copy at its own thresholds without refusing it', () => {
    // Installed the way `DeploymentConfigProvider` installs it before the first
    // paint, so the person under the field and the agent in its tool result
    // read these same numbers.
    configureCellBudget(resolved.cellBudget)
    const fits = getCellContentLengthGuidance('x'.repeat(80))
    expect(fits.target).toBe(80)
    expect(fits.warning).toBe(100)
    expect(fits.message).toBeNull()
    const long = getCellContentLengthGuidance('x'.repeat(101))
    expect(long.overWarning).toBe(true)
    expect(long.message).toContain('the target is 80 and the warning is 100')
    const label = getCellContentLengthGuidance('x'.repeat(33), 'touchpointLabels')
    expect([label.target, label.warning, label.overTarget]).toEqual([32, 48, true])
  })

  it('turns ranked search on, because its database carries the function', () => {
    expect(resolved.agent?.search?.enabled).toBe(true)
    expect(resolved.agent?.search?.indexes).toEqual([
      { provider: 'google', model: 'gemini-embedding-001', dimensions: 768 },
    ])
  })
})
