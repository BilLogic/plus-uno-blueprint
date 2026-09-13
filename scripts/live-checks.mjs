/**
 * Every check in this repository that asks the DATABASE rather than the files,
 * and what CI can see of each.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 *
 * `check:identifiers` replays `supabase/migrations` and refuses a retired name
 * found in them. `check:identifiers:live` asks `pg_catalog` the same question.
 * The first runs on every pull request; the second ran when somebody
 * remembered. So a name retired in the files and still alive in production was
 * invisible to CI — which is how `stakeholders.parent_id` and
 * `agent_sessions.user_id` survived until a schema account disagreed with the
 * database and a person noticed.
 *
 * The defect was never that the live half is wrong. It is honest about its
 * subject; nothing ran it, and nothing SAID that nothing ran it. A skipped job
 * in a green checks table reads exactly like a job that passed.
 *
 * So this list is the declaration, and `check-live-coverage.mjs` is what holds
 * CI to it. Each entry names one check, the credential it needs, the kind of
 * credential that is, where it runs, and — the part that matters — what goes
 * UNVERIFIED when it does not. A pull request prints that sentence for every
 * check its own green ticks did not cover.
 *
 * ── THE THREE KINDS OF CREDENTIAL, WHICH ARE THREE DIFFERENT RISKS ────────
 *
 * Lumping the live checks together is what produced the blind spot. They do
 * not share a threat model:
 *
 *   `none`        — an unauthenticated endpoint. `check:bot-probe` reads
 *                   uno-bot's `/health/blueprint`, which returns per-probe
 *                   booleans and no data. Nothing to leak, so it runs
 *                   wherever it is useful.
 *
 *   `publishable` — the project URL and the anon key. Already inside the
 *                   browser bundle this repository deploys, so publishing
 *                   them to Actions adds no exposure at all. They are
 *                   repository VARIABLES, and every check on this tier
 *                   already runs on every pull request.
 *
 *   `privileged`  — a direct `postgres://` connection string, password and
 *                   all. `pg_catalog`, `information_schema` and
 *                   `supabase_migrations` are reachable through no PostgREST
 *                   role, so the catalog checks have no other route. This is
 *                   a repository SECRET and it may never be named by a
 *                   workflow that `pull_request` can trigger: a same-repo
 *                   pull request gets the repository's secrets AND supplies
 *                   the workflow file it runs, so a privileged credential in
 *                   a pull-request job is a credential any branch author can
 *                   print. `check-live-coverage.mjs` asserts that
 *                   mechanically rather than leaving it to a reviewer.
 *
 * A scheduled run on `main` has no such hole — the workflow it runs is the one
 * that was reviewed and merged — which is why the privileged tier is nightly
 * rather than per-pull-request, and why "nightly" is not a weaker answer here
 * but the only sound one.
 *
 * ── STATUS IS A FACT ABOUT CI, NOT AN AMBITION ────────────────────────────
 *
 *   `pull-request` — runs on every pull request, and a failure blocks it
 *   `scheduled`    — runs nightly against production, and never blocks a merge
 *   `manual`       — nothing in CI runs it; a person does, at a stated moment
 *
 * `manual` is a real answer and one check keeps it. It is not a placeholder
 * for "we did not get round to it": an entry that says `manual` has to say in
 * `unverified` what that costs, and a pull request prints the sentence.
 */

/** @typedef {'none'|'publishable'|'privileged'} Secrecy */
/** @typedef {'pull-request'|'scheduled'|'manual'} Status */

export const LIVE_CHECKS = Object.freeze([
  {
    key: 'contract',
    script: 'check:contract:live',
    subject: 'the live database, as the anon role sees it',
    secrecy: 'publishable',
    needs: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
    status: 'pull-request',
    runsIn: ['.github/workflows/gates.yml', '.github/workflows/bot-contract-probe.yml'],
    unverified:
      'whether the database still answers to the contract the app and uno-bot share — ' +
      'embed hints, RPC parameter names and accepted values, the breadcrumb, and every ' +
      'value set a swept document states',
  },
  {
    key: 'agent-account',
    script: 'check:agent-account',
    subject: "the column comments the agent's account of the schema is rendered from",
    secrecy: 'publishable',
    needs: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    status: 'pull-request',
    runsIn: ['.github/workflows/gates.yml'],
    unverified: 'whether the document an agent is handed still matches the schema it describes',
  },
  {
    key: 'auth-posture',
    script: 'check:auth-posture',
    subject: "GoTrue's own published configuration",
    secrecy: 'publishable',
    needs: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    status: 'pull-request',
    runsIn: ['.github/workflows/gates.yml'],
    unverified: 'whether a stranger can still mint an authenticated token',
  },
  {
    key: 'bot-probe',
    script: 'check:bot-probe',
    subject: "uno-bot's live reads, through its unauthenticated health endpoint",
    secrecy: 'none',
    needs: [],
    status: 'scheduled',
    runsIn: ['.github/workflows/bot-contract-probe.yml'],
    unverified: 'whether the deployed bot still covers every read the contract declares',
  },
  {
    key: 'identifiers',
    script: 'check:identifiers:live',
    subject: 'pg_catalog itself — every object name, comment and function body',
    secrecy: 'privileged',
    needs: ['SUPABASE_DB_URL'],
    status: 'scheduled',
    runsIn: ['.github/workflows/live-schema.yml'],
    unverified:
      'whether a name this series retired is still alive in the database. The static half ' +
      'reads the migration FILES, so a rename written down but never applied — or applied ' +
      'and never written down — passes it',
  },
  {
    key: 'rls-posture',
    script: 'check:rls-posture:live',
    subject: 'the policies, grants and column privileges the database actually holds',
    secrecy: 'privileged',
    needs: ['SUPABASE_DB_URL'],
    status: 'scheduled',
    runsIn: ['.github/workflows/live-schema.yml'],
    unverified:
      'whether production still holds the posture the migrations describe. The suite that ' +
      'runs on every pull request proves the check goes red on each shape it exists for; it ' +
      'says nothing about production',
  },
  {
    key: 'database-types',
    script: 'check:database-types:live',
    subject: 'the columns and argument lists the database really has',
    secrecy: 'privileged',
    needs: ['SUPABASE_DB_URL'],
    status: 'scheduled',
    runsIn: ['.github/workflows/live-schema.yml'],
    unverified:
      'whether the database is still a runtime superset of the types the application was ' +
      'compiled against — a column missing here is a read that fails in production',
  },
  {
    key: 'migration-ledger',
    script: 'check:migration-ledger:live',
    subject: 'supabase_migrations.schema_migrations against the files on disk',
    secrecy: 'privileged',
    needs: ['SUPABASE_DB_URL'],
    status: 'manual',
    runsIn: [],
    unverified:
      'whether a migration file committed here was ever applied. It stays manual because it ' +
      'is a step in the apply loop rather than a watch on production: `apply:pending` ends by ' +
      'naming it, its baseline is a committed ratchet, and clearing a failure means editing ' +
      'that baseline — a nightly red no runner can clear is the unread job this whole ' +
      'arrangement exists to avoid',
  },
])

/** The scripts that reach a database or a network without saying `:live` in their name. */
export const LIVE_WITHOUT_THE_SUFFIX = Object.freeze(['check:agent-account', 'check:auth-posture', 'check:bot-probe'])

/** Every environment variable any privileged entry needs. Nothing may name one on a pull request. */
export const PRIVILEGED_VARIABLES = Object.freeze([
  ...new Set(LIVE_CHECKS.filter((c) => c.secrecy === 'privileged').flatMap((c) => c.needs)),
])

/**
 * What this environment can actually see, per check.
 *
 * `covered` is about credentials in hand, not about whether a job chose to
 * run: a check with nothing to supply is covered everywhere.
 *
 * @param {Record<string, string | undefined>} env
 */
export function coverage(env) {
  return LIVE_CHECKS.map((check) => {
    const missing = check.needs.filter((name) => !env[name])
    return { ...check, missing, covered: missing.length === 0 }
  })
}

/**
 * The sentence a pull request prints for a check its own ticks did not cover.
 *
 * It is written to be true whether or not the nightly is armed, because the
 * workflow that prints it cannot ask — a pull-request job may not name a
 * privileged variable, which is the point of the rule above. The nightly says
 * which of the two it was, in its own summary, every day.
 */
export function unverifiedHere(check) {
  if (check.status === 'manual') {
    return (
      `\`npm run ${check.script}\` did not run on this pull request, so this went unverified: ` +
      `${check.unverified}. NOTHING IN CI RUNS IT AT ALL — a person does, on a machine that has ` +
      `${check.needs.join(' and ') || 'the credential it needs'}.`
    )
  }
  const how =
    check.secrecy === 'privileged'
      ? ` That job needs the ${check.needs.join(' and ')} repository secret and reports in its own summary whether it had one.`
      : ''
  return (
    `\`npm run ${check.script}\` did not run on this pull request, so this went unverified: ` +
    `${check.unverified}. It runs in ${check.runsIn.join(' and ')}, not here.${how}`
  )
}
