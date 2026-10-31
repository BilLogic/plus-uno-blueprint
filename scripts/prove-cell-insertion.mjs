#!/usr/bin/env node
/** Owns a disposable local database; proves collision-safe public insertion. */
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const database = `codex_cell_insert_${process.pid}_${Date.now()}`
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')))
// PROOF_PGHOST/PROOF_PGPORT pick a local server other than the default socket.
Object.assign(env, {
  PGHOST: process.env.PROOF_PGHOST ?? '/tmp', PGPORT: process.env.PROOF_PGPORT ?? '5432', PGDATABASE: database,
})
const args = ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', database]
const sql = (input) => execFileSync('psql', [...args, '-At'], { cwd: root, env, input, encoding: 'utf8' }).trim()
const auth = `set local role authenticated;
  select set_config('request.jwt.claims','{"role":"authenticated","app_metadata":{"role":"service"}}',true);
  select set_config('request.jwt.claim.sub','d7640000-0000-4000-8000-000000000001',true);`
const sessions = []
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
  sessions.push({ child, done })
}
async function waitFor(query) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (sql(query) === 't') return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('Concurrent proof never reached the expected database wait')
}
try {
  execFileSync(process.execPath, ['scripts/replay-migrations.mjs'], {
    cwd: root, env: { ...env, REPLAY_DATABASE: database }, stdio: 'inherit',
  })
  execFileSync('psql', [...args, '-f', 'supabase/tests/insert_cell_at_position.sql'], { cwd: root, env, stdio: 'inherit' })
  execFileSync(process.execPath, ['scripts/check-database-types.mjs'], {
    cwd: root, env: { ...env, SUPABASE_DB_URL: `postgresql://${env.PGHOST.startsWith('/') ? 'localhost' : env.PGHOST}:${env.PGPORT}/${database}` }, stdio: 'inherit',
  })
  const [svc, phase, scenario, path, lane, step] = Array.from({ length: 6 }, () => randomUUID())
  sql(`insert into public.services(id,name) values('${svc}','concurrent insertion fixture');
    insert into public.phases(id,service_id,name) values('${phase}','${svc}','fixture');
    insert into public.scenarios(id,phase_id,name) values('${scenario}','${phase}','fixture');
    insert into public.paths(id,scenario_id,name,kind) values('${path}','${scenario}','one','happy');
    insert into public.lanes(id,path_id,name,position) values('${lane}','${path}','Regular Tutor',0);
    insert into public.steps(id,scenario_id,name) values('${step}','${scenario}','Goal conversation');
    insert into public.path_steps(path_id,step_id,position) values('${path}','${step}',0);
    insert into public.cells(path_id,lane_id,step_id,content,status,cell_key)
      values('${path}','${lane}','${step}','Original conversation','live',public.mint_cell_key('${path}','${lane}','${step}'));`)
  const winnerName = `${database}_winner`
  const loserName = `${database}_loser`
  session(`begin; ${auth} select public.insert_cell_at_position('${path}','${lane}','${step}',1,'Winner','built'); select pg_sleep(4); commit;`, winnerName)
  await waitFor(`select exists(select 1 from pg_stat_activity where application_name='${winnerName}' and wait_event='PgSleep')`)
  session(`begin; ${auth} select public.insert_cell_at_position('${path}','${lane}','${step}',1,'Loser','live'); commit;`, loserName)
  await waitFor(`select exists(select 1 from pg_stat_activity where application_name='${loserName}' and wait_event='transactionid')`)
  const [first, second] = await Promise.all(sessions.map((item) => item.done))
  if (first.code !== 0 || second.code === 0 || !second.output.includes('cells_lane_step_slot_unique'))
    throw new Error(`Concurrent insertion outcomes unexpected: ${JSON.stringify([first, second])}`)
  if (sql(`select content||':'||status from public.cells where lane_id='${lane}' and step_id='${step}' and position=1`) !== 'Winner:built'
      || sql(`select content||':'||status from public.cells where lane_id='${lane}' and step_id='${step}' and position=0`) !== 'Original conversation:live'
      || sql(`select count(*) from public.cells where path_id='${path}'`) !== '2'
      || sql(`select count(*) from public.authoring_changes where fn='insert_cell_at_position' and args->>'path_id'='${path}'`) !== '1')
    throw new Error('Concurrent insertion changed the original or produced extra cells/ledger records')
  // Two different secondary slots share the descriptive key stem. Neither
  // may collide with the conversation or with the other's new identity.
  sql(`begin; ${auth}
    select public.insert_cell_at_position('${path}','${lane}','${step}',2,'Counter','live');
    select public.insert_cell_at_position('${path}','${lane}','${step}',3,'Private notes','live'); commit;`)
  if (sql(`select count(distinct cell_key) from public.cells where path_id='${path}'`) !== '4'
      || sql(`select count(*) from public.authoring_changes where fn='insert_cell_at_position' and args->>'path_id'='${path}' and revert->'args'->>'cell_id'=args->>'cell_id'`) !== '3')
    throw new Error('Distinct positions did not receive unique stable keys and exact inverses')
  console.log('[cell-insertion] concurrent collision refused; position0 preserved; unique secondary keys and durable inverses: PASS')
} finally {
  for (const { child } of sessions) if (child.exitCode === null) child.kill('SIGTERM')
  await Promise.allSettled(sessions.map((item) => item.done))
  execFileSync('dropdb', ['--if-exists', database], { cwd: root, env, stdio: 'inherit' })
  console.log(`[cell-insertion] disposed ${database}; no hosted connection used`)
}
