import { useState, type FormEvent } from 'react'
import { LogIn, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useSupabase } from '@/contexts/SupabaseProvider'

type SignInStep = 'email' | 'code'

/**
 * Compact sign-in control for the sidebar footer. Anonymous sessions get a
 * "Sign in" button opening an email OTP dialog (magic link AND 6-digit code —
 * corporate link scanners consume magic links, so the code path always
 * works). Signed-in sessions show the email plus sign-out. Hidden entirely
 * in no-DB mode.
 */
export function SignInControl() {
  const { client, configured, session } = useSupabase()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [step, setStep] = useState<SignInStep>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!configured || !client) return null

  if (session) {
    return (
      <div className="flex min-w-0 items-center gap-1.5 px-3 py-2">
        <p
          className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
          title={session.user.email ?? undefined}
        >
          {session.user.email ?? 'Signed in'}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Sign out"
          onClick={() => {
            void client.auth.signOut()
          }}
        >
          <LogOut className="size-3.5" />
        </Button>
      </div>
    )
  }

  const resetDialog = () => {
    setStep('email')
    setCode('')
    setBusy(false)
    setError(null)
  }

  const handleSendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !email.trim()) return
    setBusy(true)
    setError(null)
    const { error: otpError } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: false,
      },
    })
    setBusy(false)
    if (otpError) {
      setError(otpError.message)
      return
    }
    setStep('code')
  }

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !code.trim()) return
    setBusy(true)
    setError(null)
    const { error: verifyError } = await client.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (verifyError) {
      setError(verifyError.message)
      return
    }
    setDialogOpen(false)
    resetDialog()
  }

  return (
    <>
      <div className="px-3 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={() => {
            resetDialog()
            setDialogOpen(true)
          }}
        >
          <LogIn className="size-3.5" />
          Sign in
        </Button>
      </div>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetDialog()
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
            <DialogDescription>
              {step === 'email'
                ? 'Enter your email to receive a magic link and a 6-digit code.'
                : `We sent a magic link and a 6-digit code to ${email.trim()}. Open the link, or enter the code below.`}
            </DialogDescription>
          </DialogHeader>
          {step === 'email' ? (
            <form
              className="flex flex-col gap-3 px-6 py-4"
              onSubmit={(event) => {
                void handleSendCode(event)
              }}
            >
              <Input
                type="email"
                required
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-label="Email address"
              />
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? 'Sending…' : 'Send link and code'}
              </Button>
            </form>
          ) : (
            <form
              className="flex flex-col gap-3 px-6 py-4"
              onSubmit={(event) => {
                void handleVerifyCode(event)
              }}
            >
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                placeholder="6-digit code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                aria-label="One-time code"
              />
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? 'Verifying…' : 'Verify code'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError(null)
                }}
              >
                Use a different email
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
