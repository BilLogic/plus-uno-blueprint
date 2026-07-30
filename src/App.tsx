import { EditorShell } from '@/components/editor/EditorShell'
import { TooltipProvider } from '@/components/ui/tooltip'
import { EditorProvider } from '@/contexts/EditorContext'
import { PathSelectionProvider } from '@/contexts/PathSelectionContext'
import { SupabaseProvider } from '@/contexts/SupabaseProvider'
import { ViewStateProvider } from '@/contexts/ViewStateContext'

function App() {
  return (
    <SupabaseProvider>
      <EditorProvider>
        <ViewStateProvider>
          <PathSelectionProvider>
            <TooltipProvider delay={200}>
              <EditorShell />
            </TooltipProvider>
          </PathSelectionProvider>
        </ViewStateProvider>
      </EditorProvider>
    </SupabaseProvider>
  )
}

export default App
