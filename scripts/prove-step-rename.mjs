#!/usr/bin/env node
/** Local Postgres proof. Owns and drops a uniquely named disposable database. */
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const database = `codex_step_rename_${process.pid}_${Date.now()}`
// A caller's hosted PG environment must never redirect a disposable proof.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')))
Object.assign(env, { PGHOST: '/tmp', PGPORT: '5432', PGDATABASE: database })
const args = ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', database]
const sql = (input) => execFileSync('psql', [...args, '-At'], { cwd: root, env, input, encoding: 'utf8' }).trim()
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const auth = `set local role authenticated;
  select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"service"}}', true);
  select set_config('request.jwt.claim.sub', 'd7620000-0000-4000-8000-000000000001', true);`

function session(input, name) {
  const child = spawn('psql', args, { cwd: root, env: { ...env, PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  const done = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) => resolve({ code, output }))
  })
  child.stdin.end(input)
  return { child, done }
}

async function waitFor(query) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (sql(query) === 't') return
    await pause(25)
  }
  throw new Error('Concurrent proof never reached the expected database wait')
}

const sessions = []
try {
  execFileSync(process.execPath, ['scripts/replay-migrations.mjs'], {
    cwd: root, env: { ...env, REPLAY_DATABASE: database }, stdio: 'inherit',
  })
  execFileSync('psql', [...args, '-f', 'supabase/tests/rename_step.sql'], { cwd: root, env, stdio: 'inherit' })

  const [service, phase, scenario, step] = Array.from({ length: 4 }, () => randomUUID())
  sql(`insert into public.services(id,name) values ('${service}','concurrent rename fixture');
    insert into public.phases(id,service_id,name) values ('${phase}','${service}','fixture');
    insert into public.scenarios(id,phase_id,name) values ('${scenario}','${phase}','fixture');
    insert into public.steps(id,scenario_id,name) values ('${step}','${scenario}','Old step');`)
  const winnerName = `${database}_winner`
  const loserName = `${database}_loser`
  const winner = session(`begin; ${auth}
    select public.rename_step('${step}', 'Old step', 'Winner');
    select pg_sleep(4); commit;`, winnerName)
  sessions.push(winner)
  await waitFor(`select exists(select 1 from pg_stat_activity where application_name = '${winnerName}' and wait_event = 'PgSleep')`)
  const loser = session(`begin; ${auth}
    select public.rename_step('${step}', 'Old step', 'Loser'); commit;`, loserName)
  sessions.push(loser)
  await waitFor(`select exists(select 1 from pg_stat_activity where application_name = '${loserName}' and wait_event = 'transactionid')`)
  const [first, second] = await Promise.all(sessions.map((item) => item.done))
  if (first.code !== 0 || second.code === 0 || !second.output.includes('Step name changed; refresh before renaming'))
    throw new Error(`Concurrent rename outcomes unexpected: ${JSON.stringify([first, second])}`)
  if (sql(`select name from public.steps where id='${step}'`) !== 'Winner'
      || sql(`select count(*) from public.authoring_changes where fn='rename_step' and args->>'step_id'='${step}'`) !== '1')
    throw new Error('Concurrent read-back found the wrong winner or inverse count')
  console.log('[rename-step] concurrent stale rename refused; one winner and one durable inverse: PASS')
} finally {
  for (const { child } of sessions) if (child.exitCode === null) child.kill('SIGTERM')
  await Promise.allSettled(sessions.map((item) => item.done))
  execFileSync('dropdb', ['--if-exists', database], { cwd: root, env, stdio: 'inherit' })
  console.log(`[rename-step] disposed ${database}; no hosted connection used`)
}
