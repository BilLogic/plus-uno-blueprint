import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tailwind.config.css'
import App from './App.tsx'

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
