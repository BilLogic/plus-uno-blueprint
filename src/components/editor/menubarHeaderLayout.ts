/** Shared layout classes for blueprint canvas menubar headers. */
export const BLUEPRINT_MENUBAR_HEADER_CLASS =
  'relative h-9 w-full max-w-full shrink-0 items-center gap-3 rounded-none border-0 bg-transparent px-3 py-0 shadow-none'

/** Docked navbar bar — same surface/elevation as the side nav. */
export const BLUEPRINT_NAVBAR_BAR_CLASS =
  'relative shrink-0 border-b border-border bg-sidebar px-4'

/**
 * Cell-detail drawer top offset: clear the docked h-9 navbar + border, then
 * match the panel's right inset (`1rem`). Used instead of a hard-coded `67px`
 * from the old floating header.
 */
export const CELL_DETAIL_PANEL_TOP_CLASS = '!top-[calc(2.25rem+1px+1rem)]'

/** Flattens the menubar when it sits inside the docked navbar bar. */
export const BLUEPRINT_MENUBAR_FLAT_CLASS =
  'relative h-9 rounded-none border-0 bg-transparent px-0 py-0 shadow-none'

export const BLUEPRINT_MENUBAR_TITLE_CLASS =
  'absolute left-1/2 top-1/2 z-10 flex max-w-[min(52rem,calc(100%-18rem))] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 px-1 text-center'

export const BLUEPRINT_MENUBAR_DESCRIPTION_CLASS =
  'min-w-0 truncate text-xs text-muted-foreground'

export const BLUEPRINT_MENUBAR_TITLE_TEXT_CLASS =
  'shrink-0 text-sm font-semibold tracking-tight text-foreground'

export const BLUEPRINT_MENUBAR_SEPARATOR_CLASS =
  'shrink-0 text-xs text-muted-foreground/70'
