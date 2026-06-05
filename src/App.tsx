import { EditorShell } from '@/components/editor/EditorShell'
import { EditorProvider } from '@/contexts/EditorContext'
import { SupabaseProvider } from '@/contexts/SupabaseProvider'

function App() {
  return (
    <SupabaseProvider>
      <EditorProvider>
        <EditorShell />
      </EditorProvider>
    </SupabaseProvider>
  )
}

export default App
