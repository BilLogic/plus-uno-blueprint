/**
 * The localStorage namespace this repository owns.
 *
 * A DECLARED FORK SEAM (#325 S2, #396 Q20), and one of exactly two places
 * where convergence with the template stops on purpose. Every key this app
 * writes to `window.localStorage` is prefixed, and the prefix names the
 * DEPLOYMENT rather than the code: this instance ships as `uno-*`, the
 * template (agentic-service-blueprinting) as `sb-*`. Two installations served
 * from one origin would otherwise read each other's settings, sessions and
 * chat placement, so the prefix is the one thing about a stored key that MUST
 * differ per install.
 *
 * That is why this module exists instead of a string literal at each call
 * site. Every module that stores anything imports `storageKey` from here,
 * which leaves those modules byte-identical to the template's copies and
 * confines the fork to the constant below. Do not "fix" the divergence by
 * inlining the prefix again — the divergence is the point, and this file is
 * where it is allowed to live.
 *
 * The prefix itself is frozen: the keys already sitting in readers' browsers
 * carry it, and nothing migrates them. Changing it silently forgets every
 * saved API key, session list and remembered path.
 */

/** Prefix on every localStorage key this app writes. */
export const STORAGE_PREFIX = 'uno-'

/** A namespaced localStorage key — `storageKey('agent-settings')`. */
export function storageKey(name: string): string {
  return `${STORAGE_PREFIX}${name}`
}
