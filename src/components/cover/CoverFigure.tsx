import { useState } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Expand } from 'lucide-react'
import type { CoverFigure as CoverFigureModel } from '@/components/cover/coverModel'
import { COVER_MEASURE } from '@/components/cover/coverMeasure'
import { cn } from '@/lib/utils'

/**
 * A cover figure.
 *
 * No plate, no border, no padding — deliberately. Every figure is authored
 * with a full-bleed rounded background rect across its whole viewBox
 * (`fill="#fafbfc" rx="14"`), so the artwork already IS its own container.
 * Wrapping it in a second bordered, padded, white box drew a frame around a
 * frame, which is what made the page read as boxes inside boxes.
 *
 * That self-plate is also what makes dark mode work without any treatment
 * here: the figures are authored light — panel fills, text and strokes are
 * literal hex inside the file, and an `<img>` seals page CSS out of them —
 * so they read as printed plates in a dark book, which is a convention,
 * rather than as panels that forgot to theme themselves.
 *
 * Not `dark:invert` — that destroys the lane colours the figures encode.
 * Not an opacity dim either, which drops the smallest labels below AA.
 *
 * Click to expand. These are dense technical diagrams — cell anatomy, the
 * skill architecture — authored at 880px and then shrunk to fit
 * COVER_MEASURE; small labels are legible in the source and not always in
 * the page. The trigger is the whole image, not a small corner button: a
 * diagram this dense benefits from a big hit target. The cursor stays a
 * plain pointer, not a zoom cursor — the corner hint already says "this
 * expands", and having both say it a second way read as two competing
 * signals for one action rather than reinforcement.
 *
 * The opened figure fills the popup fit-to-viewport, and every click closes
 * it — the empty margin, the backdrop, and the diagram itself. There is no
 * separate close button and no further zoom step: the image ignores pointer
 * events, so a click on it reaches the close target beneath.
 */
export function CoverFigure({
  figure,
  eager = false,
  className,
}: {
  figure: CoverFigureModel
  /** First figure on the page decodes eagerly; everything below it is lazy. */
  eager?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        type="button"
        aria-label={`Expand: ${figure.alt}`}
        className={cn(
          'group/cover-figure relative block w-full cursor-pointer',
          COVER_MEASURE,
          className,
        )}
      >
        <img
          src={figure.src}
          alt={figure.alt}
          width={figure.width}
          height={figure.height}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          data-cover-figure
          // One measure with the prose and the tables — see COVER_MEASURE.
          // This was `max-w-3xl` against the prose's `max-w-2xl`, so every
          // figure overhung the column it belonged to and the page
          // zig-zagged.
          className="h-auto w-full object-contain"
        />
        <span
          aria-hidden
          className="absolute right-3 bottom-3 flex size-8 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 backdrop-blur-sm transition-opacity duration-(--motion-fade) ease-out group-hover/cover-figure:opacity-100 group-focus-visible/cover-figure:opacity-100 max-sm:opacity-100"
        >
          <Expand className="size-4" aria-hidden />
        </span>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 cursor-pointer bg-black/70 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          aria-label={figure.alt}
          className="fixed inset-4 z-50 flex items-center justify-center outline-none transition duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 sm:inset-10"
        >
          {/* Fills the popup behind the image. The image is inert to pointer
              events, so every click — margin or diagram — reaches this and
              closes the popup. */}
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute inset-0 cursor-pointer"
            render={<button type="button" tabIndex={-1} />}
          />
          <img
            src={figure.src}
            alt={figure.alt}
            width={figure.width}
            height={figure.height}
            className="pointer-events-none max-h-full max-w-full rounded-xl object-contain shadow-2xl"
          />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
