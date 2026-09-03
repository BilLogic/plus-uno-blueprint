import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { EditorErrorBoundary } from '@/components/EditorErrorBoundary'
import { EditorShell } from '@/components/editor/EditorShell'
import { ScenarioPathSelectionReset } from '@/components/editor/ScenarioPathSelectionReset'
import { WriteFailureNotices } from '@/components/editor/WriteFailureNotices'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ActiveServiceProvider } from '@/contexts/ActiveServiceContext'
import { EditorProvider } from '@/contexts/EditorContext'
import { EntityExamplesProvider } from '@/contexts/EntityExamplesContext'
import { PathSelectionProvider } from '@/contexts/PathSelectionContext'
import { SupabaseProvider } from '@/contexts/SupabaseProvider'
import { ViewStateProvider } from '@/contexts/ViewStateContext'
import { queryClient } from '@/lib/queryClient'

function App() {
  return (
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
          {/* Resolves the URL slug to the active service and canonicalizes the
              slug into the address bar (#335). Above the shell so every read
              under it sees the active service. */}
          <ActiveServiceProvider>
            <EditorProvider>
              <ViewStateProvider>
                <PathSelectionProvider>
                  <ScenarioPathSelectionReset />
                  <TooltipProvider delay={200}>
                    {/* One read of the service's six examples, shared by every
                        definition popover under it (#302). */}
                    <EntityExamplesProvider>
                      <EditorErrorBoundary>
                        <EditorShell />
                      </EditorErrorBoundary>
                    </EntityExamplesProvider>
                    {/* Outside the boundary: a write can fail as the shell
                        falls over, and the notice is what says so. */}
                    <WriteFailureNotices />
                  </TooltipProvider>
                </PathSelectionProvider>
              </ViewStateProvider>
            </EditorProvider>
          </ActiveServiceProvider>
        </SupabaseProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
