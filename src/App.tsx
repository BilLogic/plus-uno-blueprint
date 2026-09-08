import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { EditorErrorBoundary } from '@/components/EditorErrorBoundary'
import { BoardAddressSync } from '@/components/editor/BoardAddressSync'
import { EditorShell } from '@/components/editor/EditorShell'
import { ScenarioPathSelectionReset } from '@/components/editor/ScenarioPathSelectionReset'
import { WriteFailureNotices } from '@/components/editor/WriteFailureNotices'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ActiveServiceProvider } from '@/contexts/ActiveServiceContext'
import { DeploymentConfigProvider } from '@/contexts/DeploymentConfigContext'
import { EditorProvider } from '@/contexts/EditorContext'
import { EntityExamplesProvider } from '@/contexts/EntityExamplesContext'
import { PathSelectionProvider } from '@/contexts/PathSelectionContext'
import { SupabaseProvider } from '@/contexts/SupabaseProvider'
import { TouchpointRegistryProvider } from '@/contexts/TouchpointRegistryProvider'
import { ViewStateProvider } from '@/contexts/ViewStateContext'
import type { DeploymentConfig } from '@/deploymentConfig'
import { queryClient } from '@/lib/queryClient'

/**
 * The app root.
 *
 * ── THE ORDER OF THE TREE, AND WHY IT IS THIS ONE ─────────────────────────
 *
 * This order is agentic-service-blueprinting's, adopted here so the two trees
 * are one tree. Its `src/App.tsx` carries the full reasoning and is where a
 * change to the order belongs; the short form is that almost nothing here
 * constrains anything else — every provider reads React context from outside
 * this file or from nothing at all — so the tree has three forced edges and a
 * dozen arbitrary ones, and both installations had drifted.
 *
 * The forced edges: the query cache and the database client above the three
 * providers that read; the path selection and the editor above the reset that
 * watches them; and the error boundary NOT above the write failure notice.
 *
 * Everything else is settled by band, outermost to innermost — infrastructure,
 * shared reads, interaction state, presentation — under one rule: a band may
 * read the bands outside it and never the ones inside.
 *
 * The band that used to be missing here is the outermost one: the deployment
 * seam. It goes outermost because every band below it may be skinned by the
 * config and none of it may be skinned half way down. The `config` prop is how
 * a HOST skins a tree it mounts, which is where ADR 0013 ends up; this app is
 * still the tree rather than a host of it, so nothing passes one, and the
 * values the provider resolves are the ones `deploymentConfig.ts` declares as
 * this deployment's own. The prop is here anyway, because it is the signature
 * the flip needs and an absent one is a second difference to close later.
 */
function App({ config }: { config?: DeploymentConfig | null }) {
  return (
    <DeploymentConfigProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {/*
         * `attribute="class"` matches the token setup: themes/light.css targets
         * `:root, .light`, themes/dark.css targets `.dark`, and the `dark:`
         * variant is `&:where(.dark, .dark *)`. `enableColorScheme` (on by
         * default) also sets `color-scheme` on the root, which is what makes
         * scrollbars and native form controls follow the theme.
         */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <SupabaseProvider>
            {/*
             * Resolves the URL slug to the active service and canonicalises
             * the slug into the address bar. Above everything that reads a
             * service, so no reader below it can see a stale one.
             */}
            <ActiveServiceProvider>
              {/*
               * Above the editor so both the menubar identity headers and the
               * canvas read one cached service query; the definition popovers
               * on the board pick their per-kind example out of it by kind.
               */}
              <EntityExamplesProvider>
                {/*
                 * One unscoped read of `touchpoints.tone` and `.aliases` for
                 * the whole session, published to the module store every
                 * touchpoint face resolves its colour through (#326 S6).
                 */}
                <TouchpointRegistryProvider>
                  <EditorProvider>
                    <ViewStateProvider>
                      <PathSelectionProvider>
                        {/*
                         * A comparison is a statement about the scenario it
                         * was built in, so moving to another one collapses it.
                         * Inside the provider it drives, under the editor
                         * whose navigation it watches.
                         */}
                        <ScenarioPathSelectionReset />
                        {/*
                         * The board reaches the address bar here, beside the
                         * reset, and for the same reason: it joins navigation,
                         * the path selection and the tab state, and none of
                         * those three providers may learn about the other two.
                         */}
                        <BoardAddressSync />
                        <TooltipProvider delay={200}>
                          <EditorErrorBoundary>
                            <EditorShell />
                          </EditorErrorBoundary>
                          {/*
                           * Outside the boundary, on purpose: a write can fail
                           * as the shell falls over, and the notice is what
                           * says so. Inside it, the one message explaining the
                           * blank screen would be caught by the blank screen.
                           */}
                          <WriteFailureNotices />
                        </TooltipProvider>
                      </PathSelectionProvider>
                    </ViewStateProvider>
                  </EditorProvider>
                </TouchpointRegistryProvider>
              </EntityExamplesProvider>
            </ActiveServiceProvider>
          </SupabaseProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </DeploymentConfigProvider>
  )
}

export default App
