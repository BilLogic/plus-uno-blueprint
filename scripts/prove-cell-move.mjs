#!/usr/bin/env node
/** Public-operation proof in an owned disposable local Postgres database. */
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const database = `codex_cell_move_${process.pid}_${Date.now()}`
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')))
Object.assign(env, { PGHOST: '/tmp', PGPORT: '5432', PGDATABASE: database })
const args = ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', database]
const sql = (input) => execFileSync('psql', [...args, '-At'], { cwd: root, env, input, encoding: 'utf8' }).trim()
const auth = `set local role authenticated;
  select set_config('request.jwt.claims','{"role":"authenticated","app_metadata":{"role":"service"}}',true);
  select set_config('request.jwt.claim.sub','d7630000-0000-4000-8000-000000000001',true);`
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
  const running = { child, done }
  sessions.push(running)
  return running
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
  execFileSync('psql', [...args, '-f', 'supabase/tests/move_cell.sql'], { cwd: root, env, stdio: 'inherit' })
  const [svc, phase, scenario, pathA, pathB, laneA, laneB, stepA, stepB, cell, peer, anchor, edgeId] = Array.from({ length: 13 }, () => randomUUID())
  sql(`insert into public.services(id,name) values('${svc}','concurrent move fixture');
    insert into public.phases(id,service_id,name) values('${phase}','${svc}','fixture');
    insert into public.scenarios(id,phase_id,name) values('${scenario}','${phase}','fixture');
    insert into public.paths(id,scenario_id,name,kind) values('${pathA}','${scenario}','one','happy'),('${pathB}','${scenario}','two','variant');
    insert into public.lanes(id,path_id,name,position) values('${laneA}','${pathA}','Tutor',0),('${laneB}','${pathB}','Tutor',0);
    insert into public.steps(id,scenario_id,name) values('${stepA}','${scenario}','one'),('${stepB}','${scenario}','two');
    insert into public.path_steps(path_id,step_id,position) values('${pathA}','${stepA}',0),('${pathA}','${stepB}',1),('${pathB}','${stepB}',0);
    insert into public.cells(id,path_id,lane_id,step_id,content,status) values('${cell}','${pathA}','${laneA}','${stepA}','Keep identity','live'),
      ('${peer}','${pathA}','${laneA}','${stepB}','Peer in original path','live');
    insert into public.cells(id,path_id,lane_id,step_id,position,content,status)
      values('${anchor}','${pathA}','${laneA}','${stepA}',1,'Original edge target','live');`)
  const source = JSON.stringify({ path_id: pathA, lane_id: laneA, step_id: stepA, position: 0 })
  const target = JSON.stringify({ path_id: pathB, lane_id: laneB, step_id: stepB, position: 1 })
  const alternative = JSON.stringify({ path_id: pathA, lane_id: laneA, step_id: stepB, position: 0 })
  const winnerName = `${database}_winner`
  const loserName = `${database}_loser`
  session(`begin; ${auth} select public.move_cell('${cell}','${source}','${target}'); select pg_sleep(4); commit;`, winnerName)
  await waitFor(`select exists(select 1 from pg_stat_activity where application_name='${winnerName}' and wait_event='PgSleep')`)
  session(`begin; ${auth} select public.move_cell('${cell}','${source}','${alternative}'); commit;`, loserName)
  await waitFor(`select exists(select 1 from pg_stat_activity where application_name='${loserName}' and wait_event='relation')`)
  const [first, second] = await Promise.all(sessions.map((item) => item.done))
  if (first.code !== 0 || second.code === 0 || !second.output.includes('Cell coordinates changed; refresh before moving'))
    throw new Error(`Concurrent move outcomes unexpected: ${JSON.stringify([first, second])}`)
  if (sql(`select path_id::text||':'||position from public.cells where id='${cell}'`) !== `${pathB}:1`
      || sql(`select count(*) from public.authoring_changes where fn='move_cell' and args->>'cell_id'='${cell}'`) !== '1')
    throw new Error('Concurrent read-back found the wrong destination or ledger count')
  console.log('[cell-move] concurrent stale move refused; one winner and one durable inverse: PASS')

  // An existing edge writer reads cell parents before its INSERT. Without
  // coordinated locks it can validate the old path, wait for the move, then
  // insert a cross-path edge. Prove refusal at that actual public seam.
  sql(`begin; ${auth} select public.move_cell('${cell}','${target}','${source}'); commit;`)
  const movingName = `${database}_moving`
  const edgeName = `${database}_edge`
  const moving = session(`begin; ${auth} select public.move_cell('${cell}','${source}','${target}'); select pg_sleep(4); commit;`, movingName)
  await waitFor(`select exists(select 1 from pg_stat_activity where application_name='${movingName}' and wait_event='PgSleep')`)
  const edge = session(`begin; ${auth} select public.set_cell_dependency('${cell}','${peer}'); commit;`, edgeName)
  await waitFor(`select exists(select 1 from pg_stat_activity where application_name='${edgeName}' and wait_event='relation')`)
  const [moveResult, edgeResult] = await Promise.all([moving.done, edge.done])
  if (moveResult.code !== 0 || edgeResult.code === 0 || !edgeResult.output.includes('Both cells must be in the same path of the journey'))
    throw new Error(`Concurrent edge/move outcomes unexpected: ${JSON.stringify([moveResult, edgeResult])}`)
  if (sql(`select count(*) from public.cell_dependencies where source_cell_id='${cell}' or target_cell_id='${cell}'`) !== '0')
    throw new Error('Concurrent edge writer left a cross-path dependency')
  console.log('[cell-move] concurrent edge writer rechecks moved parents and is refused: PASS')

  sql(`begin; ${auth} select public.move_cell('${cell}','${target}','${source}'); commit;`)
  sql(`insert into public.cell_dependencies(id,source_cell_id,target_cell_id) values('${edgeId}','${peer}','${anchor}');`)
  const movingAgainName = `${database}_moving_again`
  const updateName = `${database}_edge_update`
  const movingAgain = session(`begin; ${auth} select public.move_cell('${cell}','${source}','${target}'); select pg_sleep(4); commit;`, movingAgainName)
  await waitFor(`select exists(select 1 from pg_stat_activity where application_name='${movingAgainName}' and wait_event='PgSleep')`)
  const update = session(`begin; ${auth} select public.update_cell_dependency('${edgeId}','leads_to','${cell}',null); commit;`, updateName)
  await waitFor(`select exists(select 1 from pg_stat_activity where application_name='${updateName}' and wait_event='relation')`)
  const [movedAgain, updated] = await Promise.all([movingAgain.done, update.done])
  if (movedAgain.code !== 0 || updated.code === 0 || !updated.output.includes('Both cells must be in the same path of the journey'))
    throw new Error(`Concurrent edge-update/move outcomes unexpected: ${JSON.stringify([movedAgain, updated])}`)
  if (sql(`select target_cell_id from public.cell_dependencies where id='${edgeId}'`) !== anchor)
    throw new Error('Refused edge retargeting changed the existing edge')
  console.log('[cell-move] concurrent edge retargeting is refused and original edge preserved: PASS')
} finally {
  for (const { child } of sessions) if (child.exitCode === null) child.kill('SIGTERM')
  await Promise.allSettled(sessions.map((item) => item.done))
  execFileSync('dropdb', ['--if-exists', database], { cwd: root, env, stdio: 'inherit' })
  console.log(`[cell-move] disposed ${database}; no hosted connection used`)
}
