import { useSyncExternalStore } from 'react'

/**
 * Agent sessions, localStorage-backed for the UI prototype. The plan's
 * persistence unit (agent_sessions/agent_messages tables, RLS
 * authenticated-only) replaces this store without changing the panel API —
 * which is the point of keeping the API this small.
 */

export type AgentSession = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  /** Ledger entries stamped with this session — wired when tool loop lands. */
  changeCount: number
}

const STORAGE_KEY = 'uno-agent-sessions'

function read(): AgentSession[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as AgentSession[]) : []
  } catch {
    return []
  }
}

let snapshot: AgentSession[] = typeof window === 'undefined' ? [] : read()
const listeners = new Set<() => void>()

function write(next: AgentSession[]) {
  snapshot = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Session-only fallback is fine for a prototype store.
  }
  listeners.forEach((listener) => listener())
}

export function useAgentSessions(): AgentSession[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => snapshot,
  )
}

export function createAgentSession(title = 'New session'): AgentSession {
  const now = new Date().toISOString()
  const session: AgentSession = {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    changeCount: 0,
  }
  // Newest first — the list renders in store order.
  write([session, ...snapshot])
  return session
}

export function renameAgentSession(id: string, title: string) {
  write(
    snapshot.map((session) =>
      session.id === id
        ? { ...session, title, updatedAt: new Date().toISOString() }
        : session,
    ),
  )
}

export function deleteAgentSession(id: string) {
  write(snapshot.filter((session) => session.id !== id))
}
