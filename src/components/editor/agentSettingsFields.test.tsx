// @vitest-environment jsdom
/**
 * The settings surface is two components with one seam, and this pins the
 * seam rather than the halves.
 *
 * `AgentSettingsFields` composes `AdminSessionFields` and
 * `AgentProviderFields`; all it owns itself is the column, the headings and
 * the `canAgent` gate. So the thing worth asserting is which half is on
 * screen for whom — a signed-out visitor gets the front door and nothing
 * else, a session that can use the agent gets the keys as well, and a
 * signed-in session that cannot use the agent still gets no keys. Get the
 * gate on the wrong side of the split and one of these three flips.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentSettingsFields } from '@/components/editor/AgentSettingsFields'
import type { Session } from '@supabase/supabase-js'

const mockSupabase = {
  client: {} as unknown,
  session: null as Session | null,
  canAgent: false,
}
vi.mock('@/contexts/SupabaseProvider', () => ({
  useSupabase: () => mockSupabase,
}))

const signedIn = { user: { email: 'admin@example.com' } } as Session

beforeEach(() => {
  mockSupabase.session = null
  mockSupabase.canAgent = false
  window.localStorage.clear()
})
afterEach(cleanup)

describe('AgentSettingsFields', () => {
  it('a signed-out visitor gets the sign-in fields and no agent keys', () => {
    render(<AgentSettingsFields />)
    expect(screen.getByLabelText('Admin email')).toBeDefined()
    expect(screen.getByLabelText('Admin password')).toBeDefined()
    expect(screen.queryByLabelText('API key')).toBeNull()
  })

  it('a session that can use the agent gets the keys, not the sign-in form', () => {
    mockSupabase.session = signedIn
    mockSupabase.canAgent = true
    render(<AgentSettingsFields />)
    expect(screen.getByText('admin@example.com')).toBeDefined()
    expect(screen.queryByLabelText('Admin email')).toBeNull()
    expect(screen.getByLabelText('API key')).toBeDefined()
  })

  it('signing in is not the same as being allowed the agent', () => {
    mockSupabase.session = signedIn
    render(<AgentSettingsFields />)
    expect(screen.getByText('Sign out')).toBeDefined()
    expect(screen.queryByLabelText('API key')).toBeNull()
  })
})
