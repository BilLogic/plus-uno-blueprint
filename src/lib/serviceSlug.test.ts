import { describe, expect, it } from 'vitest'
import {
  resolveServiceBySlug,
  serviceSlug,
  slugifyServiceName,
} from '@/lib/serviceSlug'

/*
 * The route slug is derived from the service name (production has no `slug`
 * column), mirroring the database's `key_slug`. These pin that derivation and
 * the slug -> service resolution the router turns a `/<slug>` deep link into.
 */

describe('slugifyServiceName', () => {
  it('lowercases and hyphenates like key_slug', () => {
    expect(slugifyServiceName('PLUS Tutoring')).toBe('plus-tutoring')
  })

  it('collapses runs of non-alphanumerics into one hyphen', () => {
    expect(slugifyServiceName('Sales  &  Success!')).toBe('sales-success')
  })

  it('trims leading and trailing separators', () => {
    expect(slugifyServiceName('  --Onboarding-- ')).toBe('onboarding')
  })

  it('empties for a name with no ASCII alphanumerics', () => {
    expect(slugifyServiceName('运营协调')).toBe('')
  })
})

describe('serviceSlug', () => {
  it('is the slugified name for an ordinary service', () => {
    expect(serviceSlug({ id: 'svc-1', name: 'PLUS Tutoring' })).toBe('plus-tutoring')
  })

  it('falls back to the id when the name slugifies to nothing', () => {
    expect(serviceSlug({ id: 'svc-9', name: '运营协调' })).toBe('svc-9')
  })
})

describe('resolveServiceBySlug', () => {
  const services = [
    { id: 'a', name: 'Support Desk' },
    { id: 'b', name: 'Sales Pipeline' },
  ]

  it('resolves a service from its slug', () => {
    expect(resolveServiceBySlug(services, 'sales-pipeline')?.id).toBe('b')
  })

  it('picks only the named service, never a sibling', () => {
    // The scoping guarantee: a `/sales-pipeline` deep link cannot land on the
    // support service.
    expect(resolveServiceBySlug(services, 'support-desk')?.id).toBe('a')
    expect(resolveServiceBySlug(services, 'support-desk')?.id).not.toBe('b')
  })

  it('is case-insensitive', () => {
    expect(resolveServiceBySlug(services, 'Sales-Pipeline')?.id).toBe('b')
  })

  it('returns null when no service matches', () => {
    expect(resolveServiceBySlug(services, 'billing')).toBeNull()
  })
})
