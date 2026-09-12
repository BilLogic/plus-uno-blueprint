import { describe, expect, it } from 'vitest'
import { BRAND, ORG_NAME } from './config'
import { coverContent } from './content/coverContent'
import {
  asbDefaultConfig,
  resolveDeploymentConfig,
  type DeploymentConfig,
} from './deploymentConfig'
import { unoDeploymentConfig } from './deployment'

// The deployment seam has two contracts here, not one. The template's is that
// a sparse overlay resolves against the defaults and that no config at all
// reads exactly as the defaults do. This deployment adds the second: the
// defaults are ITS OWN, and neither of the two wired fields is a literal.

describe("this deployment's default config", () => {
  it('names itself from the cover content, never from a string here', () => {
    // #396 Q43. A hardcoded name once put one workspace's title on every other
    // service's board; sourcing it from the module a deployment defines itself
    // in is what stops that recurring, and this is the assertion that keeps it
    // sourced.
    expect(asbDefaultConfig.content?.workspaceTitle).toBe(coverContent.title)
    expect(resolveDeploymentConfig().content?.workspaceTitle).toBe(
      coverContent.title,
    )
  })

  it('takes its accent from the brand block the theme files are drawn at', () => {
    // #411, and Q42 one step along: `config.ts` holds the colour, the theme
    // files hold the ramp, and a hex repeated here would be a third place for
    // the three to disagree.
    expect(asbDefaultConfig.brand?.accent).toBe(BRAND.accent)
    expect(resolveDeploymentConfig().brand.accent).toBe(BRAND.accent)
  })
})

describe("this deployment's search index", () => {
  it('names the one model its database was embedded with', () => {
    // The database refuses a question embedded with any other model, so this
    // list is a statement of fact about the index rather than a preference.
    // If the index is ever re-embedded, this is the line that has to move with
    // it — and a search that suddenly refuses everything is what a stale line
    // here looks like from the outside.
    const search = unoDeploymentConfig.agent?.search
    expect(search?.enabled).toBe(true)
    expect(search?.indexes).toEqual([
      { provider: 'google', model: 'gemini-embedding-001', dimensions: 768 },
    ])
  })

  it('survives the resolve, so the agent is offered the tool', () => {
    const resolved = resolveDeploymentConfig(unoDeploymentConfig)
    expect(resolved.agent?.search?.enabled).toBe(true)
    expect(resolved.agent?.search?.indexes).toHaveLength(1)
  })
})

describe('resolveDeploymentConfig', () => {
  it('no config, undefined, null and {} all resolve to the defaults', () => {
    for (const config of [undefined, null, {}]) {
      const resolved = resolveDeploymentConfig(config)
      expect(resolved.brand.name).toBe(ORG_NAME)
      expect(resolved.brand.accent).toBe(BRAND.accent)
      expect(resolved.content).toEqual({ workspaceTitle: coverContent.title })
      expect(resolved.agent).toBeUndefined()
    }
  })

  it('a brand override keeps the fields it does not restate', () => {
    const resolved = resolveDeploymentConfig({ brand: { logo: '/mark.svg' } })
    expect(resolved.brand).toEqual({
      name: ORG_NAME,
      accent: BRAND.accent,
      logo: '/mark.svg',
    })
  })

  it('a named brand wins over the default name', () => {
    expect(resolveDeploymentConfig({ brand: { name: 'Acme' } }).brand.name).toBe(
      'Acme',
    )
  })

  it('an explicit undefined field means "nothing to say", not "erase"', () => {
    const resolved = resolveDeploymentConfig({
      brand: { name: undefined, logo: '/mark.svg' },
    })
    expect(resolved.brand.name).toBe(ORG_NAME)
    expect(resolved.brand.logo).toBe('/mark.svg')
  })

  it('merges a section field by field rather than replacing it', () => {
    const resolved = resolveDeploymentConfig({
      content: { coverTitle: 'Rooftop Retrofit' },
      agent: { enabledTools: ['get_cell'] },
    })
    expect(resolved.content).toEqual({
      workspaceTitle: coverContent.title,
      coverTitle: 'Rooftop Retrofit',
    })
    // A section the defaults lack is carried through, and only when given.
    expect(resolved.agent).toEqual({ enabledTools: ['get_cell'] })
  })

  it('never aliases the host object or the module default', () => {
    const tools = ['get_cell']
    const config: DeploymentConfig = {
      brand: { name: 'Acme' },
      agent: { enabledTools: tools },
    }
    const resolved = resolveDeploymentConfig(config)

    expect(resolved.brand).not.toBe(config.brand)
    expect(resolved.brand).not.toBe(asbDefaultConfig.brand)
    expect(resolved.content).not.toBe(asbDefaultConfig.content)
    expect(resolved.agent).not.toBe(config.agent)
    expect(resolved.agent?.enabledTools).not.toBe(tools)

    tools.push('update_cell')
    resolved.brand.name = 'Mutated'
    expect(resolved.agent?.enabledTools).toEqual(['get_cell'])
    expect(asbDefaultConfig.brand?.name).toBe(ORG_NAME)
    expect(config.brand?.name).toBe('Acme')
  })
})
