import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type { AgentSession } from '@/lib/agent/sessions'
import type { TranscriptEvent } from '@/lib/agent/loop'

type Client = SupabaseClient<Database>

/**
 * Best-effort DB persistence for agent sessions and transcripts.
 *
 * Local dev runs authenticated (the dev authoring user), so everything here
 * lands in agent_sessions / agent_messages and survives reloads. The
 * deployed read-only site runs as anon, which has NO policies on these
 * tables — every call fails quietly and the panel keeps working from its
 * in-memory/localStorage stores. That degradation is deliberate: the agent
 * surface never exists without write access anyway.
 */

let attached: Client | null = null

export function attachAgentPersistence(client: Client | null) {
  attached = client
}

export function persistSession(session: AgentSession): void {
  if (!attached) return
  void attached
    .from('agent_sessions')
    .upsert({
      id: session.id,
      title: session.title,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    })
    .then(() => undefined)
}

export function deletePersistedSession(id: string): void {
  if (!attached) return
  void attached
    .from('agent_sessions')
    .delete()
    .eq('id', id)
    .then(() => undefined)
}

export async function loadPersistedSessions(): Promise<AgentSession[] | null> {
  if (!attached) return null
  const { data, error } = await attached
    .from('agent_sessions')
    .select('id, title, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (error || !data) return null
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    changeCount: 0,
  }))
}

export function persistEvent(
  sessionId: string,
  seq: number,
  event: TranscriptEvent,
): void {
  if (!attached) return
  void attached
    .from('agent_messages')
    .upsert(
      {
        session_id: sessionId,
        seq,
        kind: event.kind,
        payload: event as unknown as Json,
      },
      { onConflict: 'session_id,seq' },
    )
    .then(() => undefined)
}

export async function loadPersistedEvents(
  sessionId: string,
): Promise<TranscriptEvent[] | null> {
  if (!attached) return null
  const { data, error } = await attached
    .from('agent_messages')
    .select('payload')
    .eq('session_id', sessionId)
    .order('seq', { ascending: true })
  if (error || !data) return null
  return data
    .map((row) => row.payload as unknown as TranscriptEvent)
    .filter((event) => event && typeof event.kind === 'string')
}
