/**
 * The deployment seam — everything this installation is, in one typed object.
 *
 * ADR 0013's end state is that this repository stops being a COPY of
 * agentic-service-blueprinting and becomes a HOST of it: uno's entry renders
 * `<App config={deploymentConfig} />`, and everything deployment-specific
 * arrives through this type instead of through template code edited in place.
 * The type and the resolver below are the template's, unchanged, so that the
 * object this repository already fills in is the object it will hand over at
 * the flip. Every field is optional — a config is a sparse overlay, and an
 * absent section falls back to the defaults below.
 *
 * WHAT FORKS HERE IS THE DEFAULT, and that fork is the point.
 * `asbDefaultConfig` carries the template's own values upstream — brand name
 * `ORG_NAME`, nothing else — and carries THIS deployment's values here. It is
 * the same shape of declared fork as `lib/storageNamespace.ts`'s `'uno-'`
 * against the template's `'sb-'`: one named constant, one forked value, the
 * modules around it identical. Keeping the NAME matters as much as forking
 * the value — rename it and `resolveDeploymentConfig` forks too, over nothing.
 *
 * It has to be the default rather than an argument, because a config is
 * resolved from the default whenever no overlay is supplied, and in a
 * repository that IS the app rather than a host of it, no overlay ever is. A
 * surface mounted on its own — a test, a single component under a bare
 * provider — then resolves this deployment's chrome rather than the kit's,
 * which is the whole of what the wordmark seam is for.
 *
 * Secrets are NOT config. The Supabase URL and anon key stay in the
 * environment (`VITE_SUPABASE_*`), read by `src/config.ts` and the Supabase
 * provider — never threaded through this object. A `DeploymentConfig` is
 * branding, copy, and (reserved) agent surface: values safe to hold in source
 * and to render. The deployment supplies environment for the secrets and
 * config for the skin; the two never mix.
 *
 * ── WHAT THIS TYPE DOES NOT COVER ─────────────────────────────────────────
 *
 * Stated here because the header above reads like a complete boundary and is
 * not one, and a seam that overstates its reach is the defect it exists to
 * prevent.
 *
 * WIRED TODAY: `content.workspaceTitle`, read by the collapsed navbar's
 * wordmark through `useWorkspaceTitle` (#396 Q43), and `brand.accent`, written
 * onto the root's `--hue` by `DeploymentConfigProvider` and again at bootstrap
 * by `main.tsx` (#411 — the same value from the same constant, and the write
 * is idempotent). `brand.logo`, `content.coverTitle` and the whole `agent`
 * block are declared shape with no reader: the cover heading and the workspace
 * breadcrumb still take `coverContent.title` and `ORG_NAME` directly. They
 * migrate onto this type in later slices; until then setting them changes
 * nothing.
 *
 * NOT FIELDS HERE, AND DELIBERATELY: the localStorage namespace, and the
 * agent's extra reference documents. A config is read when `App` RENDERS, and
 * the namespace is settled long before that — six modules build their storage
 * key while the import graph evaluates, and two of them read localStorage
 * there to seed a store snapshot. A field whose value arrives one lifecycle
 * too late would be honoured by nothing and would fail silently, with two
 * installations on one origin sharing a namespace. `lib/storageNamespace.ts`
 * carries that reasoning and the constant this repository forks.
 *
 * The reference documents fail the same test for the same reason. The record
 * the agent serves, the vocabulary that names it, and the `get_reference` tool
 * description that quotes that vocabulary to the model are all built while
 * `referenceDocs.ts`, `referenceNames.ts` and `specs.ts` evaluate. A document
 * handed over at render time would be served by a tool that never mentions it.
 * So documents arrive by module edit (`referenceNamesExtra.ts`, which is how
 * this repository serves `blueprint`) or by a pre-import call to
 * `registerReferenceDocs` — `lib/agent/tools/referenceRegistry.ts` carries the
 * ordering rule.
 *
 * Timing is the whole of the argument in both cases: it is not that these
 * values are unimportant, it is that a render-time seam cannot carry an
 * import-time value.
 *
 * NOT A GAP, THOUGH IT LOOKED LIKE ONE: the provider tree. `App` renders a
 * fixed one, and a config object cannot express a provider tree, so the
 * obvious reading is that a deployment with providers of its own needs a
 * composition seam here. It was checked rather than assumed, and the four
 * providers that prompted the question named no deployment and no table this
 * schema lacks — every one was a generic behaviour the template was simply
 * missing, and each has landed there. `App.tsx` carries the order the two
 * trees settled on and the reasoning behind each position.
 */
import { BRAND, ORG_NAME } from './config'
import { coverContent } from './content/coverContent'

/**
 * The overlay an external deployment supplies. Sparse by construction: every
 * section and every field is optional, and what is left out is inherited from
 * `asbDefaultConfig`.
 */
export type DeploymentConfig = {
  /** Product identity shown in app chrome. `name` is the wordmark seam. */
  brand?: {
    name?: string
    /** Public path or data URI for a logomark. Unused by the mount spike. */
    logo?: string
    /** Accent color token. Unused by the mount spike. */
    accent?: string
  }
  /** User-facing copy a deployment overrides without touching a renderer. */
  content?: {
    workspaceTitle?: string
    coverTitle?: string
  }
  /**
   * RESERVED. The in-app agent is a configurable surface — its doctrine (a
   * system-prompt overlay) and the tools it may call are set by the
   * deployment, not hardcoded, the same way brand and content are. The fields
   * are declared here so the shape is stable, but nothing reads them yet:
   * later slices wire `doctrine` into the agent's prompt assembly and
   * `enabledTools` into its tool registry. Present and unused, on purpose.
   */
  agent?: {
    doctrine?: string
    enabledTools?: string[]
  }
}

/**
 * The resolved shape every consumer reads: the deployment's overlay merged
 * over the template defaults. `brand.name` is guaranteed a string because the
 * default supplies it; everything else stays optional.
 */
export type ResolvedDeploymentConfig = {
  brand: {
    name: string
    logo?: string
    accent?: string
  }
  content?: {
    workspaceTitle?: string
    coverTitle?: string
  }
  agent?: {
    doctrine?: string
    enabledTools?: string[]
  }
}

/**
 * THIS deployment's config, and the value every resolution starts from. The
 * template's copy of this constant holds `{ brand: { name: ORG_NAME } }` and
 * nothing more; the fork is the whole of what makes this installation itself.
 *
 * Neither field is a literal, and neither may become one. The workspace title
 * is `coverContent.title` — the one module a deployment defines itself in
 * (#305) — because a hardcoded name here once put one workspace's title on
 * every other service's board, and the fallback chain in `useWorkspaceTitle`
 * is what stops that recurring (#396 Q43). The accent is `BRAND.accent` for
 * the same reason one step along: `config.ts` is where a deployer writes the
 * colour, `styles/themes/*.css` is where the ramp drawn at that hue is
 * authored, and Q42 left those theme files each deployment's own — so a hex
 * repeated here would be a third place for the three to disagree.
 */
export const asbDefaultConfig: DeploymentConfig = {
  brand: { name: ORG_NAME, accent: BRAND.accent },
  content: { workspaceTitle: coverContent.title },
}

/**
 * A section with its `undefined` fields dropped, as a fresh object. Two
 * reasons: an overlay that says `{ workspaceTitle: undefined }` means "I have
 * nothing to say", not "erase the default"; and the resolved config must never
 * alias the host's object or the module default — a later mutation of either
 * would reach into every reader. Arrays are copied for the same reason.
 */
function present<T extends object>(section: T | undefined): Partial<T> {
  const out: Partial<T> = {}
  if (!section) return out
  for (const key of Object.keys(section) as (keyof T)[]) {
    const value = section[key]
    if (value === undefined) continue
    out[key] = (Array.isArray(value) ? [...value] : value) as T[keyof T]
  }
  return out
}

/** Merge one flat section, field by field; `over` wins. Arrays are replaced. */
function mergeSection<T extends object>(
  base: T | undefined,
  over: T | undefined,
): T | undefined {
  if (base === undefined && over === undefined) return undefined
  return { ...present(base), ...present(over) } as T
}

/**
 * Resolve a deployment's overlay against the template defaults. A deep merge
 * one level into each section, so a deployment can set `brand.logo` without
 * having to restate `brand.name`. An absent or `null` config resolves to the
 * defaults unchanged. The result is a fresh object every call.
 */
export function resolveDeploymentConfig(
  config?: DeploymentConfig | null,
): ResolvedDeploymentConfig {
  const brand = {
    ...present(asbDefaultConfig.brand),
    ...present(config?.brand),
    // The one guaranteed field: default name unless the deployment names one.
    name: config?.brand?.name ?? asbDefaultConfig.brand?.name ?? ORG_NAME,
  }
  const content = mergeSection(asbDefaultConfig.content, config?.content)
  const agent = mergeSection(asbDefaultConfig.agent, config?.agent)

  return {
    brand,
    ...(content ? { content } : {}),
    ...(agent ? { agent } : {}),
  }
}
