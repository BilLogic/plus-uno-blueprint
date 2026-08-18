import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { listModels } from '@/lib/agent/providers/models'
import {
  AGENT_PROVIDERS,
  MODEL_OPTIONS,
  modelFor,
  saveAgentSettings,
  useAgentSettings,
} from '@/lib/agent/settings'

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
 * `active` is only the model-list fetch gate: skip the provider round-trip
 * while the surface is closed.
 */
export function AgentSettingsFields({ active = true }: { active?: boolean }) {
  const settings = useAgentSettings()
  const { client, session, canAgent } = useSupabase()
  const [keyDraft, setKeyDraft] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [passwordDraft, setPasswordDraft] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const signIn = () => {
    if (!client || authBusy) return
    const email = emailDraft.trim()
    if (!email || !passwordDraft) return
    setAuthBusy(true)
    setAuthError(null)
    void client.auth
      .signInWithPassword({ email, password: passwordDraft })
      .then(({ error }) => {
        setAuthBusy(false)
        if (error) {
          setAuthError(error.message)
          return
        }
        setEmailDraft('')
        setPasswordDraft('')
      })
  }

  // Magic link: sign in without a password at all. The right fit for this
  // app's hand-created admin accounts — there is no sign-up flow and no
  // set-password screen, so a mailed link that lands already authenticated
  // beats a recovery flow with nowhere to type a new password.
  // `shouldCreateUser: false` keeps it from quietly minting accounts.
  // Requires the project's Site URL / redirect allowlist to include this
  // origin — a link mailed to the default localhost Site URL goes nowhere.
  const [linkSent, setLinkSent] = useState(false)
  const sendMagicLink = () => {
    if (!client || authBusy) return
    const email = emailDraft.trim()
    if (!email) return
    setAuthBusy(true)
    setAuthError(null)
    void client.auth
      .signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin,
        },
      })
      .then(({ error }) => {
        setAuthBusy(false)
        if (error) {
          setAuthError(error.message)
          return
        }
        setLinkSent(true)
      })
  }

  const signOut = () => {
    if (!client || authBusy) return
    setAuthBusy(true)
    void client.auth.signOut().then(() => {
      setAuthBusy(false)
      setAuthError(null)
    })
  }
  // Live model list from the provider's own list-models endpoint — current
  // by construction. The curated MODEL_OPTIONS list is only the no-key
  // fallback. null = not fetched (no key / failed / loading).
  const [liveModels, setLiveModels] = useState<{
    provider: string
    models: string[]
  } | null>(null)
  const provider = settings.provider
  const savedKeyForFetch = settings.keys[provider]
  useEffect(() => {
    if (!active || !savedKeyForFetch) return
    const controller = new AbortController()
    listModels(provider, savedKeyForFetch, controller.signal)
      .then((models) => {
        if (!controller.signal.aborted && models.length > 0)
          setLiveModels({ provider, models })
      })
      .catch(() => {
        // Fallback list stays; a failed listing is not worth an error state.
      })
    return () => controller.abort()
  }, [active, provider, savedKeyForFetch])
  // Stale fetches self-invalidate by provider tag — no reset effect needed.
  const modelChoices =
    liveModels && liveModels.provider === provider
      ? liveModels.models
      : MODEL_OPTIONS[provider]
  const providerLabel =
    AGENT_PROVIDERS.find((entry) => entry.id === settings.provider)?.label ??
    settings.provider
  const savedKey = settings.keys[settings.provider]

  return (
    <div className="flex flex-col gap-2.5">
      {/* Show/hide the chat is the rail's ✦ toggle — settings hold
          settings, not surface toggles. */}
      <p className="text-xs font-medium text-foreground">Admin</p>
      {session ? (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
            {session.user.email ?? 'Signed in'}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={authBusy}
            onClick={signOut}
          >
            Sign out
          </Button>
        </div>
      ) : (
        <>
          <Input
            type="email"
            value={emailDraft}
            onChange={(event) => setEmailDraft(event.target.value)}
            placeholder="admin@…"
            className="h-7 text-xs"
            aria-label="Admin email"
            autoComplete="email"
          />
          <div className="flex items-center gap-2">
            <Input
              type="password"
              value={passwordDraft}
              onChange={(event) => setPasswordDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') signIn()
              }}
              placeholder="Password"
              className="h-7 min-w-0 flex-1 text-xs"
              aria-label="Admin password"
              autoComplete="current-password"
            />
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={
                authBusy || emailDraft.trim() === '' || passwordDraft === ''
              }
              onClick={signIn}
            >
              Sign in
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 justify-start px-1 text-xs text-muted-foreground"
            disabled={authBusy || emailDraft.trim() === ''}
            onClick={sendMagicLink}
          >
            Email me a sign-in link instead
          </Button>
          {authError ? (
            <p className="text-3xs leading-snug text-destructive">
              {authError}
            </p>
          ) : linkSent ? (
            <p className="text-3xs leading-snug text-muted-foreground">
              Link sent — check that inbox, then open it on this device.
            </p>
          ) : (
            <p className="text-3xs leading-snug text-muted-foreground">
              Signing in unlocks editing and the agent on this device.
            </p>
          )}
        </>
      )}

      {canAgent ? (
        <>
      <div className="my-0.5 border-t border-muted" />
      <p className="text-xs font-medium text-foreground">Agent</p>

      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-2xs text-muted-foreground">
          Provider
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-7 min-w-0 flex-1 justify-start font-mono text-xs"
              >
                <span className="truncate">{providerLabel}</span>
              </Button>
            }
          />
          {/* Same values the trigger shows, so the same face. Size is the
              design system's menu default (12px). */}
          <DropdownMenuContent align="start" className="font-mono">
            {AGENT_PROVIDERS.map((entry) => (
              <DropdownMenuItem
                key={entry.id}
                onClick={() => {
                  saveAgentSettings({ provider: entry.id })
                  setKeyDraft('')
                }}
              >
                {entry.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-2xs text-muted-foreground">
          Model
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-7 min-w-0 flex-1 justify-start font-mono text-xs"
              >
                <span className="truncate">{modelFor(settings)}</span>
              </Button>
            }
          />
          <DropdownMenuContent
            align="start"
            className="max-h-64 overflow-y-auto font-mono"
          >
            {modelChoices.map((model) => (
              <DropdownMenuItem
                key={model}
                onClick={() =>
                  saveAgentSettings({
                    models: { [settings.provider]: model },
                  })
                }
              >
                {model}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-2xs text-muted-foreground">
          API key
        </span>
        <Input
          type="password"
          value={keyDraft}
          onChange={(event) => setKeyDraft(event.target.value)}
          placeholder={savedKey ? '••••••••  saved' : 'Paste key'}
          className="h-7 min-w-0 flex-1 font-mono text-xs"
          aria-label="API key"
        />
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={keyDraft.trim() === ''}
          onClick={() => {
            saveAgentSettings({
              keys: { [settings.provider]: keyDraft.trim() },
            })
            setKeyDraft('')
          }}
        >
          Save
        </Button>
      </div>
        </>
      ) : null}
    </div>
  )
}
