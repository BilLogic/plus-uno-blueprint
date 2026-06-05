import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { useSupabase } from '@/contexts/SupabaseProvider'

type Status = 'loading' | 'connected' | 'error' | 'unconfigured'

export function ConnectionBanner() {
  const { client, configured, isLoading: authLoading } = useSupabase()
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!configured || !client) {
      setStatus('unconfigured')
      return
    }
    if (authLoading) {
      setStatus('loading')
      return
    }

    let cancelled = false
    void client
      .from('service_lifecycles')
      .select('id', { count: 'exact', head: true })
      .then(({ error }) => {
        if (cancelled) return
        if (error) {
          setStatus('error')
          setMessage(error.message)
        } else {
          setStatus('connected')
          setMessage(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, client, configured])

  if (status === 'loading') {
    return <Skeleton className="h-14 w-full max-w-xl" />
  }

  if (status === 'unconfigured') {
    return (
      <Alert>
        <Info />
        <AlertTitle>Supabase not configured</AlertTitle>
        <AlertDescription>
          Copy <code className="text-xs">.env.example</code> to{' '}
          <code className="text-xs">.env</code> and set{' '}
          <code className="text-xs">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-xs">VITE_SUPABASE_ANON_KEY</code>.
        </AlertDescription>
      </Alert>
    )
  }

  if (status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Database connection failed</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <CheckCircle2 className="size-4 text-emerald-600" />
      <span>Connected to Supabase</span>
      <Badge variant="secondary">Live</Badge>
    </div>
  )
}
