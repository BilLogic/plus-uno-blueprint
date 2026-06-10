type EditorZoomIndicatorProps = {
  zoom: number
}

export function EditorZoomIndicator({ zoom }: EditorZoomIndicatorProps) {
  return (
    <div
      data-zoom-indicator=""
      className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-border bg-background/95 px-2.5 py-1 shadow-sm backdrop-blur-sm"
    >
      <span className="min-w-[2.75rem] text-center font-mono text-xs text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
    </div>
  )
}
