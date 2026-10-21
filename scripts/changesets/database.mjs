function checked(result) {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

/** All pagination is explicit: the hosted API's row cap is not an absence. */
export function createDatabase(client, modules) {
  const { cell, evidence, structure, placement, scenario, step, log, session } = modules
  let appendResults = []
  log.setAuthoringLogWriter((row) => {
    const promise = (async () => {
      if (!row.revert?.fn) throw new Error('Refusing an authoring append without an inverse')
      const id = checked(await client.rpc('record_authoring_change', row))
      if (!id) throw new Error('Authoring append returned no change id')
      return id
    })()
    // The UI deliberately swallows append failures. This command must wait
    // for them and stop, because its success includes durable read-back.
    appendResults.push(promise.then((id) => ({ id }), (error) => ({ error })))
    return promise
  })

  async function read(target) {
    const rows = []
    for (let offset = 0; ; offset += 500) {
      let query = client.from(target.table).select('*').order('id').range(offset, offset + 499)
      if (target.table === 'path_steps') {
        query = client.from(target.table).select('*').order('position').range(offset, offset + 499)
      }
      if (target.cell_key) query = query.eq('cell_key', target.cell_key)
      for (const [key, value] of Object.entries(target.where ?? {})) {
        query = value === null ? query.is(key, null) : query.eq(key, value)
      }
      // UUID has no LIKE operator. Read the scoped set, then match fragments
      // against the full id; never choose a first match from a limited page.
      const fullId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.id ?? '')
      if (fullId) query = query.eq('id', target.id)
      const page = checked(await query)
      rows.push(...page)
      if (page.length < 500) break
    }
    let matched = rows
    if (target.id) {
      const fragment = target.id.replace(/…|\.\.\./g, '*').toLowerCase()
      if (!/^[0-9a-f*-]+$/.test(fragment)) throw new Error('Expected a UUID, UUID prefix or …suffix')
      const expression = new RegExp(`^${fragment.split('*').join('.*')}${fragment.includes('*') ? '$' : ''}`, 'i')
      matched = rows.filter((row) => expression.test(row.id))
    }
    if (target.withSteps) {
      for (const row of matched) {
        const links = await read({ table: 'path_steps', where: { path_id: row.id } })
        row.step_ids = links.map((link) => link.step_id)
      }
    }
    return matched
  }

  async function one(table, id) {
    const rows = await read({ table, id })
    if (rows.length !== 1) throw new Error(`Expected one ${table} parent ${id}; found ${rows.length}`)
    return rows[0]
  }

  function contentValue(row) {
    return {
      content: row.content, summary: row.summary ?? '', owner: row.owner ?? '',
      perceivedOwner: row.perceived_owner ?? '', status: row.status,
    }
  }

  async function prepare(op, before) {
    if (op.operation === 'update_cell_content' && !before?.content?.trim())
      throw new Error(`${op.key}: the module cannot capture an inverse for a blank prior cell label`)
    const value = { ...op.target.where, ...before, ...op.value }
    const parents = {
      create_path_at_status: [['scenarios', 'scenario_id']],
      create_scenario: [['phases', 'phase_id']],
      upsert_cell_at_status: [['paths', 'path_id'], ['lanes', 'lane_id'], ['steps', 'step_id']],
      add_step: [['paths', 'path_id']],
      add_lane: [['scenarios', 'scenario_id']],
      add_evidence: [['services', 'service_id'], ['cells', 'cell_id']],
      set_cell_dependency: [['cells', 'source_cell_id'], ['cells', 'target_cell_id']],
    }
    for (const [table, field] of parents[op.operation] ?? []) {
      const id = value[field] ?? op.input?.[field]
      if (id && typeof id === 'object') continue // Created by a preceding operation.
      if (!id) throw new Error(`${op.key}: expected parent ${field}`)
      await one(table, id)
    }
    if (op.operation === 'upsert_cell_at_status') {
      if (!value.status || !value.content?.trim()) throw new Error('New cells require content and an explicit status')
      if (value.position !== 0) throw new Error('upsert_cell_at_status writes only position 0')
      if (typeof value.path_id === 'string' && typeof value.lane_id === 'string' && typeof value.step_id === 'string') {
        const path = await one('paths', value.path_id)
        const lane = await one('lanes', value.lane_id)
        const step = await one('steps', value.step_id)
        if (lane.path_id !== path.id || step.scenario_id !== path.scenario_id)
          throw new Error('Cell parents must belong to the same path and scenario')
      }
    }
    if (op.operation === 'create_path_at_status' && !value.status)
      throw new Error('New paths require an explicit status')
    if (op.operation === 'set_path_steps' && !Array.isArray(before?.step_ids))
      throw new Error('set_path_steps requires target.withSteps: true and expected.step_ids')
    if (op.operation === 'add_step' && !op.input?.path_id)
      throw new Error('add_step requires input.path_id')
    if (op.operation === 'add_lane' && !op.input?.scenario_id)
      throw new Error('add_lane requires input.scenario_id')
    if (op.operation === 'add_step' && typeof op.input.path_id === 'string') {
      const path = await one('paths', op.input.path_id)
      if (path.scenario_id !== value.scenario_id) throw new Error('Step parent path does not belong to the target scenario')
    }
    if (op.operation === 'add_lane' && typeof value.path_id === 'string' && typeof op.input.scenario_id === 'string') {
      const path = await one('paths', value.path_id)
      if (path.scenario_id !== op.input.scenario_id) throw new Error('Lane parent path does not belong to the target scenario')
    }
  }

  async function write(op, before) {
    appendResults = []
    const value = { ...op.target.where, ...before, ...op.value }
    const rpc = async (fn, args) => checked(await client.rpc(fn, args))
    let databaseChangeId
    switch (op.operation) {
      case 'update_cell_content':
        await cell.updateCellContent(client, before.id, contentValue(value), contentValue(before))
        break
      case 'add_evidence':
        await evidence.addEvidence(client, {
          serviceId: value.service_id, cellId: value.cell_id, cellKey: value.cell_key,
          kind: value.kind, title: value.title, note: value.note,
        })
        break
      case 'upsert_cell_at_status': {
        const result = await rpc('upsert_cell_at_status', {
          path_id: value.path_id, lane_id: value.lane_id, step_id: value.step_id,
          content: value.content, status: value.status,
        })
        if (!result?.id || !result.change_id) throw new Error('Cell RPC returned no row or durable change id')
        if (!result.inserted) throw new Error('Creation collided with an existing cell; inspect the RPC inverse before continuing')
        databaseChangeId = result.change_id
        if (Object.hasOwn(op.value, 'summary')) {
          const created = await one('cells', result.id)
          await cell.updateCellContent(client, result.id, contentValue({ ...created, summary: value.summary }), contentValue(created))
        }
        break
      }
      case 'create_path_at_status': {
        const id = await rpc('create_path_at_status', {
          scenario_id: value.scenario_id, name: value.name, kind: value.kind,
          status: value.status, lane_source_path_id: op.input?.lane_source_path_id ?? null,
        })
        if (!id) throw new Error('Path RPC returned no id')
        // This RPC records itself atomically but returns only the created id.
        const logs = await read({ table: 'authoring_changes', where: { fn: 'create_path_at_status' } })
        const matched = logs.filter((row) => row.revert?.args?.path_id === id)
        if (matched.length !== 1) throw new Error('Cannot identify the created path’s durable inverse')
        databaseChangeId = matched[0].id
        if (Object.hasOwn(op.value, 'summary') || Object.hasOwn(op.value, 'note')) {
          const created = await one('paths', id)
          await scenario.updatePathSpec(client, id,
            { summary: value.summary ?? '', note: value.note ?? '', status: value.status },
            { summary: created.summary ?? '', note: created.note ?? '', status: created.status },
          )
        }
        break
      }
      case 'set_path_status': {
        const result = await rpc('set_path_status', { path_id: before.id, status: value.status })
        databaseChangeId = result?.change_id
        if (!databaseChangeId) throw new Error('Path status RPC returned no durable change id')
        break
      }
      case 'create_scenario': {
        const created = await structure.createScenario(client, {
          phaseId: value.phase_id, name: value.name, layout: value.layout,
          laneSourcePathId: op.input?.lane_source_path_id,
          laneSet: op.input?.lane_set, stepCount: op.input?.step_count ?? 0,
          pathName: op.input?.path_name,
        })
        if (Object.hasOwn(op.value, 'summary'))
          await scenario.updateScenarioSummary(client, created.scenario_id, value.summary ?? '', '')
        break
      }
      case 'add_step': {
        const id = await structure.addStep(client, {
          pathId: op.input.path_id, name: value.name, atPosition: op.input.at_position,
        })
        if (Object.hasOwn(op.value, 'summary')) await step.updateStepSummary(client, id, value.summary ?? '', '')
        break
      }
      case 'add_lane':
        await structure.addLane(client, {
          scenarioId: op.input.scenario_id, name: value.name, laneRole: value.lane_role,
          atPosition: op.input.at_position,
        })
        break
      case 'set_path_steps': {
        // The published wrapper does not accept the previous order. The same
        // operation with an explicit recordChange retains the complete inverse.
        const args = { path_id: before.id, step_ids: value.step_ids }
        await rpc('set_path_steps', args)
        session.recordChange('set_path_steps', args, {
          fn: 'set_path_steps', args: { path_id: before.id, step_ids: before.step_ids },
        })
        break
      }
      case 'set_cell_dependency':
        await structure.setCellDependency(client, {
          sourceCellId: value.source_cell_id, targetCellId: value.target_cell_id,
          kind: value.kind, name: value.name, note: value.note,
        })
        break
      case 'set_placement_touchpoint':
        await placement.setPlacementTouchpoint(client,
          { id: before.id, cellId: before.cell_id, name: before.name ?? '' },
          value.touchpoint_id ? { touchpointId: value.touchpoint_id } : { name: value.name },
        )
        break
      case 'update_path_spec': {
        const convert = (row) => ({ summary: row.summary ?? '', note: row.note ?? '', status: row.status })
        await scenario.updatePathSpec(client, before.id, convert(value), convert(before))
        break
      }
      case 'update_scenario_spec':
        await scenario.updateScenarioSummary(client, before.id, value.summary ?? '', before.summary ?? '')
        break
      case 'update_step_spec':
        await step.updateStepSummary(client, before.id, value.summary ?? '', before.summary ?? '')
        break
      default:
        throw new Error(`Unsupported operation ${op.operation}`)
    }
    const results = await Promise.all(appendResults)
    const failed = results.find((result) => result.error)
    if (failed) throw new Error(`Durable append failed after write: ${failed.error.message}`)
    const changeIds = [...results.map((result) => result.id), ...(databaseChangeId ? [databaseChangeId] : [])]
    if (!changeIds.length) throw new Error('Write produced no durable changes')
    return { changeIds }
  }

  async function auditCount() {
    const result = await client.from('authoring_changes').select('id', { head: true, count: 'exact' })
    checked(result)
    if (result.count === null) throw new Error('Cannot read durable change count')
    return result.count
  }
  return { read, prepare, write, auditCount, close: () => log.setAuthoringLogWriter(null) }
}
