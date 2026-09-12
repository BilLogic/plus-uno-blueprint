/**
 * This deployment's entry point.
 *
 * THE ORDER OF THE FOUR IMPORTS BELOW IS THE FILE'S CONTENT. ES modules
 * evaluate depth-first in source order, and three of the four do work while
 * they evaluate rather than when something calls them:
 *
 *   1. `./bootstrap` settles the storage prefix and registers this
 *      deployment's reference documents. It MUST precede the application,
 *      because six of the application's modules build their localStorage key
 *      while the import graph evaluates and two of them read storage there.
 *      Nothing raises if this line moves below the next one — the keys simply
 *      come out under the package's `sb-` prefix, every reader's saved state
 *      silently resets, and the old keys sit unread in browsers this
 *      deployment does not control.
 *   2. the package's stylesheet, which carries the application's utilities and
 *      the template's theme dials.
 *   3. this deployment's brand dials, AFTER it: they meet the template's at
 *      equal specificity, so source order is what decides which paints.
 *   4. the application itself.
 *
 * `applyBrandAccent` is called below as well as by `DeploymentConfigProvider`,
 * which does it in a layout effect. The write is idempotent and the duplication
 * is deliberate: the provider's call is what makes the field a config field
 * that is actually read, and this one is what settles the dial before React
 * exists at all.
 */
import './bootstrap'
import 'agentic-service-blueprinting/styles.css'
import './styles/brand.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from 'agentic-service-blueprinting'
import { applyBrandAccent } from '@/lib/brandAccent'
import { unoDeploymentConfig } from './deployment'

/**
 * The deployment's `brand.accent`, onto the root before anything renders.
 *
 * `styles/brand.css` has already declared this deployment's `--hue` at parse
 * time, so this repaints nothing today and is not what makes the first frame
 * correct. It is here because a config field read from a render path is a field
 * that stops being read the moment that path moves (#411), and because the two
 * agreeing is a thing worth having assert itself on every load rather than a
 * coincidence nobody checks.
 */
applyBrandAccent(document.documentElement, unoDeploymentConfig.brand)

const root = createRoot(document.getElementById('root')!)

/**
 * Dev-only experimental routes. `import.meta.env.DEV` is statically `false` in
 * a production build, so Vite drops this whole branch (and tree-shakes the
 * dynamic import) — the proto pages never reach real users. The app routes by
 * service slug (`serviceRoute.ts`), so proto pages live under a reserved
 * `/proto/` prefix that no service slug can claim.
 *
 * The page itself is the application's, reached through `@/…` like any other
 * module of it; the ROUTE is this deployment's, which is why it is declared
 * here and not upstream. The package's own entry carries no such branch.
 */
if (
  import.meta.env.DEV &&
  window.location.pathname.replace(/\/$/, '') === '/proto/arrows'
) {
  void import('@/dev/ArrowSituationCatalogPage').then(
    ({ ArrowSituationCatalogPage }) => {
      root.render(
        <StrictMode>
          <ArrowSituationCatalogPage />
        </StrictMode>,
      )
    },
  )
} else {
  root.render(
    <StrictMode>
      <App config={unoDeploymentConfig} />
    </StrictMode>,
  )
}
