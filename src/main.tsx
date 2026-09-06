import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tailwind.config.css'
import App from './App.tsx'
import { applyBrandAccent } from './lib/brandAccent.ts'

/**
 * The deployment's `brand.accent`, onto the root before anything renders.
 *
 * The stylesheets above have already declared the theme files' own `--hue`;
 * this overrides it with the configured accent's hue, which an inline custom
 * property on `documentElement` is entitled to do against any selector. It
 * runs here rather than inside a component because every token derived through
 * the dial is computed at parse time for the first paint, and because a config
 * field read from a render path is a field that stops being read the moment
 * that path moves (#411).
 */
applyBrandAccent(document.documentElement)

const root = createRoot(document.getElementById('root')!)

/**
 * Dev-only experimental routes. `import.meta.env.DEV` is statically `false` in
 * a production build, so Vite drops this whole branch (and tree-shakes the
 * dynamic import) — the proto pages never reach real users. The app routes by
 * service slug (`serviceRoute.ts`), so proto pages live under a reserved
 * `/proto/` prefix that no service slug can claim.
 */
if (
  import.meta.env.DEV &&
  window.location.pathname.replace(/\/$/, '') === '/proto/arrows'
) {
  void import('./dev/ArrowSituationCatalogPage').then(
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
      <App />
    </StrictMode>,
  )
}
