import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { AgentPanel } from '@/components/editor/AgentPanel'

/**
 * The agent, as a BOTTOM sheet — a little over half the screen, so the
 * canvas stays visible behind it (92svh read as a full-screen takeover).
 * AgentPanel state lives in the module store (panelState), so open/close
 * never drops a session.
 *
 * Extracted from MobileShell as a Phase-2 seam (plan 2026-08-16-002); the
 * Phase-4 redesign replaces this sheet with the FAB + workspace, and wants
 * a component swap. The shell mounts this only when the session can run the
 * agent, so the sheet itself assumes nothing about tiers.
 */
export function MobileAgentSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        // min-h + max-h pin the size in BOTH directions: the sheet variant's
        // own data-[side=bottom] h-auto survives tailwind-merge (different
        // variant prefix), so a bare h-[60svh] loses to it — content-hungry
        // panels grew past it, and a fresh empty chat SHRANK below it. The
        // sheet is a fixed room the conversation lives in, not a balloon.
        className="flex min-h-[60svh] max-h-[60svh] flex-col gap-0 rounded-t-2xl p-0"
      >
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-sm">Agent</SheetTitle>
        </SheetHeader>
        {/* Must be a flex COLUMN, not a block: AgentPanel's own root is
            `min-h-0 flex-1 flex-col`, which only stretches inside a flex
            parent — in a block div the panel takes natural height and the
            composer floats mid-sheet instead of anchoring at the bottom. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <AgentPanel />
        </div>
      </SheetContent>
    </Sheet>
  )
}
