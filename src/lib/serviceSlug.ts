/**
 * A service's route slug — derived from its name, not read from a column.
 *
 * A deployment routes by service slug (#303/#335): `/<slug>` opens that
 * service. The obvious source would be a `services.slug` column, but production
 * dropped that column long ago (the initial schema had it; the empty-replay
 * baseline still does, production does not — see migration
 * `20260830180000_the_two_gaps_that_were_actually_open`). Selecting it would
 * error, so the slug is COMPUTED from the name the same way the database's
 * `key_slug` computes a cell key's service segment: lowercase, every run of
 * non-alphanumerics becomes a single hyphen, ends trimmed. That keeps the app's
 * route slug in step with the identity the import pipeline already slugifies,
 * with no schema change.
 *
 * A name that slugifies to nothing (all non-ASCII — `key_slug` has its own
 * md5 fallback there) falls back to the row id, so every service still has a
 * stable, unique, resolvable slug.
 */

export type ServiceIdentity = { id: string; name: string }

/**
 * Slugify a service name the way `public.key_slug` does for ASCII input:
 * `trim('-', regexp_replace(lower(value), '[^a-z0-9]+', '-'))`. May be empty
 * when the name has no ASCII alphanumerics — callers pair it with the id.
 */
export function slugifyServiceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** The route slug for a service: its slugified name, or its id when that empties. */
export function serviceSlug(service: ServiceIdentity): string {
  return slugifyServiceName(service.name) || service.id
}

/**
 * The service a route slug names, or `null` when none matches. Comparison is
 * case-insensitive so a hand-typed `/Plus-Tutoring` still resolves.
 */
export function resolveServiceBySlug<T extends ServiceIdentity>(
  services: readonly T[],
  slug: string,
): T | null {
  const target = slug.toLowerCase()
  return services.find((service) => serviceSlug(service).toLowerCase() === target) ?? null
}
