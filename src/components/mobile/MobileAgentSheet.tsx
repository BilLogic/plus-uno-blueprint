import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { AgentPanel } from '@/components/editor/AgentPanel'

/**
 * The agent, full-height bottom sheet. AgentPanel state lives in the module
 * store (panelState), so open/close never drops a session.
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
        className="flex h-[92svh] flex-col gap-0 rounded-t-2xl p-0"
      >
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-sm">Agent</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          <AgentPanel />
        </div>
      </SheetContent>
    </Sheet>
  )
}
