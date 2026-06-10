import type { ReactNode } from 'react'
import { useZoomPanViewport } from '@/hooks/useZoomPanViewport'
import { EditorSequenceNav } from '@/components/editor/EditorSequenceNav'
import { EditorZoomIndicator } from '@/components/editor/EditorZoomIndicator'
import { cn } from '@/lib/utils'

type ZoomPanViewportProps = {
  children: ReactNode
  className?: string
  resetKey?: string
  panIgnoreSelector?: string
}

export function ZoomPanViewport({
  children,
  className,
  resetKey,
  panIgnoreSelector,
}: ZoomPanViewportProps) {
  const {
    containerRef,
    contentRef,
    pan,
    zoom,
    isPanning,
    pointerHandlers,
  } = useZoomPanViewport({ resetKey, panIgnoreSelector })

  return (
    <div className={cn('relative min-h-0 flex-1', className)}>
      <div
        ref={containerRef}
        className={cn(
          'absolute inset-0 overflow-hidden touch-none bg-[#e8e8e8] dark:bg-[#1a1a1a]',
          isPanning ? 'cursor-grabbing' : 'cursor-grab',
        )}
        {...pointerHandlers}
      >
        <div
          ref={contentRef}
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {children}
        </div>
      </div>

      <EditorSequenceNav />
      <EditorZoomIndicator zoom={zoom} />
    </div>
  )
}
