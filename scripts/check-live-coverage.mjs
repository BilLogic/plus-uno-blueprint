#!/usr/bin/env node
/**
 * `npm run check:live-coverage` — CI is held to what it says it verifies.
 *
 * `scripts/live-checks.mjs` declares, for every check that asks the database,
 * which credential it needs and where it runs. This is the file that stops
 * that declaration from becoming a comment: it reads `package.json` and
 * `.github/workflows/`, and fails when the two disagree.
 *
 * WHAT IT ASSERTS. All of it static — file reads, no database, no network — so
 * it can be a required check beside the vocabulary guards:
 *
 *   1. every `:live` npm script is declared, and every declared script exists
 *   2. every workflow an entry names exists and really runs that script
 *   3. an entry that claims to run on pull requests is named by a workflow
 *      `pull_request` triggers; one that claims a schedule is named by a
 *      workflow with a `schedule:` trigger; one that says `manual` is named
 *      by no workflow at all
 *   4. NO workflow that `pull_request` can trigger names a privileged
 *      credential
 *
 * The fourth is the load-bearing one and the reason this check is worth a job
 * slot. A same-repo pull request is handed the repository's secrets AND brings
 * the workflow file that will run, so a direct `postgres://` string named by a
 * pull-request job is a string any branch author can print. That is the whole
 * content of this repository's standing rule about privileged credentials in
 * CI, which until now was a sentence in a comment. It is an invariant, so it
 * is checked.
 *
 * THE OTHER MODE IS THE POINT OF THE TICKET.
 *
 *   node scripts/check-live-coverage.mjs --announce pull-request
 *   node scripts/check-live-coverage.mjs --announce scheduled
 *
 * `--announce` never fails a build. It writes the coverage table to the job
 * summary and raises a `::warning::` for every check the running job did not
 * cover, naming what went unverified and how the job that covers it is turned
 * on. A silent skip inside a green job is the defect this repository kept
 * meeting; a skip that says so is the fix, and it is the fix whether or not
 * anything else is decided.
 */

import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LIVE_CHECKS, LIVE_WITHOUT_THE_SUFFIX, PRIVILEGED_VARIABLES, coverage, unverifiedHere } from './live-checks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORKFLOWS = path.join(ROOT, '.github', 'workflows')

function workflowFiles() {
  if (!existsSync(WORKFLOWS)) return []
  return readdirSync(WORKFLOWS)
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => ({
      path: `.github/workflows/${name}`,
      text: readFileSync(path.join(WORKFLOWS, name), 'utf8'),
    }))
}

/** A trigger is a key in the `on:` block, so it sits at one indent and ends the line. */
function triggers(text, name) {
  return new RegExp(`^\\s{2}${name}:\\s*$`, 'm').test(text)
}

/** A step really runs the script, rather than merely mentioning it in a comment. */
function runsScript(text, script) {
  return new RegExp(`run:\\s*npm run ${script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)
}

export function coverageFailures({ scripts, workflows }) {
  const failures = []
  const declared = new Map(LIVE_CHECKS.map((check) => [check.script, check]))

  for (const name of Object.keys(scripts)) {
    if (name.endsWith(':live') && !declared.has(name)) {
      failures.push(
        `\`${name}\` is an npm script that asks the database and scripts/live-checks.mjs does not ` +
          'declare it. Every live check says where CI runs it, or says that nothing does.',
      )
    }
  }
  for (const name of LIVE_WITHOUT_THE_SUFFIX) {
    if (!declared.has(name)) failures.push(`\`${name}\` reaches a live subject and is not declared`)
  }
  for (const check of LIVE_CHECKS) {
    if (!(check.script in scripts)) {
      failures.push(`\`${check.script}\` is declared in scripts/live-checks.mjs and is not an npm script`)
      continue
    }
    const naming = workflows.filter((w) => runsScript(w.text, check.script))

    for (const declaredPath of check.runsIn) {
      const workflow = workflows.find((w) => w.path === declaredPath)
      if (!workflow) {
        failures.push(`\`${check.script}\` names ${declaredPath}, which does not exist`)
      } else if (!runsScript(workflow.text, check.script)) {
        failures.push(`\`${check.script}\` names ${declaredPath}, which never runs it`)
      }
    }

    if (check.status === 'manual' && naming.length > 0) {
      failures.push(
        `\`${check.script}\` is declared manual and ${naming.map((w) => w.path).join(', ')} runs it. ` +
          'A check CI runs is not manual, whatever the declaration says.',
      )
    }
    if (check.status === 'pull-request' && !naming.some((w) => triggers(w.text, 'pull_request'))) {
      failures.push(`\`${check.script}\` claims to run on every pull request and no pull-request workflow runs it`)
    }
    if (check.status === 'scheduled' && !naming.some((w) => triggers(w.text, 'schedule'))) {
      failures.push(`\`${check.script}\` claims a schedule and no scheduled workflow runs it`)
    }
  }

  for (const workflow of workflows.filter((w) => triggers(w.text, 'pull_request'))) {
    for (const variable of PRIVILEGED_VARIABLES) {
      if (workflow.text.includes(variable)) {
        failures.push(
          `${workflow.path} can be triggered by a pull request and names ${variable}. A same-repo ` +
            'pull request is handed this repository\'s secrets and supplies the workflow that reads ' +
            'them, so a privileged database credential there is one any branch author can print.',
        )
      }
    }
  }
  return failures
}

/* ------------------------------------------------------------------ output */

function summarise(lines) {
  const file = process.env.GITHUB_STEP_SUMMARY
  const text = `${lines.join('\n')}\n`
  if (file) appendFileSync(file, text)
  else process.stdout.write(text)
}

function announce(context, env) {
  const checks = coverage(env)
  const here = checks.filter((check) => check.status === context)
  const elsewhere = checks.filter((check) => check.status !== context)
  const lines = []

  if (context === 'pull-request') {
    lines.push('### Live-database checks this job ran', '')
    for (const check of here) {
      lines.push(
        check.covered
          ? `- ✅ \`${check.script}\` — ${check.subject}`
          : `- ⚠️ \`${check.script}\` — ${check.missing.join(' and ')} unset, so this job could not ask ${check.subject}`,
      )
    }
    lines.push('', '### What no check in this job looked at', '')
    for (const check of elsewhere) {
      lines.push(`- ⚠️ ${unverifiedHere(check)}`)
      console.log(`::warning title=${check.script} did not run here::${unverifiedHere(check)}`)
    }
    lines.push(
      '',
      'This list is `scripts/live-checks.mjs`, and `npm run check:live-coverage` fails if a ' +
        'live check is missing from it or runs somewhere other than it says.',
    )
    summarise(lines)
    return
  }

  lines.push('### The nightly sweep of the live schema', '')
  for (const check of here) {
    if (check.covered) {
      lines.push(`- ✅ \`${check.script}\` — ${check.subject}`)
      continue
    }
    const how =
      `set ${check.missing.join(' and ')} as ` +
      (check.secrecy === 'privileged' ? 'a repository SECRET' : 'a repository VARIABLE') +
      ' (Settings → Secrets and variables → Actions)'
    const said = `\`${check.script}\` verified NOTHING: ${check.missing.join(' and ')} unset. Unverified: ${check.unverified}. To turn it on, ${how}.`
    lines.push(`- ⚠️ ${said}`)
    console.log(`::warning title=${check.script} verified nothing::${said}`)
  }
  summarise(lines)
}

/* -------------------------------------------------------------------- main */

function main(argv, env) {
  const scripts = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts ?? {}
  const workflows = workflowFiles()

  const at = argv.indexOf('--announce')
  if (at !== -1) {
    const context = argv[at + 1]
    if (context !== 'pull-request' && context !== 'scheduled') {
      console.error('::error::--announce takes `pull-request` or `scheduled`')
      process.exit(1)
    }
    announce(context, env)
    return
  }

  const failures = coverageFailures({ scripts, workflows })
  for (const failure of failures) console.error(`::error::${failure}`)
  console.log(
    `${LIVE_CHECKS.length} live check(s) declared across ${workflows.length} workflow(s): ` +
      LIVE_CHECKS.map((check) => `${check.key}=${check.status}`).join(', '),
  )
  if (failures.length > 0) {
    console.error(`\n${failures.length} disagreement(s) between what CI runs and what it says it runs.`)
    process.exit(1)
  }
  console.log('ok — every live check declares where it runs, and no pull-request workflow names a privileged credential')
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2), process.env)
