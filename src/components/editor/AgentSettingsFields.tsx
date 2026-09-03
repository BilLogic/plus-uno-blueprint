import { AdminSessionFields } from '@/components/editor/AdminSessionFields'
import { AgentProviderFields } from '@/components/editor/AgentProviderFields'
import { AgentScopeField } from '@/components/editor/AgentScopeField'
import { useSupabase } from '@/contexts/SupabaseProvider'

/**
 * Admin sign-in, then the agent's provider / model / key — the whole of
 * the settings surface, with no opinion about what frames it.
 *
 * Two frames use it: the desktop rail's ⚙ popover, and the phone drawer's
 * settings surface. It lives apart from both because the phone had NO way
 * to sign in at all before (the gear is desktop rail chrome), which on the
 * deployed site meant a phone could never reach the agent — and a second
 * copy of an auth form is how two sign-in flows drift apart.
 *
 * The two halves are their own components because they share nothing: no
 * state crosses between them and each reads only the context field it
 * needs. What is left here is what genuinely spans both — the column they
 * sit in, the section headings, the rule between them, and the `canAgent`
 * gate that decides whether the second half exists at all.
 *
 * `active` is only the model-list fetch gate: skip the provider round-trip
 * while the surface is closed.
 */
export function AgentSettingsFields({ active = true }: { active?: boolean }) {
  const { canAgent } = useSupabase()

  return (
    <div className="flex flex-col gap-2.5">
      {/* Show/hide the chat is the rail's ✦ toggle — settings hold
          settings, not surface toggles. */}
      <p className="text-xs font-medium text-foreground">Admin</p>
      <AdminSessionFields />

      {canAgent ? (
        <>
          <div className="my-0.5 border-t border-muted" />
          <p className="text-xs font-medium text-foreground">Agent</p>
          <AgentProviderFields active={active} />
          <AgentScopeField />
        </>
      ) : null}
    </div>
  )
}
