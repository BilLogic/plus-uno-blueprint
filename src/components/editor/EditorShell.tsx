import { LayoutGrid, Presentation } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import { CanvasModeView } from '@/components/editor/CanvasModeView'
import { SlideModeView } from '@/components/editor/SlideModeView'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { EditorMode } from '@/types/slides'

export function EditorShell() {
  const { mode, setMode } = useEditor()

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-border px-4">
        <ToggleGroup
          value={[mode]}
          onValueChange={(values) => {
            const next = values[0] as EditorMode | undefined
            if (next) setMode(next)
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem
            value="stack"
            aria-label="Stack"
            className="gap-1.5 px-3"
          >
            <Presentation className="size-4" />
            <span className="hidden sm:inline">Stack</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="canvas"
            aria-label="Canvas"
            className="gap-1.5 px-3"
          >
            <LayoutGrid className="size-4" />
            <span className="hidden sm:inline">Canvas</span>
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">PLUS</span>
          <span className="text-sm text-muted-foreground">Service Hub</span>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        {mode === 'stack' ? <SlideModeView /> : <CanvasModeView />}
      </div>
    </div>
  )
}
