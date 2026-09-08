import type { ReactNode } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { useImageZoom } from '@/hooks/useImageZoom'
import type { ImageZoomCursor } from '@/lib/imageZoomReducer'
import { cn } from '@/lib/utils'

/**
 * The cursor, spelled out one class at a time.
 *
 * `cursor-${cursor}` would read better and generate nothing: Tailwind scans
 * source text for whole class names, so a class assembled at runtime is a
 * class that exists in no stylesheet. The map is what puts all four literals
 * in front of the scanner.
 */
const CURSOR_CLASS: Record<ImageZoomCursor, string> = {
  'zoom-in': 'cursor-zoom-in',
  'zoom-out': 'cursor-zoom-out',
  grab: 'cursor-grab',
  grabbing: 'cursor-grabbing',
}

/**
 * An image that opens, and once open behaves like an image viewer.
 *
 * The trigger, the popup and every gesture live here, so an adopter renders
 * this in place of a bare image and gets the whole interaction rather than
 * six near-identical re-implementations of it. The arithmetic is one layer
 * further down again, in `imageZoomReducer`, which this component reaches
 * only through `useImageZoom`.
 *
 * Three exits, all available at every scale: a click on the surrounding
 * margin, Escape, and the corner button. The image itself is the one thing
 * that does NOT close, because the image is what the reader is operating —
 * a click on it zooms. That is the reversal this component embodies: the
 * opened figure used to be inert, and every click on it closed the popup.
 *
 * The corner button matters most exactly where the margin stops being
 * reachable, which is why it sits outside the clipping box and above the
 * image rather than inside the frame with it.
 *
 * No sibling stepping. The first adopter is a cover figure, which has none;
 * arrow keys, on-screen prev/next and the counter arrive with the adopters
 * that come in rows.
 */
export function ZoomableImage({
  src,
  alt,
  naturalWidth,
  naturalHeight,
  triggerLabel,
  triggerClassName,
  children,
}: {
  src: string
  alt: string
  /**
   * The image's authored size, where the adopter knows it. Worth passing:
   * an SVG with a `viewBox` and no root `width`/`height` has no intrinsic
   * size, and the browser's answer is its own default box rather than the
   * diagram's. See `useImageZoom`.
   */
  naturalWidth?: number
  naturalHeight?: number
  /** The trigger is a button and therefore needs a name of its own. */
  triggerLabel: string
  triggerClassName?: string
  /** The closed-state rendering — the thumbnail and any hint over it. */
  children: ReactNode
}) {
  const {
    popupRef,
    viewportRef,
    imageRef,
    measure,
    cursor,
    animated,
    imageStyle,
    imageHandlers,
  } = useImageZoom({ naturalWidth, naturalHeight })

  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger
        type="button"
        aria-label={triggerLabel}
        className={triggerClassName}
      >
        {children}
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70 transition-opacity duration-(--motion-fade) data-ending-style:opacity-0 data-starting-style:opacity-0" />
        {/*
          Full-bleed rather than inset, so the wheel reaches every pixel a
          reader might have their pointer over. The visual margin is the
          viewport box below, which is inset instead.
        */}
        <DialogPrimitive.Popup
          ref={popupRef}
          aria-label={alt}
          className="fixed inset-0 z-50 outline-none transition-opacity duration-(--motion-fade) data-ending-style:opacity-0 data-starting-style:opacity-0"
        >
          {/*
            Fills the popup behind everything else, and closes on a click.
            The image sits above it and takes its own clicks now, so this
            catches the margin and nothing more. Presentational: it is a
            second, unfocusable spelling of the corner button beside it, and
            announcing "Close" twice helps nobody.
          */}
          <DialogPrimitive.Close
            aria-hidden
            data-image-zoom-margin
            className="absolute inset-0 cursor-pointer"
            render={<button type="button" tabIndex={-1} />}
          />
          {/*
            The box the image is fitted to and clipped by. Inert to the
            pointer so that a click on the letterbox beside a wide image
            still reaches the close catcher beneath.
          */}
          <div
            ref={viewportRef}
            data-image-zoom-viewport
            className="pointer-events-none absolute inset-4 overflow-hidden sm:inset-10"
          >
            <img
              ref={imageRef}
              src={src}
              alt={alt}
              onLoad={measure}
              draggable={false}
              style={imageStyle}
              {...imageHandlers}
              className={cn(
                'pointer-events-auto absolute top-1/2 left-1/2 max-w-none rounded-xl shadow-2xl select-none',
                // `origin-top-left` is load-bearing, not styling. The
                // transform in `imageStyle` does its own centring, and the
                // default `50% 50%` origin would centre it a second time —
                // at the unscaled half-size, so the image lands off-centre by
                // a distance that grows with the scale.
                'origin-top-left',
                // `touch-none` is what makes a one-finger drag pan instead of
                // scrolling, and what leaves a pinch to the gesture handler.
                'touch-none',
                CURSOR_CLASS[cursor],
                animated &&
                  'transition-transform duration-(--motion-micro) ease-out',
              )}
            />
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute top-4 right-4 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full bg-foreground/70 text-background backdrop-blur-sm transition-colors duration-(--motion-micro) hover:bg-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            render={<button type="button" />}
          >
            <X className="size-5" aria-hidden />
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
