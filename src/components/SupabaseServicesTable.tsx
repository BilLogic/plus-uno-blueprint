import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSupabase } from '@/contexts/SupabaseProvider'
import type { Service } from '@/types/database'

export function SupabaseServicesTable() {
  const { client, configured, isLoading: authLoading } = useSupabase()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!configured || !client) {
      setLoading(false)
      return
    }
    if (authLoading) return

    let cancelled = false
    void client
      .from('services')
      .select('*')
      .order('name')
      .then(({ data, error: err }) => {
        if (cancelled) return
        setError(err?.message ?? null)
        setServices(data ?? [])
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, client, configured])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service catalog</CardTitle>
        <CardDescription>Legacy `services` table from the initial schema.</CardDescription>
      </CardHeader>
      <CardContent>
        {!configured && (
          <p className="text-sm text-muted-foreground">Supabase is not configured.</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {loading && <Skeleton className="h-32 w-full" />}
        {!loading && configured && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.slug}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.description ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
