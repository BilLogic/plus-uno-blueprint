import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
  A BADGE DESCRIBES THE THING IT SITS ON, and never reacts to the pointer.

  One per thing, not drawn from a set, never interactive — that is what
  separates it from a TAG, which is one value out of a set and is selectable
  or removable. The owner control is the only tag in this app.

  So there is no hover state here, and that is the load-bearing part rather
  than an omission. Every variant used to carry an `[a]:hover:` rule for the
  case where a badge was rendered as a link, and two more variants existed
  (`ghost`, `link`) whose whole content was a hover state. Nothing used them,
  and what they taught was worse than the duplication: a surface that
  repaints under the pointer reads as clickable, so a badge that did it was
  promising a click that never came.

  What a badge keeps instead is the FOCUS RING below, a `cursor-help` at the
  call sites that carry a definition, and the tooltip itself. A control that
  needs a hover state is a button; use one.
*/
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40",
        /*
          Supabase's own badge formula for this role, verbatim from their
          `shadcn/ui/badge.tsx`: `bg-warning/10 text-warning-600 border
          border-warning-500`. Added because two call sites were hand-rolling a
          tinted amber badge straight off the PRIMITIVE amber ramp — a tier-1
          leak that also had to restate its own dark mode.

          The ink is step 600, not `text-warning`. That is the whole trick: the
          mid role colour (oklch L 0.68) on its own 10% wash measures ~2.3:1,
          while step 600 measures ~3.4:1 — still under AA for body copy, and
          what Supabase ships. It replaces a fill that measured ~1.9:1.
        */
        warning:
          "border border-warning-500 bg-warning/10 text-warning-600 focus-visible:ring-warning-500/40",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
